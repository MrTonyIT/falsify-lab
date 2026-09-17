import React, { useState, useEffect, lazy, Suspense } from "react";
import { motion } from "motion/react";
import { t } from "./i18n";
import {
  ChevronDown,
  Plus,
  Copy,
  Code2,
  ShieldCheck,
  Timer,
  Coins,
  Zap,
  Hash,
} from "lucide-react";

import { Badge, CodePanel, CopyButton } from "./shared";
export function Result({ job, selected, setSelected, notify, newRun }: any) {
  const attempt = job?.attempts?.[selected] ?? job?.attempts?.at(-1);
  if (!attempt) return null;
  const killed = attempt.verdict === "kill";
  return (
    <motion.section
      className={"result-card panel " + (killed ? "kill-result" : "")}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid="result"
    >
      <div className="result-heading">
        <div className={"result-symbol " + (killed ? "kill" : "survived")}>
          {killed ? <Zap size={24} /> : <ShieldCheck size={24} />}
        </div>
        <div>
          <div className="eyebrow">
            {job.mode === "demo" ? t("DEMO EXECUTION · ") : ""}
            {t("ATTEMPT")} {attempt.attempt}
            {t(" OF 3")}
          </div>
          <h2>
            {killed
              ? t("Counterexample found.")
              : job.status === "finished"
                ? t(
                    "No counterexample found within the configured attempt budget.",
                  )
                : t("The search continues.")}
          </h2>
        </div>
        <Badge value={attempt.verdict} />
      </div>
      {!killed && job.status === "finished" && (
        <p className="result-note">
          {job.knownWrong
            ? t(
                "This target is known to be incorrect, but the falsifier did not expose its bug within 3 attempts.",
              )
            : t("This result does not establish that your code is correct.")}
        </p>
      )}
      {job.mode === "demo" && (
        <p className="result-note">
          {t(
            "Scripted example with simulated Python execution. The validator, reference agreement, checker and attempt loop use the real engine.",
          )}
        </p>
      )}
      <div className="result-outputs">
        <CodePanel
          label={t("COUNTEREXAMPLE INPUT")}
          value={attempt.input}
          truncated={attempt.input_truncated}
          notify={notify}
        />
        <CodePanel
          label={t("EXPECTED OUTPUT")}
          value={attempt.expected}
          variant="expected"
          notify={notify}
        />
        <CodePanel
          label={t("YOUR CODE RETURNED")}
          value={attempt.actual}
          variant={killed ? "different" : ""}
          notify={notify}
        />
      </div>
      <div className="result-facts">
        <span>
          <Timer size={14} />
          {(attempt.latency_ms / 1000).toFixed(2)}
          {t("s model latency")}
        </span>
        <span>
          <Hash size={14} />
          {attempt.tokens_in + attempt.tokens_out}
          {t(" tokens")}
        </span>
        <span>
          <Coins size={14} />${attempt.cost_usd.toFixed(5)}
        </span>
        <span>
          {attempt.input_size}
          {t(" input bytes")}
        </span>
        <span>{attempt.detail.replaceAll("_", " ")}</span>
      </div>
      <details className="generator-details">
        <summary>
          <Code2 size={16} />
          {t(" Generated Python script ")}
          <ChevronDown size={15} />
        </summary>
        <CodePanel
          label={t("GENERATOR.PY · SEED 12345")}
          value={attempt.generator_script}
          notify={notify}
        />
      </details>
      <div className="result-actions">
        <CopyButton
          value={attempt.input_truncated ? "" : attempt.input}
          label={t("Copy input")}
          notify={notify}
        />
        <CopyButton
          value={attempt.generator_script}
          label={t("Copy generator")}
          notify={notify}
        />
        <button className="button subtle" onClick={newRun}>
          <Plus size={15} />
          {t("New run")}
        </button>
      </div>
    </motion.section>
  );
}
