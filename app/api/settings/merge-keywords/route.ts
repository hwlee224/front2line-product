import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeProductName } from "@/lib/utils";

async function fetchAllSalesRows() {
  const pageSize = 1000;
  let from = 0;
  let allRows: any[] = [];

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("daily_product_sales")
      .select("sale_date, product_name, normalized_product_name, sales_amount, source_file_name")
      .order("sale_date", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const rows = data || [];
    allRows = allRows.concat(rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

async function chunkInsert(rows: any[]) {
  const chunkSize = 500;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabaseAdmin.from("daily_product_sales").insert(chunk);
    if (error) throw error;
  }
}

async function renormalizeExistingSales(keywords: string[]) {
  const existingRows = await fetchAllSalesRows();
  if (!existingRows.length) return { before: 0, after: 0 };

  const grouped = new Map<string, any>();

  for (const row of existingRows) {
    const baseProductName = row.product_name || row.normalized_product_name || "";
    const normalized = normalizeProductName(baseProductName, keywords);
    if (!normalized) continue;

    const key = `${row.sale_date}|||${normalized}`;
    const current = grouped.get(key);

    if (current) {
      current.sales_amount += Number(row.sales_amount || 0);
      if (!current.source_file_name && row.source_file_name) {
        current.source_file_name = row.source_file_name;
      }
    } else {
      grouped.set(key, {
        sale_date: row.sale_date,
        product_name: baseProductName,
        normalized_product_name: normalized,
        sales_amount: Number(row.sales_amount || 0),
        source_file_name: row.source_file_name,
      });
    }
  }

  const newRows = Array.from(grouped.values());

  const { error: deleteError } = await supabaseAdmin
    .from("daily_product_sales")
    .delete()
    .neq("id", 0);

  if (deleteError) throw deleteError;

  if (newRows.length) {
    await chunkInsert(newRows);
  }

  return { before: existingRows.length, after: newRows.length };
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "merge_keywords")
    .single();

  if (error) {
    return NextResponse.json({
      keywords: ["[이청아 착용]", "[앵콜 반다]", "[앵콜반다]", "[주말특가]", "[팬츠야시장]"],
    });
  }

  return NextResponse.json({ keywords: data?.value || [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const keywords = Array.isArray(body.keywords) ? body.keywords : [];

    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({
        key: "merge_keywords",
        value: keywords,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const renormalized = await renormalizeExistingSales(keywords);

    return NextResponse.json({
      ok: true,
      keywords,
      renormalized,
      message: "합산 키워드를 저장하고 기존 데이터를 다시 정리했습니다.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
