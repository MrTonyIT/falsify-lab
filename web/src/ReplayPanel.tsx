import React, { useState, useEffect } from "react";
import { api } from "./api";
import { t } from "./i18n";
export function ReplayPanel({ job, attempt }: any) {
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setCode("");
    setError("");
    setResult(null);
  }, [job.id, attempt.attempt]);
  const path = `/runs/${job.id}/attempts/${attempt.attempt}`;
  const download = async (kind: string) => {
    try {
      const evidence = await api(path + "/evidence");
      const bytes =
        kind === "input"
          ? Uint8Array.from(atob(evidence.input_b64), (c) => c.charCodeAt(0))
          : JSON.stringify(evidence, null, 2);
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type:
            kind === "input" ? "application/octet-stream" : "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${job.id}-attempt-${attempt.attempt}.${kind === "input" ? "in" : "json"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      setError(e.message);
    }
  };
  const replay = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api(path + "/replay", { code }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (job.status !== "finished") return null;
  return (
    <div className="replay-panel">
      <p>
        {t(
          "Download full input or export input/output evidence. Exports omit source code, generated scripts and raw provider responses; review before sharing.",
        )}
      </p>
      <div className="result-actions">
        <button className="button subtle" onClick={() => download("input")}>
          {t("Download full input")}
        </button>
        <button className="button subtle" onClick={() => download("evidence")}>
          {t("Export evidence")}
        </button>
      </div>
      <p>
        {t("Source SHA")}: <code>{attempt.sub_hash}</code>
        <br />
        {t("Input SHA")}: <code>{attempt.input_sha}</code>
        <br />
        {t("Execution")}: {attempt.execution_kind ?? "unknown"} ·{" "}
        {attempt.target_language ?? "python"} · {t("Commit")}:{" "}
        <code>{attempt.git_commit}</code>
      </p>
      <p>
        {t("Runtime image")}:{" "}
        <code>
          {attempt.runtime_image_id ??
            t(job.mode === "demo" ? "Simulated execution" : "Not recorded")}
        </code>
      </p>
      <p>
        {t(
          "To reproduce: download the input, run your source with it in an isolated environment, then compare with the saved expected output using the problem checker.",
        )}
      </p>
      {["kill", "survived"].includes(attempt.verdict) &&
        (job.language ?? "python") === "python" && (
          <details>
            <summary>{t("Check a revision on this input")}</summary>
            <p>
              {t(
                "No model calls. The original run stays unchanged. Passing this input does not prove correctness. Live replay uses Docker and rechecks the original oracle.",
              )}
            </p>
            {job.mode === "demo" && (
              <>
                <p>
                  {t(
                    "Simulated demo: only the two bundled sources can be replayed. Arbitrary edits require live execution.",
                  )}
                </p>
                <button
                  className="button subtle"
                  onClick={async () => {
                    try {
                      const rows = await api("/examples");
                      setCode(rows[1].code);
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  {t("Load bundled corrected example")}
                </button>
              </>
            )}
            <label>
              {t("Revised Python source")}
              <textarea
                aria-label={t("Revised Python source")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={busy}
                spellCheck={false}
              />
            </label>
            <button
              className="button primary"
              disabled={busy || !code.trim()}
              onClick={replay}
            >
              {t(busy ? "Checking revision…" : "Run saved input without AI")}
            </button>
            {result && (
              <div role="status" data-testid="replay-result">
                <strong>
                  {t(
                    result.verdict === "survived"
                      ? "Matches expected output on this input only."
                      : result.verdict === "kill"
                        ? "The revision still differs on this input."
                        : "Not enough evidence to judge this revision.",
                  )}
                </strong>
                <p>
                  {t("Execution")}: {result.execution_kind} · {t("Model calls")}
                  : {result.model_calls}
                </p>
                <pre>{result.actual}</pre>
                {result.outputs_truncated && (
                  <p>{t("Output preview truncated.")}</p>
                )}
              </div>
            )}
          </details>
        )}
      {error && <p role="alert">{t(error)}</p>}
    </div>
  );
}
