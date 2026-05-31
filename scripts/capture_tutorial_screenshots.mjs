import { chromium } from "playwright";
import { createHmac } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.TUTORIAL_BASE_URL || "http://localhost:3001";
const captureScope = process.env.TUTORIAL_CAPTURE_SCOPE || "all";
const outDir = path.resolve("deliverables", "tutorial-screenshots");

const customer = {
  customerCode: "CUST-202605-3054",
  username: "client-test-20260524@sheffield-test.com",
  email: "tutorial-20260526@sheffield-demo.com",
  password: "Tutorial@2026",
};

async function ensureDir() {
  await fs.mkdir(outDir, { recursive: true });
}

async function loadEnvValue(name) {
  const envPath = path.resolve(".env.local");
  const raw = await fs.readFile(envPath, "utf8").catch(() => "");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    if (key !== name) continue;
    return trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

async function sessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.STAFF_WHITELIST_JSON ||
    (await loadEnvValue("SESSION_SECRET")) ||
    (await loadEnvValue("AUTH_SECRET")) ||
    (await loadEnvValue("NEXTAUTH_SECRET")) ||
    (await loadEnvValue("POSTGRES_URL")) ||
    (await loadEnvValue("DATABASE_URL")) ||
    (await loadEnvValue("STAFF_WHITELIST_JSON")) ||
    "local-development-session-secret"
  );
}

async function signedCustomerSession() {
  const payload = Buffer.from(JSON.stringify({ customerCode: customer.customerCode, username: customer.username }), "utf8").toString("base64url");
  const signature = createHmac("sha256", await sessionSecret()).update(payload).digest("base64url");
  return `v1.${payload}.${signature}`;
}

