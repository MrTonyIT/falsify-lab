import { createHash } from 'node:crypto';

export const Verdict = Object.freeze({ KILL:'kill', SURVIVED:'survived', INVALID_INPUT:'invalid', GEN_FAILED:'gen_failed', UNUSABLE:'unusable', INCONCLUSIVE:'inconclusive' });
export const sha256 = value => 'sha256:' + createHash('sha256').update(value).digest('hex');
export const LIMITS = Object.freeze({ attempts:3, seed:12345, generatorSeconds:10, runSeconds:30, memoryBytes:1073741824, inputBytes:8388608, outputBytes:8388608, stderrBytes:65536, pids:64 });
export function assert(condition, message) { if (!condition) throw new Error(message); }
export function publicProblem(problem) {
  assert(typeof problem.statement === 'string' && typeof problem.constraints === 'string', 'Statement and constraints required');
  return Object.freeze({ id:problem.id, statement:problem.statement, constraints:problem.constraints });
}
export function devTarget(submission) {
  assert(submission.split === 'dev', 'Only DEV submissions may be exposed to generation or selection');
  assert(typeof submission.code === 'string', 'Target source required');
  return Object.freeze({ id:submission.id, split:'dev', code:submission.code });
}
export function validateProblem(p, { official=false, allowRuntimeError=false }={}) {
  publicProblem(p);
  assert(['A','B','C'].includes(p.division), 'Div2 A/B/C required');
  assert(typeof p.validator === 'function' && typeof p.checker === 'function', 'Validator/checker required');
  assert(p.references?.length === 3, 'Exactly three references required');
  assert(new Set(p.references.map(r=>r.author)).size === 3 && p.references.every(r=>r.author && r.verdict==='ACCEPTED' && typeof r.code==='string'), 'References must be ACCEPTED from three named authors');
  const subs=[...p.dev,...p.heldOut];
  assert(new Set(subs.map(s=>String(s.id))).size === subs.length, 'Submission IDs overlap');
  assert(new Set(subs.map(s=>sha256(s.code))).size === subs.length, 'Duplicate source across corpus partitions');
  assert(!p.references.some(r=>subs.some(s=>String(s.id)===String(r.id))), 'Reference/target IDs overlap');
  assert(p.dev.every(s=>s.split==='dev') && p.heldOut.every(s=>s.split==='held-out'), 'Incorrect split labels');
  for (const s of subs) {
    assert(typeof s.code==='string' && /python|pypy/i.test(s.language), 'Only Python sources supported');
    assert(['WRONG_ANSWER',...(allowRuntimeError?['RUNTIME_ERROR']:[])].includes(s.verdict), 'Ineligible target verdict');
    assert(Number.isInteger(s.passedTestCount) && s.passedTestCount>=0, 'Missing passedTestCount');
    if (official) assert(s.origin==='human', 'Synthetic/mutant sources excluded from human corpus');
  }
  if (official) {
    assert(p.dev.length===15 && p.heldOut.length===10, 'Official split is 15 DEV / 10 held-out');
    assert(p.publishedAt && p.semanticSizeDefinition && p.samples?.length, 'Problem metadata incomplete');
    assert(!p.exclusions?.length, 'Unsupported problem category');
    assert(p.eligibilityReviewed===true, 'Manual eligibility review required: no interactive, print-any, float output, file I/O or image-dependent statement');
    assert(p.references.every(r=>/python|pypy/i.test(r.language)), 'Python references required');
  }
  return p;
}
export function validateConfig(c, official=false) {
  assert(c.model && c.reasoningEffort==='high' && c.maxCompletionTokens===16000, 'Model, high effort and 16000 completion tokens required');
  assert(Number.isFinite(c.costLimitUsd) && c.costLimitUsd>0, 'Positive total cost guard required');
  assert(c.responseCache===false, 'Response reuse prohibited');
  for (const key of ['input','cachedInput','output']) assert(Number.isFinite(c.pricing?.[key]) && c.pricing[key]>=0, 'Explicit prices per million tokens required');
  if (official) assert(c.snapshotPinned===true && !/latest/i.test(c.model) && c.model!=='gpt-5.6-terra', 'Concrete provider snapshot required');
  return c;
}
