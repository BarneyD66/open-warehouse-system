const WebSocket = require("next/dist/compiled/ws");

const channel = process.argv[2] || "1m3ovxfy";
const ws = new WebSocket("ws://localhost:3055");

function commandId() {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function color(hex, a = 1) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
    a,
  };
}

function sendRaw(payload) {
  ws.send(JSON.stringify(payload));
}

function sendCommand(command, params = {}, timeoutMs = 20000) {
  const id = commandId();
  const payload = {
    id,
    type: command === "join" ? "join" : "message",
    channel,
    message: {
      id,
      command,
      params: {
        ...params,
        commandId: id,
      },
    },
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error(`Timed out waiting for ${command}`));
    }, timeoutMs);

    function onMessage(raw) {
      const data = JSON.parse(raw.toString());
      const message = data.message;
      if (message && message.id === id && (message.result || message.error)) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        if (message.error) reject(new Error(message.error));
        else resolve(message.result);
      }
    }

    ws.on("message", onMessage);
    sendRaw(payload);
  });
}

async function frame(name, x, y, width, height, fill = "#FFFFFF", stroke = "#E2E8F0", radius = 10, parentId) {
  const result = await sendCommand("create_frame", {
    name,
    x,
    y,
    width,
    height,
    parentId,
    fillColor: color(fill),
    strokeColor: color(stroke),
    strokeWeight: 1,
  });
  if (radius > 0) {
    await sendCommand("set_corner_radius", { nodeId: result.id, radius });
  }
  return result;
}

async function label(text, x, y, options = {}) {
  return sendCommand("create_text", {
    name: options.name || text.slice(0, 32),
    x,
    y,
    text,
    fontSize: options.size || 14,
    fontWeight: options.weight || 400,
    fontColor: color(options.color || "#0F172A"),
    parentId: options.parentId,
  });
}

async function chip(text, x, y, options = {}) {
  const padding = options.padding || 14;
  const width = options.width || Math.max(72, text.length * 14 + padding * 2);
  const height = options.height || 38;
  const box = await frame(
    `Chip / ${text}`,
    x,
    y,
    width,
    height,
    options.fill || "#FFFFFF",
    options.stroke || "#CBD5E1",
    6,
    options.parentId,
  );
  await label(text, x + padding, y + 10, {
    size: options.size || 13,
    weight: 600,
    color: options.color || "#1E293B",
    parentId: options.parentId,
  });
  return box;
}

