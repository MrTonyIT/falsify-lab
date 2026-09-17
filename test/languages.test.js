import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { languages, languageFor } from "../src/languages.js";
import { build_falsify_prompt } from "../src/prompt.js";
import { Evaluator } from "../src/evaluator.js";
import { MockSandbox, dockerArgs, DockerSandbox } from "../src/sandbox.js";
import { LabService, examples } from "../server/service.js";
import { readJsonl } from "../src/logging.js";
import { smokeProblem } from "../fixtures/sum-problem.js";
import { messages } from "../web/src/locales/international.js";

test("language IDs are allowlisted; historic Python labels preserve the benchmark prompt", () => {
  assert.equal(languageFor("Python 3").id, "python");
  for (const invalid of ["sh", "cpp; curl attacker", "../../bin/sh", {}, null])
    assert.throws(() => languageFor(invalid));
  const p = smokeProblem();
  assert(build_falsify_prompt(p, p.dev[0]).includes("[TARGET PYTHON]"));
  for (const l of languages) {
    const prompt = build_falsify_prompt(
      p,
      { ...p.dev[0], language: l.id },
      [],
      { knownWrong: false },
    );
    assert(prompt.includes("PYTHON GENERATOR SCRIPT"));
    assert(prompt.includes("correctness is UNKNOWN"));
    assert(
      prompt.includes(
        l.id === "python"
          ? "[TARGET PYTHON]"
          : `[TARGET ${l.name.toUpperCase()}]`,
      ),
    );
  }
});
test("the evaluator sends the target language only to the target and aborts compile failures", async () => {
  const p = smokeProblem(),
    input = Buffer.from("1\n1\n-1\n");
  const sandbox = new MockSandbox((code, data, options) =>
    options.role === "generator"
      ? { stdout: input }
      : options.role === "target"
        ? { compileFailed: true, crashed: true, stderr: "bad source" }
        : { stdout: Buffer.from("-1\n") },
  );
  await assert.rejects(
    () =>
      new Evaluator(sandbox).evaluate(
        p,
        { ...p.dev[0], language: "cpp" },
        "generator",
      ),
    (e) => e.code === "COMPILE_FAILED",
  );
  assert.equal(sandbox.calls.at(-1).options.language, "cpp");
  assert(sandbox.calls.slice(0, -1).every((c) => !c.options.language));
});
test("compiled sandbox retains isolation and permits execution only in its bounded work mount", () => {
  const normal = dockerArgs("python", "test", {
    seconds: 30,
    memoryBytes: 1e9,
  });
  const multi = dockerArgs("multi", "test", {
    seconds: 50,
    memoryBytes: 1e9,
    multilang: true,
  });
  assert(!normal.includes("/work:rw,exec,nosuid,nodev,size=256m"));
  for (const option of [
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "/tmp:rw,noexec,nosuid,nodev,size=64m",
    "/work:rw,exec,nosuid,nodev,size=256m",
  ])
    assert(multi.includes(option));
});
test("API rejects unsupported and non-Python demo/benchmark requests before execution", async () => {
  const s = new LabService({
    root: await mkdtemp(join(tmpdir(), "language-api-")),
  });
  await s.init();
  for (const mode of ["demo", "benchmark"])
    await assert.rejects(
      () => s.start({ ...examples[0], mode, language: "cpp" }),
      (e) => e.code === "PYTHON_PROTOCOL_ONLY",
    );
  await assert.rejects(
    () => s.start({ ...examples[0], mode: "playground", language: "shell" }),
    (e) => e.code === "UNSUPPORTED_LANGUAGE",
  );
  assert.equal(s.jobs.size, 0);
});
test("compile errors end a live job before model calls and produce no benchmark kill evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "compile-api-"));
  const s = new LabService({ root });
  await s.init();
  s.config = {
    model: "unused",
    reasoningEffort: "high",
    maxCompletionTokens: 16000,
    pricing: { input: 0, output: 0, cachedInput: 0 },
  };
  s.status = async () => ({
    provider: { status: "configured" },
    sandbox: { status: "available" },
    languages: [{ id: "cpp", status: "available" }],
  });
  const calls = [];
  s.multilang = {
    run: async (...args) => {
      calls.push(args);
      return {
        compileFailed: true,
        stderr: "compiler syntax error",
        stdout: Buffer.alloc(0),
      };
    },
  };
  const started = await s.start({
    ...examples[0],
    mode: "playground",
    oracle: "example",
    language: "cpp",
    code: "broken source",
    allowPaid: true,
  });
  for (let i = 0; i < 100 && s.active; i++)
    await new Promise((r) => setTimeout(r, 10));
  const job = s.get(started.id);
  assert.equal(job.status, "error");
  assert.equal(job.language, "cpp");
  assert.equal(job.diagnostics, "compiler syntax error");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].prepareOnly, true);
  assert(!job.events.some((e) => e.type === "llm_started"));
  assert.equal(job.attempts.length, 0);
  assert.deepEqual(await readJsonl(join(root, job.id, "finals.jsonl")), []);
});
test("core international messages have ten nonempty translations each", () => {
  for (const [key, values] of Object.entries(messages)) {
    assert.equal(values.length, 10, key);
    assert(
      values.every((v) => typeof v === "string" && v.trim()),
      key,
    );
  }
});
test("live Python syntax preflight treats source as data and makes no model call on invalid syntax", async () => {
  const root = await mkdtemp(join(tmpdir(), "syntax-api-"));
  const s = new LabService({ root });
  await s.init();
  s.config = {
    model: "unused",
    reasoningEffort: "high",
    maxCompletionTokens: 16000,
    pricing: { input: 0, output: 0, cachedInput: 0 },
  };
  s.status = async () => ({
    provider: { status: "configured" },
    sandbox: { status: "available" },
    languages: [{ id: "python", status: "available" }],
  });
  const source = "print('untrusted')\nreturn 5";
  const calls = [];
  s.sandbox = {
    run: async (code, input, options) => {
      calls.push({ code, options });
      return {
        crashed: true,
        stderr: "SyntaxError: return outside function",
        stdout: Buffer.alloc(0),
      };
    },
  };
  const started = await s.start({
    ...examples[0],
    mode: "playground",
    oracle: "example",
    language: "python",
    code: source,
    allowPaid: true,
  });
  for (let i = 0; i < 100 && s.active; i++)
    await new Promise((r) => setTimeout(r, 10));
  assert.equal(s.get(started.id).status, "error");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.role, "syntax-check");
  assert(!calls[0].code.includes("print('untrusted')"));
  assert(calls[0].code.includes(Buffer.from(source).toString("hex")));
  assert(!s.get(started.id).events.some((e) => e.type === "llm_started"));
});

