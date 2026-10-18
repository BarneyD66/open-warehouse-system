import type { Metadata } from "next";
import { FloatingAIConcierge } from "./components/FloatingAIConcierge";
import "./globals.css";

export const metadata: Metadata = {
  title: "英国驿站 | 仓储、一件代发、退货与 FBA 中转",
  description: "英国驿站面向中国跨境卖家，提供英国本地仓储、一件代发、退货处理、FBA 补仓与账单对账服务。",
  icons: {
    icon: "/assets/uk-station-logo.png",
    apple: "/assets/uk-station-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <FloatingAIConcierge />
      </body>
    </html>
  );
}
