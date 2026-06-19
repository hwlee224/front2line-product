// ============================================================================
// [2단계] app/api/sales/upload/route.ts  →  이 내용으로 "전체 교체"
//
// 기존 코드와 다른 점은 "// ★추가" 표시된 부분뿐입니다.
//   - 기존 daily_product_sales 저장 로직: 그대로 (대시보드 동작 동일)
//   - daily_product_metrics 에 제품별 원본 전환지표를 추가로 저장 (사이트엔 안 보임)
// ============================================================================

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { columnToIndex, guessDateFromFileName, normalizeProductName, parseNumber } from "@/lib/utils";

// ★추가: cafe24 "상품별 매출 분석" export의 고정 컬럼 위치 (0부터 시작)
//   A=0 product_no, D=3 노출, E=4 장바구니, F=5 주문, G=6 판매수량,
//   H=7 전환율, J=9~M=12 각종 비율
const IDX = {
  productNo: 0,           // A
  exposure: 3,            // D
  cart: 4,                // E
  orderCount: 5,          // F
  orderProductCount: 6,   // G
  conversion: 7,          // H
  cartToExposure: 9,      // J
  orderToExposure: 10,    // K
  orderToCart: 11,        // L
  orderProductToCart: 12, // M
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  const productColumn = String(formData.get("productColumn") || "B");
  const salesColumn = String(formData.get("salesColumn") || "I");
  const overwrite = String(formData.get("overwrite") || "false") === "true";

  const { data: settings } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "merge_keywords")
    .single();

  const mergeKeywords = Array.isArray(settings?.value) ? settings.value : ["[이청아 착용]", "[앵콜 반다]"];

  const productIdx = columnToIndex(productColumn);
  const salesIdx = columnToIndex(salesColumn);

  const results: any[] = [];

  for (const file of files) {
    const saleDate = guessDateFromFileName(file.name);
    if (!saleDate) {
      results.push({
        fileName: file.name,
        status: "failed",
        message: "파일명에서 날짜를 인식하지 못했습니다. 예: 2026년05월05일.csv",
        inserted: 0,
      });
      continue;
    }

    const { count: existingCount } = await supabaseAdmin
      .from("daily_product_sales")
      .select("*", { count: "exact", head: true })
      .eq("sale_date", saleDate);

    if ((existingCount || 0) > 0 && !overwrite) {
      results.push({
        fileName: file.name,
        saleDate,
        status: "skipped_existing",
        message: "이미 저장된 날짜입니다. 덮어쓰기를 선택하면 기존 날짜 데이터를 삭제 후 재저장합니다.",
        inserted: 0,
      });
      continue;
    }

    if ((existingCount || 0) > 0 && overwrite) {
      await supabaseAdmin.from("daily_product_sales").delete().eq("sale_date", saleDate);
      await supabaseAdmin.from("daily_product_metrics").delete().eq("sale_date", saleDate); // ★추가
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];

    // ── 기존: 매출 정규화·병합 후 daily_product_sales 저장 (변경 없음) ──
    const grouped = new Map<string, { original: string; amount: number }>();
    sheetRows.slice(1).forEach((row) => {
      const originalProduct = String(row[productIdx] || "").trim();
      const normalized = normalizeProductName(originalProduct, mergeKeywords);
      const amount = parseNumber(row[salesIdx]);
      if (!normalized || !amount) return;
      const current = grouped.get(normalized) || { original: originalProduct, amount: 0 };
      current.amount += amount;
      grouped.set(normalized, current);
    });

    const insertRows = Array.from(grouped.entries()).map(([normalized, item]) => ({
      sale_date: saleDate,
      product_name: item.original,
      normalized_product_name: normalized,
      sales_amount: item.amount,
      source_file_name: file.name,
    }));

    if (insertRows.length > 0) {
      const { error } = await supabaseAdmin.from("daily_product_sales").upsert(insertRows, {
        onConflict: "sale_date,normalized_product_name",
      });
      if (error) {
        results.push({
          fileName: file.name,
          saleDate,
          status: "failed",
          message: error.message,
          inserted: 0,
        });
        continue;
      }
    }

    // ★추가: 제품별 원본 전환지표를 daily_product_metrics 에 저장 ──────────────
    let metricsInserted = 0;
    const metricRows = sheetRows
      .slice(1)
      .map((row) => {
        const productNo = parseNumber(row[IDX.productNo]);
        const productName = String(row[productIdx] || "").trim();
        if (!productNo || !productName) return null;
        return {
          sale_date: saleDate,
          product_no: productNo,
          product_name: productName,
          normalized_product_name: normalizeProductName(productName, mergeKeywords),
          exposure_count: parseNumber(row[IDX.exposure]) || 0,
          cart_count: parseNumber(row[IDX.cart]) || 0,
          order_count: parseNumber(row[IDX.orderCount]) || 0,
          order_product_count: parseNumber(row[IDX.orderProductCount]) || 0,
          conversion_rate: parseNumber(row[IDX.conversion]) || 0,
          order_amount: parseNumber(row[salesIdx]) || 0,
          cart_to_exposure_rate: parseNumber(row[IDX.cartToExposure]) || 0,
          order_to_exposure_rate: parseNumber(row[IDX.orderToExposure]) || 0,
          order_to_cart_rate: parseNumber(row[IDX.orderToCart]) || 0,
          order_product_to_cart_rate: parseNumber(row[IDX.orderProductToCart]) || 0,
          source_file_name: file.name,
        };
      })
      .filter(Boolean) as any[];

    if (metricRows.length > 0) {
      const { error: metricError } = await supabaseAdmin
        .from("daily_product_metrics")
        .upsert(metricRows, { onConflict: "sale_date,product_no" });
      if (!metricError) metricsInserted = metricRows.length;
    }
    // ★추가 끝 ─────────────────────────────────────────────────────────────

    results.push({
      fileName: file.name,
      saleDate,
      status: "saved",
      message: "저장 완료",
      inserted: insertRows.length,
      metricsInserted, // ★추가
    });
  }

  return NextResponse.json({ results });
}
