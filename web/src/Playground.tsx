import React, { lazy, Suspense } from "react";

import { t } from "./i18n";
import { languages } from "../../src/languages.js";
import { Badge, CopyButton, short } from "./shared";
import { Pipeline } from "./Pipeline";
import { Result } from "./Result";
import {
  Terminal,
  FlaskConical,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  Plus,
  X,
  Search,
  Code2,
  FileText,
  ShieldCheck,
  Network,
  Sparkles,
  Trash2,
  Loader2,
  AlertTriangle,
  Zap,
  SlidersHorizontal,
  CircleHelp,
} from "lucide-react";

const CodeEditor = lazy(() => import("./CodeEditor"));
export function Playground({
  mode,
  setMode,
  examples,
  loadExample,
  statement,
  setStatement,
  constraints,
  setConstraints,
  code,
  setCode,
  tab,
  setTab,
  language,
  setLanguage,
  sourceLanguage,
  oracle,
  setOracle,
  validator,
  setValidator,
  references,
  setReferences,
  paid,
  setPaid,
  problemId,
  setProblemId,
  submissionId,
  setSubmissionId,
  problems,
  job,
  setJob,
  busy,
  selected,
  setSelected,
  error,
  setError,
  startRun,
  elapsed,
  status,
  notify,
  navigate,
  offline,
}: any) {
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">
            <span className="violet-dot" />
            {t(" AI ADVERSARIAL CODE LABORATORY ")}
            <span className="version">{t("V0.1")}</span>
          </div>
          <h1>
            {t("Find the input your code")}
            <br />
            <span>{t("hoped nobody would test.")}</span>
          </h1>
          <p>
            {t(
              "Give your code an adversary. Find a counterexample. Understand the failure.",
            )}
          </p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit outer" />
          <div className="orbit inner" />
          <div className="crosshair horizontal" />
          <div className="crosshair vertical" />
          <span className="orbit-point p1" />
          <span className="orbit-point p2" />
          <div className="core-symbol">
            <FlaskConical size={34} strokeWidth={1.3} />
          </div>
          <span className="art-caption">
            {t("ASSUMPTION → COUNTEREXAMPLE")}
          </span>
        </div>
      </section>
      <div className="workspace-toolbar">
        <div className="section-label">
          <Terminal size={17} />
          <strong>{t("Falsification workspace")}</strong>
          <span className="subtle-label">{sourceLanguage.name}</span>
        </div>
        <div className="toolbar-actions">
          <select
            aria-label={t("Load example")}
            value=""
            onChange={(e) => {
              const example = examples.find((x) => x.id === e.target.value);
              if (example) {
                loadExample(example);
                notify("Example loaded");
              }
            }}
            disabled={busy}
          >
            <option value="">{t("Load an example")}</option>
            {examples.map((e) => (
              <option key={e.id} value={e.id}>
                {t(e.name)}
              </option>
            ))}
          </select>
          <button
            className="icon-button"
            title={t("Clear editors")}
            aria-label={t("Clear editors")}
            disabled={busy}
            onClick={() => {
              setStatement("");
              setConstraints("");
              setCode("");
              setOracle("custom");
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="workspace-grid">
        <div className="editor-column">
          <section className="panel problem-panel">
            <div className="panel-heading">
              <span>
                <FileText size={16} />
                {t(" The problem")}
              </span>
              <span className="step-number">01</span>
            </div>
            <div className="editor-tabs">
              <button
                className={tab === "statement" ? "active" : ""}
                onClick={() => setTab("statement")}
              >
                {t("Statement")}
              </button>
              <button
                className={tab === "constraints" ? "active" : ""}
                onClick={() => setTab("constraints")}
              >
                {t("Constraints")}
                <span className="tab-dot" />
              </button>
              <span className="plain-text-label">{t("PLAIN TEXT")}</span>
            </div>
            <textarea
              aria-label={
                tab === "statement"
                  ? t("Problem statement")
                  : t("Problem constraints")
              }
              className="problem-textarea"
              value={tab === "statement" ? statement : constraints}
              onChange={(e) => {
                (tab === "statement" ? setStatement : setConstraints)(
                  e.target.value,
                );
                setOracle("custom");
              }}
              disabled={busy || mode === "benchmark"}
              placeholder={
                tab === "statement"
                  ? t("Describe the programming problem…")
                  : t(
                      "Include all bounds, input format and aggregate constraints…",
                    )
              }
            />
            <div className="editor-footnote">
              <CircleHelp size={12} />
              {tab === "statement"
                ? t("A precise problem statement makes a better adversary.")
                : t(
                    "Every constraint is enforced by the configured validator.",
                  )}
              <span>
                {(tab === "statement" ? statement : constraints).length}{" "}
                {t("chars")}
              </span>
            </div>
          </section>
          <section className="panel code-panel">
            <div className="panel-heading">
              <span>
                <Code2 size={16} />
                {t(" Target submission")}{" "}
                <span className="file-tag">{sourceLanguage.file}</span>
              </span>
              <div className="row">
                <CopyButton value={code} notify={notify} />
                <span className="step-number">02</span>
              </div>
            </div>
            <Suspense
              fallback={
                <div className="editor-loading skeleton">
                  {t("Loading editor…")}
                </div>
              }
            >
              <CodeEditor
                language={sourceLanguage.editor}
                value={code}
                onChange={setCode}
                height={278}
                readOnly={busy || mode === "benchmark"}
              />
            </Suspense>
            <div className="language-config">
              <label>
                {t("Code language")}
                <select
                  aria-label={t("Code language")}
                  value={language}
                  disabled={busy || mode !== "playground"}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {languages.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <small>
                {t(
                  mode !== "playground"
                    ? "Choose Live playground to test other languages."
                    : "Single-file console programs · stdin / stdout · no external packages.",
                )}
              </small>
              {mode === "playground" && (
                <small
                  className={
                    status?.languages?.find((l) => l.id === language)
                      ?.status === "available"
                      ? "status-good"
                      : "status-warning"
                  }
                >
                  {t(
                    status?.languages?.find((l) => l.id === language)
                      ?.status === "available"
                      ? "Runtime available"
                      : "Runtime unavailable — open System for setup.",
                  )}
                </small>
              )}
              {language === "java" && (
                <small>{t("Java entry point: public class Main.")}</small>
              )}
              {language === "typescript" && (
                <small>
                  {t(
                    "TypeScript: declare Node globals locally; external type packages are unavailable.",
                  )}
                </small>
              )}
            </div>
            <div className="editor-status">
              <span>
                <span className="status-dot muted-dot" />
                {sourceLanguage.name}
              </span>
              <span>
                {t("UTF-8 ")}
                <span className="dot-separator">·</span>{" "}
                {code.split("\n").length}
                {t(" lines")} <span className="dot-separator">·</span>
                {t(" Spaces: 4")}
              </span>
            </div>
          </section>
          {mode === "playground" && (
            <details className="panel oracle-setup">
              <summary>
                <ShieldCheck size={16} />
                {t(" Verification setup")}{" "}
                <Badge value={oracle === "example" ? "passed" : "idle"}>
                  {oracle === "example"
                    ? t("EXAMPLE ORACLE")
                    : t("CUSTOM ORACLE")}
                </Badge>
                <ChevronDown size={15} />
              </summary>
              <p>
                {t(
                  "Pasted code is unverified. Live custom problems require a reviewed corpus oracle with source-bound provenance; these fields alone cannot authorize a KILL or a paid run.",
                )}
              </p>
              <label>
                {t("Python validator")}{" "}
                <small>
                  {t(
                    "Read input from stdin. Exit 0 for valid, nonzero for invalid.",
                  )}
                </small>
                <textarea
                  value={validator}
                  onChange={(e) => setValidator(e.target.value)}
                  placeholder={t(
                    "import sys\\n# Validate every constraint\\n# sys.exit(1) for invalid input",
                  )}
                />
              </label>
              {references.map((value, i) => (
                <label key={i}>
                  {t("Reference solution ")}
                  {i + 1}
                  <textarea
                    value={value}
                    onChange={(e) =>
                      setReferences((r) =>
                        r.map((v, j) => (i === j ? e.target.value : v)),
                      )
                    }
                    placeholder={t(
                      "Paste an independent accepted Python solution…",
                    )}
                  />
                </label>
              ))}
            </details>
          )}
        </div>
        <div className="control-column">
          <section className="panel control-panel">
            <div className="panel-heading">
              <span>
                <SlidersHorizontal size={16} />
                {job ? t("Live control room") : t("Run configuration")}
              </span>
              {job ? (
                <Badge value={busy ? "running" : job.status}>
                  {busy ? t("LIVE") : job.status.toUpperCase()}
                </Badge>
              ) : (
                <span className="step-number">03</span>
              )}
            </div>
            {!job && (
              <>
                <div className="mode-tabs">
                  {[
                    ["demo", "Demo"],
                    ["playground", "Live playground"],
                    ["benchmark", "Benchmark"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={mode === value ? "active" : ""}
                      onClick={() => {
                        setMode(value);
                        if (value !== "playground") setLanguage("python");
                        setError("");
                      }}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
                {mode === "benchmark" && (
                  <div className="config-selects">
                    <label>
                      {t("Corpus problem")}
                      <select
                        value={problemId}
                        onChange={(e) => {
                          const p = problems.find(
                            (p) => p.id === e.target.value,
                          );
                          setProblemId(p?.id ?? "");
                          setStatement(p?.statement ?? "");
                          setConstraints(p?.constraints ?? "");
                          setCode("");
                          setSubmissionId("");
                        }}
                      >
                        <option value="">
                          {problems.length
                            ? t("Select a problem")
                            : t("No corpus configured")}
                        </option>
                        {problems.map((p) => (
                          <option key={p.id}>{p.id}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("DEV submission")}
                      <select
                        value={submissionId}
                        onChange={(e) => {
                          setSubmissionId(e.target.value);
                          setCode(
                            problems
                              .find((p) => p.id === problemId)
                              ?.dev.find((s) => String(s.id) === e.target.value)
                              ?.code ?? "",
                          );
                        }}
                      >
                        <option value="">{t("Select a DEV target")}</option>
                        {problems
                          .find((p) => p.id === problemId)
                          ?.dev.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.id}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                )}
                <div className="configuration">
                  <div className="config-row">
                    <span>{t("Model")}</span>
                    <strong>
                      <Sparkles size={14} />
                      {mode === "demo"
                        ? t("Fixture provider")
                        : (status?.provider?.model ?? t("Not configured"))}
                      <span className="config-pill">
                        {mode === "demo" ? t("DEMO") : t("API")}
                      </span>
                    </strong>
                  </div>
                  <div className="config-row">
                    <span>{t("Reasoning effort")}</span>
                    <strong>
                      {mode === "demo" ? t("Scripted") : t("High")}
                      <span className="signal-bars">
                        <i />
                        <i />
                        <i />
                      </span>
                    </strong>
                  </div>
                  <div className="config-row">
                    <span>{t("Attempt budget")}</span>
                    <strong className="attempt-budget">
                      <b>01</b>
                      <b>02</b>
                      <b>03</b>
                      <small>{t("max")}</small>
                    </strong>
                  </div>
                </div>
                <div
                  className={"mode-notice " + (mode === "demo" ? "demo" : "")}
                >
                  <FlaskConical size={16} />
                  <div>
                    <strong>
                      {mode === "demo"
                        ? t("Try the complete flow, safely.")
                        : t("Isolated execution. Verified results.")}
                    </strong>
                    <p>
                      {mode === "demo"
                        ? t(
                            "Bundled examples · simulated Python · no paid calls. Your benchmark data stays separate.",
                          )
                        : t(
                            "Live mode needs Docker, a model provider and a verified problem oracle.",
                          )}
                    </p>
                  </div>
                </div>
                {mode !== "demo" && (
                  <label className="paid-toggle">
                    <input
                      type="checkbox"
                      checked={paid}
                      onChange={(e) => setPaid(e.target.checked)}
                    />{" "}
                    {t("Allow paid model calls within the configured budget")}
                  </label>
                )}
              </>
            )}
            {job && (
              <div className="run-info">
                <div>
                  <span className="eyebrow">
                    {t("RUN #")}
                    {short(job.id)}
                  </span>
                  <strong>
                    {busy
                      ? t(
                          job.events?.some(
                            (e) => e.type === "compilation_started",
                          ) &&
                            !job.events?.some(
                              (e) => e.type === "compilation_finished",
                            )
                            ? "Checking source before model calls…"
                            : "Searching for a counterexample",
                        )
                      : job.status === "error"
                        ? t("Execution stopped")
                        : t("Search complete")}
                  </strong>
                </div>
                <span className="elapsed">
                  {(busy ? elapsed : (job.elapsed_ms ?? 0) / 1000).toFixed(1)}
                  <small>{t("s")}</small>
                </span>
              </div>
            )}
            <div className="run-cta">
              <button
                className={"falsify-button " + (busy ? "is-running" : "")}
                onClick={
                  job && !busy
                    ? () => {
                        setJob(null);
                        setError("");
                      }
                    : startRun
                }
                disabled={busy || offline}
                data-testid="falsify"
              >
                <span>
                  {busy ? (
                    <Loader2 className="spin" size={18} />
                  ) : job ? (
                    <Plus size={18} />
                  ) : (
                    <Zap size={18} />
                  )}{" "}
                  {busy
                    ? `FALSIFYING · ATTEMPT ${job?.currentAttempt || 1}`
                    : job
                      ? t("NEW EXPERIMENT")
                      : t("FALSIFY CODE")}
                </span>
                {!busy && <ArrowRight size={17} />}
              </button>
              <span className="shortcut-hint">
                {job ? (
                  `${job.model} · ${job.mode === "demo" ? "demonstration" : (job.language ?? "python") + " sandbox"}`
                ) : (
                  <>
                    <kbd>{t("Ctrl")}</kbd> + <kbd>{t("Enter")}</kbd>
                    {t(" to start your experiment")}
                  </>
                )}
              </span>
            </div>
            {error && (
              <div className="error-card" role="alert">
                <AlertTriangle size={17} />
                <div>
                  <strong>{t("Unable to complete the run")}</strong>
                  <p>{t(error)}</p>
                  {job?.diagnostics && (
                    <pre className="compiler-diagnostics" dir="ltr">
                      {job.diagnostics}
                    </pre>
                  )}
                  <button onClick={() => navigate("System")}>
                    {t("View system status ")}
                    <ArrowUpRight size={12} />
                  </button>
                </div>
                <button
                  className="icon-button"
                  aria-label={t("Dismiss error")}
                  onClick={() => setError("")}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="pipeline-header">
              <span>{t("EXECUTION PIPELINE")}</span>
              <span>
                {busy ? (
                  <>
                    <span className="status-dot" />
                    {t(" LIVE")}
                  </>
                ) : job ? (
                  t("TRACE")
                ) : (
                  t("7 VERIFICATION STAGES")
                )}
              </span>
            </div>
            <Pipeline
              events={job?.events}
              attempt={job?.currentAttempt}
              running={busy}
            />
            <div className="security-note">
              <ShieldCheck size={13} />
              {mode === "demo"
                ? t("Demo fixture · No untrusted code is executed")
                : t(
                    "Isolated execution · Network disabled · 3 Python references",
                  )}
            </div>
          </section>
          <div className="attempt-strip">
            {[1, 2, 3].map((n) => {
              const a = job?.attempts.find((a) => a.attempt === n);
              return (
                <button
                  key={n}
                  disabled={!a}
                  className={
                    (a?.verdict ??
                      (busy && job?.currentAttempt === n ? "running" : "")) +
                    (selected === n - 1 && a ? " selected" : "")
                  }
                  onClick={() => setSelected(n - 1)}
                >
                  <span>
                    {t("ATTEMPT 0")}
                    {n}
                  </span>
                  <strong>
                    {a ? (
                      <>
                        <span className="attempt-status-dot" />
                        {a.verdict.replace("_", " ")}
                      </>
                    ) : busy && job?.currentAttempt === n ? (
                      t("Searching…")
                    ) : (
                      t("Waiting")
                    )}
                  </strong>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <Result
        job={job}
        selected={selected}
        setSelected={setSelected}
        notify={notify}
        newRun={() => {
          setJob(null);
          setError("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      <div className="workspace-footer">
        <span>
          <ShieldCheck size={13} />
          {t(" Correctness over confidence.")}
        </span>
        <span>
          {t("Valid input. Reviewed references. Traceable evidence.")}
        </span>
      </div>
    </>
  );
}
