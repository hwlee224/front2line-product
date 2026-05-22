import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "자사몰 제품별 매출 트래킹",
  description: "F2L product sales cumulative",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
