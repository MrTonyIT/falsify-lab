import { languages } from "../../src/languages.js";
import { LanguageSelector, useLocale, t, formatNumber } from "./i18n";
import React, {
  useState,
  useEffect,
  useRef,
  lazy,
  Suspense,
  useCallback,
} from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import {
  Terminal,
  FlaskConical,
  Play,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Plus,
  Copy,
  Check,
  X,
  Settings,
  Activity,
  LayoutGrid,
  History,
  BarChart3,
  Layers3,
  Cpu,
  Search,
  Command,
  Code2,
  FileText,
  ShieldCheck,
  Network,
  GitBranch,
  CircleDot,
  Sparkles,
  Timer,
  Coins,
  ExternalLink,
  RotateCcw,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Menu,
  Zap,
  Hash,
  Radio,
  BookOpen,
  Download,
  SlidersHorizontal,
  Server,
  Database,
  Box,
  ArrowDown,
  CircleHelp,
} from "lucide-react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "./styles.css";
const CodeEditor = lazy(() => import("./CodeEditor"));
const Charts = lazy(() => import("./charts"));
const nav = [
  { name: "Playground", icon: Terminal },
  { name: "Runs", icon: History },
  { name: "Benchmarks", icon: LayoutGrid },
  { name: "Test Suites", icon: Layers3 },
  { name: "Analytics", icon: BarChart3 },
  { name: "System", icon: Activity },
];
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
    hint: "Independent oracle agreement",
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
    hint: "A measured outcome",
    icon: CircleDot,
    start: "verdict",
    finish: "attempt_finished",
  },
];
async function api(path: string, body?: any) {
  const r = await fetch(
    "/api" + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error?.message ?? "The backend is unavailable.");
  return data;
}
const fmt = (n: number, suffix = "") =>
  n == null ? t("NOT RUN") : formatNumber(Number(n)) + suffix;
