import React, { useState, useEffect, lazy, Suspense } from "react";

import { t } from "./i18n";
import {
  Terminal,
  FlaskConical,
  History,
  Cpu,
  Code2,
  ShieldCheck,
  Network,
  RotateCcw,
  Server,
  Database,
  Box,
} from "lucide-react";

import { languages } from "../../src/languages.js";
import { Badge, PageHeader } from "./shared";

export function SystemPage({ page, status, offline, refresh }: any) {
  return (
    <>
      <PageHeader
        eyebrow="LOCAL INFRASTRUCTURE"
        title={
          page === "System"
            ? t("Know what’s actually running.")
            : t("Your laboratory. Your controls.")
        }
        text={t(
          "Live health checks and explicit configuration. No simulated green lights.",
        )}
        action={
          <button className="button" onClick={refresh}>
            <RotateCcw size={15} />
            {t("Refresh status")}
          </button>
        }
      />
      <div className="science-note" role="status">
        <span>
          Protocol 3.0.0 · Runtime integration validation: NOT RUN · Provider
          validation: NOT RUN · Unseen-problem evaluation: NOT RUN. Availability
          checks do not prove runtime correctness.
        </span>
      </div>
      <div className="system-grid">
        {[
          {
            name: "Backend API",
            icon: Server,
            state: offline ? "Offline" : "Online",
            good: !offline,
            text: "Local Node API · loopback only · SSE events",
          },
          {
            name: "Python sandbox",
            icon: Box,
            state: status?.sandbox.status ?? "Checking",
            good: status?.sandbox.status === "available",
            text: status?.sandbox.message ?? "Isolated Linux Docker execution",
          },
          {
            name: "Model provider",
            icon: Cpu,
            state: status?.provider.status?.replace("_", " ") ?? "Checking",
            good: status?.provider.status === "configured",
            text:
              status?.provider.model ?? "No paid model credentials configured",
          },
          {
            name: "Benchmark corpus",
            icon: Database,
            state: `${status?.corpus.count ?? 0} / 30 problems`,
            good: status?.corpus.count === 30,
            text:
              status?.corpus.error ??
              "Private sources and DEV / held-out partitions",
          },
          {
            name: "Input validators",
            icon: ShieldCheck,
            state: `${status?.validators ?? 0} corpus validators`,
            good: status?.validators > 0,
            text: "The bundled demo has its own complete fixture validator.",
          },
          {
            name: "Reference oracle",
            icon: Network,
            state: `${status?.references ?? 0} corpus references`,
            good: status?.references > 0,
            text: "Reference agreement requires hash-bound provenance and human independence review.",
          },
          {
            name: "Results storage",
            icon: History,
            state: status?.storage ?? "Checking",
            good: status?.storage === "available",
            text: "JSONL evidence with persistent local run history.",
          },
          {
            name: "Demonstration",
            icon: FlaskConical,
            state: "Ready",
            good: true,
            text: "Scripted provider and sandbox · no arbitrary Python execution",
          },
        ].map(({ name, icon: Icon, state, good, text }) => (
          <div className="panel system-card" key={name}>
            <div className="system-card-top">
              <Icon size={20} />
              <span className={"status-dot " + (!good ? "warning-dot" : "")} />
            </div>
            <h3>{t(name)}</h3>
            <strong className={good ? "status-good" : "status-warning"}>
              {t(state)}
            </strong>
            <p>{t(text)}</p>
          </div>
        ))}
      </div>
      <section className="panel runtime-panel">
        <div className="panel-heading">
          <span>
            <Code2 size={17} />
            {t("Programming languages")}
          </span>
        </div>
        <p>
          {t(
            "Live playground supports single-file console programs. Generators, validators and reference solutions remain Python. Official benchmarks retain their Python protocol.",
          )}
        </p>
        <div className="runtime-grid">
          {languages.map((l) => (
            <div key={l.id}>
              <strong>{l.name}</strong>
              <Badge
                value={
                  status?.languages?.find((x) => x.id === l.id)?.status ===
                  "available"
                    ? "available"
                    : "unavailable"
                }
              />
            </div>
          ))}
        </div>
        <p>
          {t("Build the additional sandbox to enable non-Python languages:")}
        </p>
        <pre dir="ltr">
          docker build -f sandbox/Dockerfile.multilang -t
          ai-falsifier-multilang:local sandbox
        </pre>
        <p>
          {t(
            "Compilation is checked before model calls. Compile failures are not algorithmic bugs. Runtime availability requires Docker; demo execution is simulated.",
          )}
        </p>
      </section>
      <div className="panel setup-guide">
        <div className="panel-heading">
          <span>
            <Terminal size={17} />
            {t("Enable live execution")}
          </span>
          <Badge value="idle">{t("LOCAL CONFIGURATION")}</Badge>
        </div>
        <div className="setup-steps">
          <div>
            <span>01</span>
            <div>
              <h3>{t("Start the isolated Python sandbox")}</h3>
              <p>
                {t(
                  "Install a Linux Docker daemon, then build the existing sandbox image.",
                )}
              </p>
              <code>docker build -t ai-falsifier-python:local sandbox</code>
            </div>
          </div>
          <div>
            <span>02</span>
            <div>
              <h3>{t("Configure your provider on the server")}</h3>
              <p>
                {t(
                  "Set a verified endpoint, model snapshot, token prices and cost guard in a private configuration file. API keys never enter the browser.",
                )}
              </p>
              <code>
                FALSIFIER_CONFIG=private/model.json
                <br />
                FALSIFIER_API_KEY=your-provider-key
              </code>
            </div>
          </div>
          <div>
            <span>03</span>
            <div>
              <h3>{t("Choose a verified oracle")}</h3>
              <p>
                {t(
                  "Load a reviewed corpus with FALSIFIER_CORPUS or use the bundled synthetic sum problem. Pasted reference code alone cannot establish a trusted oracle.",
                )}
              </p>
              <code>npm run start</code>
            </div>
          </div>
        </div>
        <p className="setup-footnote">
          {t(
            "Restart the server after changing environment configuration. An official benchmark additionally requires the existing preflight, baseline and pilot checks.",
          )}
        </p>
      </div>
    </>
  );
}
