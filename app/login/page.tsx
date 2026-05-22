"use client";

import React, { useState } from "react";
import { LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError("비밀번호가 올바르지 않습니다.");
        setIsLoading(false);
        return;
      }

      window.location.href = "/";
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-6 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-xl items-center justify-center">
        <section className="w-full rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-100">
          <p className="mb-3 text-sm tracking-[0.24em] text-slate-500">FRONT2LINE</p>
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">Access Restricted</h1>
          <p className="mt-4 text-slate-600">
            자사몰 제품별/기간별 매출 변화 트래킹은 내부 구성원 전용 페이지입니다.
            비밀번호를 입력해주세요.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-600">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-lg outline-none focus:border-slate-900"
                placeholder="비밀번호 입력"
                autoFocus
              />
            </label>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {isLoading ? "확인 중..." : "Enter"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
