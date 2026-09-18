import {
  mkdir,
  appendFile,
  readFile,
  writeFile,
  stat,
  readdir,
} from "node:fs/promises";
import { join } from "node:path";
import { assert, Verdict } from "./domain.js";
export const ATTEMPT_FIELDS = [
  "run_id",
  "git_commit",
  "problem_id",
  "submission_id",
  "sub_hash",
  "passed_test_count",
  "attempt",
  "model",
  "reasoning_effort",
  "generator_script",
  "verdict",
  "detail",
  "input_size",
  "tokens_in",
  "tokens_out",
  "cost_usd",
  "latency_ms",
];
export const FINAL_FIELDS = [
  "run_id",
  "problem_id",
  "submission_id",
  "killed",
  "kill_at_1",
  "attempts_used",
  "killer_script_sha",
  "min_input_size",
  "total_cost_usd",
];
export class JsonlLog {
  constructor(directory) {
    this.directory = directory;
  }
  async initialize(metadata) {
    await mkdir(this.directory, { recursive: true });
    const existing = await readdir(this.directory);
    assert(
      existing.every((n) => ["web.json", "stream.jsonl"].includes(n)),
      "EEXIST: Run directory already contains evidence",
    );
    await writeFile(
      join(this.directory, "run.json"),
      JSON.stringify(metadata, null, 2),
      { flag: "wx" },
    );
  }
  async append(kind, record) {
    assert(
      [
        "attempts",
        "finals",
        "track2",
        "blackbox",
        "events",
        "responses",
      ].includes(kind),
      "Unknown log kind",
    );
    for (const key of kind === "attempts"
      ? ATTEMPT_FIELDS
      : kind === "finals"
        ? FINAL_FIELDS
        : [])
      assert(key in record, `Missing ${key}`);
    if (kind === "attempts")
      assert(
        Object.values(Verdict).includes(record.verdict),
        "Unknown verdict",
      );
    await mkdir(this.directory, { recursive: true });
    await appendFile(
      join(this.directory, kind + ".jsonl"),
      JSON.stringify(record) + "\n",
      { encoding: "utf8", mode: 0o600 },
    );
  }
}
export async function readJsonl(path) {
  let data;
  try {
    assert(
      (await stat(path)).size <= 128 * 1024 * 1024,
      "Evidence file exceeds 128 MiB analysis limit",
    );
    data = await readFile(path, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  return data
    .split(/\r?\n/)
    .filter((x) => x.trim())
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSONL at ${path}:${i + 1}`);
      }
    });
}
