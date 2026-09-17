import { smokeProblem } from '../fixtures/sum-problem.js';
import { MockSandbox } from './sandbox.js';
import { MockLLM } from './llm.js';
import { Evaluator } from './evaluator.js';
import { assert } from './domain.js';
import { metadataFor,initializeRun,track1,track2 } from './workflow.js';
import { freezeBaseline,runBaselines } from './baseline.js';
import { report } from './report.js';
export async function smoke(directory) {
  const p=smokeProblem();
  // Deliberate response table, not an interpreter for Python or a real sandbox.
  const sandbox=new MockSandbox((code,input,{role})=>{
    if(role==='generator')return {stdout:Buffer.from(code.includes('random')?'1\n2\n-1 2\n':code.includes('negative')?'1\n1\n-1\n':'1\n1\n1\n')};
    const lines=input.toString().trim().split('\n'),values=lines[2].split(' ').map(Number);
    const value=role==='reference'?values.reduce((a,b)=>a+b,0):code.includes('abs')?values.reduce((a,b)=>a+Math.abs(b),0):values.reduce((a,b)=>a+Math.max(0,b),0);
    return {stdout:Buffer.from(value+'\n')};
  });
  const evaluator=new Evaluator(sandbox),config={model:'mock',reasoningEffort:'high',maxCompletionTokens:16000,pricing:{input:0,cachedInput:0,output:0}},metadata=metadataFor([p],config,'smoke');
  const log=await initializeRun(directory,metadata);
  await runBaselines({problems:[p],frozen:freezeBaseline([p]),evaluator,log,metadata});
  await track1({problems:[p],evaluator,llm:new MockLLM(['```python\nprint("1\\n1\\n1")\n```','```python\n# negative\nprint("1\\n1\\n-1")\n```']),log,metadata});
  await track2({problems:[p],evaluator,directory,log,metadata});
  await log.append('events',{event:'run_complete',run_id:metadata.run_id});
  const result=await report(directory);assert(result.official_status==='NOT RUN','Fixture must never produce official findings');return result;
}
