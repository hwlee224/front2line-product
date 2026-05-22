import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { columnToIndex, guessDateFromFileName, normalizeProductName, parseNumber } from "@/lib/utils";

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
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];

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

    results.push({
      fileName: file.name,
      saleDate,
      status: "saved",
      message: "저장 완료",
      inserted: insertRows.length,
    });
  }

  return NextResponse.json({ results });
}
