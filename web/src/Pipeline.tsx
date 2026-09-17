import React, { useState, useEffect, lazy, Suspense } from "react";

import { t } from "./i18n";
import {
  Terminal,
  Check,
  Search,
  Code2,
  ShieldCheck,
  Network,
  GitBranch,
  CircleDot,
  Sparkles,
  Loader2,
} from "lucide-react";

const stages = [
  {
    label: "AI falsifier",
    hint: "Search for an edge case",
    icon: Sparkles,
    start: "llm_started",
    finish: "generator_created",
  },
  {
    label: "Generator sandbox",
    hint: "Produce a candidate input",
    icon: Code2,
    start: "generator_running",
    finish: "generator_finished",
  },
  {
    label: "Input validator",
    hint: "Enforce every constraint",
    icon: ShieldCheck,
    start: "validation_started",
    finish: "validation_passed",
  },
  {
    label: "3 reference solutions",
    hint: "Reviewed reference agreement",
    icon: Network,
    start: "references_started",
    finish: "references_agreed",
  },
  {
    label: "Target submission",
    hint: "Run your source code",
    icon: Terminal,
    start: "target_started",
    finish: "target_finished",
  },
  {
    label: "Output checker",
    hint: "Compare. Find the difference.",
    icon: GitBranch,
    start: "checker_started",
    finish: "verdict",
  },
  {
    label: "Verdict",
    hint: "Canonical outcome (demo may be simulated)",
    icon: CircleDot,
    start: "verdict",
    finish: "attempt_finished",
  },
];
export function Pipeline({ events = [], attempt = 0, running = false }: any) {
  const current = events.filter((e) => e.attempt === attempt);
  return (
    <div className="pipeline">
      {stages.map((stage, i) => {
        const started = current.find((e) => e.type === stage.start),
          done = current.find((e) => e.type === stage.finish);
        const fail =
          (i === 1 && done?.ok === false) ||
          (i === 2 && current.some((e) => e.type === "validation_failed")) ||
          (i === 3 &&
            current.some((e) =>
              ["references_disagreed", "references_failed"].includes(e.type),
            ));
        const state =
          i === 6 && done && started?.verdict === "kill"
            ? "killed"
            : fail
              ? "failed"
              : done
                ? "passed"
                : started && running
                  ? "running"
                  : started
                    ? "stopped"
                    : "idle";
        const duration =
          started && done
            ? ((Date.parse(done.at) - Date.parse(started.at)) / 1000).toFixed(
                2,
              ) + "s"
            : state === "running"
              ? "Running"
              : "—";
        const Icon = stage.icon;
        return (
          <div
            key={stage.label}
            className={"pipeline-step " + state}
            data-stage={i}
            data-state={state}
          >
            <span className="stage-connection" />
            <span className="stage-icon">
              {state === "passed" ? (
                <Check size={15} />
              ) : state === "running" ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Icon size={16} />
              )}
            </span>
            <div>
              <strong>{t(stage.label)}</strong>
              <small>
                {state === "running" ? t("Executing…") : t(stage.hint)}
              </small>
            </div>
            <span className="stage-duration">{duration}</span>
          </div>
        );
      })}
    </div>
  );
}
