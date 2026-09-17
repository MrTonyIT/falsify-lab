import React, { useState, useEffect, lazy, Suspense } from "react";

import { t } from "./i18n";
import { FlaskConical, Search, ShieldCheck, GitBranch } from "lucide-react";

import { Badge, Empty, PageHeader, Metric } from "./shared";
const Charts = lazy(() => import("./charts"));
export function BenchmarkPage({
  page,
  dataset,
  setDataset,
  data,
  metric,
  groups,
  activeRuns,
}: any) {
  return (
    <>
      <PageHeader
        eyebrow={
          page === "Benchmarks" ? "MEASURED, NOT ASSUMED" : "BEHIND THE VERDICT"
        }
        title={
          page === "Benchmarks"
            ? t("How good is the adversary?")
            : t("Understand what survives.")
        }
        text={t(
          "Real JSONL evidence. Problem-level statistics. No invented results.",
        )}
        action={
          <select
            aria-label={t("Results dataset")}
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
          >
            <option value="official">{t("Official benchmarks")}</option>
            {data?.runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.kind === "smoke" || r.kind === "demo"
                  ? t("DEMO · ")
                  : r.kind.toUpperCase() + " · "}
                {r.id} · {r.evidenceStatus}
              </option>
            ))}
          </select>
        }
      />
      <div
        className={"dataset-banner " + (dataset !== "official" ? "demo" : "")}
      >
        <FlaskConical size={16} />
        <span>
          {dataset === "official"
            ? data?.officialStatus === "MEASURED"
              ? t("Showing completed official benchmark evidence.")
              : t(
                  "No verified official evidence is present in the displayed archive. Metrics remain unavailable.",
                )
            : t(
                "This dataset is shown separately. Development and playground results are not official benchmark findings.",
              )}
        </span>
        <Badge value={dataset === "official" ? "idle" : "demo"}>
          {dataset === "official"
            ? (data?.officialStatus ?? t("NOT RUN"))
            : t("SEPARATE DATASET")}
        </Badge>
      </div>
      {data?.truncated && (
        <p role="status">
          Showing at most 100 local run directories. Use CLI reports for the
          complete archive.
        </p>
      )}
      {data?.warnings?.length > 0 && (
        <p role="alert">
          Some evidence could not be read safely. It has been excluded from this
          view.
        </p>
      )}
      <details className="science-note">
        <summary>Metric definitions and limits</summary>
        <p>
          VERIFIED means artifact integrity checks passed; it does not certify
          scientific truth, real Docker validation, or independent human review.
          DEMO and MOCK remain simulated. Kill@1 and Kill@3 use all assigned
          pairs, including inconclusive pairs. Eligible-pair rates are
          secondary. A gain after extra attempts does not isolate the causal
          effect of feedback. Semantic size is problem-defined; bytes are
          reported separately. Problem-cluster confidence intervals resample
          whole problems and are unavailable for a single problem. Cost per kill
          is a usage-based estimate, not an audited invoice. Frozen held-out
          evaluation tests new submissions to the same problems, not unseen
          problems.
        </p>
      </details>
      <div className="metric-grid">
        {[
          [
            "Kill@1",
            metric?.all_pair_kill_at_1,
            "%",
            "First-attempt detection",
          ],
          ["Kill@3", metric?.all_pair_kill_at_3, "%", "Within the full budget"],
          [
            "Additional-attempt gain",
            metric?.all_pair_kill_at_3 == null
              ? null
              : metric.all_pair_kill_at_3 - metric.all_pair_kill_at_1,
            " pp",
            "Additional detection",
          ],
          ["Invalid rate", metric?.invalid_rate, "%", "Rejected candidates"],
          [
            "Unusable rate",
            metric?.unusable_rate,
            "%",
            "Oracle unable to decide",
          ],
          [
            "Inconclusive",
            metric?.inconclusive_rate,
            "%",
            "Expanded resource limits",
          ],
          [
            "Cost per kill",
            metric?.cost_per_kill,
            " USD",
            "Recorded model usage",
          ],
          ["Evaluated pairs", metric?.pairs, "", "Problem / submission pairs"],
        ].map(([label, value, unit, description]) => (
          <Metric
            key={String(label)}
            label={t(label)}
            value={value}
            unit={unit}
            description={description}
          />
        ))}
      </div>
      <Suspense fallback={<div className="panel skeleton chart-placeholder" />}>
        <Charts metric={metric} groups={groups} runs={activeRuns} />
      </Suspense>
      {page === "Analytics" && (
        <div className="panel survivor-panel">
          <div className="panel-heading">
            <span>
              <ShieldCheck size={16} />
              {t("Survivor analysis")}
            </span>
            <span className="subtle-label">{t("Manual bug labels")}</span>
          </div>
          {metric?.survivors?.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("PROBLEM")}</th>
                    <th>{t("SUBMISSION")}</th>
                    <th>{t("BUG CATEGORY")}</th>
                    <th>{t("RESOURCE EXCLUSION")}</th>
                  </tr>
                </thead>
                <tbody>
                  {metric.survivors.map((s) => (
                    <tr key={s.problem_id + s.submission_id}>
                      <td>{s.problem_id}</td>
                      <td>{s.submission_id}</td>
                      <td>{s.bug_type ?? t("Unlabeled")}</td>
                      <td>{s.inconclusive ? t("Inconclusive") : t("No")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              icon={Search}
              title={t("Survivors are evidence, too.")}
              text={t(
                "Manual bug categories and unresolved submissions appear here when a selected dataset contains them.",
              )}
            />
          )}
        </div>
      )}
      <div className="science-note">
        <GitBranch size={16} />
        <span>
          {t(
            "Confidence intervals resample whole problems, not individual submissions.",
          )}{" "}
          {metric?.bootstrap
            ? `${metric.bootstrap.clusters} problem clusters · 95% CI ${metric.bootstrap.ci95?.map((n) => n.toFixed(1)).join("–") ?? "N/A"}%`
            : t("No confidence interval is available yet.")}
        </span>
      </div>
    </>
  );
}
