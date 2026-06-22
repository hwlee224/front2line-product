export function money(value: number | null | undefined) {
  const num = Number(value || 0);
  const sign = num > 0 ? "+" : num < 0 ? "-" : "";
  return sign + Math.abs(Math.round(num)).toLocaleString("ko-KR") + "원";
}

export function salesMoney(value: number | null | undefined) {
  return Math.round(Number(value || 0)).toLocaleString("ko-KR") + "원";
}

export function rateText(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const rounded = Math.round(value * 1000) / 10;
  return (value > 0 ? "+" : "") + rounded + "%";
}

// 양수 = 초록(상승), 음수 = 레드(하락), 트래픽 라이트 스타일
export function valueColor(value: number | null | undefined) {
  const num = Number(value || 0);
  if (num > 0) return "text-emerald-600";
  if (num < 0) return "text-[#E8341C]";
  return "text-[#111111]";
}

export function guessDateFromFileName(fileName: string) {
  const yearIndex = fileName.indexOf("년");
  const monthIndex = fileName.indexOf("월");
  const dayIndex = fileName.indexOf("일");
  if (yearIndex < 4 || monthIndex < yearIndex || dayIndex < monthIndex) return "";

  const yearText = fileName.slice(yearIndex - 4, yearIndex);
  if (!/^\d{4}$/.test(yearText)) return "";

  let monthText = "";
  for (let i = yearIndex + 1; i < monthIndex; i++) {
    const ch = fileName[i];
    if (ch >= "0" && ch <= "9") monthText += ch;
  }

  let dayText = "";
  for (let i = monthIndex + 1; i < dayIndex; i++) {
    const ch = fileName[i];
    if (ch >= "0" && ch <= "9") dayText += ch;
  }

  if (!monthText || !dayText) return "";
  return yearText + "-" + monthText.padStart(2, "0") + "-" + dayText.padStart(2, "0");
}

export function compactSpaces(text: string) {
  let result = String(text || "").trim();
  while (result.includes("  ")) result = result.split("  ").join(" ");
  return result;
}

export function normalizeProductName(name: unknown, mergeKeywords: string[]) {
  let result = String(name || "").trim();
  mergeKeywords.forEach((keyword) => {
    if (keyword.trim()) result = result.split(keyword.trim()).join("");
  });
  return compactSpaces(result);
}

export function parseNumber(value: unknown) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "").split(",").join("").split("원").join("").trim();
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function columnToIndex(letter: string) {
  const normalized = String(letter || "").trim().toUpperCase();
  let result = 0;
  for (let i = 0; i < normalized.length; i++)
    result = result * 26 + (normalized.charCodeAt(i) - 64);
  return Math.max(result - 1, 0);
}

export function dayCount(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 1;
  return Math.max(Math.round((e.getTime() - s.getTime()) / 86400000) + 1, 1);
}
