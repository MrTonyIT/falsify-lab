import { assert } from './domain.js';
// Helpers for manually authored problem validators; these are not a generic validator.
export function strictLines(data) {
  const text=new TextDecoder('utf-8',{fatal:true}).decode(data).replace(/\r\n/g,'\n');
  assert(!text.includes('\r') && !text.includes('\0'),'Invalid characters');
  return text.replace(/\n$/,'').split('\n');
}
export function integers(line,count,min,max) {
  assert(typeof line==='string' && /^-?\d+(?:[ \t]+-?\d+)*[ \t]*$/.test(line),'Expected integer line');
  const values=line.trim().split(/[ \t]+/).map(Number);
  assert(values.length===count && values.every(n=>Number.isSafeInteger(n)&&n>=min&&n<=max),'Integer count/range');return values;
}
export function permutation(values,n) {return values.length===n&&new Set(values).size===n&&values.every(v=>Number.isInteger(v)&&v>=1&&v<=n);}
export function tree(edges,n) {
  if(!Number.isInteger(n)||n<1||edges.length!==n-1)return false;
  const parent=Array.from({length:n},(_,i)=>i);const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(const [a,b]of edges){if(!Number.isInteger(a)||!Number.isInteger(b)||a<1||b<1||a>n||b>n)return false;const x=root(a-1),y=root(b-1);if(x===y)return false;parent[x]=y;}return true;
}
export async function testValidator(problem) {
  const cases=problem.validatorCases??[];
  assert(cases.filter(c=>c.valid===true).length>=2&&cases.filter(c=>c.valid===false).length>=2,'At least two valid and two invalid validator cases required');
  for(const c of cases) assert((await problem.validator(Buffer.from(c.input))).ok===c.valid,`Validator fixture failed: ${c.name??c.input.slice(0,30)}`);
  return {valid:cases.filter(c=>c.valid).length,invalid:cases.filter(c=>!c.valid).length};
}
