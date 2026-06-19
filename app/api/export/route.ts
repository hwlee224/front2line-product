// ============================================================================
// [3단계 수정본] app/api/export/route.ts
//
// GitHub에서 app/api/export/route.ts 를 열어 ✏️Edit → 전체 지우고 → 이 내용으로 교체 → Commit
// (이전 버전의 쿼리 조립 방식이 빌드 타입 에러를 내서, 안전한 방식으로 수정했습니다.)
//
// 배포 후 주소: https://f2l-product-sale-tracking.vercel.app/api/export
// 사용 예:
//   /api/export?token=○○○&date=2026-06-18
//   /api/export?token=○○○&from=2026-02-01&to=2026-06-18
//   /api/export?token=○○○&format=json
//
// 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (재사용), EXPORT_TOKEN (신규)
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
    // 필터 단계 (eq/gte/lte 는 같은 타입을 반환하므로 재대입해도 안전)
    let filtered = supabaseAdmin.from("daily_product_metrics").select(COLUMNS.join(","));
    if (date) {
      filtered = filtered.eq("sale_date", date);
    } else {
      if (from) filtered = filtered.gte("sale_date", from);
      if (to) filtered = filtered.lte("sale_date", to);
    }

    // 정렬·범위는 재대입하지 않고 한 번에 체이닝 (타입 에러 방지)
    const { data, error } = await filtered
      .order("sale_date", { ascending: true })
      .order("order_amount", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) return new Response(`DB error: ${error.message}`, { status: 500 });

    const batch = (data ?? []) as unknown as Record<string, unknown>[];
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
