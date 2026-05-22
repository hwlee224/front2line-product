import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "자사몰 제품별/기간별 매출 변화 트래킹",
  description: "자사몰 제품별/기간별 매출 변화 트래킹",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