const short = (s: string) => s?.replace("lab-", "").slice(0, 8) ?? "—";
function Badge({ value, children }: any) {
  return (
    <span className={"badge " + (value ?? "")}>
      {t(children ?? value?.replaceAll("_", " "))
        ?.toString()
        .toUpperCase()}
    </span>
  );
}
function Empty({ icon: Icon = FlaskConical, title, text, action }: any) {
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
function CopyButton({ value, label = "Copy", notify }: any) {
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
function CodePanel({
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
function Pipeline({ events = [], attempt = 0, running = false }: any) {
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
function Result({ job, selected, setSelected, notify, newRun }: any) {
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
function App() {
  const locale = useLocale();
  const [language, setLanguage] = useState("python");
  const sourceLanguage = languages.find((l) => l.id === language)!;
  const [page, setPage] = useState(
    decodeURIComponent(location.hash.slice(1)) || "Playground",
  );
  const [status, setStatus] = useState<any>(null),
    [offline, setOffline] = useState(false),
    [examples, setExamples] = useState<any[]>([]),
    [problems, setProblems] = useState<any[]>([]);
  const [statement, setStatement] = useState(""),
    [constraints, setConstraints] = useState(""),
    [code, setCode] = useState(""),
    [tab, setTab] = useState("statement"),
    [mode, setMode] = useState("demo"),
    [oracle, setOracle] = useState("example");
  const [validator, setValidator] = useState(""),
    [references, setReferences] = useState(["", "", ""]),
    [paid, setPaid] = useState(false),
    [problemId, setProblemId] = useState(""),
    [submissionId, setSubmissionId] = useState("");
  const [job, setJob] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(0),
    [error, setError] = useState(""),
    [runs, setRuns] = useState<any[]>([]),
    [data, setData] = useState<any>(null),
    [runFilter, setRunFilter] = useState("all"),
    [dataset, setDataset] = useState("official");
  const [toast, setToast] = useState(""),
    [palette, setPalette] = useState(false),
    [menu, setMenu] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const stream = useRef<EventSource>(null),
    jobStart = useRef(0),
    submitRef = useRef<() => void>(() => {});
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  };
  const navigate = (name: string) => {
    setPage(name);
    location.hash = name;
    setMenu(false);
    setPalette(false);
  };
  const refresh = useCallback(async () => {
    try {
      const [s, r, d] = await Promise.all([
        api("/system/status"),
        api("/runs"),
        api("/metrics"),
      ]);
      setStatus(s);
      setRuns(r);
      setData(d);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);
  function loadExample(example: any) {
    setLanguage("python");
    setStatement(example.statement);
    setConstraints(example.constraints);
    setCode(example.code);
    setOracle("example");
    setError("");
  }
  useEffect(() => {
    refresh();
    api("/examples")
      .then((e) => {
        setExamples(e);
        if (e[0]) loadExample(e[0]);
      })
      .catch(() => setOffline(true));
    api("/problems")
      .then(setProblems)
      .catch(() => {});
    const interval = setInterval(refresh, 20000);
    return () => {
      clearInterval(interval);
      stream.current?.close();
    };
  }, [refresh]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submitRef.current();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if (e.key === "Escape") {
        setPalette(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", handler);
    const hash = () =>
      setPage(decodeURIComponent(location.hash.slice(1)) || "Playground");
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(
      () => setElapsed((Date.now() - jobStart.current) / 1000),
      100,
    );
    return () => clearInterval(t);
  }, [busy]);
  async function startRun() {
    if (busy || page !== "Playground") return;
    if (!statement.trim() || !constraints.trim() || !code.trim()) {
      setError(
        "Add a problem statement, constraints and source code to start.",
      );
      return;
    }
    setError("");
    setBusy(true);
    setSelected(0);
    setElapsed(0);
    setJob(null);
    jobStart.current = Date.now();
    try {
      const created = await api("/falsify", {
        mode,
        language,
        statement,
        constraints,
        code,
        oracle,
        validator,
        references,
        allowPaid: paid,
        problemId,
        submissionId,
      });
      setJob({
        ...created,
        attempts: [],
        events: [],
        currentAttempt: 0,
        status: "running",
      });
      stream.current?.close();
      const source = new EventSource("/api/runs/" + created.id + "/events");
      stream.current = source;
      source.onmessage = (event) => {
        const e = JSON.parse(event.data);
        setJob((prev) => {
          if (!prev || prev.events.some((x) => x.id === e.id)) return prev;
          const next = { ...prev, events: [...prev.events, e] };
          if (e.type === "attempt_started") next.currentAttempt = e.attempt;
          if (e.type === "attempt_result")
            next.attempts = [...prev.attempts, e.result];
          if (e.type === "job_finished") {
            next.final = e.final;
            next.status = "finished";
            next.elapsed_ms = e.elapsed_ms;
          }
          if (e.type === "job_failed") {
            next.status = "error";
            next.error = e.error;
          }
          return next;
        });
        if (e.type === "attempt_result") setSelected(e.result.attempt - 1);
        if (e.type === "job_finished" || e.type === "job_failed") {
          setBusy(false);
          source.close();
          if (e.type === "job_finished")
            setTimeout(
              () =>
                document.querySelector("[data-testid=result]")?.scrollIntoView({
                  behavior: matchMedia("(prefers-reduced-motion: reduce)")
                    .matches
                    ? "instant"
                    : "smooth",
                  block: "start",
                }),
              180,
            );
          if (e.error) setError(e.error);
          if (e.diagnostics)
            setJob((prev) => ({ ...prev, diagnostics: e.diagnostics }));
          refresh();
        }
      };
      source.onerror = async () => {
        try {
          const latest = await api("/runs/" + created.id);
          setJob(latest);
          if (["finished", "error"].includes(latest.status)) {
            setBusy(false);
            source.close();
            if (latest.error) setError(latest.error);
            refresh();
          }
        } catch {
          setError(
            "Connection lost. The run may still be executing. Reconnect and check Runs before starting another.",
          );
          setBusy(false);
          source.close();
        }
      };
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }
  submitRef.current = startRun;
  async function openRun(id: string) {
    try {
      const j = await api("/runs/" + id);
      setJob(j);
      setSelected(Math.max(0, j.attempts.length - 1));
      setMode(j.mode);
      setLanguage(j.language ?? "python");
      setElapsed(j.elapsed_ms / 1000);
      navigate("Run detail");
    } catch (e: any) {
      notify(e.message);
    }
  }
  const activeRuns =
    dataset === "official"
      ? (data?.runs.filter(
          (r) =>
            r.official ||
            (r.kind === "baseline" &&
              data.runs.some(
                (o) => o.official && o.corpusId && o.corpusId === r.corpusId,
              )),
        ) ?? [])
      : (data?.runs.filter((r) => r.id === dataset) ?? []);
  const groups = activeRuns.flatMap((r) =>
    Object.entries(r.analysis.groups).map(([key, value]: any) => ({
      key,
      ...value,
    })),
  );
  const metric = groups.find((g) => g.key.includes("|ai|")) ?? groups[0];
  const displayedRuns = runs.filter(
    (r) =>
      runFilter === "all" ||
      (runFilter === "kill" ? r.final?.killed : r.verdict === runFilter),
  );
  const isPlayground = page === "Playground";
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        {menu && (
          <button
            className="sidebar-backdrop"
            aria-label={t("Close navigation")}
            onClick={() => setMenu(false)}
          />
        )}
        <aside className={"sidebar " + (menu ? "open" : "")}>
          <button
            className="brand"
            onClick={() => navigate("Playground")}
            aria-label={t("Falsify Lab home")}
          >
            <span className="brand-mark">
              <FlaskConical size={23} strokeWidth={1.8} />
            </span>
            <span>
              {t("FALSIFY")}
              <span className="brand-light">{t(" LAB")}</span>
              <small>{t("ADVERSARIAL CODE LABORATORY")}</small>
            </span>
          </button>
          <button
            className="workspace-switch"
            onClick={() => navigate("System")}
          >
            <span className="workspace-avatar">{t("L")}</span>
            <span>
              {t("Local workspace")}
              <small>{t("Personal laboratory")}</small>
            </span>
            <ChevronDown size={14} />
          </button>
          <div className="nav-label">{t("WORKSPACE")}</div>
          <nav>
            {nav.map(({ name, icon: Icon }) => (
              <button
                key={name}
                className={
                  "nav-item " +
                  (page === name || (page === "Run detail" && name === "Runs")
                    ? "active"
                    : "")
                }
                onClick={() => navigate(name)}
              >
                <Icon size={18} />
                <span>{t(name)}</span>
                {name === "Playground" && (
                  <span className="nav-new">{t("LAB")}</span>
                )}
                {name === "Runs" && runs.length > 0 && (
                  <span className="nav-count">{runs.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="tiny-orbit">
              <CircleDot size={20} />
            </span>
            <strong>{t("Break it. Understand it.")}</strong>
            <p>{t("The most useful test is the one your code fails.")}</p>
            <button
              onClick={() => {
                navigate("Playground");
                if (examples[0]) loadExample(examples[0]);
              }}
            >
              {t("Explore the playground ")}
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="sidebar-bottom">
            <button className="nav-item" onClick={() => navigate("Settings")}>
              <Settings size={17} />
              <span>{t("Settings")}</span>
            </button>
            <button className="command-button" onClick={() => setPalette(true)}>
              <Search size={14} />
              <span>{t("Jump to…")}</span>
              <kbd>{t("Ctrl K")}</kbd>
            </button>
            <div className="local-user">
              <span className="user-avatar">{t("FL")}</span>
              <span>
                {t("Local operator")}
                <small>{t("No account required")}</small>
              </span>
              <span className="status-dot" />
            </div>
          </div>
        </aside>
        <div className="app-body">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label={t("Open navigation")}
                onClick={() => setMenu(true)}
              >
                <Menu size={20} />
              </button>
              <span>{t("Workspace")}</span>
              <ChevronRight size={13} />
              <strong>{t(page)}</strong>
            </div>
            <div className="topbar-right">
              <LanguageSelector />
              <span className={"connection " + (offline ? "offline" : "")}>
                <span className="status-dot" />
                {offline ? t("Backend offline") : t("Backend connected")}
              </span>
              <span className="top-divider" />
              <button className="model-chip" onClick={() => navigate("System")}>
                <Cpu size={14} />
                {status?.provider?.model ?? t("Demo provider")}
                <ChevronDown size={12} />
              </button>
            </div>
          </header>
          <main>
            {locale !== "en" && locale !== "vi" && (
              <p className="translation-note">
                {t("Missing translations use English.")}
              </p>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0, y: 9 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.22 }}
              >
                {isPlayground && (
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
                        <span className="subtle-label">
                          {sourceLanguage.name}
                        </span>
                      </div>
                      <div className="toolbar-actions">
                        <select
                          aria-label={t("Load example")}
                          value=""
                          onChange={(e) => {
                            const example = examples.find(
                              (x) => x.id === e.target.value,
                            );
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
                            <span className="plain-text-label">
                              {t("PLAIN TEXT")}
                            </span>
                          </div>
                          <textarea
                            aria-label={
                              tab === "statement"
                                ? t("Problem statement")
                                : t("Problem constraints")
                            }
                            className="problem-textarea"
                            value={
                              tab === "statement" ? statement : constraints
                            }
                            onChange={(e) => {
                              (tab === "statement"
                                ? setStatement
                                : setConstraints)(e.target.value);
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
                              ? t(
                                  "A precise problem statement makes a better adversary.",
                                )
                              : t(
                                  "Every constraint is enforced by the configured validator.",
                                )}
                            <span>
                              {
                                (tab === "statement" ? statement : constraints)
                                  .length
                              }{" "}
                              {t("chars")}
                            </span>
                          </div>
                        </section>
                        <section className="panel code-panel">
                          <div className="panel-heading">
                            <span>
                              <Code2 size={16} />
                              {t(" Target submission")}{" "}
                              <span className="file-tag">
                                {sourceLanguage.file}
                              </span>
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
                                  status?.languages?.find(
                                    (l) => l.id === language,
                                  )?.status === "available"
                                    ? "status-good"
                                    : "status-warning"
                                }
                              >
                                {t(
                                  status?.languages?.find(
                                    (l) => l.id === language,
                                  )?.status === "available"
                                    ? "Runtime available"
                                    : "Runtime unavailable — open System for setup.",
                                )}
                              </small>
                            )}
                            {language === "java" && (
                              <small>
                                {t("Java entry point: public class Main.")}
                              </small>
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
                              {t(" lines")}{" "}
                              <span className="dot-separator">·</span>
                              {t(" Spaces: 4")}
                            </span>
                          </div>
                        </section>
                        {mode === "playground" && (
                          <details className="panel oracle-setup">
                            <summary>
                              <ShieldCheck size={16} />
                              {t(" Verification setup")}{" "}
                              <Badge
                                value={oracle === "example" ? "passed" : "idle"}
                              >
                                {oracle === "example"
                                  ? t("EXAMPLE ORACLE")
                                  : t("CUSTOM ORACLE")}
                              </Badge>
                              <ChevronDown size={15} />
                            </summary>
                            <p>
                              {t(
                                "To verify a custom problem, provide an input validator and three independently authored reference solutions. These run only inside Docker and are never sent to the model.",
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
                                      r.map((v, j) =>
                                        i === j ? e.target.value : v,
                                      ),
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
                              {job
                                ? t("Live control room")
                                : t("Run configuration")}
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
                                      if (value !== "playground")
                                        setLanguage("python");
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
                                            ?.dev.find(
                                              (s) =>
                                                String(s.id) === e.target.value,
                                            )?.code ?? "",
                                        );
                                      }}
                                    >
                                      <option value="">
                                        {t("Select a DEV target")}
                                      </option>
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
                                      : (status?.provider?.model ??
                                        t("Not configured"))}
                                    <span className="config-pill">
                                      {mode === "demo" ? t("DEMO") : t("API")}
                                    </span>
                                  </strong>
                                </div>
                                <div className="config-row">
                                  <span>{t("Reasoning effort")}</span>
                                  <strong>
                                    {mode === "demo"
                                      ? t("Scripted")
                                      : t("High")}
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
                                className={
                                  "mode-notice " +
                                  (mode === "demo" ? "demo" : "")
                                }
                              >
                                <FlaskConical size={16} />
                                <div>
                                  <strong>
                                    {mode === "demo"
                                      ? t("Try the complete flow, safely.")
                                      : t(
                                          "Isolated execution. Verified results.",
                                        )}
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
                                  {t(
                                    "Allow paid model calls within the configured budget",
                                  )}
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
                                          (e) =>
                                            e.type === "compilation_started",
                                        ) &&
                                          !job.events?.some(
                                            (e) =>
                                              e.type === "compilation_finished",
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
                                {(busy
                                  ? elapsed
                                  : (job.elapsed_ms ?? 0) / 1000
                                ).toFixed(1)}
                                <small>{t("s")}</small>
                              </span>
                            </div>
                          )}
                          <div className="run-cta">
                            <button
                              className={
                                "falsify-button " + (busy ? "is-running" : "")
                              }
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
                                  <kbd>{t("Ctrl")}</kbd> +{" "}
                                  <kbd>{t("Enter")}</kbd>
                                  {t(" to start your experiment")}
                                </>
                              )}
                            </span>
                          </div>
                          {error && (
                            <div className="error-card" role="alert">
                              <AlertTriangle size={17} />
                              <div>
                                <strong>
                                  {t("Unable to complete the run")}
                                </strong>
                                <p>{t(error)}</p>
                                {job?.diagnostics && (
                                  <pre
                                    className="compiler-diagnostics"
                                    dir="ltr"
                                  >
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
                              ? t(
                                  "Demo fixture · No untrusted code is executed",
                                )
                              : t(
                                  "Isolated execution · Network disabled · 3 Python references",
                                )}
                          </div>
                        </section>
                        <div className="attempt-strip">
                          {[1, 2, 3].map((n) => {
                            const a = job?.attempts.find(
                              (a) => a.attempt === n,
                            );
                            return (
                              <button
                                key={n}
                                disabled={!a}
                                className={
                                  (a?.verdict ??
                                    (busy && job?.currentAttempt === n
                                      ? "running"
                                      : "")) +
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
                        {t(
                          "Valid input. Independent references. Reproducible results.",
                        )}
                      </span>
                    </div>
                  </>
                )}
                {page === "Runs" && (
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
                        {[
                          "all",
                          "kill",
                          "survived",
                          "invalid",
                          "inconclusive",
                        ].map((f) => (
                          <button
                            key={f}
                            className={runFilter === f ? "active" : ""}
                            onClick={() => setRunFilter(f)}
                          >
                            {f === "all"
                              ? t("All runs")
                              : f === "kill"
                                ? t("Killed")
                                : f}
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
                                      {new Date(r.createdAt).toLocaleString(
                                        locale,
                                      )}
                                    </small>
                                  </td>
                                  <td>
                                    <span>
                                      {r.mode === "demo"
                                        ? t("Demo fixture")
                                        : r.mode}
                                    </span>
                                    <small>
                                      {r.model} ·{" "}
                                      {languages.find(
                                        (l) =>
                                          l.id === (r.language ?? "python"),
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
                                    {r.final?.kill_at_1 && (
                                      <small>{t("Kill@1")}</small>
                                    )}
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
                            <button
                              className="button"
                              onClick={() => navigate("Playground")}
                            >
                              {t("Open Playground ")}
                              <ArrowRight size={15} />
                            </button>
                          }
                        />
                      )}
                    </section>
                  </>
                )}
                {page === "Run detail" && job && (
                  <>
                    <PageHeader
                      eyebrow={"EXPERIMENT #" + short(job.id)}
                      title={job.title}
                      text={`${job.mode === "demo" ? "Demonstration · Simulated execution" : "Local execution"} · ${new Date(job.createdAt).toLocaleString(locale)}`}
                      action={
                        <button
                          className="button"
                          onClick={() => navigate("Runs")}
                        >
                          <History size={16} />
                          {t("All runs")}
                        </button>
                      }
                    />
                    <div className="detail-grid">
                      <div className="panel">
                        <div className="panel-heading">
                          {t("Execution trace")}
                          <Badge value={job.status} />
                        </div>
                        <Pipeline
                          events={job.events}
                          attempt={selected + 1}
                          running={false}
                        />
                      </div>
                      <div className="panel attempt-list">
                        <div className="panel-heading">
                          {t("Attempt history")}
                          <span className="mono">
                            {job.attempts.length} / 3
                          </span>
                        </div>
                        {job.attempts.map((a, i) => (
                          <button
                            key={i}
                            className={selected === i ? "selected" : ""}
                            onClick={() => setSelected(i)}
                          >
                            <span>
                              {t("Attempt 0")}
                              {a.attempt}
                              <small>
                                {a.input_size}
                                {t(" bytes ·")} {a.tokens_in + a.tokens_out}
                                {t(" tokens")}
                              </small>
                            </span>
                            <Badge value={a.verdict} />
                            <ChevronRight size={15} />
                          </button>
                        ))}
                        {job.error && (
                          <p className="error-text">{t(job.error)}</p>
                        )}
                      </div>
                    </div>
                    <Result
                      job={job}
                      selected={selected}
                      notify={notify}
                      newRun={() => {
                        setJob(null);
                        navigate("Playground");
                      }}
                    />
                  </>
                )}
                {["Benchmarks", "Analytics"].includes(page) && (
                  <>
                    <PageHeader
                      eyebrow={
                        page === "Benchmarks"
                          ? "MEASURED, NOT ASSUMED"
                          : "BEHIND THE VERDICT"
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
                          <option value="official">
                            {t("Official benchmarks")}
                          </option>
                          {data?.runs.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.kind === "smoke" || r.kind === "demo"
                                ? t("DEMO · ")
                                : r.kind.toUpperCase() + " · "}
                              {r.id}
                            </option>
                          ))}
                        </select>
                      }
                    />
                    <div
                      className={
                        "dataset-banner " +
                        (dataset !== "official" ? "demo" : "")
                      }
                    >
                      <FlaskConical size={16} />
                      <span>
                        {dataset === "official"
                          ? data?.officialStatus === "MEASURED"
                            ? t(
                                "Showing completed official benchmark evidence.",
                              )
                            : t(
                                "Official benchmark has not run. Metrics remain unavailable until real results exist.",
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
                    <div className="metric-grid">
                      {[
                        [
                          "Kill@1",
                          metric?.kill_at_1,
                          "%",
                          "First-attempt detection",
                        ],
                        [
                          "Kill@3",
                          metric?.kill_at_3,
                          "%",
                          "Within the full budget",
                        ],
                        [
                          "Feedback gain",
                          metric?.delta_pp,
                          " pp",
                          "Additional detection",
                        ],
                        [
                          "Invalid rate",
                          metric?.invalid_rate,
                          "%",
                          "Rejected candidates",
                        ],
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
                        [
                          "Evaluated pairs",
                          metric?.pairs,
                          "",
                          "Problem / submission pairs",
                        ],
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
                    <Suspense
                      fallback={
                        <div className="panel skeleton chart-placeholder" />
                      }
                    >
                      <Charts
                        metric={metric}
                        groups={groups}
                        runs={activeRuns}
                      />
                    </Suspense>
                    {page === "Analytics" && (
                      <div className="panel survivor-panel">
                        <div className="panel-heading">
                          <span>
                            <ShieldCheck size={16} />
                            {t("Survivor analysis")}
                          </span>
                          <span className="subtle-label">
                            {t("Manual bug labels")}
                          </span>
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
                                    <td>
                                      {s.inconclusive
                                        ? t("Inconclusive")
                                        : t("No")}
                                    </td>
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
                )}
                {page === "Test Suites" && (
                  <>
                    <PageHeader
                      eyebrow="TRACK 02 · GENERALIZATION"
                      title={t("Fewer tests. More exposed bugs.")}
                      text={t(
                        "Inspect the DEV kill matrix, frozen greedy selection, and independent held-out evaluation.",
                      )}
                    />
                    {!data?.suites?.length ? (
                      <div className="panel">
                        <Empty
                          icon={Layers3}
                          title={t("Your adversarial suite starts here.")}
                          text={t(
                            "Complete Track 1 and Track 2 to inspect a measured kill matrix. No tests or coverage numbers are fabricated.",
                          )}
                        />
                      </div>
                    ) : (
                      data.suites.map((suite, i) => (
                        <Suite key={i} suite={suite} />
                      ))
                    )}
                  </>
                )}
                {["System", "Settings"].includes(page) && (
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
                          text:
                            status?.sandbox.message ??
                            "Isolated Linux Docker execution",
                        },
                        {
                          name: "Model provider",
                          icon: Cpu,
                          state:
                            status?.provider.status?.replace("_", " ") ??
                            "Checking",
                          good: status?.provider.status === "configured",
                          text:
                            status?.provider.model ??
                            "No paid model credentials configured",
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
                          text: "Three independent accepted solutions per problem.",
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
                            <span
                              className={
                                "status-dot " + (!good ? "warning-dot" : "")
                              }
                            />
                          </div>
                          <h3>{t(name)}</h3>
                          <strong
                            className={good ? "status-good" : "status-warning"}
                          >
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
                                status?.languages?.find((x) => x.id === l.id)
                                  ?.status === "available"
                                  ? "available"
                                  : "unavailable"
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <p>
                        {t(
                          "Build the additional sandbox to enable non-Python languages:",
                        )}
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
                            <code>
                              docker build -t ai-falsifier-python:local sandbox
                            </code>
                          </div>
                        </div>
                        <div>
                          <span>02</span>
                          <div>
                            <h3>
                              {t("Configure your provider on the server")}
                            </h3>
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
                                "Load a curated corpus with FALSIFIER_CORPUS, use the bundled sum problem, or add a validator and three reference solutions in the Playground.",
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
                )}
              </motion.div>
            </AnimatePresence>
          </main>
          <footer className="app-footer">
            <span>
              {t("FALSIFY LAB ")}
              <span> / </span>
              {t(" Built for the edge cases.")}
            </span>
            <span>
              <span className="status-dot" />
              {t(" Local environment ")}
              <span>·</span> {t("v0.1")}
            </span>
          </footer>
        </div>
        <AnimatePresence>
          {toast && (
            <motion.div
              className="toast"
              role="status"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <CheckCircle2 size={16} />
              {t(toast)}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {palette && (
            <motion.div
              className="palette-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPalette(false)}
            >
              <motion.div
                className="command-palette"
                role="dialog"
                aria-modal="true"
                aria-label={t("Navigate workspace")}
                initial={{ y: -10, scale: 0.98 }}
                animate={{ y: 0, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="palette-title">
                  <Search size={18} />
                  {t("Jump to your workspace")}
                  <button
                    className="icon-button"
                    aria-label={t("Close command palette")}
                    onClick={() => setPalette(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
                {nav.map(({ name, icon: Icon }, i) => (
                  <button
                    key={name}
                    autoFocus={i === 0}
                    onClick={() => navigate(name)}
                  >
                    <Icon size={18} />
                    {t(name)}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
                <div className="palette-footer">
                  {t("Navigate with Tab · Enter to open · Esc to close")}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
function PageHeader({ eyebrow, title, text, action }: any) {
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
function Metric({ label, value, unit, description }: any) {
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
function Suite({ suite }: any) {
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
            {t("Frozen before evaluation")}
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
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