async function setCustomerSession(context) {
  await context.addCookies([
    {
      name: "uk-warehouse-session",
      value: await signedCustomerSession(),
      url: baseUrl,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
}

async function loginStaff(page, username, password, landingPath) {
  await page.goto(`${baseUrl}/ops-login`, { waitUntil: "networkidle" });
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1600);
  await page.goto(`${baseUrl}${landingPath}`, { waitUntil: "networkidle" });
}

async function markByText(page, labels) {
  const marks = [];
  for (const item of labels) {
    const locator = item.selector
      ? page.locator(item.selector)
      : page.getByText(item.text, { exact: item.exact ?? false });
    const count = await locator.count().catch(() => 0);
    if (!count) continue;
    const target = locator.nth(item.index ?? 0);
    const box = await target.boundingBox().catch(() => null);
    if (!box) continue;
    marks.push({
      n: item.n,
      title: item.title,
      x: Math.max(8, box.x + (item.dx ?? 0)),
      y: Math.max(8, box.y + (item.dy ?? 0)),
    });
  }

  await page.evaluate((items) => {
    document.querySelectorAll(".tutorial-shot-mark").forEach((node) => node.remove());
    const style = document.createElement("style");
    style.className = "tutorial-shot-mark";
    style.textContent = `
      .tutorial-shot-badge {
        position: absolute;
        z-index: 2147483647;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: #e11d48;
        color: #fff;
        border: 3px solid #fff;
        box-shadow: 0 10px 22px rgba(15, 23, 42, .28);
        display: flex;
        align-items: center;
        justify-content: center;
        font: 800 16px/1 Arial, sans-serif;
      }
      .tutorial-shot-label {
        position: absolute;
        z-index: 2147483646;
        max-width: 220px;
        border-radius: 8px;
        background: rgba(15, 23, 42, .92);
        color: #fff;
        padding: 7px 10px 7px 24px;
        box-shadow: 0 10px 22px rgba(15, 23, 42, .20);
        font: 600 13px/1.35 "Microsoft YaHei", Arial, sans-serif;
      }
    `;
    document.head.appendChild(style);
    for (const item of items) {
      const badge = document.createElement("div");
      badge.className = "tutorial-shot-mark tutorial-shot-badge";
      badge.textContent = String(item.n);
      badge.style.left = `${item.x}px`;
      badge.style.top = `${item.y}px`;
      document.body.appendChild(badge);

      const label = document.createElement("div");
      label.className = "tutorial-shot-mark tutorial-shot-label";
      label.textContent = item.title;
      label.style.left = `${item.x + 16}px`;
      label.style.top = `${item.y + 18}px`;
      document.body.appendChild(label);
    }
  }, marks);

  return marks;
}

async function screenshot(page, name, url, labels, options = {}) {
  await page.goto(`${baseUrl}${url}`, { waitUntil: "networkidle" });
  if (options.scrollY) await page.mouse.wheel(0, options.scrollY);
  await page.waitForTimeout(600);
  const marks = await markByText(page, labels);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return { name, file, url, marks };
}

async function main() {
  await ensureDir();
  const browser = await chromium.launch({ headless: true });

  const customerContext = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  const customerPage = await customerContext.newPage();

  const publicContext = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  const publicPage = await publicContext.newPage();

  const staffContext = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  const staffPage = await staffContext.newPage();

  const warehouseContext = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  const warehousePage = await warehouseContext.newPage();

  const shots = [];

  if (captureScope === "all" || captureScope === "customer") {
    shots.push(await screenshot(publicPage, "01-login", "/login", [
      { n: 1, selector: 'input[name="username"]', title: "输入手机号或邮箱" },
      { n: 2, selector: 'input[name="password"]', title: "输入密码" },
      { n: 3, selector: 'button[type="submit"]', title: "登录客户工作台" },
      { n: 4, text: "免费注册", title: "新客户注册入口", dx: -8, dy: -8 },
    ]));

    await setCustomerSession(customerContext);
    shots.push(await screenshot(customerPage, "02-customer-portal", "/portal", [
      { n: 1, text: "我的待办", title: "先处理需要客户确认的事项" },
      { n: 2, text: "提交需求", title: "提交报价和服务需求" },
      { n: 3, text: "入库预报", title: "登记预计到仓货物" },
      { n: 4, text: "SKU 档案", title: "维护商品编码与预警" },
      { n: 5, text: "出库申请", title: "创建发货/一件代发订单" },
      { n: 6, text: "费用账单", title: "查看费用并确认账单" },
      { n: 7, text: "账号资料", title: "维护公司资料和密码" },
    ]));

    shots.push(await screenshot(customerPage, "03-customer-inbound", "/inbound", [
      { n: 1, text: "返回客户工作台", title: "回到首页总览" },
      { n: 2, selector: 'input[name="customer"]', title: "填写公司/店铺名称" },
      { n: 3, selector: 'input[name="cartons"]', title: "填写箱数" },
      { n: 4, selector: 'textarea[name="skuDetails"]', title: "录入 SKU 明细" },
      { n: 5, selector: 'button[type="submit"]', title: "提交入库预报" },
    ]));

    shots.push(await screenshot(customerPage, "04-customer-outbound", "/outbound", [
      { n: 1, text: "返回客户工作台", title: "回到首页总览" },
      { n: 2, selector: 'input[name="recipientName"]', title: "收件人信息" },
      { n: 3, selector: 'textarea[name="address"]', title: "收件地址" },
      { n: 4, selector: 'textarea[name="items"]', title: "SKU 和数量明细" },
      { n: 5, selector: 'button[type="submit"]', title: "提交出库申请" },
    ]));

    shots.push(await screenshot(customerPage, "05-customer-account", "/account", [
      { n: 1, text: "账号状态", title: "查看认证/暂停状态" },
      { n: 2, text: "公司资料", title: "维护公司、VAT、EORI" },
      { n: 3, text: "平台店铺", title: "维护平台与店铺信息" },
      { n: 4, text: "修改密码", title: "客户自主改密" },
    ]));
  }

  if (captureScope === "all" || captureScope === "admin") {
    await loginStaff(staffPage, "ops", "Ops@2026Test", "/ops");
    shots.push(await screenshot(staffPage, "06-ops-overview", "/ops", [
      { n: 1, text: "总览", title: "运营后台总览" },
      { n: 2, text: "询盘", title: "报价与客户需求" },
      { n: 3, text: "入库", title: "入库预报审核" },
      { n: 4, text: "库存", title: "库存、库位、批次" },
      { n: 5, text: "出库", title: "出库申请和波次" },
      { n: 6, text: "物流", title: "渠道、面单、追踪" },
      { n: 7, text: "账单", title: "费用和月结" },
    ]));

    shots.push(await screenshot(staffPage, "07-ops-logistics", "/ops", [
      { n: 1, text: "上线体检", title: "上线前检查项" },
      { n: 2, text: "客户自助工单处理队列", title: "处理客户工单" },
      { n: 3, text: "高级筛选", title: "保存视图和运营报表" },
      { n: 4, text: "权限矩阵", title: "角色权限和敏感操作" },
    ], { scrollY: 1250 }));

    await loginStaff(warehousePage, "warehouse", "Warehouse@2026Test", "/warehouse");
    shots.push(await screenshot(warehousePage, "08-warehouse-workbench", "/warehouse", [
      { n: 1, text: "作业台", title: "扫描 ASN、SKU、库位或面单" },
      { n: 2, text: "入库收货", title: "验货、登记差异、上架" },
      { n: 3, text: "出库拣货", title: "拣货、打包、交运" },
      { n: 4, text: "库位管理", title: "维护库区、货架、库位" },
      { n: 5, text: "打印", title: "打印拣货单和面单" },
    ]));

    shots.push(await screenshot(warehousePage, "09-warehouse-scanning", "/warehouse", [
      { n: 1, selector: 'input[type="search"]', title: "扫码枪输入框" },
      { n: 2, text: "ASN", title: "扫入库单定位任务" },
      { n: 3, text: "SKU", title: "扫商品条码核对商品" },
      { n: 4, text: "库位", title: "扫库位确认上架/拣货位置" },
      { n: 5, text: "异常", title: "发现问题立即登记" },
    ], { scrollY: 450 }));
  }

  await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(shots, null, 2), "utf8");
  await browser.close();
  console.log(JSON.stringify({ outDir, count: shots.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
