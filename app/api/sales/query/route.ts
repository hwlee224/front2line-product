import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function sumSales(rows: any[], start: string, end: string) {
  const map = new Map<string, number>();
  rows
    .filter((row) => row.sale_date >= start && row.sale_date <= end)
    .forEach((row) => {
      const key = row.normalized_product_name;
      map.set(key, (map.get(key) || 0) + Number(row.sales_amount || 0));
    });
  return map;
}

async function fetchAllSalesRows(minDate: string, maxDate: string) {
  const pageSize = 1000;
  let from = 0;
  let allRows: any[] = [];

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("daily_product_sales")
      .select("sale_date, normalized_product_name, sales_amount")
      .gte("sale_date", minDate)
      .lte("sale_date", maxDate)
      .order("sale_date", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    allRows = allRows.concat(data || []);

    if ((data || []).length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const comparisonMode = body.comparisonMode === "3" ? "3" : "2";
    const periods = body.periods;

    const allStarts = [
      periods.A.start,
      periods.B.start,
      comparisonMode === "3" ? periods.C.start : null,
    ].filter(Boolean);

    const allEnds = [
      periods.A.end,
      periods.B.end,
      comparisonMode === "3" ? periods.C.end : null,
    ].filter(Boolean);

    const minDate = allStarts.sort()[0];
    const maxDate = allEnds.sort().reverse()[0];

    const rows = await fetchAllSalesRows(minDate, maxDate);

    const products = Array.from(new Set(rows.map((row) => row.normalized_product_name)));
    const aMap = sumSales(rows, periods.A.start, periods.A.end);
    const bMap = sumSales(rows, periods.B.start, periods.B.end);
    const cMap = comparisonMode === "3" ? sumSales(rows, periods.C.start, periods.C.end) : new Map();

    const resultRows = products
      .map((product) => {
        const salesA = aMap.get(product) || 0;
        const salesB = bMap.get(product) || 0;
        const salesC = cMap.get(product) || 0;
        const averageSales =
          comparisonMode === "3"
            ? (salesA + salesB + salesC) / 3
            : (salesA + salesB) / 2;

        return { product, salesA, salesB, salesC, averageSales };
      })
      .sort((a, b) => b.averageSales - a.averageSales);

    return NextResponse.json({ rows: resultRows, rowCount: rows.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