const echoSources = {
  c: '#include <stdio.h>\nint main(){int n;scanf("%d",&n);printf("%d\\n",n+1);}',
  cpp: '#include <iostream>\nint main(){int n;std::cin>>n;std::cout<<n+1<<"\\n";}',
  javascript:
    'const fs=require("fs");console.log(Number(fs.readFileSync(0,"utf8"))+1);',
  typescript:
    'declare function require(n:string):any; const fs=require("fs");console.log(Number(fs.readFileSync(0,"utf8"))+1);',
  java: "import java.util.Scanner; public class Main {public static void main(String[] args){System.out.println(new Scanner(System.in).nextInt()+1);}}",
  go: 'package main\nimport "fmt"\nfunc main(){var n int;fmt.Scan(&n);fmt.Println(n+1)}',
  rust: 'use std::io::{self,Read};fn main(){let mut s=String::new();io::stdin().read_to_string(&mut s).unwrap();println!("{}",s.trim().parse::<i32>().unwrap()+1);}',
  csharp:
    "using System;class MainClass{static void Main(){Console.WriteLine(int.Parse(Console.ReadLine())+1);}}",
  ruby: "puts STDIN.read.to_i+1",
  php: '<?php echo (intval(trim(stream_get_contents(STDIN)))+1)."\\n";',
};
test(
  "real multi-language Docker: stdin/output, compilation failure, timeout and isolation",
  { skip: process.env.FALSIFIER_MULTILANG_TEST !== "1", timeout: 300000 },
  async () => {
    const sandbox = new DockerSandbox({
      image:
        process.env.FALSIFIER_MULTILANG_IMAGE || "ai-falsifier-multilang:local",
    });
    await sandbox.check();
    for (const [language, code] of Object.entries(echoSources)) {
      const r = await sandbox.run(code, Buffer.from("41\n"), {
        language,
        multilang: true,
      });
      assert.equal(r.exitCode, 0, `${language}: ${r.stderr}`);
      assert.equal(r.stdout.toString().trim(), "42", language);
    }
    const bad = await sandbox.run("this is not C++", Buffer.alloc(0), {
      language: "cpp",
      multilang: true,
    });
    assert(bad.compileFailed);
    const timeout = await sandbox.run("while(true){}", Buffer.alloc(0), {
      language: "javascript",
      multilang: true,
      seconds: 1,
    });
    assert(timeout.timedOut);
    const readOnly = await sandbox.run(
      'require("fs").writeFileSync("/forbidden","x")',
      Buffer.alloc(0),
      { language: "javascript", multilang: true },
    );
    assert(readOnly.crashed);
  },
);
