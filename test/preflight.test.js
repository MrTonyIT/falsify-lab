import test from 'node:test';
import assert from 'node:assert/strict';
import { smokeProblem } from '../fixtures/sum-problem.js';
import { sha256 } from '../src/domain.js';
import { corpusIdentity } from '../src/corpus.js';
import { configIdentity } from '../src/llm.js';
import { freezeBaseline } from '../src/baseline.js';
import { officialPreflight } from '../src/preflight.js';
test('preflight accepts complete bound evidence and rejects stale source evidence',()=>{
  // Synthetic records for gate testing only; these are never benchmark measurements.
  const problems=Array.from({length:30},(_,i)=>{
    const p=smokeProblem();p.id='p'+i;p.division=['A','B','C'][Math.floor(i/10)];p.publishedAt='2020-01-01';p.eligibilityReviewed=true;
    p.references=p.references.map(r=>({...r,language:'Python 3'}));
    const make=(n,split)=>Array.from({length:n},(_,j)=>({...p.dev[0],id:split+j,split,code:p.dev[0].code+'\n# '+split+j,origin:'human'}));
    p.dev=make(15,'dev');p.heldOut=make(10,'held-out');return p;
  });
  const config={model:'test-snapshot-2026',snapshotPinned:true,endpoint:'https://example.com/complete',reasoningEffort:'high',maxCompletionTokens:16000,responseCache:false,costLimitUsd:1,pricing:{input:1,cachedInput:1,output:1}};
  const corpusId=corpusIdentity(problems),configId=configIdentity(config),baseline=freezeBaseline(problems),imageId='sha256:'+'a'.repeat(64),commit='b'.repeat(40);
  const evidence={compatibility:{config_id:configId,model:config.model,nonempty:true,longPrompt:true},sandboxIntegration:{imageId,passed:true},quality:{corpus_id:corpusId,problems:problems.map(p=>({problem_id:p.id,referenceSamplesAgree:true,validator:{valid:2,invalid:2},rejected:[],accepted:[...p.dev,...p.heldOut].map(s=>({id:s.id,hash:sha256(s.code),samplePassed:true}))}))},baseline:{sha:baseline.sha,completed:true,log_digest:'digest'},accountUsageLimitConfigured:true,pricing:{verified:true,config_id:configId,source:'fixture',verified_at:'test'},pilot:{pairs:20,manuallyReviewed:true,corpus_id:corpusId,logs:'fixture'},privacyReview:{passed:true,git_commit:commit}};
  const args={config,problems,evidence,baseline,sandbox:{kind:'docker',imageId},gitCommit:commit};
  assert.deepEqual(officialPreflight(args).failures,[]);
  evidence.quality.problems[0].accepted[0].hash='tampered';assert(officialPreflight(args).failures.some(f=>f.startsWith('quality')));
});
