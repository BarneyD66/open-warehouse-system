import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, ListChecks, ShieldCheck } from "lucide-react";
import { buildLaunchGuardTasks, guardStatusLabel, summarizeLaunchGuard, type GuardOwner, type GuardStatus, type LaunchGuardInput } from "@/lib/launchGuard";

type Props = LaunchGuardInput;

const statusTone: Record<GuardStatus, string> = {
  blocked: "border-rose-200 bg-rose-50 text-rose-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
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

function pill(label: string, tone: string) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

export function OpsLaunchGuardPanel(props: Props) {
  const tasks = buildLaunchGuardTasks(props);
  const summary = summarizeLaunchGuard(tasks, props);
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
            {pill(summary.ready ? "可进入上线复核" : summary.blocked > 0 ? "存在阻塞项" : "仍需复核", summary.ready ? statusTone.ready : summary.blocked > 0 ? statusTone.blocked : statusTone.warning)}
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">把上线体检、生产集成、系统健康和系统告警合并成一张责任清单，优先处理会影响真实客户使用的阻塞项。</p>
        </div>
        <div className="flex flex-col gap-3 sm:min-w-[330px]">
          <Link className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100" href="/api/ops/launch-guard?format=csv">
            <Download size={14} />
            导出复核包
          </Link>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-semibold text-rose-700">阻塞项</p>
              <p className="mt-1 text-lg font-semibold text-rose-950">{summary.blocked}</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-700">关注项</p>
              <p className="mt-1 text-lg font-semibold text-amber-950">{summary.warning}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">总评分</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{summary.score}</p>
            </div>
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
                  {pill(guardStatusLabel[task.status], statusTone[task.status])}
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
