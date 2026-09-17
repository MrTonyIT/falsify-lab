import { assert,sha256,LIMITS } from './domain.js';
import { corpusIdentity } from './corpus.js';
import { runPair } from './falsify.js';
export function freezeBaseline(problems) {
  const generators=problems.map(p=>{assert(typeof p.randomGenerator==='function','Manual random generator required for every problem');return {problem_id:p.id,scripts:Array.from({length:50},(_,i)=>p.randomGenerator(LIMITS.seed+i)),plugin_hash:p.randomHash};});
  const protocol={corpus_id:corpusIdentity(problems),seed:LIMITS.seed,budgets:[3,50],generators};
  return {...protocol,sha:sha256(JSON.stringify(protocol)),frozen_at:new Date().toISOString()};
}
export function verifyBaseline(frozen,problems) {
  const {sha,frozen_at,...protocol}=frozen;
  assert(sha256(JSON.stringify(protocol))===sha,'Frozen baseline contents were modified');
  const current=freezeBaseline(problems);assert(current.sha===frozen.sha,'Random baseline or corpus changed after freezing');
  return true;
}
export async function runBaselines({problems,frozen,evaluator,log,metadata}) {
  verifyBaseline(frozen,problems);
  for(const p of problems)for(const target of p.dev)for(const k of [3,50]) await runPair({problem:p,target,evaluator,log,metadata,scripts:frozen.generators.find(g=>g.problem_id===p.id).scripts,method:'random'+k,budget:k});
  await log.append('events',{run_id:metadata.run_id,event:'baseline_complete',baseline_sha:frozen.sha,completed_at:new Date().toISOString()});
}
