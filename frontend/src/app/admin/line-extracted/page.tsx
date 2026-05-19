"use client";

import api from "@/lib/api";
import { LineGroupExtractedFile, PaginatedResponse } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Lock, FileText, ExternalLink, Info } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import clsx from "clsx";

const TYPE_COLORS: Record<string, string> = {
  thailand_post: "bg-amber-100 text-amber-700",
  image: "bg-purple-100 text-purple-700",
  document: "bg-blue-100 text-blue-700",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function LineExtractedPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<
    PaginatedResponse<LineGroupExtractedFile>
  >({
    queryKey: ["line-extracted", search, typeFilter, page],
    queryFn: () =>
      api
        .get("/line-extracted", {
          params: { search, file_type: typeFilter, page, per_page: 20 },
        })
        .then((r) => r.data),
    enabled: can("line-files.view"),
  });

  if (!can("line-files.view")) {
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
          <h1 className="text-2xl font-bold text-slate-800">
            Extracted Header Files
          </h1>
          <div className="relative group flex items-center">
            <Info className="w-4 h-4 text-slate-400 hover:text-slate-650 cursor-pointer transition-colors" />
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block w-64 bg-slate-900 text-slate-100 text-xs rounded-lg py-2 px-3 shadow-xl z-20 pointer-events-none border border-slate-800 text-center font-normal leading-normal">
                แสดงข้อมูลไฟล์ที่ถูกนำเข้าในรูปแบบ .zip โดยจะแสดงรายการไฟล์ทั้งหมดที่อยู่ภายในไฟล์ .zip ที่ถูก Import เข้ามา
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
            </div>
          </div>
        </div>

        <p className="text-slate-500 text-sm mt-1">
          ทั้งหมด {data?.total ?? 0} ไฟล์
        </p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="ชื่อไฟล์, Message ID..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ทุกประเภท</option>
          <option value="thailand_post">Thailand Post</option>
          <option value="image">Image</option>
          <option value="document">Document</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-slate-600">
                ID
              </th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">
                ชื่อไฟล์
              </th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">
                ประเภท
              </th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">
                ต้นทาง (Parent)
              </th>
              <th className="text-left px-5 py-3 font-medium text-slate-600">
                วันที่
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-5 py-4 text-slate-400 text-xs font-mono">
                    {item.id}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-800 truncate max-w-[200px]">
                      {item.file_name ?? "—"}
                    </p>
                    {item.file_extension && (
                      <span className="text-xs text-slate-400 font-mono">
                        .{item.file_extension}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {item.file_type ? (
                      <span
                        className={clsx(
                          "px-2.5 py-1 rounded-full text-xs font-medium",
                          TYPE_COLORS[item.file_type] ??
                            "bg-slate-100 text-slate-600",
                        )}
                      >
                        {item.file_type}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs truncate max-w-[180px]">
                    {item.parent_file?.original_file_name ??
                      (item.parent_file_id ? `#${item.parent_file_id}` : "—")}
                  </td>
                  <td className="px-5 py-4 text-slate-400 text-xs">
                    {fmtDate(item.created_at)}
                  </td>
                  <td className="px-5 py-4">
                    {item.s3_url && (
                      <a
                        href={item.s3_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors inline-flex"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && data.last_page > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>
              หน้า {data.current_page} จาก {data.last_page}
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
