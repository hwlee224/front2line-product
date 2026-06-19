// ============================================================================
// [3단계] 새 파일 추가 → app/api/export/route.ts
//
// 배포 후 주소: https://f2l-product-sale-tracking.vercel.app/api/export
// Claude(또는 외부)가 헤더 없이 URL만으로 daily_product_metrics 데이터를 읽어가는 엔드포인트.
//
// 사용 예:
//   /api/export?token=○○○                              → 전체
//   /api/export?token=○○○&date=2026-06-18              → 특정 하루
//   /api/export?token=○○○&from=2026-02-01&to=2026-06-18 → 기간
//   /api/export?token=○○○&format=json                  → JSON (기본은 csv)
//
// 필요한 환경변수 (Vercel):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  → 이미 등록돼 있음 (재사용)
//   EXPORT_TOKEN  → 이번에 새로 추가 (아무 긴 문자열)
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
  if (rows.length === 0) return header + "\n";
  const body = rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(",")).join("\n");
  return header + "\n" + body + "\n";
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  // ── 토큰 검사 (헤더 또는 ?token= 둘 다 허용) ──
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

  // ── 페이지네이션으로 전체 조회 (Supabase 기본 1000행 제한 회피) ──
  const pageSize = 1000;
  let offset = 0;
  const all: Record<string, unknown>[] = [];
  while (true) {
    let q = supabaseAdmin
      .from("daily_product_metrics")
      .select(COLUMNS.join(","));
    if (date) {
      q = q.eq("sale_date", date);
    } else {
      if (from) q = q.gte("sale_date", from);
      if (to) q = q.lte("sale_date", to);
    }
    q = q
      .order("sale_date", { ascending: true })
      .order("order_amount", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, error } = await q;
    if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
    const batch = (data ?? []) as Record<string, unknown>[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  if (format === "json") {
    return NextResponse.json(all);
  }
  return new Response(toCsv(all), {
    status: 200,
    headers: { "content-type": "text/csv; charset=utf-8" },
  });
}
