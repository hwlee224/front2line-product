// ============================================================================
// [3단계 v3] app/api/export/route.ts  → 이 내용으로 "전체 교체"
//
// 추가된 점: limit / offset 파라미터로 데이터를 "작게 나눠" 받을 수 있음.
//   → Claude가 매일 자동으로 받을 때 한 번에 다 안 받고 페이지 단위로 안전하게 받음.
//   → limit 없이 부르면 기존처럼 전체 반환(브라우저 수동 확인용).
//
// 사용 예:
//   /api/export?token=○○○&date=2026-06-18                    → 그 날 전체
//   /api/export?token=○○○&date=2026-06-18&limit=150&offset=0 → 150개씩 페이지
//   /api/export?token=○○○&from=2026-02-01&to=2026-06-18      → 기간 전체
//   /api/export?token=○○○&date=2026-06-18&format=json        → JSON
//
// 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EXPORT_TOKEN
// ============================================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "sale_date", "product_no", "product_name", "normalized_product_name",
  "exposure_count", "cart_count", "order_count", "order_product_count",
  "conversion_rate", "order_amount",
  "cart_to_exposure_rate", "order_to_exposure_rate",
  "order_to_cart_rate", "order_product_to_cart_rate",
];

function toCsv(rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = COLUMNS.join(",");
  if (rows.length === 0) return "﻿" + header + "\n";
  const body = rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(",")).join("\n");
  return "﻿" + header + "\n" + body + "\n"; // ﻿: 엑셀에서 한글 안 깨지게 하는 표식(BOM)
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // ── 토큰 검사 ──
  const token =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("token");
  if (!process.env.EXPORT_TOKEN || token !== process.env.EXPORT_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  const date = url.searchParams.get("date");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const format = (url.searchParams.get("format") || "csv").toLowerCase();

  // limit/offset (자동화용 페이지 나누기). 없으면 전체.
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const hasPaging = limitParam !== null;
  const limit = Math.min(Math.max(parseInt(limitParam || "1000", 10) || 1000, 1), 1000);
  const startOffset = Math.max(parseInt(offsetParam || "0", 10) || 0, 0);

  const buildFiltered = () => {
    let f = supabaseAdmin.from("daily_product_metrics").select(COLUMNS.join(","));
    if (date) {
      f = f.eq("sale_date", date);
    } else {
      if (from) f = f.gte("sale_date", from);
      if (to) f = f.lte("sale_date", to);
    }
    return f;
  };

  const all: Record<string, unknown>[] = [];

  if (hasPaging) {
    // 클라이언트가 페이지를 지정 → 딱 그 한 페이지만 반환
    const { data, error } = await buildFiltered()
      .order("sale_date", { ascending: true })
      .order("order_amount", { ascending: false })
      .range(startOffset, startOffset + limit - 1);
    if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
    all.push(...((data ?? []) as unknown as Record<string, unknown>[]));
  } else {
    // 파라미터 없음 → 내부에서 전체를 순회해 반환 (수동 확인용)
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await buildFiltered()
        .order("sale_date", { ascending: true })
        .order("order_amount", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
      const batch = (data ?? []) as unknown as Record<string, unknown>[];
      all.push(...batch);
      if (batch.length < pageSize) break;
      offset += pageSize;
    }
  }

  if (format === "json") {
    return NextResponse.json(all);
  }
  return new Response(toCsv(all), {
    status: 200,
    headers: { "content-type": "text/csv; charset=utf-8" },
  });
}
