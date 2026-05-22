import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("daily_product_sales")
    .select("sale_date")
    .order("sale_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const uniqueDates = Array.from(new Set((data || []).map((row) => row.sale_date)));
  return NextResponse.json({ dates: uniqueDates });
}
