import { PageShell } from "../components/MarketingShell";
import { StaffLoginForm } from "../components/StaffLoginForm";

const roleCards = [
  ["运营账号", "处理询盘、报价、入库审核、物流异常和客户沟通。"],
  ["仓库账号", "处理扫码收货、库位、拣货、复核、打包和交接。"],
  ["管理员账号", "管理员工白名单、客户状态、权限和系统配置。"],
];

export default function OpsLoginPage() {
  return (
    <PageShell surface="admin">
      <div className="bg-slate-100 pt-24 text-slate-950">
        <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl items-center gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <span className="inline-flex rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">员工白名单</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">登录运营后台</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              运营后台只允许已加入员工白名单的账号登录。客服、运营、仓库和管理员在这里处理询盘、入库、库存、出库、物流异常和账单。
            </p>
            <div className="mt-5 grid gap-3">
              {roleCards.map(([title, body]) => (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={title}>
                  <p className="text-sm font-semibold text-slate-950">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <StaffLoginForm />
        </div>
      </div>
    </PageShell>
  );
}
