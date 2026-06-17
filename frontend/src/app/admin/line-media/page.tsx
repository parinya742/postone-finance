"use client";

import api from "@/lib/api";
import { LineGroupMedia, PaginatedResponse } from "@/lib/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Lock, Image, Film, ExternalLink, Trash2, X, RotateCcw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import clsx from "clsx";

const CONTENT_COLORS: Record<string, string> = {
  image: "bg-purple-100 text-purple-700",
  video: "bg-blue-100 text-blue-700",
  audio: "bg-green-100 text-green-700",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d.includes("T") ? d : d.replace(" ", "T"));
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

function fmtDuration(ms: number | null) {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}

type PreviewItem = LineGroupMedia | null;

export default function LineMediaPage() {
  const { can } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [contentType, setContentType] = useState("");
  const [trashed, setTrashed] = useState("without");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<PreviewItem>(null);

  const resetPage = () => setPage(1);

  const { data, isLoading } = useQuery<PaginatedResponse<LineGroupMedia>>({
    queryKey: ["line-media", search, contentType, trashed, page],
    queryFn: () =>
      api
        .get("/line-media", {
          params: { search, content_type: contentType || undefined, trashed, page, per_page: 20 },
        })
        .then((r) => r.data),
    enabled: can("line-media.view"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/line-media/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["line-media"] }),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/line-media/${id}/restore`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["line-media"] }),
  });

  if (!can("line-media.view")) {
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
        <h1 className="text-2xl font-bold text-slate-800">รายการสื่อ LINE (Media)</h1>
        <p className="text-slate-500 text-sm mt-1">ทั้งหมด {data?.total ?? 0} รายการ</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Group ID, Message ID..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={contentType}
          onChange={(e) => { setContentType(e.target.value); resetPage(); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ทุกประเภท</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
        </select>
        <select
          value={trashed}
          onChange={(e) => { setTrashed(e.target.value); resetPage(); }}
          className={clsx(
            "border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
            trashed === "only"
              ? "border-red-300 bg-red-50 text-red-700"
              : trashed === "with"
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-slate-300"
          )}
        >
          <option value="without">แสดงเฉพาะปกติ</option>
          <option value="only">แสดงเฉพาะที่ถูกลบ</option>
          <option value="with">แสดงทั้งหมด</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-16">Preview</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Message ID</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Group ID</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">ประเภท</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">ขนาด / ระยะเวลา</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">วันที่</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <Image className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  {/* Thumbnail */}
                  <td className="px-4 py-3">
                    {item.content_type === "image" ? (
                      <button onClick={() => setPreview(item)} className="block">
                        <img
                          src={item.file_url}
                          alt={item.message_id}
                          className="w-12 h-12 object-cover rounded border border-slate-200 hover:opacity-80 transition-opacity"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded border border-slate-200 bg-slate-100 flex items-center justify-center">
                        <Film className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                  </td>
                  {/* Message ID */}
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 max-w-[160px] truncate">
                    {item.message_id}
                  </td>
                  {/* Group ID */}
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-[160px] truncate">
                    {item.group_id}
                  </td>
                  {/* Type */}
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "px-2.5 py-1 rounded-full text-xs font-medium",
                        CONTENT_COLORS[item.content_type] ?? "bg-slate-100 text-slate-600"
                      )}
                    >
                      {item.content_type}
                      {item.file_extension && (
                        <span className="ml-1 opacity-70">.{item.file_extension}</span>
                      )}
                    </span>
                  </td>
                  {/* Size / Duration */}
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {item.content_type === "image" && item.width && item.height
                      ? `${item.width} × ${item.height}`
                      : item.content_type === "video" || item.content_type === "audio"
                      ? fmtDuration(item.duration_ms)
                      : "—"}
                  </td>
                  {/* Date */}
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {fmtDate(item.created_at)}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {item.deleted_at ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                          ถูกลบ
                        </span>
                      ) : (
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="เปิดไฟล์"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      {can("line-media.delete") && (
                        item.deleted_at ? (
                          <button
                            onClick={() => restoreMutation.mutate(item.id)}
                            disabled={restoreMutation.isPending}
                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-40"
                            title="กู้คืน"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm("ลบรายการนี้?")) deleteMutation.mutate(item.id);
                            }}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && data.last_page > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>หน้า {data.current_page} จาก {data.last_page}</span>
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

      {/* Image Preview Modal */}
      {preview && preview.content_type === "image" && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={preview.file_url}
              alt={preview.message_id}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
            <p className="mt-2 text-center text-white/60 text-xs font-mono">{preview.message_id}</p>
          </div>
        </div>
      )}
    </div>
  );
}
