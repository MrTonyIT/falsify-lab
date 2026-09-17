import React, { useState, useEffect, lazy, Suspense } from "react";
import { motion } from "motion/react";
import { t, formatNumber } from "./i18n";
import { FlaskConical, Copy, Check } from "lucide-react";

export const fmt = (n: number, suffix = "") =>
  n == null ? t("NOT RUN") : formatNumber(Number(n)) + suffix;
export const short = (s: string) => s?.replace("lab-", "").slice(0, 8) ?? "—";
export function Badge({ value, children }: any) {
  return (
    <span className={"badge " + (value ?? "")}>
      {t(children ?? value?.replaceAll("_", " "))
        ?.toString()
        .toUpperCase()}
    </span>
  );
}
export function Empty({ icon: Icon = FlaskConical, title, text, action }: any) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={28} strokeWidth={1.25} />
      </span>
      <h3>{t(title)}</h3>
      <p>{t(text)}</p>
      {action}
    </div>
  );
}
export function CopyButton({ value, label = "Copy", notify }: any) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-button"
      disabled={!value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          notify?.("Copied to clipboard");
          setTimeout(() => setCopied(false), 1800);
        } catch {
          notify?.("Clipboard unavailable. Select and copy the text.");
        }
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {t(label)}
    </button>
  );
}
export function CodePanel({
  label,
  value,
  variant = "",
  truncated = false,
  notify,
}: any) {
  return (
    <div className={"output-panel " + variant}>
      <div className="output-title">
        <span>{t(label)}</span>
        <CopyButton value={truncated ? "" : value} notify={notify} />
      </div>
      <pre>
        {value === "" || value == null ? (
          <span className="muted">{t("No output")}</span>
        ) : (
          value
        )}
      </pre>
      {truncated && (
        <div className="small muted">
          {t(
            "Preview truncated. Copy the generator to reproduce the complete input.",
          )}
        </div>
      )}
    </div>
  );
}
export function PageHeader({ eyebrow, title, text, action }: any) {
  return (
    <section className="page-header">
      <div>
        <div className="eyebrow">
          <span className="violet-dot" />
          {t(eyebrow)}
        </div>
        <h1>{t(title)}</h1>
        <p>{t(text)}</p>
      </div>
      {action}
    </section>
  );
}
export function Metric({ label, value, unit, description }: any) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (value == null) {
      setDisplay(null);
      return;
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 600);
      setDisplay(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <div className="panel metric-card">
      <span>{t(label)}</span>
      <strong className={value == null ? "not-run" : ""}>
        {value == null ? t("NOT RUN") : fmt(display, unit)}
      </strong>
      <small>{t(description)}</small>
    </div>
  );
}
