import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET: 가장 최근 AI 분석 결과 반환
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("ai_insights")
      .select("analysis_text, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ text: null });
    }

    return NextResponse.json({
      text: data.analysis_text,
      analyzed_at: data.created_at,
    });
  } catch {
    return NextResponse.json({ text: null });
  }
}

// POST: 최신 데이터 기반으로 AI 분석 실행 후 저장
export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인해주세요." },
      { status: 500 }
    );
  }

  // 최근 30일 매출 데이터 전체 가져오기 (페이지네이션)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const minDate = thirtyDaysAgo.toISOString().slice(0, 10);

  const pageSize = 1000;
  let from = 0;
  let allRows: any[] = [];

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("daily_product_sales")
      .select("sale_date, normalized_product_name, sales_amount")
      .gte("sale_date", minDate)
      .order("sale_date", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data || [];
    allRows = allRows.concat(rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  if (allRows.length === 0) {
    return NextResponse.json(
      { error: "분석할 데이터가 없습니다. 먼저 매출 파일을 업로드해주세요." },
      { status: 400 }
    );
  }

  // 날짜별 제품 매출 집계
  const byDate = new Map<string, Map<string, number>>();
  allRows.forEach((row) => {
    if (!byDate.has(row.sale_date)) byDate.set(row.sale_date, new Map());
    const dateMap = byDate.get(row.sale_date)!;
    dateMap.set(
      row.normalized_product_name,
      (dateMap.get(row.normalized_product_name) || 0) + Number(row.sales_amount)
    );
  });

  // 날짜 내림차순 정렬
  const sortedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));
  const latestDate = sortedDates[0];

  // 최근 7일 vs 이전 7일 비교
  const recentDates = sortedDates.slice(0, 7);
  const prevDates = sortedDates.slice(7, 14);

  const sumForDates = (dates: string[], product: string) =>
    dates.reduce((sum, date) => sum + (byDate.get(date)?.get(product) || 0), 0);

  // 전체 제품 총매출 집계
  const productTotals = new Map<string, number>();
  allRows.forEach((row) => {
    productTotals.set(
      row.normalized_product_name,
      (productTotals.get(row.normalized_product_name) || 0) + Number(row.sales_amount)
    );
  });

  // 상위 10개 제품
  const top10 = Array.from(productTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  const productChanges = top10.map((product) => {
    const recent = sumForDates(recentDates, product);
    const prev = sumForDates(prevDates, product);
    const changeRate = prev > 0 ? ((recent - prev) / prev) * 100 : null;
    return {
      product,
      recent: Math.round(recent),
      prev: Math.round(prev),
      changeRate: changeRate !== null ? Math.round(changeRate * 10) / 10 : null,
    };
  });

  // 전체 매출 합계
  const totalRecent = recentDates.reduce((sum, date) => {
    const m = byDate.get(date);
    if (!m) return sum;
    return sum + Array.from(m.values()).reduce((s, v) => s + v, 0);
  }, 0);

  const totalPrev = prevDates.reduce((sum, date) => {
    const m = byDate.get(date);
    if (!m) return sum;
    return sum + Array.from(m.values()).reduce((s, v) => s + v, 0);
  }, 0);

  const totalChangeRate =
    totalPrev > 0 ? (((totalRecent - totalPrev) / totalPrev) * 100).toFixed(1) : "N/A";

  // Claude에게 보낼 데이터 요약
  const dataText = `
최신 데이터 날짜: ${latestDate}

전체 매출 비교 (최근 ${recentDates.length}일 vs 이전 ${prevDates.length}일):
- 최근: ${Math.round(totalRecent).toLocaleString("ko-KR")}원
- 이전: ${Math.round(totalPrev).toLocaleString("ko-KR")}원
- 변화율: ${totalChangeRate}%

상위 제품별 변화:
${productChanges
  .map(
    (p) =>
      `- ${p.product}: 최근 ${p.recent.toLocaleString("ko-KR")}원 / 이전 ${p.prev.toLocaleString("ko-KR")}원 (${
        p.changeRate !== null
          ? (p.changeRate > 0 ? "+" : "") + p.changeRate + "%"
          : "이전 기간 데이터 없음"
      })`
  )
  .join("\n")}
`.trim();

  // Anthropic API 호출
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: `당신은 프론투라인 자사몰의 제품 매출 분석 전문가입니다. 아래 데이터를 보고 핵심 인사이트와 액션 제언을 작성해주세요.

${dataText}

다음 내용을 3~4문장으로 자연스러운 한국어로 작성하세요:
1. 전체 매출 흐름 한 줄 요약 (수치 포함)
2. 가장 주목할 만한 상승 또는 하락 제품 (수치 포함)
3. 지금 당장 취할 수 있는 구체적인 액션 제언 1가지

딱딱한 보고서 형식 금지. 이모지 없이. 숫자는 반드시 포함. 문어체 금지.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Anthropic API 오류: ${response.status} ${errText}` },
        { status: 500 }
      );
    }

    const result = await response.json();
    const analysisText: string = result.content?.[0]?.text || "";

    if (!analysisText) {
      return NextResponse.json({ error: "AI 응답이 비어 있습니다." }, { status: 500 });
    }

    // Supabase에 저장
    const { error: insertError } = await supabaseAdmin.from("ai_insights").insert({
      analysis_text: analysisText,
      data_snapshot: {
        latestDate,
        totalRecent,
        totalPrev,
        totalChangeRate,
        productChanges,
      },
    });

    if (insertError) {
      // 저장 실패해도 분석 결과는 반환
      console.error("ai_insights 저장 오류:", insertError.message);
    }

    return NextResponse.json({
      text: analysisText,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
