import React, { useState, useEffect, lazy, Suspense } from "react";

import { t } from "./i18n";
import { ArrowUpRight, ArrowRight, Plus, History } from "lucide-react";

import { languages } from "../../src/languages.js";
import { Badge, Empty, PageHeader, short } from "./shared";

export function RunsPage({
  navigate,
  runFilter,
  setRunFilter,
  displayedRuns,
  openRun,
  locale,
}: any) {
  return (
    <>
      <PageHeader
        eyebrow="EXPERIMENT LOG"
        title={t("Every attempt tells a story.")}
        text={t(
          "Your local falsification runs, preserved with their evidence.",
        )}
        action={
          <button
            className="button primary"
            onClick={() => navigate("Playground")}
          >
            <Plus size={16} />
            {t("New experiment")}
          </button>
        }
      />
      <div className="filter-bar">
        <div className="filter-tabs">
          {["all", "kill", "survived", "invalid", "inconclusive"].map((f) => (
            <button
              key={f}
              className={runFilter === f ? "active" : ""}
              onClick={() => setRunFilter(f)}
            >
              {f === "all" ? t("All runs") : f === "kill" ? t("Killed") : f}
            </button>
          ))}
        </div>
        <span className="muted">
          {displayedRuns.length}
          {t(" runs")}
        </span>
      </div>
      <section className="panel table-panel">
        {displayedRuns.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("EXPERIMENT")}</th>
                  <th>{t("MODE / MODEL")}</th>
                  <th>{t("VERDICT")}</th>
                  <th>{t("ATTEMPTS")}</th>
                  <th>{t("COST")}</th>
                  <th>{t("ELAPSED")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {displayedRuns.map((r) => (
                  <tr key={r.id} onClick={() => openRun(r.id)}>
                    <td>
                      <button
                        className="table-run-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRun(r.id);
                        }}
                      >
                        {t(r.title)}
                      </button>
                      <small>
                        #{short(r.id)} ·{" "}
                        {new Date(r.createdAt).toLocaleString(locale)}
                      </small>
                    </td>
                    <td>
                      <span>
                        {r.mode === "demo" ? t("Demo fixture") : r.mode}
                      </span>
                      <small>
                        {r.model} ·{" "}
                        {languages.find(
                          (l) => l.id === (r.language ?? "python"),
                        )?.name ?? r.language}
                      </small>
                    </td>
                    <td>
                      <Badge
                        value={
                          r.status === "error"
                            ? "error"
                            : (r.verdict ?? "running")
                        }
                      />
                      {r.final?.kill_at_1 && <small>{t("Kill@1")}</small>}
                    </td>
                    <td className="mono">{r.attempts} / 3</td>
                    <td className="mono">${r.cost.toFixed(4)}</td>
                    <td className="mono">
                      {(r.elapsed_ms / 1000).toFixed(1)}
                      {t("s")}
                    </td>
                    <td>
                      <ArrowUpRight size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={History}
            title={t("A clean experiment log.")}
            text={t(
              "Run your first falsification in the Playground. Every attempt and counterexample will appear here.",
            )}
            action={
              <button className="button" onClick={() => navigate("Playground")}>
                {t("Open Playground ")}
                <ArrowRight size={15} />
              </button>
            }
          />
        )}
      </section>
    </>
  );
}
