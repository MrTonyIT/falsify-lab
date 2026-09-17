import { strictLines,integers } from '../src/validators.js';
import { tokenChecker } from '../src/checkers.js';
import { sha256 } from '../src/domain.js';
// Authored synthetic fixture; never presented as a real Codeforces problem.
export function validate(data) {
  try {
    const lines=strictLines(data);const [t]=integers(lines[0],1,1,5);if(lines.length!==1+2*t)return {ok:false};
    let total=0;
    for(let i=0;i<t;i++){const [n]=integers(lines[1+2*i],1,1,10);integers(lines[2+2*i],n,-10,10);total+=n;}
    return total<=20?{ok:true,semanticSize:total}:{ok:false};
  }catch{return {ok:false};}
}
export const validatorCases=[{name:'one',input:'1\n1\n0\n',valid:true},{name:'two cases',input:'2\n2\n-1 2\n1\n3\n',valid:true},{name:'range',input:'1\n1\n11\n',valid:false},{name:'count',input:'1\n2\n0\n',valid:false},{name:'aggregate',input:'3\n10\n0 0 0 0 0 0 0 0 0 0\n10\n0 0 0 0 0 0 0 0 0 0\n1\n0\n',valid:false}];
export function randomGenerator(seed) {return `import random\nrandom.seed(${seed})\nn = random.randint(1, 10)\nprint(1)\nprint(n)\nprint(*[random.randint(-10, 10) for _ in range(n)])`;}
const references=[
  't=int(input())\nfor _ in range(t):\n n=int(input()); print(sum(map(int,input().split())))',
  't=int(input())\nfor _ in range(t):\n n=int(input()); a=list(map(int,input().split())); s=0\n for x in a: s+=x\n print(s)',
  'import sys\nit=iter(map(int,sys.stdin.buffer.read().split()))\nt=next(it)\nfor _ in range(t):\n n=next(it); print(sum(next(it) for j in range(n)))'
];
const sub=(id,split,code)=>({id,split,code,language:'Python 3',verdict:'WRONG_ANSWER',passedTestCount:4,origin:'synthetic'});
export function smokeProblem() {return {id:'synthetic-sum',statement:'For each test case, print the sum of its array.',constraints:'1 <= t <= 5; 1 <= n <= 10; -10 <= a[i] <= 10; sum(n) <= 20. First line t; each case has a line n and a line of exactly n integers.',division:'A',publishedAt:null,semanticSizeDefinition:'sum(n) across cases',validator:validate,validatorCases,validatorHash:sha256(String(validate)),randomGenerator,randomHash:sha256(String(randomGenerator)),checker:tokenChecker,checkerName:'tokens',samples:[{input:'1\n2\n1 2\n',output:'3\n'}],references:references.map((code,i)=>({id:'ref'+i,author:'fixture-author-'+i,code,verdict:'ACCEPTED'})),dev:[sub('dev1','dev',"t=int(input())\nfor _ in range(t):\n n=int(input()); print(sum(abs(x) for x in map(int,input().split())))")],heldOut:[sub('held1','held-out',"t=int(input())\nfor _ in range(t):\n n=int(input()); print(sum(max(0,x) for x in map(int,input().split())))")]};}