async function main() {
  await new Promise((resolve) => ws.on("open", resolve));
  await sendCommand("join", { channel });
  console.log(`Joined channel ${channel}`);

  const board = await frame("01 官网导航重构", 0, 0, 1920, 1360, "#F4F7F9", "#F4F7F9", 0);

  await label("官网导航重构", 80, 70, { size: 40, weight: 700, parentId: board.id });
  await label(
    "把“分类标签”和“页面入口”分开：公开官网只保留服务、流程、价格、帮助、仓库位置；客户操作用右侧 CTA 和登录后工作台承接。",
    80,
    132,
    { size: 17, weight: 400, color: "#475569", parentId: board.id },
  );

  const old = await frame("旧版问题标注", 80, 220, 760, 300, "#FFFFFF", "#E2E8F0", 12, board.id);
  await label("旧版问题", 110, 248, { size: 22, weight: 700, parentId: board.id });
  await label("分类标签和真实页面入口都长得像按钮，客户不知道“客户官网 / 客户操作”到底能不能点。", 110, 286, {
    size: 15,
    color: "#64748B",
    parentId: board.id,
  });
  const oldRow1 = ["客户官网", "服务项目", "操作流程", "价格计费", "帮助中心", "谢菲尔德仓"];
  const oldRow2 = ["客户操作", "客户登录", "提交询盘", "入库预报", "查进度"];
  for (let i = 0, x = 110; i < oldRow1.length; i += 1) {
    const isGroup = i === 0;
    await chip(oldRow1[i], x, 346, {
      fill: isGroup ? "#F1F5F9" : "#FFFFFF",
      stroke: isGroup ? "#F1F5F9" : "#CBD5E1",
      color: "#1E293B",
      parentId: board.id,
    });
    x += oldRow1[i].length > 4 ? 116 : 94;
  }
  for (let i = 0, x = 110; i < oldRow2.length; i += 1) {
    const isGroup = i === 0;
    await chip(oldRow2[i], x, 404, {
      fill: isGroup ? "#F1F5F9" : "#FFFFFF",
      stroke: isGroup ? "#F1F5F9" : "#CBD5E1",
      color: "#1E293B",
      parentId: board.id,
    });
    x += oldRow2[i].length > 4 ? 116 : 94;
  }
  await frame("Warning dot", 110, 474, 14, 14, "#F97316", "#F97316", 999, board.id);
  await label("结论：移除分类标签按钮，只保留真正可点击的页面入口。", 134, 468, {
    size: 15,
    weight: 600,
    color: "#9A3412",
    parentId: board.id,
  });

  const desktop = await frame("新版桌面导航 / Desktop", 900, 220, 900, 300, "#FFFFFF", "#E2E8F0", 12, board.id);
  await label("新版桌面导航", 930, 248, { size: 22, weight: 700, parentId: board.id });
  await label("主导航只讲官网内容；客户动作放到右侧 CTA 区。", 930, 286, {
    size: 15,
    color: "#64748B",
    parentId: board.id,
  });
  await frame("Desktop nav shell", 930, 336, 840, 86, "#FFFFFF", "#E2E8F0", 10, board.id);
  await frame("Logo mark", 956, 358, 42, 42, "#0F172A", "#0F172A", 8, board.id);
  await label("W", 970, 368, { size: 16, weight: 700, color: "#FFFFFF", parentId: board.id });
  await label("UK Fulfilment OS", 1012, 354, { size: 12, color: "#64748B", parentId: board.id });
  await label("英国海外仓运营系统", 1012, 376, { size: 15, weight: 600, parentId: board.id });
  const navItems = ["服务项目", "操作流程", "价格计费", "帮助中心", "谢菲尔德仓"];
  for (let i = 0; i < navItems.length; i += 1) {
    await label(navItems[i], 1210 + i * 78, 370, { size: 13, weight: 600, color: "#334155", parentId: board.id });
  }
  await chip("客户登录", 1568, 360, { fill: "#ECFEFF", stroke: "#A5F3FC", color: "#155E75", parentId: board.id });
  await chip("创建入库预报", 1666, 360, { fill: "#0F172A", stroke: "#0F172A", color: "#FFFFFF", width: 118, parentId: board.id });
  await label("原则：导航回答“我想了解什么”；按钮回答“我下一步要做什么”。", 930, 462, {
    size: 15,
    weight: 600,
    color: "#0E7490",
    parentId: board.id,
  });

  const mobile = await frame("新版移动端导航 / Mobile 390", 80, 590, 390, 650, "#FFFFFF", "#CBD5E1", 28, board.id);
  await frame("Mobile logo", 106, 622, 40, 40, "#0F172A", "#0F172A", 8, board.id);
  await label("W", 119, 632, { size: 15, weight: 700, color: "#FFFFFF", parentId: board.id });
  await label("英国海外仓运营系统", 160, 621, { size: 15, weight: 600, parentId: board.id });
  await label("UK Fulfilment OS", 160, 646, { size: 12, color: "#64748B", parentId: board.id });
  await chip("登录", 382, 624, { fill: "#ECFEFF", stroke: "#A5F3FC", color: "#155E75", width: 62, parentId: board.id });
  await frame("Mobile primary CTA", 106, 700, 338, 70, "#0F172A", "#0F172A", 10, board.id);
  await label("创建入库预报", 128, 720, { size: 16, weight: 600, color: "#FFFFFF", parentId: board.id });
  await label("准备发货到英国仓时优先使用", 128, 744, { size: 12, color: "#CBD5E1", parentId: board.id });
  await label("常用入口", 106, 812, { size: 15, weight: 700, parentId: board.id });
  const mobileItems = ["查进度", "提交询盘", "服务项目", "价格计费", "帮助中心"];
  for (let i = 0; i < mobileItems.length; i += 1) {
    const y = 848 + i * 62;
    await frame(`Mobile item / ${mobileItems[i]}`, 106, y, 338, 48, "#FFFFFF", "#E2E8F0", 8, board.id);
    await label(mobileItems[i], 126, y + 15, { size: 14, weight: 600, color: "#1E293B", parentId: board.id });
    await label("›", 414, y + 8, { size: 24, color: "#64748B", parentId: board.id });
  }
  await label("移动端规则：一级只放 1 个主按钮 + 5 个常用入口，避免横向滚动。", 106, 1170, {
    size: 12,
    color: "#64748B",
    parentId: board.id,
  });

  const rules = await frame("导航组件规范", 520, 590, 1280, 650, "#FFFFFF", "#E2E8F0", 12, board.id);
  await label("导航组件规范", 552, 622, { size: 26, weight: 700, parentId: board.id });
  await label("用于官网、客户工作台、内部后台三套界面分流。", 552, 666, {
    size: 15,
    color: "#64748B",
    parentId: board.id,
  });
  const columns = [
    ["公开官网", "服务项目 / 操作流程 / 价格计费 / 帮助中心 / 谢菲尔德仓", "右侧 CTA：客户登录、提交询盘、创建入库预报、查进度", "#0E7490"],
    ["客户工作台", "工作台 / 入库预报 / 查进度 / 补交资料 / 费用账单", "不出现官网介绍、内部后台、开发说明", "#059669"],
    ["内部后台", "运营后台 / 后续 WMS 作业台", "只给客服、运营、仓库和财务使用", "#D97706"],
  ];
  for (let i = 0; i < columns.length; i += 1) {
    const x = 552 + i * 405;
    await frame(`Spec card / ${columns[i][0]}`, x, 720, 370, 220, "#F8FAFC", "#E2E8F0", 10, board.id);
    await frame(`Spec mark / ${columns[i][0]}`, x + 20, 744, 44, 44, columns[i][3], columns[i][3], 8, board.id);
    await label(String(i + 1), x + 36, 756, { size: 16, weight: 700, color: "#FFFFFF", parentId: board.id });
    await label(columns[i][0], x + 78, 744, { size: 18, weight: 700, parentId: board.id });
    await label(columns[i][1], x + 20, 812, { size: 14, weight: 600, color: "#334155", parentId: board.id });
    await label(columns[i][2], x + 20, 874, { size: 13, color: "#64748B", parentId: board.id });
  }
  await label("交互规则", 552, 1000, { size: 18, weight: 700, parentId: board.id });
  const ruleList = [
    "分类词不做成按钮，避免用户误点。",
    "公开官网优先建立信任，客户操作入口作为 CTA 出现。",
    "客户登录后只看自己的业务，不出现官网营销和内部后台。",
    "移动端不横向滚动；入口收敛为主按钮 + 列表。",
    "内部后台与客户域名分离，避免误发给客户。",
  ];
  for (let i = 0; i < ruleList.length; i += 1) {
    const y = 1038 + i * 38;
    await frame(`Rule ${i + 1}`, 552, y, 24, 24, "#ECFEFF", "#A5F3FC", 999, board.id);
    await label(String(i + 1), 560, y + 4, { size: 12, weight: 700, color: "#0E7490", parentId: board.id });
    await label(ruleList[i], 588, y + 3, { size: 14, color: "#334155", parentId: board.id });
  }
  await label("对应线上页面", 1240, 1000, { size: 18, weight: 700, parentId: board.id });
  const links = [
    ["官网", "https://sheffield-warehouse-web.vercel.app"],
    ["客户工作台", "https://sheffield-warehouse-app.vercel.app/login"],
    ["内部后台", "https://sheffield-warehouse-admin.vercel.app/ops"],
  ];
  for (let i = 0; i < links.length; i += 1) {
    const y = 1038 + i * 54;
    await frame(`Link / ${links[i][0]}`, 1240, y, 500, 42, "#FFFFFF", "#E2E8F0", 8, board.id);
    await label(links[i][0], 1260, y + 12, { size: 13, weight: 600, parentId: board.id });
    await label(links[i][1], 1360, y + 12, { size: 13, color: "#0E7490", parentId: board.id });
  }

  console.log("Created Figma navigation redesign board");
  ws.close();
}

main().catch((error) => {
  console.error(error);
  ws.close();
  process.exit(1);
});
