import { chromium } from "playwright";
import path from "node:path";

const baseUrl = process.env.GUIDE_BASE_URL || "http://127.0.0.1:3074";
const username = process.env.GUIDE_USERNAME;
const password = process.env.GUIDE_PASSWORD;

if (!username || !password) {
  throw new Error("GUIDE_USERNAME and GUIDE_PASSWORD are required.");
}

const outputDir = path.join(process.cwd(), "public", "assets", "guides", "workbench");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  colorScheme: "light",
  deviceScaleFactor: 1,
  locale: "zh-CN",
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();

async function fill(label, value) {
  const field = page.getByLabel(label).first();
  await field.fill(value);
}

async function captureForm(route, formText, filename, fillForm) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await fillForm();
  const form = page.locator("form").filter({ hasText: formText }).first();
  await form.scrollIntoViewIfNeeded();
  await form.screenshot({ path: path.join(outputDir, filename) });
}

await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
await page.locator('input[name="username"]').fill(username);
await page.locator('input[name="password"]').fill(password);
await page.locator('button[type="submit"]').click();
await page.waitForURL(/\/(portal|workspace)/, { timeout: 15_000 });

await captureForm("/account", "店铺联系资料", "account-profile-focus.png", async () => {
  await fill("公司 / 店铺名称", "跨境家居店");
  await fill("联系人", "业务联系人");
  await fill("手机号", "07•• •••• ••••");
  await fill("微信号（可选）", "");
  await fill("邮箱", "");
  await fill("平台 / 店铺", "TikTok Shop 英国站");
  await fill("店铺链接", "");
  await fill("常用发货备注", "默认使用环保包材；易碎商品需要加固");
});

await captureForm("/skus", "新增 SKU", "sku-create-focus.png", async () => {
  await fill("SKU 编码", "HOME-BOTTLE-500-BLK");
  await fill("商品名称", "不锈钢保温杯 500ml 黑色");
  await fill("条码", "");
  await fill("分类", "家居用品");
  await fill("库存预警值", "20");
});

await captureForm("/inbound", "提交入库预报", "inbound-basics-focus.png", async () => {
  await fill("客户 / 店铺名称", "跨境家居店");
  await fill("联系人", "业务联系人");
  await fill("手机 / 微信", "已填写常用联系方式");
  await fill("承运商 / 追踪号", "RM000000000GB");
  await fill("主要品名", "保温杯与包装物料");
  await fill("SKU 明细", "HOME-BOTTLE-500-BLK, 不锈钢保温杯 500ml 黑色, 120, 3\nPKG-MAILER-M, 环保气泡袋, 120, 1");
});

await captureForm("/outbound", "创建出库申请", "outbound-create-focus.png", async () => {
  await fill("尾程渠道", "Royal Mail Tracked 48");
  await fill("订单数", "1");
  await fill("收件人 *", "收件人姓名");
  await fill("出库 SKU 明细", "HOME-BOTTLE-500-BLK,2");
  await fill("完整收件地址（含英国邮编）*", "门牌与街道\n城市\n英国邮编");
  await fill("补充说明", "使用环保包材并加固");
});

await captureForm("/returns", "创建退货预报", "returns-create-focus.png", async () => {
  await fill("销售平台", "TikTok Shop");
  await fill("原订单号", "ORDER-UK-0001");
  await fill("买家退货追踪号", "RM000000001GB");
  await fill("退货 SKU 明细", "HOME-BOTTLE-500-BLK,1");
  await fill("退货原因", "买家反馈尺寸不合适，商品未使用");
  await fill("处理偏好", "外观完好请重新上架；如有破损请先拍照确认");
});

await browser.close();
