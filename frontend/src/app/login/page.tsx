"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("remember_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "session_expired") setSessionExpired(true);
  }, []);

  useEffect(() => {
    if (user) router.push("/admin");
  }, [user, router]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      if (rememberMe) {
        localStorage.setItem("remember_email", email);
      } else {
        localStorage.removeItem("remember_email");
      }
      router.push("/admin");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setError(msg ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F5F5F5]">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#354A5E] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <img
            src="/pumpkin.png"
            alt="POSTONE Logo"
            className="w-9 h-9 object-contain"
          />
          <div>
            <p className="font-bold text-white text-sm tracking-wide">
              Report
            </p>
            <p className="text-[#ACC7D9] text-[10px] uppercase tracking-widest">
              Finance
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-white leading-tight">
            ระบบจัดการ
            <br />
            <span className="text-[#ACC7D9]">Report</span>
          </h2>
          <p className="text-white/50 mt-4 text-sm leading-relaxed max-w-sm">
            ระบบสำหรับจัดการรายงานไปรษณีย์ 
          </p>

          <div className="flex gap-6 mt-10">
            {[
              { label: "Roles", value: "5" },
              { label: "Modules", value: "8" },
              { label: "Permissions", value: "34+" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-white/50 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-xs">
          © 2026 Postone Finance. All rights reserved.
        </p>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img
              src="/pumpkin.png"
              alt="POSTONE Logo"
              className="w-9 h-9 object-contain"
            />
            <div>
              <p className="font-bold text-slate-800 text-sm">
                Report Finance
              </p>
            </div>
          </div>

          <div className="bg-white rounded shadow-lg border border-[#D9D9D9] p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#32363A]">เข้าสู่ระบบ</h1>
              <p className="text-[#6A6D70] text-sm mt-1">
                กรอกข้อมูลเพื่อเข้าใช้งานระบบ
              </p>
            </div>

            {sessionExpired && (
              <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex items-start gap-2">
                <span className="mt-0.5">⚠</span>
                <span>เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่</span>
              </div>
            )}

            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
                <span className="mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
              <div>
                <label className="block text-sm font-medium text-[#32363A] mb-1.5">
                  อีเมล
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  className="w-full border border-[#D9D9D9] rounded px-3.5 py-2.5 text-sm text-[#32363A] focus:outline-none focus:ring-2 focus:ring-[#0070F2] focus:border-transparent transition-all placeholder:text-[#6A6D70]"
                  placeholder="email@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#32363A] mb-1.5">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full border border-[#D9D9D9] rounded px-3.5 py-2.5 pr-10 text-sm text-[#32363A] focus:outline-none focus:ring-2 focus:ring-[#0070F2] focus:border-transparent transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-[#32363A]">จดจำอีเมล</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0070F2] hover:bg-[#0064D9] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded py-2.5 text-sm transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    กำลังเข้าสู่ระบบ...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    เข้าสู่ระบบ
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-[#6A6D70] mt-6">
            Postone Finance v1.0 — Secure Access
          </p>
        </div>
      </div>
    </div>
  );
}
