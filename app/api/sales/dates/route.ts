import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function fetchAllDates() {
  const pageSize = 1000;
  let from = 0;
  let allRows: any[] = [];

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("daily_product_sales")
      .select("sale_date")
      .order("sale_date", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const rows = data || [];
    allRows = allRows.concat(rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

export async function GET() {
  try {
    const data = await fetchAllDates();
    const uniqueDates = Array.from(new Set(data.map((row) => row.sale_date)));
    return NextResponse.json({ dates: uniqueDates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
