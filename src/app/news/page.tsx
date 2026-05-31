import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "../components/MarketingShell";
import { surfaceHref } from "@/lib/surfaceLinks";
import { newsArticles, newsCategories } from "./data";

export default function NewsPage() {
  const firstArticleByCategory = Object.fromEntries(
    newsCategories.map((category) => [category.id, newsArticles.find((article) => article.category === category.id)?.slug]),
  );

  return (
    <main className="marketing-shell-fixed-header min-h-screen bg-white text-slate-950">
      <MarketingHeader surface="marketing" />

      <section className="news-page-hero">
        <Image alt="英国仓库扫码与新闻资讯背景" className="object-cover" fill priority sizes="100vw" src="/assets/uk-warehouse-service.png" />
        <div className="news-page-hero-overlay" />
        <div className="news-page-hero-content">
          <h1>新闻资讯</h1>
          <span />
        </div>
      </section>

      <nav className="news-category-tabs" aria-label="新闻分类">
        {newsCategories.map((category) => (
          <a href={`#news-category-${category.id}`} key={category.id}>
            {category.label}
          </a>
        ))}
      </nav>

      <section className="news-list-wrap">
        {newsArticles.map((article) => (
          <article className="news-list-item" id={firstArticleByCategory[article.category] === article.slug ? `news-category-${article.category}` : undefined} key={article.slug}>
            <Link className="news-list-image" href={surfaceHref("marketing", `/news/${article.slug}`)}>
              <Image alt={article.title} className="object-cover" fill sizes="(min-width: 1024px) 430px, 100vw" src={article.image} />
            </Link>
            <div className="news-list-copy">
              <p className="news-list-date">{article.date}</p>
              <h2>
                <Link href={surfaceHref("marketing", `/news/${article.slug}`)}>{article.title}</Link>
              </h2>
              <p>{article.summary}</p>
              <Link className="news-list-more" href={surfaceHref("marketing", `/news/${article.slug}`)}>
                查看详情 <ArrowRight size={15} />
              </Link>
            </div>
          </article>
        ))}
      </section>

      <MarketingFooter surface="marketing" />
    </main>
  );
}
