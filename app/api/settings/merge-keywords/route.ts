import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "merge_keywords")
    .single();

  if (error) return NextResponse.json({ keywords: ["[이청아 착용]", "[앵콜 반다]"] });
  return NextResponse.json({ keywords: data?.value || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const keywords = Array.isArray(body.keywords) ? body.keywords : [];

  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({
      key: "merge_keywords",
      value: keywords,
      updated_at: new Date().toISOString(),
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, keywords });
}
