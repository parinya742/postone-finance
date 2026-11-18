<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\QueriesReportTables;
use App\Http\Controllers\Controller;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * MT — HP-MH RTV: product lines read out of the return slip PDFs (hpmh_rtv.return_slip_extract_item),
 * one row per line, plus summaries. Only slips that have been processed are included (see ReturnSlipExtractService).
 *
 * Quantities and amounts are "net": reversals — MVT 162 (of a 161 return) and 123 (of a 122 return delivery) —
 * count negative, so a return and its cancellation add up to zero.
 */
class HpmhRtvReturnItemController extends Controller
{
    use QueriesReportTables;

    private const REVERSAL = "i.mvt IN ('162', '123')";

    private const NET_QTY = 'CASE WHEN ' . self::REVERSAL . ' THEN -i.qty ELSE i.qty END';

    private const NET_AMOUNT = 'CASE WHEN ' . self::REVERSAL . ' THEN -i.amount ELSE i.amount END';

    private const GROUPS = ['article', 'reason', 'site', 'buyer', 'month'];

    private function base(Request $request): Builder
    {
        $q = DB::connection('hpmh_rtv')->table('return_slip_extract_item as i')
            ->join('return_slip_extract as e', 'e.id', '=', 'i.extract_id')
            ->where('e.status', '<>', 'error');

        if ($request->filled('vendor_no')) {
            $q->where('e.vendor_no', $request->vendor_no);
        }
        foreach (['site_code' => 'e.site_code', 'buyer_code' => 'e.buyer_code', 'mvt' => 'i.mvt', 'article' => 'i.article'] as $param => $col) {
            if ($request->filled($param)) {
                $q->where($col, $request->input($param));
            }
        }
        if ($request->filled('reason')) {
            $request->reason === '-' ? $q->whereNull('i.return_reason') : $q->where('i.return_reason', $request->reason);
        }
        if ($request->boolean('reversal')) {
            $q->whereNotNull('i.reversed_doc_no');
        }
        $this->applyDateRange($q, $request, 'e.doc_date');
        $this->applySearch($q, $request, [
            'e.article_doc_no', 'i.article', 'i.vd_part', 'i.description', 'i.po_no', 'i.return_reason', 'i.reversed_doc_no', 'e.site',
        ]);

        return $q;
    }

    public function index(Request $request): JsonResponse
    {
        $q = $this->base($request)->select(
            'i.id', 'i.item_no', 'i.vd_part', 'i.article', 'i.batch', 'i.po_no', 'i.po_item', 'i.mvt', 'i.unit',
            'i.qty', 'i.base_qty', 'i.base_unit', 'i.price', 'i.amount', 'i.description', 'i.description_pdf',
            'i.return_reason', 'i.reversed_doc_no', 'i.remarks', 'i.page',
            'e.document_id', 'e.article_doc_no', 'e.fiscal_year', 'e.doc_date', 'e.site_code', 'e.site',
            'e.buyer_code', 'e.buyer_name', 'e.gr_text', 'e.status as extract_status',
        );

        return $this->paginateWithTotals(
            $q, $request,
            ['qty' => self::NET_QTY, 'amount' => self::NET_AMOUNT],
            ['e.doc_date' => 'desc', 'e.article_doc_no' => 'desc', 'i.item_no' => 'asc']
        );
    }

    /** Totals grouped by product / return reason / branch / buyer / month (same filters as the list). */
    public function summary(Request $request): JsonResponse
    {
        $group = in_array($request->input('group'), self::GROUPS, true) ? $request->input('group') : 'article';

        [$key, $label] = match ($group) {
            'article' => ['i.article', 'MAX(i.description)'],
            'reason' => ["COALESCE(i.return_reason, '-')", 'NULL'],
            'site' => ['e.site_code', 'MAX(e.site)'],
            'buyer' => ['e.buyer_code', 'MAX(e.buyer_name)'],
            'month' => ["TO_CHAR(e.doc_date, 'YYYY-MM')", 'NULL'],
        };

        $rows = $this->base($request)
            ->selectRaw("{$key} as key, {$label} as label")
            ->selectRaw($group === 'article' ? 'MAX(i.vd_part) as extra' : 'NULL as extra')
            ->selectRaw('COUNT(DISTINCT e.id) as docs, COUNT(*) as lines')
            ->selectRaw('SUM(' . self::NET_QTY . ') as qty, SUM(' . self::NET_AMOUNT . ') as amount')
            ->selectRaw('COALESCE(SUM(i.amount) FILTER (WHERE ' . self::REVERSAL . '), 0) as cancelled_amount')
            ->groupByRaw($key)
            ->when($group === 'month', fn ($q) => $q->orderByRaw("{$key} DESC"), fn ($q) => $q->orderByDesc('amount'))
            ->limit(2000)
            ->get();

        return response()->json([
            'group' => $group,
            'rows' => $rows,
            'totals' => [
                'docs' => $this->base($request)->distinct()->count('e.id'),
                'lines' => $rows->sum('lines'),
                'qty' => round((float) $rows->sum('qty'), 3),
                'amount' => round((float) $rows->sum('amount'), 2),
            ],
        ]);
    }

    public function options(Request $request): JsonResponse
    {
        $base = fn () => DB::connection('hpmh_rtv')->table('return_slip_extract_item as i')
            ->join('return_slip_extract as e', 'e.id', '=', 'i.extract_id')
            ->where('e.status', '<>', 'error')
            ->when($request->filled('vendor_no'), fn ($q) => $q->where('e.vendor_no', $request->vendor_no));

        return response()->json([
            'sites' => $base()->select('e.site_code', DB::raw('MAX(e.site) as site'))->whereNotNull('e.site_code')
                ->groupBy('e.site_code')->orderBy('e.site_code')->get(),
            'buyers' => $base()->select('e.buyer_code', DB::raw('MAX(e.buyer_name) as buyer_name'))->whereNotNull('e.buyer_code')
                ->groupBy('e.buyer_code')->orderBy('e.buyer_code')->get(),
            'reasons' => $base()->selectRaw("COALESCE(i.return_reason, '-') as reason, COUNT(*) as lines")
                ->groupByRaw("COALESCE(i.return_reason, '-')")->orderByDesc('lines')->get(),
            'mvts' => $base()->whereNotNull('i.mvt')->distinct()->orderBy('i.mvt')->pluck('i.mvt'),
        ]);
    }
}
