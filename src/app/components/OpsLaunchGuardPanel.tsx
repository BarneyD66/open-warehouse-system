import Link from "next/link";
import { AlertTriangle, CheckCircle2, ListChecks, ShieldCheck } from "lucide-react";
import type { LaunchReadiness } from "@/lib/launchReadiness";
import type { OpsSystemHealth, OpsSystemHealthStatus } from "@/lib/opsSystemHealth";
import type { IntegrationReadinessStatus, ProductionIntegrationReadiness } from "@/lib/productionIntegrationReadiness";
import type { SystemAlert } from "@/lib/systemAlertStore";

type GuardStatus = "blocked" | "warning" | "ready";
type GuardOwner = "产品" | "前端" | "后端" | "运营" | "运维" | "仓库" | "财务";

type GuardTask = {
  id: string;
  source: string;
  owner: GuardOwner;
  status: GuardStatus;
  title: string;
  detail: string;
  nextAction: string;
  href?: string;
};

type Props = {
  launchReadiness: LaunchReadiness;
  integrationReadiness: ProductionIntegrationReadiness;
  systemHealth: OpsSystemHealth;
  alerts: SystemAlert[];
};

const statusTone: Record<GuardStatus, string> = {
  blocked: "border-rose-200 bg-rose-50 text-rose-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const statusLabel: Record<GuardStatus, string> = {
  blocked: "必须处理",
  warning: "需要关注",
  ready: "已就绪",
};

const ownerTone: Record<GuardOwner, string> = {
  产品: "border-violet-200 bg-violet-50 text-violet-800",
  前端: "border-cyan-200 bg-cyan-50 text-cyan-800",
  后端: "border-slate-200 bg-slate-50 text-slate-700",
  运营: "border-amber-200 bg-amber-50 text-amber-800",
  运维: "border-rose-200 bg-rose-50 text-rose-800",
  仓库: "border-emerald-200 bg-emerald-50 text-emerald-800",
  财务: "border-indigo-200 bg-indigo-50 text-indigo-800",
};

const integrationGroupLabel: Record<ProductionIntegrationReadiness["items"][number]["group"], string> = {
  carrier: "承运商 API",
  notification: "消息通知",
  platform: "平台订单 API",
  reporting: "报表投递",
  security: "安全运维",
  storage: "文件存储",
};

function pill(label: string, tone: string) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function launchStatus(status: LaunchReadiness["checks"][number]["status"]): GuardStatus {
  if (status === "fail") return "blocked";
  if (status === "warn") return "warning";
  return "ready";
}

function integrationStatus(status: IntegrationReadinessStatus): GuardStatus {
  if (status === "blocked") return "blocked";
  if (status === "partial") return "warning";
  return "ready";
}

function healthStatus(status: OpsSystemHealthStatus): GuardStatus {
  if (status === "critical") return "blocked";
  if (status === "degraded") return "warning";
  return "ready";
}

function launchOwner(id: string): GuardOwner {
  if (["shared-db", "document-storage", "demo-login", "backup-readiness"].includes(id)) return "后端";
  if (id === "surface-routing") return "前端";
  if (id === "billing-readiness") return "财务";
  if (id === "location-capacity") return "仓库";
  if (["carrier-integration", "platform-api-sync", "staff-whitelist", "document-security"].includes(id)) return "运营";
  return "产品";
}

function integrationOwner(group: ProductionIntegrationReadiness["items"][number]["group"]): GuardOwner {
  if (group === "storage" || group === "security") return "运维";
  if (group === "reporting") return "运营";
  return "运营";
}

function healthOwner(id: string): GuardOwner {
  if (["database", "production-errors", "integration-probes", "file-security"].includes(id)) return "运维";
  if (id === "notification-delivery") return "运营";
  if (id === "staff-governance") return "运营";
  if (id === "job-queue") return "运营";
  return "产品";
}

function alertOwner(source: SystemAlert["source"]): GuardOwner {
  if (source === "billing") return "财务";
  if (source === "warehouse") return "仓库";
  if (source === "system" || source === "readiness") return "运维";
  return "运营";
}

function taskRank(task: GuardTask) {
  const statusRank: Record<GuardStatus, number> = { blocked: 0, warning: 1, ready: 2 };
  const ownerRank: Record<GuardOwner, number> = { 运维: 0, 后端: 1, 运营: 2, 仓库: 3, 财务: 4, 产品: 5, 前端: 6 };
  return statusRank[task.status] * 10 + ownerRank[task.owner];
}

