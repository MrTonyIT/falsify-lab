import React, { useState, useEffect, lazy, Suspense } from "react";

import { t } from "./i18n";
import { X, Layers3, ShieldCheck, CheckCircle2 } from "lucide-react";

import { Badge } from "./shared";
export function Suite({ suite }: any) {
  const { selection, matrix, heldOut } = suite;
  return (
    <section className="panel suite-card">
      <div className="panel-heading">
        <span>
          <Layers3 size={18} />
          {suite.problemId}
        </span>
        <Badge value={suite.official ? "passed" : "demo"}>
          {suite.official ? t("OFFICIAL") : t("DEVELOPMENT FIXTURE")}
        </Badge>
      </div>
      <div className="suite-summary">
        <div>
          <span>{t("Suite size")}</span>
          <strong>
            {selection.suite_size}
            <small>{t(" tests")}</small>
          </strong>
        </div>
        <div>
          <span>{t("DEV coverage")}</span>
          <strong>
            {selection.dev_covered}
            <small> / {selection.dev_total}</small>
          </strong>
        </div>
        <div>
          <span>{t("Held-out coverage")}</span>
          <strong>
            {heldOut
              ? heldOut.results.filter((r) => r.killed).length
              : t("N/A")}
            <small>{heldOut ? " / " + heldOut.results.length : ""}</small>
          </strong>
        </div>
        <div>
          <span>{t("Selection")}</span>
          <strong className="small-strong">
            <ShieldCheck size={17} />
            {suite.evidenceStatus === "VERIFIED" ||
            suite.evidenceStatus === "DEMO"
              ? t("Frozen before evaluation")
              : "UNVERIFIED / LEGACY"}
          </strong>
        </div>
      </div>
      <div className="suite-columns">
        <div>
          <div className="eyebrow">{t("KILL MATRIX · DEV ONLY")}</div>
          <div className="matrix-scroll">
            <table className="kill-matrix">
              <thead>
                <tr>
                  <th />
                  {matrix.submission_ids.map((id) => (
                    <th key={id}>{id}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row, i) => (
                  <tr key={row.test_id}>
                    <th>
                      {t("Test ")}
                      {i + 1}
                    </th>
                    {row.kills.map((kill, j) => (
                      <td key={j}>
                        <span
                          className={"matrix-cell " + (kill ? "killed" : "")}
                          title={`Test ${i + 1} × ${matrix.submission_ids[j]}: ${row.verdicts?.[j] ?? (kill ? "kill" : "survived")}`}
                        >
                          {kill ? <X size={13} /> : <span />}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="matrix-legend">
            <span>
              <i />
              {t("Killed")}
            </span>
            <span>
              <i />
              {t("Not killed")}
            </span>
          </div>
        </div>
        <div>
          <div className="eyebrow">{t("SELECTED ADVERSARIAL SUITE")}</div>
          {selection.selected.map((s, i) => (
            <div className="selected-test" key={s.test_id}>
              <span>0{i + 1}</span>
              <div>
                <strong>
                  {t("Test")}{" "}
                  {matrix.rows.findIndex((r) => r.test_id === s.test_id) + 1}
                </strong>
                <small>
                  {t("Covers ")}
                  {s.incremental_coverage}
                  {t(" new DEV submissions")}
                </small>
              </div>
              <CheckCircle2 size={17} />
            </div>
          ))}
          {!selection.selected.length && (
            <p className="muted">{t("No test adds DEV coverage.")}</p>
          )}
          <p className="suite-note">
            <ShieldCheck size={14} />
            {t("Held-out results never influence this selection.")}
          </p>
        </div>
      </div>
    </section>
  );
}
