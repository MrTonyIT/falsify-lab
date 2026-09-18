import { sha256, assert, LIMITS } from "./domain.js";
import { protocolBinding } from "./protocol.js";
export async function preserveResponse(
  log,
  response,
  metadata,
  { problem_id = null, submission_id = null, attempt, retainRaw = true } = {},
) {
  const raw =
    response.rawResponse ??
    JSON.stringify({
      text: response.text,
      providerModel: response.providerModel,
      requestId: response.requestId,
    });
  assert(
    typeof raw === "string" &&
      Buffer.byteLength(raw) <= LIMITS.providerResponseBytes,
    "Response artifact exceeds bounded size",
  );
  await log.append("responses", {
    ...protocolBinding(),
    run_id: metadata.run_id,
    problem_id,
    submission_id,
    attempt,
    config_id: metadata.config_id,
    nonempty: typeof response.text === "string" && !!response.text.trim(),
    provider_request_id: response.requestId ?? null,
    provider_model: response.providerModel ?? null,
    raw_response_sha: sha256(raw),
    raw_response: retainRaw ? raw : null,
    tokens_in: response.tokensIn,
    tokens_out: response.tokensOut,
    cached_tokens: response.cachedTokens ?? 0,
    cost_usd: response.costUsd,
    finish_reason: response.finishReason ?? null,
  });
}
