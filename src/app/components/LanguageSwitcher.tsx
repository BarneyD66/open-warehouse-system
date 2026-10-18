"use client";

import { useEffect, useState } from "react";

type LanguageCode = "zh" | "en";

const languages = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
] satisfies { code: LanguageCode; label: string }[];

export function LanguageSwitcher({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [language, setLanguage] = useState<LanguageCode>(() => {
    if (typeof window === "undefined") return "zh";
    const saved = window.localStorage.getItem("uk-station-language");
  return saved === "en" ? "en" : "zh";
  });
  const [open, setOpen] = useState(false);
  const current = languages.find((item) => item.code === language) ?? languages[0];

  useEffect(() => {
    window.localStorage.setItem("uk-station-language", language);
    window.dispatchEvent(new CustomEvent("uk-station-language-change", { detail: language }));
  }, [language]);

  return (
    <div className={`language-switcher language-switcher-${tone} ${open ? "is-open" : ""}`}>
      <button aria-expanded={open} aria-label="选择语言" onClick={() => setOpen((value) => !value)} type="button">
        {current.label}
        <span aria-hidden="true" />
      </button>
      <div aria-hidden={!open} className="language-switcher-menu" hidden={!open}>
        {languages.map((item) => (
          <button
            className={item.code === language ? "is-active" : ""}
            key={item.code}
            onClick={() => {
              setLanguage(item.code);
              setOpen(false);
            }}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
