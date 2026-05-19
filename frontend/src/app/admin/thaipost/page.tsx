"use client";

import api from "@/lib/api";
import { ThailandPostAcceptance, PaginatedResponse } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Lock, Truck, Info } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import clsx from "clsx";

const SOURCE_COLORS: Record<string, string> = {
  zip_extracted: "bg-yellow-100 text-yellow-700",
  direct: "bg-blue-100 text-blue-700",
  excel_upload: "bg-green-100 text-green-700",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function fmtNum(n: number | null, decimals = 2) {
  if (n == null) return "—";
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function ThaipostPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<
    PaginatedResponse<ThailandPostAcceptance>
  >({
    queryKey: ["thaipost", search, sourceType, page],
    queryFn: () =>
      api
        .get("/thaipost", {
          params: { search, file_source_type: sourceType, page, per_page: 20 },
        })
        .then((r) => r.data),
    enabled: can("thaipost.view"),
  });

  if (!can("thaipost.view")) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Lock className="w-12 h-12 mb-3" />
        <p className="font-medium">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    );
  }

  const items = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-800">Files Data</h1>
          <div className="relative group flex items-center">
            <Info className="w-4 h-4 text-slate-400 hover:text-slate-650 cursor-pointer transition-colors" />
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block w-64 bg-slate-900 text-slate-100 text-xs rounded-lg py-2 px-3 shadow-xl z-20 pointer-events-none border border-slate-800 text-center font-normal leading-normal">
                แสดงข้อมูลรายละเอียดไฟล์ที่ถูกนำเข้า 
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
            </div>
          </div>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total?.toLocaleString("th-TH") ?? 0} รายการ
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Barcode, ชื่อผู้รับ, ผู้ส่ง, TR No..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={sourceType}
          onChange={(e) => {
            setSourceType(e.target.value);
            setPage(1);
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ทุกประเภท</option>
          <option value="zip_extracted">Zip Extracted</option>
          <option value="direct">Direct</option>
          <option value="excel_upload">excel_upload</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[1400px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                Barcode
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                หมายเลข TR
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                วันเวลาที่รับฝาก
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                ผู้ฝากส่ง
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                ผู้รับ
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                เบอร์ผู้รับ
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                ปลายทาง
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                รหัสปลายทาง
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                ชื่อปลายทาง
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                บริการ
              </th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">
                น้ำหนัก (g)
              </th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">
                ค่าบริการ
              </th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">
                COD
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                เบอร์ Wallet
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                ที่ทำการ
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                แหล่งข้อมูล
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                รหัสไฟล์
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                นำเข้า
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(18)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={18}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 whitespace-nowrap">
                    {item.barcode ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {item.tr_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {fmtDate(item.deposit_datetime)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {item.sender_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {item.recipient_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {item.recipient_phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {item.destination ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {item.destination_code ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {item.destination_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {item.service_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-right text-slate-600">
                    {fmtNum(item.weight_grams, 0)}
                  </td>
                  <td className="px-4 py-3 text-xs text-right text-slate-700">
                    {fmtNum(item.service_fee)}
                  </td>
                  <td className="px-4 py-3 text-xs text-right text-slate-700">
                    {fmtNum(item.cod_amount)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {item.wallet_phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {item.office_name ?? item.office_code ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {item.file_source_type ? (
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-medium",
                          SOURCE_COLORS[item.file_source_type] ??
                            "bg-slate-100 text-slate-600",
                        )}
                      >
                        {item.file_source_type}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {item.parent_file_id}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {fmtDate(item.imported_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && data.last_page > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>
              หน้า {data.current_page} จาก {data.last_page} (ทั้งหมด{" "}
              {data.total?.toLocaleString("th-TH")} รายการ)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50"
              >
                ก่อนหน้า
              </button>
              <button
                disabled={page === data.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
