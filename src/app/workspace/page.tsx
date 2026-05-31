import Image from "next/image";
import { WorkspaceAccountPanel } from "../components/WorkspaceAccountPanel";
import { PageShell } from "../components/MarketingShell";

export default function WorkspacePage() {
  return (
    <PageShell surface="marketing">
      <section className="workspace-account-page">
        <Image alt="英国仓客户工作台背景" className="workspace-account-bg" fill priority sizes="100vw" src="/assets/uk-station-hero-system.png" />
        <div className="workspace-account-overlay" />
        <div className="workspace-account-shell">
          <div className="workspace-account-copy">
            <p>英国驿站仓储系统</p>
            <h1>专属仓储工作台</h1>
            <span>我们为英国仓配业务自建的客户系统，覆盖需求提交、SKU、入库、库存、出库、账单、资料和待办。客户可自主注册，也可按自己的业务配置资料、平台和作业信息。</span>
          </div>
          <WorkspaceAccountPanel />
        </div>
      </section>
    </PageShell>
  );
}