function dedupeTasks(tasks: GuardTask[]) {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = `${task.source}:${task.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildGuardTasks({ launchReadiness, integrationReadiness, systemHealth, alerts }: Props) {
  const launchTasks = launchReadiness.checks
    .filter((check) => check.status !== "pass")
    .map<GuardTask>((check) => ({
      id: `launch:${check.id}`,
      source: "上线体检",
      owner: launchOwner(check.id),
      status: launchStatus(check.status),
      title: check.label,
      detail: check.detail,
      nextAction: check.status === "fail" ? "先处理该阻塞项，再进行发版或开放给真实客户。" : "上线前完成复核，避免试运行时变成阻塞。",
      href: "/ops?section=overview",
    }));

  const integrationTasks = integrationReadiness.items
    .filter((item) => item.status !== "ready")
    .map<GuardTask>((item) => ({
      id: `integration:${item.id}`,
      source: integrationGroupLabel[item.group],
      owner: integrationOwner(item.group),
      status: integrationStatus(item.status),
      title: item.name,
      detail: item.summary,
      nextAction: item.nextActions[0] || "补齐生产环境变量、正式授权和联调验收。",
      href: "/ops?section=overview",
    }));

  const healthTasks = systemHealth.checks
    .filter((check) => check.status !== "healthy")
    .map<GuardTask>((check) => ({
      id: `health:${check.id}`,
      source: "系统健康",
      owner: healthOwner(check.id),
      status: healthStatus(check.status),
      title: check.label,
      detail: check.detail,
      nextAction: check.status === "critical" ? "当天必须确认并处理，处理后再重新执行健康检查。" : "安排负责人复核，确认是否需要环境变量、权限或数据修复。",
      href: check.actionHref || "/ops?section=overview",
    }));

  const alertTasks = alerts
    .filter((alert) => alert.handlingStatus === "open" && alert.severity !== "info")
    .map<GuardTask>((alert) => ({
      id: `alert:${alert.id}`,
      source: "系统告警",
      owner: alertOwner(alert.source),
      status: alert.severity === "critical" ? "blocked" : "warning",
      title: alert.title,
      detail: alert.detail,
      nextAction: "在系统告警中确认、搁置或关闭，并补充处理备注。",
      href: alert.actionHref || "/ops?section=overview",
    }));

  return dedupeTasks([...alertTasks, ...launchTasks, ...integrationTasks, ...healthTasks]).sort((a, b) => taskRank(a) - taskRank(b) || a.title.localeCompare(b.title));
}

export function OpsLaunchGuardPanel(props: Props) {
  const tasks = buildGuardTasks(props);
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const warning = tasks.filter((task) => task.status === "warning").length;
  const ready = blocked === 0 && warning === 0;
  const ownerRows = (["运维", "后端", "运营", "仓库", "财务", "产品", "前端"] as GuardOwner[])
    .map((owner) => ({
      owner,
      blocked: tasks.filter((task) => task.owner === owner && task.status === "blocked").length,
      warning: tasks.filter((task) => task.owner === owner && task.status === "warning").length,
    }))
    .filter((row) => row.blocked + row.warning > 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <ListChecks size={18} className="text-[#0E7490]" />
              上线守门板
            </h2>
            {pill(ready ? "可进入上线复核" : blocked > 0 ? "存在阻塞项" : "仍需复核", ready ? statusTone.ready : blocked > 0 ? statusTone.blocked : statusTone.warning)}
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">把上线体检、生产集成、系统健康和系统告警合并成一张责任清单，优先处理会影响真实客户使用的阻塞项。</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[330px]">
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-semibold text-rose-700">阻塞项</p>
            <p className="mt-1 text-lg font-semibold text-rose-950">{blocked}</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700">关注项</p>
            <p className="mt-1 text-lg font-semibold text-amber-950">{warning}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">总评分</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{Math.min(props.launchReadiness.score, props.integrationReadiness.score, props.systemHealth.score)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertTriangle size={15} className="text-amber-700" />
            优先处理清单
          </h3>
          <div className="mt-3 grid gap-2">
            {tasks.slice(0, 8).map((task) => (
              <div className="rounded-md bg-white p-3" key={task.id}>
                <div className="flex flex-wrap items-center gap-2">
                  {pill(statusLabel[task.status], statusTone[task.status])}
                  {pill(task.owner, ownerTone[task.owner])}
                  <span className="text-xs font-semibold text-slate-500">{task.source}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-950">{task.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{task.detail}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-cyan-800">下一步：{task.nextAction}</p>
                {task.href ? (
                  <Link className="mt-2 inline-flex text-xs font-semibold text-slate-700 hover:text-cyan-800" href={task.href}>
                    去处理
                  </Link>
                ) : null}
              </div>
            ))}
            {tasks.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-white p-3 text-sm font-semibold text-emerald-800">
                <CheckCircle2 size={15} />
                当前上线体检、集成配置、系统健康和告警均未发现阻塞项。
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ShieldCheck size={15} className="text-cyan-700" />
            负责人分布
          </h3>
          <div className="mt-3 grid gap-2">
            {ownerRows.map((row) => (
              <div className="rounded-md bg-white p-3 text-sm" key={row.owner}>
                <div className="flex items-center justify-between gap-2">
                  {pill(row.owner, ownerTone[row.owner])}
                  <span className="text-xs font-semibold text-slate-500">{row.blocked + row.warning} 项</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">必须处理 {row.blocked} 项，需要关注 {row.warning} 项。</p>
              </div>
            ))}
            {ownerRows.length === 0 ? <p className="rounded-md bg-white p-3 text-sm text-slate-500">暂无待分派事项。</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
