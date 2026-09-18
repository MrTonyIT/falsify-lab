import { assert, validateConfig, sha256, LIMITS } from "./domain.js";
import { Budget } from "./budget.js";
import { digest, protocolBinding } from "./protocol.js";
import { resolve } from "node:path";
export { Budget } from "./budget.js";
export function estimatedCost(usage, pricing) {
  const { tokensIn = 0, tokensOut = 0, cachedTokens = 0 } = usage;
  for (const n of [tokensIn, tokensOut, cachedTokens])
    assert(Number.isInteger(n) && n >= 0, "Invalid token usage");
  assert(cachedTokens <= tokensIn, "Invalid cached token count");
  return (
    ((tokensIn - cachedTokens) * pricing.input +
      cachedTokens * pricing.cachedInput +
      tokensOut * pricing.output) /
    1e6
  );
}
export function configIdentity(c) {
  const { apiKey, token, secret, ...publicConfig } = c;
  return digest({ ...protocolBinding(), config: publicConfig });
}
export function persistentBudget(config, root = "results") {
  const identity = configIdentity(config);
  return new Budget(config.costLimitUsd, {
    identity,
    path: resolve(root, "budgets", identity.slice(7) + ".json"),
  });
}
// Generic Chat-Completions-compatible HTTP adapter. Compatibility is measured, not assumed.
export class HttpLLM {
  kind = "live";
  constructor(
    config,
    {
      fetchImpl = fetch,
      budget = persistentBudget(config),
      apiKey = process.env.FALSIFIER_API_KEY,
    } = {},
  ) {
    this.config = validateConfig(config);
    this.fetch = fetchImpl;
    this.budget = budget;
    this.apiKey = apiKey;
  }
  async call(prompt) {
    const c = this.config;
    assert(
      c.endpoint && this.apiKey,
      "Provider endpoint and FALSIFIER_API_KEY required",
    );
    assert(
      new URL(c.endpoint).protocol === "https:",
      "Live provider must use HTTPS",
    );
    // Operator verifies this tokenizer-specific bound during compatibility preflight.
    assert(
      Number.isInteger(c.maxInputTokens) &&
        c.maxInputTokens >= Buffer.byteLength(prompt),
      "Prompt exceeds conservative input-token reservation",
    );
    const reservation = this.budget.reserve(
      (c.maxInputTokens * Math.max(c.pricing.input, c.pricing.cachedInput) +
        c.maxCompletionTokens * c.pricing.output) /
        1e6,
    );
    const body = {
      model: c.model,
      messages: [{ role: "user", content: prompt }],
      reasoning_effort: c.reasoningEffort,
      max_completion_tokens: c.maxCompletionTokens,
    };
    if (c.temperature !== undefined && c.temperature !== null)
      body.temperature = c.temperature;
    const started = Date.now();
    const r = await this.fetch(c.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(c.apiTimeoutMs ?? 180000),
    });
    if (!r.ok)
      throw new Error(
        `Provider HTTP ${r.status}; no automatic retries or parameter changes`,
      );
    let data, rawResponse;
    if (r.body) {
      const chunks = [];
      let size = 0;
      for await (const chunk of r.body) {
        size += chunk.length;
        assert(
          size <= LIMITS.providerResponseBytes,
          "Provider response exceeds 8 MiB; billing must be reconciled",
        );
        chunks.push(chunk);
      }
      rawResponse = Buffer.concat(chunks).toString("utf8");
      data = JSON.parse(rawResponse);
    } else data = await r.json(); // Injectable unit-test transports need not implement streams.
    rawResponse ??= JSON.stringify(data);
    assert(
      Buffer.byteLength(rawResponse) <= LIMITS.providerResponseBytes,
      "Provider response exceeds bound",
    );
    const u = data.usage;
    assert(
      u &&
        Number.isInteger(u.prompt_tokens) &&
        Number.isInteger(u.completion_tokens),
      "Provider usage missing: stop, reconcile billing before resuming",
    );
    const usage = {
      tokensIn: u.prompt_tokens,
      tokensOut: u.completion_tokens,
      cachedTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
    };
    const costUsd = estimatedCost(usage, c.pricing);
    assert(
      this.budget.charge(costUsd, reservation),
      "Provider exceeded reserved cost; billing reconciliation required",
    );
    const content = data.choices?.[0]?.message?.content;
    return {
      text: typeof content === "string" ? content : "",
      ...usage,
      costUsd,
      latencyMs: Date.now() - started,
      providerModel: data.model ?? null,
      finishReason: data.choices?.[0]?.finish_reason ?? null,
      requestId: data.id ?? null,
      rawResponse,
    };
  }
}
export class MockLLM {
  kind = "mock";
  constructor(responses) {
    this.responses = [...responses];
    this.prompts = [];
  }
  async call(prompt) {
    this.prompts.push(prompt);
    assert(this.responses.length, "Mock responses exhausted");
    return {
      text: this.responses.shift(),
      tokensIn: 0,
      tokensOut: 0,
      cachedTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      providerModel: "mock",
    };
  }
}
