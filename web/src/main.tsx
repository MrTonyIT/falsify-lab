import { useDialogFocus } from "./useDialogFocus";
import { Playground } from "./Playground";
import { api } from "./api";
import { Badge, Empty, PageHeader, short } from "./shared";
import { Pipeline } from "./Pipeline";
import { Result } from "./Result";
import { Suite } from "./Suite";
import { SystemPage } from "./SystemPage";
import { BenchmarkPage } from "./BenchmarkPage";
import { RunsPage } from "./RunsPage";
import { languages } from "../../src/languages.js";
import { LanguageSelector, useLocale, t } from "./i18n";
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
  ArrowUpRight,
  ChevronRight,
  ChevronDown,
  X,
  Settings,
  Activity,
  LayoutGrid,
  History,
  BarChart3,
  Layers3,
  Cpu,
  Search,
  CircleDot,
  CheckCircle2,
  Menu,
} from "lucide-react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "./styles.css";

const nav = [
  { name: "Playground", icon: Terminal },
  { name: "Runs", icon: History },
  { name: "Benchmarks", icon: LayoutGrid },
  { name: "Test Suites", icon: Layers3 },
  { name: "Analytics", icon: BarChart3 },
  { name: "System", icon: Activity },
];
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
  useDialogFocus(palette, ".command-palette");
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
              r.evidenceStatus === "VERIFIED" &&
              data.runs.some(
                (o) =>
                  o.official &&
                  o.corpusId &&
                  o.corpusId === r.corpusId &&
                  o.requiredBaselineSha &&
                  o.requiredBaselineSha === r.baselineSha,
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
            {locale !== "en" && (
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
                  <Playground
                    offline={offline}
                    mode={mode}
                    setMode={setMode}
                    examples={examples}
                    loadExample={loadExample}
                    statement={statement}
                    setStatement={setStatement}
                    constraints={constraints}
                    setConstraints={setConstraints}
                    code={code}
                    setCode={setCode}
                    tab={tab}
                    setTab={setTab}
                    language={language}
                    setLanguage={setLanguage}
                    sourceLanguage={sourceLanguage}
                    oracle={oracle}
                    setOracle={setOracle}
                    validator={validator}
                    setValidator={setValidator}
                    references={references}
                    setReferences={setReferences}
                    paid={paid}
                    setPaid={setPaid}
                    problemId={problemId}
                    setProblemId={setProblemId}
                    submissionId={submissionId}
                    setSubmissionId={setSubmissionId}
                    problems={problems}
                    job={job}
                    setJob={setJob}
                    busy={busy}
                    selected={selected}
                    setSelected={setSelected}
                    error={error}
                    setError={setError}
                    startRun={startRun}
                    elapsed={elapsed}
                    status={status}
                    notify={notify}
                    navigate={navigate}
                  />
                )}
                {page === "Runs" && (
                  <RunsPage
                    navigate={navigate}
                    runFilter={runFilter}
                    setRunFilter={setRunFilter}
                    displayedRuns={displayedRuns}
                    openRun={openRun}
                    locale={locale}
                  />
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
                  <BenchmarkPage
                    page={page}
                    dataset={dataset}
                    setDataset={setDataset}
                    data={data}
                    metric={metric}
                    groups={groups}
                    activeRuns={activeRuns}
                  />
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
                  <SystemPage
                    page={page}
                    status={status}
                    offline={offline}
                    refresh={refresh}
                  />
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
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
