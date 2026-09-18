import test from "node:test";
import assert from "node:assert/strict";
import { Evaluator } from "../src/evaluator.js";
import { MockSandbox, dockerArgs } from "../src/sandbox.js";
import { tokenChecker, lineChecker } from "../src/checkers.js";
import { Verdict as V, LIMITS } from "../src/domain.js";
const problem = {
  oracleKind: "synthetic-fixture",
  checkerName: "tokens",
  validator: () => ({ ok: true, semanticSize: 1 }),
  references: [1, 2, 3].map((i) => ({ code: "r" + i, author: "a" + i })),
  checker: tokenChecker,
};
for (const [name, change, expected] of [
  ["generator crash", { generator: { crashed: true } }, V.GEN_FAILED],
  ["generator timeout", { generator: { timedOut: true } }, V.GEN_FAILED],
  ["oversized generator", { generator: { overflow: true } }, V.GEN_FAILED],
  ["reference failure", { reference: { crashed: true } }, V.UNUSABLE],
  ["reference timeout", { reference: { timedOut: true } }, V.UNUSABLE],
  ["target crash", { target: { crashed: true } }, V.INCONCLUSIVE],
  ["target WA", { target: { stdout: Buffer.from("2") } }, V.KILL],
  ["target timeout", { target: { timedOut: true } }, V.INCONCLUSIVE],
  ["target MLE", { target: { mle: true } }, V.INCONCLUSIVE],
  ["target overflow", { target: { overflow: true } }, V.INCONCLUSIVE],
  ["survives", {}, V.SURVIVED],
]) {
  test(name, async () => {
    const e = new Evaluator(
      new MockSandbox((c, i, o) => ({
        stdout: Buffer.from("1"),
        ...change[o.role],
      })),
    );
    assert.equal(
      (await e.evaluate(problem, { code: "t" }, "gen")).verdict,
      expected,
    );
  });
}
test("invalid input stops before references", async () => {
  const s = new MockSandbox(() => ({ stdout: Buffer.from("1") }));
  assert.equal(
    (
      await new Evaluator(s).evaluate(
        { ...problem, validator: () => ({ ok: false }) },
        { code: "t" },
        "g",
      )
    ).verdict,
    V.INVALID_INPUT,
  );
  assert.equal(s.calls.length, 1);
});
test("reference disagreement", async () => {
  const s = new MockSandbox((c) => ({
    stdout: Buffer.from(c === "r3" ? "2" : "1"),
  }));
  assert.equal(
    (await new Evaluator(s).evaluate(problem, { code: "t" }, "g")).verdict,
    V.UNUSABLE,
  );
});
test("checkers normalize output without accepting extra tokens", () => {
  assert(!tokenChecker("YES\r\n1  2\n", "yes 1 2  "));
  assert(tokenChecker("YES\r\n1  2\n", "YES 1 2  "));
  assert(!tokenChecker("1", "1 2"));
  assert(lineChecker("abc  \r\n\r\n", "abc\n"));
});
test("Docker command includes isolation, no shell and protocol CPU quota", () => {
  const a = dockerArgs("image", "name", {
    seconds: 30,
    memoryBytes: LIMITS.memoryBytes,
  });
  for (const x of [
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit",
    "--memory",
    "--memory-swap",
    "--user",
    "--tmpfs",
  ])
    assert(a.includes(x));
  assert.equal(a[a.indexOf("--cpus") + 1], String(LIMITS.cpus));
  assert.equal(a[a.indexOf("--memory") + 1], a[a.indexOf("--memory-swap") + 1]);
});
