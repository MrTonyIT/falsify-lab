import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,relative,isAbsolute,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assert,sha256,validateProblem } from './domain.js';
import { checkerFor } from './checkers.js';
import { testValidator } from './validators.js';
export function bucket(n) {return n<=5?'sample..5':n<=15?'6..15':'16+';}
export function seededRandom(seed=12345) {let state=seed>>>0;return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};}
export function stratifiedSplit(candidates,{seed=12345,devCount=15,heldOutCount=10}={}) {
  assert(candidates.length>=devCount+heldOutCount,'Insufficient pool: replace problem, do not lower quality');
  assert(candidates.every(s=>s.samplePassed===true),'Sample execution evidence required before splitting');
  const rng=seededRandom(seed),groups=['sample..5','6..15','16+'].map(b=>candidates.filter(s=>bucket(s.passedTestCount)===b).sort((a,b)=>String(a.id).localeCompare(String(b.id))));
  for(const g of groups)for(let i=g.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[g[i],g[j]]=[g[j],g[i]];}
  const ordered=[];while(groups.some(g=>g.length))for(const g of groups)if(g.length)ordered.push(g.pop());
  const selected=ordered.slice(0,devCount+heldOutCount),heldIndices=new Set();
  for(let i=0;i<heldOutCount;i++)heldIndices.add(Math.floor((i+0.5)*selected.length/heldOutCount));
  return {dev:selected.filter((_,i)=>!heldIndices.has(i)).map(s=>({...s,split:'dev'})),heldOut:selected.filter((_,i)=>heldIndices.has(i)).map(s=>({...s,split:'held-out'})),seed};
}
export function corpusIdentity(problems) {
  const identify=s=>({id:s.id,hash:sha256(s.code),verdict:s.verdict,language:s.language,passedTestCount:s.passedTestCount,origin:s.origin,split:s.split,author:s.author});
  return sha256(JSON.stringify(problems.map(p=>({id:p.id,statement:p.statement,constraints:p.constraints,division:p.division,publishedAt:p.publishedAt,checker:p.checkerName,validatorHash:p.validatorHash,randomHash:p.randomHash,samples:p.samples,validatorCases:p.validatorCases,
    semanticSizeDefinition:p.semanticSizeDefinition,eligibilityReviewed:p.eligibilityReviewed,exclusions:p.exclusions,references:p.references.map(identify),dev:p.dev.map(identify),heldOut:p.heldOut.map(identify)}))));
}
export async function qualityAudit(problem,evaluator) {
  const validator=await testValidator(problem);
  assert(problem.samples?.length>0,'Public samples required');
  const prepared=[];
  for(const sample of problem.samples) {
    const candidate=await evaluator.prepare(problem,Buffer.from(sample.input));
    assert(!candidate.verdict,'Sample rejected or references failed/disagreed');
    assert(problem.checker(Buffer.from(sample.output),candidate.expected),'References disagree with published sample output');prepared.push(candidate);
  }
  const accepted=[],rejected=[];
  for(const target of [...problem.dev,...problem.heldOut]) {
    let ok=target.passedTestCount>=problem.samples.length;
    // Always execute actual sample tests, including when metadata is insufficient.
    for(const sample of prepared)if((await evaluator.judge(problem,target,sample)).verdict!=='survived')ok=false;
    (ok?accepted:rejected).push({id:target.id,hash:sha256(target.code),samplePassed:ok});
  }
  return {problem_id:problem.id,validator,accepted,rejected,referenceSamplesAgree:true};
}
function within(root,path) {const full=resolve(root,path),rel=relative(root,full);assert(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'Corpus path escapes private root');return full;}
export async function loadCorpus(manifestPath,options={}) {
  const root=resolve(manifestPath,'..');const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  const problems=[];
  for(const entry of manifest.problems) {
    const pluginPath=within(root,entry.plugin),plugin=await import(pathToFileURL(pluginPath).href);
    const load=async s=>{const code=await readFile(within(root,s.source),'utf8');assert(!s.sha256||s.sha256===sha256(code),'Source hash mismatch');return {...s,code};};
    const p={...entry,validator:plugin.validate,randomGenerator:plugin.randomGenerator,validatorCases:plugin.validatorCases,validatorHash:sha256(await readFile(pluginPath)),randomHash:sha256(String(plugin.randomGenerator)),checker:checkerFor(entry.checkerName),references:await Promise.all(entry.references.map(load)),dev:await Promise.all(entry.dev.map(load)),heldOut:await Promise.all(entry.heldOut.map(load))};
    problems.push(validateProblem(p,options));
  }
  assert(new Set(problems.map(p=>p.id)).size===problems.length,'Duplicate problem IDs');
  if(options.official)assert(problems.length===30&&['A','B','C'].every(d=>problems.filter(p=>p.division===d).length===10),'Official corpus requires 10 A / 10 B / 10 C');
  return problems;
}
export async function publicManifest(problems,path) {
  const project=s=>({id:s.id,verdict:s.verdict,passedTestCount:s.passedTestCount,language:s.language,sha256:sha256(s.code),split:s.split});
  await writeFile(path,JSON.stringify({corpus_id:corpusIdentity(problems),problems:problems.map(p=>({id:p.id,division:p.division,publishedAt:p.publishedAt,dev:p.dev.map(project),heldOut:p.heldOut.map(project),references:p.references.map(project)}))},null,2));
}
