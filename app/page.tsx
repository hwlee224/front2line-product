"use client";

import React, { useEffect, useRef, useState } from "react";
import { Upload, Download, RefreshCw, Settings2, Sparkles } from "lucide-react";
import { dayCount, money, rateText, salesMoney, valueColor } from "@/lib/utils";

type ResultRow = {
  product: string;
  salesA: number;
  salesB: number;
  salesC: number;
  averageSales: number;
};

type AiInsight = {
  text: string;
  analyzed_at: string;
};

function statusLabel(rate: number | null) {
  if (rate !== null && rate >= 0.2)
    return (
      <span className="rounded-full bg-[#FFF0EE] px-3 py-1 text-xs font-semibold text-[#E8341C]">
        급상승
      </span>
    );
  if (rate !== null && rate <= -0.2)
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
        급하락
      </span>
    );
  return (
    <span className="rounded-full bg-[#F5F5F5] px-3 py-1 text-xs text-slate-400">
      유지
    </span>
  );
}

function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export default function Page() {
  const [comparisonMode, setComparisonMode] = useState("2");
  const [periods, setPeriods] = useState({
    A: { start: "2026-05-05", end: "2026-05-12" },
    B: { start: "2026-05-13", end: "2026-05-20" },
    C: { start: "2026-05-21", end: "2026-05-28" },
  });
  const [productColumn, setProductColumn] = useState("B");
  const [salesColumn, setSalesColumn] = useState("I");
  const [overwrite, setOverwrite] = useState(false);
  const [keywordsText, setKeywordsText] = useState("[이청아 착용], [앵콜 반다]");
  const [uploadResults, setUploadResults] = useState<any[]>([]);
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const didInitRef = useRef(false);

  const activePeriods = comparisonMode === "3" ? ["A", "B", "C"] : ["A", "B"];

  async function loadSettings() {
    const res = await fetch("/api/settings/merge-keywords");
    const data = await res.json();
    if (Array.isArray(data.keywords)) setKeywordsText(data.keywords.join(", "));
  }

  async function saveSettings() {
    const keywords = keywordsText.split(",").map((x) => x.trim()).filter(Boolean);
    const res = await fetch("/api/settings/merge-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "합산 키워드 저장 중 오류가 발생했습니다.");
      return;
    }
    alert("합산 키워드를 저장하고 기존 데이터까지 다시 정리했습니다. 새로 조회를 눌러주세요.");
    await querySales();
    await loadDates();
  }

  async function loadDates() {
    const res = await fetch("/api/sales/dates");
    const data = await res.json();
    setSavedDates(data.dates || []);
  }

  async function querySales() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/sales/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comparisonMode, periods }),
      });
      const data = await res.json();
      setRows(data.rows || []);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchAiInsight() {
    try {
      const res = await fetch("/api/analyze");
      if (res.ok) {
        const data = await res.json();
        if (data.text) setAiInsight(data);
      }
    } catch {}
  }

  async function triggerAnalysis() {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.text) setAiInsight(data);
        else alert(data.error || "분석 결과를 받지 못했습니다.");
      } else {
        const data = await res.json();
        alert(data.error || "분석 중 오류가 발생했습니다.");
      }
    } catch {
      alert("분석 중 오류가 발생했습니다. API 키를 확인해주세요.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  useEffect(() => {
    loadSettings();
    loadDates();
    fetchAiInsight();
  }, []);

  useEffect(() => {
    querySales();
  }, [comparisonMode, periods]);

  useEffect(() => {
    if (!didInitRef.current && savedDates.length > 0) {
      didInitRef.current = true;
      quickCompare("2");
    }
  }, [savedDates]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setIsUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("productColumn", productColumn);
    formData.append("salesColumn", salesColumn);
    formData.append("overwrite", overwrite ? "true" : "false");
    try {
      const res = await fetch("/api/sales/upload", { method: "POST", body: formData });
      const data = await res.json();
      setUploadResults(data.results || []);
      await loadDates();
      await querySales();
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  function quickCompare(kind: "2" | "3" | "7" | "14" | "30") {
    const latest = savedDates[0];
    if (!latest) return;
    if (kind === "2") {
      const a = addDays(latest, -1);
      setComparisonMode("2");
      setPeriods((prev) => ({ ...prev, A: { start: a, end: a }, B: { start: latest, end: latest } }));
      return;
    }
    if (kind === "3") {
      const a = addDays(latest, -2);
      const b = addDays(latest, -1);
      setComparisonMode("3");
      setPeriods((prev) => ({ ...prev, A: { start: a, end: a }, B: { start: b, end: b }, C: { start: latest, end: latest } }));
      return;
    }
    const n = Number(kind);
    const bEnd = latest;
    const bStart = addDays(latest, -(n - 1));
    const aEnd = addDays(latest, -n);
    const aStart = addDays(latest, -(2 * n - 1));
    setComparisonMode("2");
    setPeriods((prev) => ({ ...prev, A: { start: aStart, end: aEnd }, B: { start: bStart, end: bEnd } }));
  }

  function updatePeriod(key: "A" | "B" | "C", field: "start" | "end", value: string) {
    setPeriods((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  const filteredRows = rows.filter((row) =>
    row.product.toLowerCase().includes(keyword.toLowerCase())
  );

  const computedRows = filteredRows.map((row) => {
    const diffAB = row.salesB - row.salesA;
    const rateAB = row.salesA ? diffAB / row.salesA : null;
    const avgDiffAB =
      row.salesB / dayCount(periods.B.start, periods.B.end) -
      row.salesA / dayCount(periods.A.start, periods.A.end);
    const diffBC = row.salesC - row.salesB;
    const rateBC = row.salesB ? diffBC / row.salesB : null;
    const avgDiffBC =
      row.salesC / dayCount(periods.C.start, periods.C.end) -
      row.salesB / dayCount(periods.B.start, periods.B.end);
    return { ...row, diffAB, rateAB, avgDiffAB, diffBC, rateBC, avgDiffBC };
  });

  const totals = computedRows.reduce(
    (acc, row) => {
      acc.salesA += row.salesA;
      acc.salesB += row.salesB;
      acc.salesC += row.salesC;
      return acc;
    },
    { salesA: 0, salesB: 0, salesC: 0 } as any
  );
  totals.diffAB = totals.salesB - totals.salesA;
  totals.rateAB = totals.salesA ? totals.diffAB / totals.salesA : null;
  totals.avgDiffAB =
    totals.salesB / dayCount(periods.B.start, periods.B.end) -
    totals.salesA / dayCount(periods.A.start, periods.A.end);
  totals.diffBC = totals.salesC - totals.salesB;
  totals.rateBC = totals.salesB ? totals.diffBC / totals.salesB : null;
  totals.avgDiffBC =
    totals.salesC / dayCount(periods.C.start, periods.C.end) -
    totals.salesB / dayCount(periods.B.start, periods.B.end);

  function downloadCsv() {
    const header =
      comparisonMode === "3"
        ? ["제품명", "A기간 매출", "B기간 매출", "C기간 매출", "A→B 증감률", "A→B 증감액", "A→B 일평균차이", "A→B 판정", "B→C 증감률", "B→C 증감액", "B→C 일평균차이", "B→C 판정"]
        : ["제품명", "A기간 매출", "B기간 매출", "A→B 증감률", "A→B 증감액", "A→B 일평균차이", "A→B 판정"];

    const getStatusText = (rate: number | null) => {
      if (rate !== null && rate >= 0.2) return "급상승";
      if (rate !== null && rate <= -0.2) return "급하락";
      return "유지";
    };

    const totalRow =
      comparisonMode === "3"
        ? ["총매출", Math.round(totals.salesA), Math.round(totals.salesB), Math.round(totals.salesC), rateText(totals.rateAB), Math.round(totals.diffAB), Math.round(totals.avgDiffAB), "-", rateText(totals.rateBC), Math.round(totals.diffBC), Math.round(totals.avgDiffBC), "-"]
        : ["총매출", Math.round(totals.salesA), Math.round(totals.salesB), rateText(totals.rateAB), Math.round(totals.diffAB), Math.round(totals.avgDiffAB), "-"];

    const bodyRows = computedRows.map((row) =>
      comparisonMode === "3"
        ? [row.product, Math.round(row.salesA), Math.round(row.salesB), Math.round(row.salesC), rateText(row.rateAB), Math.round(row.diffAB), Math.round(row.avgDiffAB), getStatusText(row.rateAB), rateText(row.rateBC), Math.round(row.diffBC), Math.round(row.avgDiffBC), getStatusText(row.rateBC)]
        : [row.product, Math.round(row.salesA), Math.round(row.salesB), rateText(row.rateAB), Math.round(row.diffAB), Math.round(row.avgDiffAB), getStatusText(row.rateAB)]
    );

    const csv = [header, totalRow, ...bodyRows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const today = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `자사몰_제품별_매출_트래킹_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* ── TOP NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-[#1f1f1f] bg-[#111111]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold tracking-tight text-white">FRONT2LINE</span>
            <span className="hidden text-xs text-zinc-600 sm:block">자사몰 제품 트래킹</span>
          </div>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-2 rounded-xl bg-[#E8341C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#c9291a]"
          >
            <Download className="h-4 w-4" />
            CSV 다운로드
          </button>
        </div>
      </nav>

      <main className="min-h-screen bg-white text-[#111111]">
        <div className="mx-auto max-w-7xl px-6 py-10">

          {/* ── PAGE HEADER ── */}
          <header className="mb-10 border-b border-[#ebebeb] pb-8">
            <p className="mb-3 text-sm font-semibold tracking-[0.15em] text-[#E8341C]">
              FRONT2LINE · 제품별 매출 트래킹
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight">
              자사몰 제품별 기간별 매출 변화 트래킹
            </h1>
            <p className="mt-4 text-[#888888]">
              2026년 2월부터 조회 가능 · made by 이혜원 이사 (문의 및 버그 제보 환영)
            </p>
          </header>

          {/* ── AI INSIGHT ── */}
          <section className="mb-10">
            {aiInsight ? (
              <div className="rounded-2xl border border-[#ebebeb] bg-[#FAFAF8] p-8">
                <p className="mb-4 text-xs font-bold tracking-[0.2em] text-[#E8341C]">
                  FRONT2LINE · AI 분석
                </p>
                <p className="text-sm font-medium leading-relaxed text-[#111111]">
                  {aiInsight.text}
                </p>
                <div className="mt-6 flex items-center justify-between border-t border-[#ebebeb] pt-4">
                  <p className="text-xs text-[#AAAAAA]">
                    분석 기준: {new Date(aiInsight.analyzed_at).toLocaleString("ko-KR")}
                  </p>
                  <button
                    onClick={triggerAnalysis}
                    disabled={isAnalyzing}
                    className="flex items-center gap-1.5 text-sm font-semibold text-[#E8341C] transition hover:opacity-70 disabled:opacity-40"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {isAnalyzing ? "분석 중…" : "새로 분석"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-2xl border border-dashed border-[#E0E0E0] p-6">
                <div>
                  <p className="font-semibold">AI 분석 · 제언</p>
                  <p className="mt-1 text-sm text-[#888888]">
                    최신 데이터를 분석해 상품별 트렌드와 액션 포인트를 정리합니다
                  </p>
                </div>
                <button
                  onClick={triggerAnalysis}
                  disabled={isAnalyzing}
                  className="ml-6 flex shrink-0 items-center gap-2 rounded-xl bg-[#E8341C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#c9291a] disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" />
                  {isAnalyzing ? "분석 중…" : "AI 분석 실행"}
                </button>
              </div>
            )}
          </section>

          {/* ── STATS ROW ── */}
          <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-[#ebebeb] p-5">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#888888]">저장된 날짜</p>
              <p className="text-3xl font-bold">
                {savedDates.length}
                <span className="ml-1 text-base font-normal text-[#888]">일</span>
              </p>
              <p className="mt-1 text-xs text-[#AAAAAA]">
                {savedDates[0] ? `최신 ${savedDates[0]}` : "데이터 없음"}
              </p>
            </div>
            <div className="rounded-2xl border border-[#ebebeb] p-5">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#888888]">A기간 총매출</p>
              <p className="truncate text-2xl font-bold">{salesMoney(totals.salesA)}</p>
            </div>
            <div className="rounded-2xl border border-[#ebebeb] p-5">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#888888]">B기간 총매출</p>
              <p className="truncate text-2xl font-bold">{salesMoney(totals.salesB)}</p>
            </div>
            <div className="rounded-2xl border border-[#ebebeb] p-5">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#888888]">A→B 일평균 차이</p>
              <p className={`truncate text-2xl font-bold ${valueColor(totals.avgDiffAB)}`}>
                {money(totals.avgDiffAB)}
              </p>
            </div>
          </section>

          {/* ── UPLOAD + SETTINGS ── */}
          <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* Upload */}
            <div className="rounded-2xl border border-[#ebebeb] p-6">
              <h2 className="mb-4 font-semibold">매출 파일 업로드</h2>
              <label className="block cursor-pointer rounded-xl border border-dashed border-[#E0E0E0] p-5 transition hover:bg-[#FAFAF8]">
                <p className="text-sm font-medium">CSV / XLSX 파일 선택</p>
                <p className="mt-1.5 text-xs leading-relaxed text-[#888888]">
                  ★ 갱신 시 덮어쓰기 먼저 체크. 파일명에{" "}
                  <b className="text-[#111]">2026년05월05일</b> 형식 날짜 포함 필수.{" "}
                  여러 파일 동시 업로드 가능.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#111111] px-4 py-2 text-sm font-semibold text-white">
                  <Upload className="h-4 w-4" />
                  {isUploading ? "업로드 중…" : "파일 업로드"}
                </div>
                <input
                  type="file"
                  multiple
                  accept=".csv,.xlsx,.xls"
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>

              <div className="mt-4 rounded-xl bg-[#F7F7F5] p-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-[#666]">
                    제품명 열
                    <input
                      value={productColumn}
                      onChange={(e) => setProductColumn(e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-[#E0E0E0] bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs text-[#666]">
                    매출액 열
                    <input
                      value={salesColumn}
                      onChange={(e) => setSalesColumn(e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-[#E0E0E0] bg-white px-3 text-sm"
                    />
                  </label>
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs text-[#555]">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                  />
                  같은 날짜 덮어쓰기
                </label>
              </div>

              <div className="mt-3 space-y-2">
                {uploadResults.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[#ebebeb] bg-white px-3 py-2 text-xs"
                  >
                    <b className="text-sm">{item.fileName}</b>
                    <br />
                    <span
                      className={
                        item.status === "saved"
                          ? "text-[#E8341C]"
                          : item.status === "skipped_existing"
                          ? "text-amber-600"
                          : "text-slate-400"
                      }
                    >
                      {item.saleDate || "-"} · {item.message} · {item.inserted}개 상품
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div className="rounded-2xl border border-[#ebebeb] p-6 lg:col-span-2">
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <Settings2 className="h-4 w-4 text-[#888]" />
                비교 기간 설정
              </h2>

              {/* Quick Compare */}
              <div className="mb-5 rounded-xl bg-[#F7F7F5] p-4">
                <p className="mb-3 text-xs font-medium text-[#888888]">
                  Quick Compare — 최신 데이터 기준 자동 적용
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["2", "3", "7", "14", "30"] as const).map((kind) => (
                    <button
                      key={kind}
                      onClick={() => quickCompare(kind)}
                      disabled={!savedDates[0]}
                      className="rounded-lg bg-[#111111] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#333] disabled:cursor-not-allowed disabled:bg-[#E0E0E0] disabled:text-[#999]"
                    >
                      {kind === "2" ? "최근2일" : kind === "3" ? "최근3일" : `최근${kind}일`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode toggle */}
              <div className="mb-5 inline-flex rounded-xl border border-[#ebebeb] bg-[#F7F7F5] p-1">
                <button
                  onClick={() => setComparisonMode("2")}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                    comparisonMode === "2" ? "bg-[#111111] text-white" : "text-[#888888]"
                  }`}
                >
                  2기간 비교
                </button>
                <button
                  onClick={() => setComparisonMode("3")}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                    comparisonMode === "3" ? "bg-[#111111] text-white" : "text-[#888888]"
                  }`}
                >
                  3기간 비교
                </button>
              </div>

              {/* Period inputs */}
              <div
                className={`grid grid-cols-1 gap-4 ${
                  comparisonMode === "3" ? "md:grid-cols-3" : "md:grid-cols-2"
                }`}
              >
                {activePeriods.map((periodKey) => (
                  <div key={periodKey} className="rounded-xl border border-[#ebebeb] p-4">
                    <p className="mb-3 text-sm font-bold">{periodKey}기간</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="rounded-lg bg-[#F7F7F5] p-2.5 text-xs">
                        <span className="text-[#888]">시작일</span>
                        <input
                          type="date"
                          value={(periods as any)[periodKey].start}
                          onChange={(e) =>
                            updatePeriod(periodKey as any, "start", e.target.value)
                          }
                          className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                        />
                      </label>
                      <label className="rounded-lg bg-[#F7F7F5] p-2.5 text-xs">
                        <span className="text-[#888]">종료일</span>
                        <input
                          type="date"
                          value={(periods as any)[periodKey].end}
                          onChange={(e) =>
                            updatePeriod(periodKey as any, "end", e.target.value)
                          }
                          className="mt-1 w-full bg-transparent text-sm font-semibold outline-none"
                        />
                      </label>
                    </div>
                    <p className="mt-2.5 text-xs text-[#AAAAAA]">
                      총{" "}
                      <b className="text-[#111]">
                        {dayCount(
                          (periods as any)[periodKey].start,
                          (periods as any)[periodKey].end
                        )}
                        일
                      </b>
                    </p>
                  </div>
                ))}
              </div>

              {/* Keywords */}
              <div className="mt-5 rounded-xl border border-[#ebebeb] p-4">
                <p className="mb-1 text-sm font-semibold">제품명 합산 키워드</p>
                <p className="mb-3 text-xs text-[#888888]">
                  수정 시 저장 버튼 누른 후 팝업이 뜰 때까지 기다려주세요
                </p>
                <textarea
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  className="h-20 w-full rounded-xl border border-[#E0E0E0] p-3 text-sm"
                />
                <button
                  onClick={saveSettings}
                  className="mt-3 rounded-xl bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#333]"
                >
                  저장
                </button>
              </div>
            </div>
          </section>

          {/* ── TABLE ── */}
          <section className="rounded-2xl border border-[#ebebeb] p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold">제품별 매출 증감표</h2>
                <p className="mt-1 text-sm text-[#888888]">
                  {isLoading ? "조회 중…" : "저장된 DB 기준으로 조회합니다."}
                </p>
              </div>
              <button
                onClick={querySales}
                className="flex items-center gap-2 rounded-xl border border-[#E0E0E0] px-4 py-2 text-sm font-semibold transition hover:bg-[#F7F7F5]"
              >
                <RefreshCw className="h-4 w-4" />
                새로 조회
              </button>
            </div>

            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="제품명 검색"
              className="mb-4 h-11 w-full rounded-xl border border-[#E0E0E0] px-4 text-sm"
            />

            <div className="overflow-auto rounded-xl border border-[#ebebeb]">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="bg-[#F7F7F5] text-[#888888]">
                  <tr>
                    <th className="p-3 text-left font-medium">제품명</th>
                    <th className="p-3 text-right font-medium text-[#E8341C]">A기간 매출</th>
                    <th className="p-3 text-right font-medium text-[#E8341C]">B기간 매출</th>
                    {comparisonMode === "3" && (
                      <th className="p-3 text-right font-medium text-[#E8341C]">C기간 매출</th>
                    )}
                    <th className="p-3 text-right font-medium">A→B 증감률</th>
                    <th className="p-3 text-right font-medium">A→B 증감액</th>
                    <th className="p-3 text-right font-medium">A→B 일평균차이</th>
                    <th className="p-3 text-center font-medium">판정</th>
                    {comparisonMode === "3" && (
                      <th className="p-3 text-right font-medium">B→C 증감률</th>
                    )}
                    {comparisonMode === "3" && (
                      <th className="p-3 text-right font-medium">B→C 증감액</th>
                    )}
                    {comparisonMode === "3" && (
                      <th className="p-3 text-right font-medium">B→C 일평균차이</th>
                    )}
                    {comparisonMode === "3" && (
                      <th className="p-3 text-center font-medium">판정</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {/* Total row */}
                  <tr className="border-t border-[#ebebeb] bg-[#F7F7F5] font-bold">
                    <td className="p-3">총매출</td>
                    <td className="p-3 text-right">{salesMoney(totals.salesA)}</td>
                    <td className="p-3 text-right">{salesMoney(totals.salesB)}</td>
                    {comparisonMode === "3" && (
                      <td className="p-3 text-right">{salesMoney(totals.salesC)}</td>
                    )}
                    <td className={`p-3 text-right ${valueColor(totals.rateAB)}`}>
                      {rateText(totals.rateAB)}
                    </td>
                    <td className={`p-3 text-right ${valueColor(totals.diffAB)}`}>
                      {money(totals.diffAB)}
                    </td>
                    <td className={`p-3 text-right ${valueColor(totals.avgDiffAB)}`}>
                      {money(totals.avgDiffAB)}
                    </td>
                    <td className="p-3 text-center">-</td>
                    {comparisonMode === "3" && (
                      <td className={`p-3 text-right ${valueColor(totals.rateBC)}`}>
                        {rateText(totals.rateBC)}
                      </td>
                    )}
                    {comparisonMode === "3" && (
                      <td className={`p-3 text-right ${valueColor(totals.diffBC)}`}>
                        {money(totals.diffBC)}
                      </td>
                    )}
                    {comparisonMode === "3" && (
                      <td className={`p-3 text-right ${valueColor(totals.avgDiffBC)}`}>
                        {money(totals.avgDiffBC)}
                      </td>
                    )}
                    {comparisonMode === "3" && <td className="p-3 text-center">-</td>}
                  </tr>

                  {/* Product rows */}
                  {computedRows.map((row) => (
                    <tr
                      key={row.product}
                      className="border-t border-[#f0f0f0] transition hover:bg-[#FAFAF8]"
                    >
                      <td className="p-3 font-medium">{row.product}</td>
                      <td className="p-3 text-right text-[#555]">{salesMoney(row.salesA)}</td>
                      <td className="p-3 text-right text-[#555]">{salesMoney(row.salesB)}</td>
                      {comparisonMode === "3" && (
                        <td className="p-3 text-right text-[#555]">{salesMoney(row.salesC)}</td>
                      )}
                      <td className={`p-3 text-right font-semibold ${valueColor(row.rateAB)}`}>
                        {rateText(row.rateAB)}
                      </td>
                      <td className={`p-3 text-right font-semibold ${valueColor(row.diffAB)}`}>
                        {money(row.diffAB)}
                      </td>
                      <td className={`p-3 text-right font-semibold ${valueColor(row.avgDiffAB)}`}>
                        {money(row.avgDiffAB)}
                      </td>
                      <td className="p-3 text-center">{statusLabel(row.rateAB)}</td>
                      {comparisonMode === "3" && (
                        <td className={`p-3 text-right font-semibold ${valueColor(row.rateBC)}`}>
                          {rateText(row.rateBC)}
                        </td>
                      )}
                      {comparisonMode === "3" && (
                        <td className={`p-3 text-right font-semibold ${valueColor(row.diffBC)}`}>
                          {money(row.diffBC)}
                        </td>
                      )}
                      {comparisonMode === "3" && (
                        <td className={`p-3 text-right font-semibold ${valueColor(row.avgDiffBC)}`}>
                          {money(row.avgDiffBC)}
                        </td>
                      )}
                      {comparisonMode === "3" && (
                        <td className="p-3 text-center">{statusLabel(row.rateBC)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
