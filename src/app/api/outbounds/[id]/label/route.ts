import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseCustomerSession } from "@/lib/customerAuth";
import { parseStaffSession, staffCookieName } from "@/lib/staffAuth";
import { getWarehouseCoreData, outboundWorkModeLabel, type CoreOutboundOrder } from "@/lib/warehouseCoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeExternalUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeFilename(value: string, fallback: string) {
  const text = value.replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return text || fallback;
}

function labelContentType(order: CoreOutboundOrder, fallback?: string | null) {
  if (fallback) return fallback;
  if (order.labelFormat === "zpl") return "application/octet-stream";
  if (order.labelFormat === "pdf") return "application/pdf";
  return "text/html; charset=utf-8";
}

function internalLabelHtml(order: CoreOutboundOrder) {
  const fee = typeof order.shippingFee === "number" ? `£${order.shippingFee.toFixed(2)}` : "-";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>面单-${escapeHtml(order.id)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: Arial, "Microsoft YaHei", sans-serif; }
    main { min-height: 100vh; padding: 32px; }
    .toolbar { max-width: 620px; margin: 0 auto 16px; text-align: right; }
    button { min-height: 36px; border: 1px solid #cbd5e1; background: white; border-radius: 6px; padding: 0 12px; font-weight: 700; cursor: pointer; }
    section { max-width: 620px; margin: 0 auto; background: white; border: 2px solid #0f172a; border-radius: 8px; padding: 24px; }
    header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 16px; }
    h1 { margin: 8px 0 0; font-size: 28px; }
    .muted { color: #64748b; font-size: 12px; font-weight: 700; }
    .service { margin-top: 6px; color: #475569; font-weight: 700; }
    .address { margin-top: 24px; }
    .name { margin-top: 6px; font-size: 22px; font-weight: 800; }
    .addr { margin-top: 10px; white-space: pre-line; line-height: 1.6; font-size: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 13px; }
    .tracking { margin-top: 20px; border: 1px solid #0f172a; padding: 18px; text-align: center; }
    .tracking strong { display: block; margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 26px; letter-spacing: 2px; }
    @media print { body { background: white; } main { padding: 12px; } .toolbar { display: none; } section { box-shadow: none; } }
  </style>
</head>
<body>
  <main>
    <div class="toolbar"><button onclick="window.print()">打印面单</button></div>
    <section>
      <header>
        <div>
          <div class="muted">出货标签 / 系统面单</div>
          <h1>${escapeHtml(order.carrierName || "待分配承运商")}</h1>
          <div class="service">${escapeHtml(order.carrierServiceName || order.channel)}</div>
        </div>
        <div style="text-align:right">
          <div class="muted">出库单</div>
          <strong>${escapeHtml(order.id)}</strong>
        </div>
      </header>
      <div class="address">
        <div class="muted">收件信息</div>
        <div class="name">${escapeHtml(order.recipientName || "收件人待补")}</div>
        <div class="addr">${escapeHtml(order.deliveryAddress || "地址待补")}</div>
      </div>
      <div class="grid">
        <div>客户：${escapeHtml(order.customerCode)}</div>
        <div>模式：${escapeHtml(outboundWorkModeLabel(order.workMode))}</div>
        <div>波次：${escapeHtml(order.pickWaveNo || "-")}</div>
        <div>篮号：${escapeHtml(order.basketNo || "-")}</div>
        <div>订单数：${escapeHtml(order.orderCount)}</div>
        <div>期望发货：${escapeHtml(order.requestedShipDate || "-")}</div>
        <div>重量/件数：${escapeHtml(order.packageWeightKg ?? "-")}kg / ${escapeHtml(order.packageCount ?? 1)}</div>
        <div>费用：${escapeHtml(fee)}</div>
      </div>
      <div class="tracking">
        <div class="muted">追踪号</div>
        <strong>${escapeHtml(order.trackingNumber || order.id)}</strong>
        <p class="muted">内部面单可用于仓内打包复核；真实承运商面单会通过系统鉴权后直接预览或下载。</p>
      </div>
    </section>
  </main>
</body>
</html>`;
}

async function externalLabelResponse(order: CoreOutboundOrder, externalUrl: string) {
  const response = await fetch(externalUrl, { cache: "no-store" }).catch(() => null);
  if (!response?.ok || !response.body) return null;

  const contentType = labelContentType(order, response.headers.get("content-type"));
  const extension = order.labelFormat === "zpl" ? "zpl" : order.labelFormat === "pdf" ? "pdf" : "label";
  const filename = safeFilename(`${order.id}-${order.trackingNumber || "label"}.${extension}`, `${order.id}.${extension}`);
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `inline; filename="${filename}"`);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new NextResponse(response.body, { headers });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const customer = parseCustomerSession(cookieStore.get("uk-warehouse-session")?.value);
  const staff = parseStaffSession(cookieStore.get(staffCookieName)?.value);
  if (!customer && !staff) return NextResponse.json({ error: "请先登录后再查看面单。" }, { status: 401 });

  const { id } = await params;
  const data = await getWarehouseCoreData();
  const order = data.outboundOrders.find((item) => item.id === decodeURIComponent(id));
  if (!order) return NextResponse.json({ error: "未找到出库单。" }, { status: 404 });
  if (customer && order.customerCode !== customer.customerCode) return NextResponse.json({ error: "当前账号无权查看该面单。" }, { status: 403 });
  if (order.labelStatus !== "generated") return NextResponse.json({ error: "该出库单尚未生成面单。" }, { status: 404 });

  const externalUrl = safeExternalUrl(order.labelUrl);
  if (externalUrl && order.labelFormat !== "internal") {
    const proxied = await externalLabelResponse(order, externalUrl);
    if (proxied) return proxied;
    const response = NextResponse.redirect(externalUrl, { status: 302 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }

  return new NextResponse(internalLabelHtml(order), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
