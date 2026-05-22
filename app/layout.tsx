import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FRONT2LINE 제품별 매출 누적 BI",
  description: "FRONT2LINE product sales cumulative BI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
