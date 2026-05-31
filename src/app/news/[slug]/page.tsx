import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "../../components/MarketingShell";
import { surfaceHref } from "@/lib/surfaceLinks";
import { getNewsArticle, newsArticles } from "../data";

export function generateStaticParams() {
  return newsArticles.map((article) => ({ slug: article.slug }));
}

type NewsDetailParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: NewsDetailParams }) {
  const { slug } = await params;
  const article = getNewsArticle(slug);
  if (!article) return {};

  return {
    title: `${article.title} | 英国驿站`,
    description: article.summary,
  };
}

export default async function NewsDetailPage({ params }: { params: NewsDetailParams }) {
  const { slug } = await params;
  const article = getNewsArticle(slug);
  if (!article) notFound();

  return (
    <main className="marketing-shell-fixed-header min-h-screen bg-white text-slate-950">
      <MarketingHeader surface="marketing" />

      <section className="news-page-hero news-detail-hero">
        <Image alt={article.title} className="object-cover" fill priority sizes="100vw" src={article.image} />
        <div className="news-page-hero-overlay" />
        <div className="news-page-hero-content">
          <p>{article.categoryLabelEn}</p>
          <h1>{article.categoryLabel}</h1>
          <span />
        </div>
      </section>

      <article className="news-article-shell">
        <Link className="news-back-link" href={surfaceHref("marketing", "/news")}>
          <ArrowLeft size={15} /> 返回列表
        </Link>

        <header className="news-article-header">
          <div className="news-article-meta">
            <span>{article.date}</span>
            <span>{article.categoryLabel}</span>
            {article.readTime ? <span>{article.readTime}</span> : null}
          </div>
          <h2>{article.title}</h2>
          <p>{article.summary}</p>
        </header>

        <div className="news-article-layout">
          <div className="news-article-content">
            {article.highlights?.length ? (
              <div className="news-article-brief">
                <p>运营观察</p>
                <ul>
                  {article.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {article.sections?.length
              ? article.sections.map((section) => (
                  <section className="news-article-section" key={section.title}>
                    <h3>{section.title}</h3>
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </section>
                ))
              : article.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}

            <div className="news-article-note">
              <strong>我们的建议</strong>
              <p>
                {article.closingNote ??
                  "如果您正在评估英国仓配，建议先用一票货把入仓、上架、出库、退货和费用核对流程跑通。等数据稳定后，再决定是否扩大备货和增加平台渠道。"}
              </p>
            </div>

            <a className="news-source-link" href={article.sourceUrl} rel="noreferrer" target={article.sourceUrl.startsWith("http") ? "_blank" : undefined}>
              参考来源：{article.sourceName} <ArrowRight size={15} />
            </a>
          </div>

          <aside className="news-article-aside">
            {article.audience ? (
              <div className="news-side-card news-side-card-dark">
                <span>适合阅读</span>
                <p>{article.audience}</p>
              </div>
            ) : null}
            {article.checklist?.length ? (
              <div className="news-side-card">
                <h3>{article.checklistTitle ?? "行动清单"}</h3>
                <ul>
                  {article.checklist.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={17} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="news-side-card news-side-cta">
              <h3>想用一票货先跑流程？</h3>
              <p>把平台、SKU、箱数、预计到仓时间和服务需求发给我们，先核一版入仓与出库口径。</p>
              <Link href={surfaceHref("customer", "/inquiry")}>
                提交需求 <ArrowRight size={15} />
              </Link>
            </div>
          </aside>
        </div>
      </article>

      <MarketingFooter surface="marketing" />
    </main>
  );
}
