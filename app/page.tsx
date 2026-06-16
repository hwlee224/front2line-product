"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Download, Database, RefreshCw, Settings2 } from "lucide-react";
import { dayCount, money, rateText, salesMoney, valueColor } from "@/lib/utils";

type ResultRow = {
  product: string;
  salesA: number;
  salesB: number;
  salesC: number;
  averageSales: number;
};

function statusLabel(rate: number | null) {
  if (rate !== null && rate >= 0.2) return <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">급상승</span>;
  if (rate !== null && rate <= -0.2) return <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-100">급하락</span>;
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">유지</span>;
}

// "YYYY-MM-DD" 문자열에 일수를 더하거나 빼서 다시 "YYYY-MM-DD"로 반환 (타임존 안전)
function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
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

  useEffect(() => {
    loadSettings();
    loadDates();
  }, []);

  useEffect(() => {
    querySales();
  }, [comparisonMode, periods]);

  // 페이지 최초 진입 시 저장된 날짜가 로드되면 최신일 기준으로 기본 기간을 1회 자동 세팅
  // 기본값: 2기간 비교, A=최신-1일, B=최신일 (시작=종료 동일)
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
      const res = await fetch("/api/sales/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setUploadResults(data.results || []);
      await loadDates();
      await querySales();
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  // Quick Compare: 최신 데이터 기준일(savedDates[0])을 기준으로 기간을 자동 세팅
  // kind "2"  → 2기간 비교, A=최신-1일, B=최신일 (시작=종료)
  // kind "3"  → 3기간 비교, A=최신-2일, B=최신-1일, C=최신일 (시작=종료)
  // kind "7"/"14"/"30" → 2기간 비교, 직전 N일 vs 최근 N일
  function quickCompare(kind: "2" | "3" | "7" | "14" | "30") {
    const latest = savedDates[0];
    if (!latest) return;

    if (kind === "2") {
      const a = addDays(latest, -1);
      setComparisonMode("2");
      setPeriods((prev) => ({
        ...prev,
        A: { start: a, end: a },
        B: { start: latest, end: latest },
      }));
      return;
    }

    if (kind === "3") {
      const a = addDays(latest, -2);
      const b = addDays(latest, -1);
      setComparisonMode("3");
      setPeriods((prev) => ({
        ...prev,
        A: { start: a, end: a },
        B: { start: b, end: b },
        C: { start: latest, end: latest },
      }));
      return;
    }

    // N일 블록 비교 (7 / 14 / 30)
    const n = Number(kind);
    const bEnd = latest;
    const bStart = addDays(latest, -(n - 1));
    const aEnd = addDays(latest, -n);
    const aStart = addDays(latest, -(2 * n - 1));
    setComparisonMode("2");
    setPeriods((prev) => ({
      ...prev,
      A: { start: aStart, end: aEnd },
      B: { start: bStart, end: bEnd },
    }));
  }

  function updatePeriod(key: "A" | "B" | "C", field: "start" | "end", value: string) {
    setPeriods((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  const filteredRows = rows.filter((row) => row.product.toLowerCase().includes(keyword.toLowerCase()));

  const computedRows = filteredRows.map((row) => {
    const diffAB = row.salesB - row.salesA;
    const rateAB = row.salesA ? diffAB / row.salesA : null;
    const avgDiffAB = row.salesB / dayCount(periods.B.start, periods.B.end) - row.salesA / dayCount(periods.A.start, periods.A.end);
    const diffBC = row.salesC - row.salesB;
    const rateBC = row.salesB ? diffBC / row.salesB : null;
    const avgDiffBC = row.salesC / dayCount(periods.C.start, periods.C.end) - row.salesB / dayCount(periods.B.start, periods.B.end);
    return { ...row, diffAB, rateAB, avgDiffAB, diffBC, rateBC, avgDiffBC };
  });

  const totals = computedRows.reduce((acc, row) => {
    acc.salesA += row.salesA;
    acc.salesB += row.salesB;
    acc.salesC += row.salesC;
    return acc;
  }, { salesA: 0, salesB: 0, salesC: 0 } as any);
  totals.diffAB = totals.salesB - totals.salesA;
  totals.rateAB = totals.salesA ? totals.diffAB / totals.salesA : null;
  totals.avgDiffAB = totals.salesB / dayCount(periods.B.start, periods.B.end) - totals.salesA / dayCount(periods.A.start, periods.A.end);
  totals.diffBC = totals.salesC - totals.salesB;
  totals.rateBC = totals.salesB ? totals.diffBC / totals.salesB : null;
  totals.avgDiffBC = totals.salesC / dayCount(periods.C.start, periods.C.end) - totals.salesB / dayCount(periods.B.start, periods.B.end);

  function downloadCsv() {
    const header =
      comparisonMode === "3"
        ? [
            "제품명",
            "A기간 매출",
            "B기간 매출",
            "C기간 매출",
            "A→B 증감률",
            "A→B 증감액",
            "A→B 일평균차이",
            "A→B 판정",
            "B→C 증감률",
            "B→C 증감액",
            "B→C 일평균차이",
            "B→C 판정",
          ]
        : [
            "제품명",
            "A기간 매출",
            "B기간 매출",
            "A→B 증감률",
            "A→B 증감액",
            "A→B 일평균차이",
            "A→B 판정",
          ];

    const getStatusText = (rate: number | null) => {
      if (rate !== null && rate >= 0.2) return "급상승";
      if (rate !== null && rate <= -0.2) return "급하락";
      return "유지";
    };

    const totalRow =
      comparisonMode === "3"
        ? [
            "총매출",
            Math.round(totals.salesA),
            Math.round(totals.salesB),
            Math.round(totals.salesC),
            rateText(totals.rateAB),
            Math.round(totals.diffAB),
            Math.round(totals.avgDiffAB),
            "-",
            rateText(totals.rateBC),
            Math.round(totals.diffBC),
            Math.round(totals.avgDiffBC),
            "-",
          ]
        : [
            "총매출",
            Math.round(totals.salesA),
            Math.round(totals.salesB),
            rateText(totals.rateAB),
            Math.round(totals.diffAB),
            Math.round(totals.avgDiffAB),
            "-",
          ];

    const bodyRows = computedRows.map((row) => {
      if (comparisonMode === "3") {
        return [
          row.product,
          Math.round(row.salesA),
          Math.round(row.salesB),
          Math.round(row.salesC),
          rateText(row.rateAB),
          Math.round(row.diffAB),
          Math.round(row.avgDiffAB),
          getStatusText(row.rateAB),
          rateText(row.rateBC),
          Math.round(row.diffBC),
          Math.round(row.avgDiffBC),
          getStatusText(row.rateBC),
        ];
      }

      return [
        row.product,
        Math.round(row.salesA),
        Math.round(row.salesB),
        rateText(row.rateAB),
        Math.round(row.diffAB),
        Math.round(row.avgDiffAB),
        getStatusText(row.rateAB),
      ];
    });

    const csvRows = [header, totalRow, ...bodyRows];

    const csv = csvRows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

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
    <main className="min-h-screen bg-[#f7f4ef] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm tracking-[0.24em] text-slate-500">FRONT2LINE</p>
            <h1 className="text-4xl font-semibold tracking-tight">자사몰 제품별/기간별 매출 변화 트래킹</h1>
            <p className="mt-3 max-w-2xl text-slate-600">2026년 2월부터 조회 가능. made by 이혜원 이사 (문의 및 버그 제보 환영)</p>
          </div>
          <button onClick={downloadCsv} className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm">
            <Download className="mr-2 inline h-4 w-4" /> 현재 표 CSV 다운로드
          </button>
        </header>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500"><Database className="h-4 w-4" /> 저장된 날짜</div>
            <p className="text-2xl font-semibold">{savedDates.length}일</p>
            <p className="mt-1 text-sm text-slate-500">{savedDates[0] ? `최근 ${savedDates[0]}` : "아직 저장된 데이터 없음"}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">최신 데이터 기준일 : {savedDates[0] || "-"}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-medium text-slate-500">A기간 총매출</p>
            <p className="text-2xl font-semibold">{salesMoney(totals.salesA)}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-medium text-slate-500">B기간 총매출</p>
            <p className="text-2xl font-semibold">{salesMoney(totals.salesB)}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-medium text-slate-500">A→B 일평균 차이</p>
            <p className={`text-2xl font-semibold ${valueColor(totals.avgDiffAB)}`}>{money(totals.avgDiffAB)}</p>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-semibold">매출 파일 누적 업로드</h2>
            <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-300 p-5 hover:bg-slate-50">
              <p className="font-medium">CSV/XLSX 파일 여러 개 선택</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">★데이터를 갱신할 경우 덮어쓰기를 먼저 체크해주세요. 파일명은 반드시 2026년05월05일 형식의 날짜를 포함해야 합니다. 여러 파일을 한 번에 업로드 가능합니다.</p>
              <div className="mt-4 inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                <Upload className="mr-2 h-4 w-4" /> {isUploading ? "업로드 중..." : "파일 업로드"}
              </div>
              <input type="file" multiple accept=".csv,.xlsx,.xls" onChange={handleUpload} className="hidden" />
            </label>

            <div className="mt-4 rounded-2xl bg-[#f7f4ef] p-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <label>제품명 열<input value={productColumn} onChange={(e) => setProductColumn(e.target.value)} className="mt-1 h-10 w-full rounded-xl border px-3" /></label>
                <label>매출액 열<input value={salesColumn} onChange={(e) => setSalesColumn(e.target.value)} className="mt-1 h-10 w-full rounded-xl border px-3" /></label>
              </div>
              <label className="mt-3 flex items-center gap-2">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                같은 날짜가 있으면 덮어쓰기
              </label>
            </div>

            <div className="mt-4 space-y-2">
              {uploadResults.map((item, idx) => (
                <div key={idx} className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                  <b>{item.fileName}</b><br />
                  <span className={item.status === "saved" ? "text-emerald-700" : item.status === "skipped_existing" ? "text-amber-700" : "text-red-700"}>
                    {item.saleDate || "-"} · {item.message} · {item.inserted}개 상품
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold"><Settings2 className="h-5 w-5" /> 비교/설정</h2>

            <div className="mb-5 rounded-2xl bg-[#f7f4ef] p-4">
              <p className="mb-3 text-sm font-medium text-slate-500">Quick Compare (최신 데이터 기준일 자동 적용)</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { kind: "2", label: "최근2일" },
                  { kind: "3", label: "최근3일" },
                  { kind: "7", label: "최근7일" },
                  { kind: "14", label: "최근14일" },
                  { kind: "30", label: "최근30일" },
                ] as const).map((item) => (
                  <button
                    key={item.kind}
                    onClick={() => quickCompare(item.kind)}
                    disabled={!savedDates[0]}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5 inline-flex rounded-2xl bg-slate-100 p-1">
              <button onClick={() => setComparisonMode("2")} className={`rounded-xl px-4 py-2 text-sm font-medium ${comparisonMode === "2" ? "bg-white shadow-sm" : "text-slate-500"}`}>2기간 비교</button>
              <button onClick={() => setComparisonMode("3")} className={`rounded-xl px-4 py-2 text-sm font-medium ${comparisonMode === "3" ? "bg-white shadow-sm" : "text-slate-500"}`}>3기간 비교</button>
            </div>

            <div className={`grid grid-cols-1 gap-4 ${comparisonMode === "3" ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {activePeriods.map((periodKey) => (
                <div key={periodKey} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="mb-3 font-medium">{periodKey}기간</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <label className="rounded-xl bg-slate-50 p-3">시작일<br /><input type="date" value={(periods as any)[periodKey].start} onChange={(e) => updatePeriod(periodKey as any, "start", e.target.value)} className="mt-1 w-full bg-transparent font-semibold outline-none" /></label>
                    <label className="rounded-xl bg-slate-50 p-3">종료일<br /><input type="date" value={(periods as any)[periodKey].end} onChange={(e) => updatePeriod(periodKey as any, "end", e.target.value)} className="mt-1 w-full bg-transparent font-semibold outline-none" /></label>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">일자 수: <b>{dayCount((periods as any)[periodKey].start, (periods as any)[periodKey].end)}일</b></p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="mb-2 font-medium">제품명 합산 키워드 (수정시 저장 버튼 누른 후 팝업 뜰 때까지 기다려주세요)</p>
              <textarea value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} className="h-20 w-full rounded-xl border p-3" />
              <button onClick={saveSettings} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">합산 키워드 저장</button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">제품별 매출 증감표</h2>
              <p className="mt-1 text-sm text-slate-500">{isLoading ? "조회 중..." : "저장된 DB 기준으로 조회합니다."}</p>
            </div>
            <button onClick={querySales} className="rounded-xl bg-slate-100 px-4 py-2 text-sm"><RefreshCw className="mr-2 inline h-4 w-4" /> 새로 조회</button>
          </div>

          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="제품명 검색" className="mb-4 h-11 w-full rounded-2xl border px-4" />

          <div className="overflow-auto rounded-2xl border">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-3 text-left">제품명</th>
                  <th className="bg-blue-50 p-3 text-right text-blue-700">A기간 매출</th>
                  <th className="bg-red-50 p-3 text-right text-red-700">B기간 매출</th>
                  {comparisonMode === "3" && <th className="bg-emerald-50 p-3 text-right text-emerald-700">C기간 매출</th>}
                  <th className="p-3 text-right">A→B 증감률</th>
                  <th className="p-3 text-right">A→B 증감액</th>
                  <th className="p-3 text-right">A→B 일평균차이</th>
                  <th className="p-3 text-center">A→B 판정</th>
                  {comparisonMode === "3" && <th className="p-3 text-right">B→C 증감률</th>}
                  {comparisonMode === "3" && <th className="p-3 text-right">B→C 증감액</th>}
                  {comparisonMode === "3" && <th className="p-3 text-right">B→C 일평균차이</th>}
                  {comparisonMode === "3" && <th className="p-3 text-center">B→C 판정</th>}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t bg-slate-50 font-semibold">
                  <td className="p-3">총매출</td>
                  <td className="bg-blue-50 p-3 text-right">{salesMoney(totals.salesA)}</td>
                  <td className="bg-red-50 p-3 text-right">{salesMoney(totals.salesB)}</td>
                  {comparisonMode === "3" && <td className="bg-emerald-50 p-3 text-right">{salesMoney(totals.salesC)}</td>}
                  <td className={`p-3 text-right ${valueColor(totals.rateAB)}`}>{rateText(totals.rateAB)}</td>
                  <td className={`p-3 text-right ${valueColor(totals.diffAB)}`}>{money(totals.diffAB)}</td>
                  <td className={`p-3 text-right ${valueColor(totals.avgDiffAB)}`}>{money(totals.avgDiffAB)}</td>
                  <td className="p-3 text-center">-</td>
                  {comparisonMode === "3" && <td className={`p-3 text-right ${valueColor(totals.rateBC)}`}>{rateText(totals.rateBC)}</td>}
                  {comparisonMode === "3" && <td className={`p-3 text-right ${valueColor(totals.diffBC)}`}>{money(totals.diffBC)}</td>}
                  {comparisonMode === "3" && <td className={`p-3 text-right ${valueColor(totals.avgDiffBC)}`}>{money(totals.avgDiffBC)}</td>}
                  {comparisonMode === "3" && <td className="p-3 text-center">-</td>}
                </tr>

                {computedRows.map((row) => (
                  <tr key={row.product} className="border-t hover:bg-slate-50">
                    <td className="p-3 font-medium">{row.product}</td>
                    <td className="bg-blue-50/60 p-3 text-right">{salesMoney(row.salesA)}</td>
                    <td className="bg-red-50/60 p-3 text-right">{salesMoney(row.salesB)}</td>
                    {comparisonMode === "3" && <td className="bg-emerald-50/60 p-3 text-right">{salesMoney(row.salesC)}</td>}
                    <td className={`p-3 text-right font-semibold ${valueColor(row.rateAB)}`}>{rateText(row.rateAB)}</td>
                    <td className={`p-3 text-right font-semibold ${valueColor(row.diffAB)}`}>{money(row.diffAB)}</td>
                    <td className={`p-3 text-right font-semibold ${valueColor(row.avgDiffAB)}`}>{money(row.avgDiffAB)}</td>
                    <td className="p-3 text-center">{statusLabel(row.rateAB)}</td>
                    {comparisonMode === "3" && <td className={`p-3 text-right font-semibold ${valueColor(row.rateBC)}`}>{rateText(row.rateBC)}</td>}
                    {comparisonMode === "3" && <td className={`p-3 text-right font-semibold ${valueColor(row.diffBC)}`}>{money(row.diffBC)}</td>}
                    {comparisonMode === "3" && <td className={`p-3 text-right font-semibold ${valueColor(row.avgDiffBC)}`}>{money(row.avgDiffBC)}</td>}
                    {comparisonMode === "3" && <td className="p-3 text-center">{statusLabel(row.rateBC)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
