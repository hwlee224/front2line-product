import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "자사몰 제품별/기간별 매출 변화 트래킹",
  description: "자사몰 일별 매출 데이터를 누적 저장하고 원하는 기간별 제품 매출 변화를 비교하는 내부 트래킹 도구",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
