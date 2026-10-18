import type { Metadata } from "next";
import { FloatingAIConcierge } from "./components/FloatingAIConcierge";
import "./globals.css";

export const metadata: Metadata = {
  title: "新途跨境 | 仓储、一件代发、退货与 FBA 中转",
  description: "新途跨境面向中国跨境卖家，提供英国本地仓储、一件代发、退货处理、FBA 补仓与账单对账服务。",
  applicationName: "新途跨境",
  openGraph: { title: "新途跨境", siteName: "新途跨境", description: "英国仓储、一件代发、退货与 FBA 中转服务。", locale: "zh_CN", type: "website" },
  twitter: { card: "summary", title: "新途跨境", description: "英国仓储、一件代发、退货与 FBA 中转服务。" },
  icons: {
    icon: "/assets/xintu-crossborder-mark.svg",
    apple: "/assets/xintu-crossborder-mark.svg",
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
