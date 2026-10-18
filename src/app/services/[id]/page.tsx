import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ClipboardCheck, PackageCheck, ReceiptText, RefreshCcw, Truck, Warehouse } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "../../components/MarketingShell";
import { getService, servicePath, serviceSections, serviceStats, type ServiceId } from "../data";
import { surfaceHref } from "@/lib/surfaceLinks";

type PageProps = {
  params: Promise<{ id: string }>;
};

const processIcons = [ClipboardCheck, Warehouse, PackageCheck, Truck, RefreshCcw, ReceiptText];

export function generateStaticParams() {
  return serviceSections.map((service) => ({ id: service.id }));
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const service = getService(id);

  if (!service) {
    return {
      title: "海外仓服务 | 英国驿站",
    };
  }

  return {
    title: `${service.title} | 英国驿站`,
    description: service.body,
  };
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const service = getService(id);

  if (!service) notFound();

  const activeId = service.id as ServiceId;

  return (
    <main className="marketing-shell-fixed-header min-h-screen bg-white text-slate-950">
      <MarketingHeader surface="marketing" />
      <section className="service-page-hero">
        <Image
          alt={service.title}
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src={service.image}
        />
        <div className="service-page-hero-shade" />
        <div className="relative z-10 flex min-h-[62svh] items-center justify-center px-5 pt-24 text-center text-white">
          <div>
            <p className="text-3xl font-semibold sm:text-4xl">{service.title}</p>
            <div className="mx-auto mt-10 h-[2px] w-12 bg-white" />
            <p className="mx-auto mt-8 max-w-2xl text-sm leading-7 text-slate-100 sm:text-base">
              {service.points.join("、")}，按您的平台、货量和库存节奏组合使用。
            </p>
          </div>
        </div>
      </section>

      <nav className="service-page-tabs">
        <div>
          {serviceSections.map((item) => (
            <Link className={item.id === activeId ? "is-active" : ""} href={surfaceHref("marketing", servicePath(item.id))} key={item.id}>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <section className="service-page-stats">
        {serviceStats.map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <div className="service-page-sections service-page-single">
        <section className="service-detail-section" id={service.id}>
          <div className="service-detail-copy">
            <p>{service.title}</p>
            <h1>{service.english}</h1>
            <div className="service-detail-body">
              {service.body}
            </div>
            <div className="service-detail-insights">
              <div>
                <span>当前背景</span>
                <p>{service.context}</p>
              </div>
              <div>
                <span>我们解决</span>
                <p>{service.solution}</p>
              </div>
            </div>
            <div className="service-detail-points">
              {service.points.map((point) => (
                <span key={point}>{point}</span>
              ))}
            </div>
            <Link className="service-detail-link" href={surfaceHref("customer", `/inquiry?service=${encodeURIComponent(service.label)}`)}>
              咨询这项服务 <ArrowRight size={16} />
            </Link>
          </div>
          <div className="service-detail-image">
            <Image alt={service.title} className="object-cover" fill loading="eager" sizes="(min-width: 1024px) 760px, 100vw" src={service.image} />
          </div>
        </section>
      </div>

      <section className="service-process-section">
        <div className="service-process-heading">
          <p>操作流程</p>
          <h2>{service.title}怎么配合，先把每一步讲清楚</h2>
          <span>从资料确认到仓库处理、出库交接和费用核对，关键节点都有记录，方便您判断下一步该准备什么。</span>
        </div>
        <div className="service-process-grid">
          {service.workflow.map(([title, body], index) => {
            const Icon = processIcons[index % processIcons.length];
            return (
              <article className="service-process-card" key={title}>
                <span className="service-process-index">STEP {String(index + 1).padStart(2, "0")}</span>
                <span className="service-process-icon">
                  <Icon size={19} strokeWidth={2.3} />
                </span>
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="service-page-cta">
        <div>
          <p>不确定该选哪项服务？</p>
          <h2>先提交平台、SKU、货量和服务需求，客服会为您判断。</h2>
        </div>
        <Link href={surfaceHref("customer", "/inquiry")}>
          提交需求 <ArrowRight size={16} />
        </Link>
      </section>

      <MarketingFooter />
    </main>
  );
}
