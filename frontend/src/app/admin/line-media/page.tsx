"use client";

import api from "@/lib/api";
import { LineGroupMedia, PaginatedResponse } from "@/lib/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Search, Lock, Image, Film, ExternalLink, Trash2,
  X, RotateCcw, Upload, User,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import clsx from "clsx";

const CONTENT_COLORS: Record<string, string> = {
  image: "bg-purple-100 text-purple-700",
  video: "bg-blue-100 text-blue-700",
  audio: "bg-green-100 text-green-700",
};

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,audio/mpeg,audio/mp4,audio/aac";

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

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importGroupId, setImportGroupId] = useState("");
  const [importDragOver, setImportDragOver] = useState(false);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const importMutation = useMutation({
    mutationFn: (fd: FormData) => api.post("/line-media", fd, { headers: { "Content-Type": undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["line-media"] });
      setShowImport(false);
      setImportFiles([]);
      setImportGroupId("");
      setImportError("");
    },
    onError: (err: any) => {
      setImportError(err?.response?.data?.message ?? "เกิดข้อผิดพลาดขณะอัปโหลด");
    },
  });

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    setImportFiles((prev) => {
      const names = new Set(prev.map((f) => f.name + f.size));
      const deduped = arr.filter((f) => !names.has(f.name + f.size));
      return [...prev, ...deduped].slice(0, 30);
    });
  }

  function removeFile(index: number) {
    setImportFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleImportSubmit() {
    if (importFiles.length === 0) { setImportError("กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์"); return; }
    setImportError("");
    const fd = new FormData();
    importFiles.forEach((f) => fd.append("files[]", f));
    if (importGroupId.trim()) fd.append("group_id", importGroupId.trim());
    importMutation.mutate(fd);
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setImportDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  function closeImport() {
    if (importMutation.isPending) return;
    setShowImport(false);
    setImportFiles([]);
    setImportGroupId("");
    setImportError("");
  }

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">รายการสื่อ LINE (Media)</h1>
          <p className="text-slate-500 text-sm mt-1">ทั้งหมด {data?.total ?? 0} รายการ</p>
        </div>
        {can("line-media.import") && (
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            นำเข้าไฟล์
          </button>
        )}
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
                  <td className="px-4 py-3 max-w-[160px]">
                    <p className="font-mono text-xs text-slate-600 truncate">{item.message_id}</p>
                    {item.imported_by && (
                      <p className="flex items-center gap-1 text-[10px] text-indigo-500 mt-0.5">
                        <User className="w-2.5 h-2.5" />
                        {item.imported_by}
                      </p>
                    )}
                  </td>
                  {/* Group ID */}
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-[160px] truncate">
                    {item.group_id}
                  </td>
                  {/* Type */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={clsx(
                          "inline-flex px-2.5 py-1 rounded-full text-xs font-medium w-fit",
                          CONTENT_COLORS[item.content_type] ?? "bg-slate-100 text-slate-600"
                        )}
                      >
                        {item.content_type}
                        {item.file_extension && (
                          <span className="ml-1 opacity-70">.{item.file_extension}</span>
                        )}
                      </span>
                      {item.imported_by && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 w-fit">
                          Manual
                        </span>
                      )}
                    </div>
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

      {/* Import Modal */}
      {showImport && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeImport}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-semibold text-slate-800">นำเข้าไฟล์สื่อแบบ Manual</h2>
              </div>
              <button onClick={closeImport} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
                onDragLeave={() => setImportDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                  "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                  importDragOver
                    ? "border-blue-400 bg-blue-50"
                    : importFiles.length > 0
                    ? "border-green-400 bg-green-50"
                    : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
                />
                <Upload className={clsx("w-7 h-7 mx-auto mb-2", importFiles.length > 0 ? "text-green-500" : "text-slate-300")} />
                <p className="text-sm text-slate-500">
                  วางไฟล์ที่นี่ หรือ <span className="text-blue-600 font-medium">คลิกเลือกไฟล์</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">JPG, PNG, GIF, WebP, MP4, MOV, MP3, M4A, AAC — ไม่เกิน 100 MB/ไฟล์ · สูงสุด 30 ไฟล์</p>
              </div>

              {/* File list */}
              {importFiles.length > 0 && (
                <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {importFiles.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <span className="flex-1 text-xs text-slate-700 font-mono truncate">{f.name}</span>
                      <span className="text-xs text-slate-400 shrink-0">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Group ID */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Group ID <span className="text-slate-400 font-normal">(ไม่บังคับ — ใช้ "manual" ถ้าไม่ระบุ)</span>
                </label>
                <input
                  value={importGroupId}
                  onChange={(e) => setImportGroupId(e.target.value)}
                  placeholder="C1234567890abcdef... (ไม่บังคับ)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {importError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {importError}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={closeImport}
                disabled={importMutation.isPending}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleImportSubmit}
                disabled={importMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {importMutation.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    กำลังอัปโหลด...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    นำเข้า{importFiles.length > 0 ? ` ${importFiles.length} ไฟล์` : "ไฟล์"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
