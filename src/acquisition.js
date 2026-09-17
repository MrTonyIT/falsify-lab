import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assert,sha256 } from './domain.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export function decodeHtml(s) {
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(full,v)=>{if(v[0]==='#')return String.fromCodePoint(v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):parseInt(v.slice(1),10));assert(v in named,`Unsupported HTML entity ${v}; use manual import`);return named[v];});
}
export function extractSource(html) {
  const match=html.match(/<pre\b[^>]*\bid=["']program-source-text["'][^>]*>([\s\S]*?)<\/pre>/i);
  assert(match,'Source unavailable in HTML (authentication/challenge possible); use manual import');
  return decodeHtml(match[1].replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,''));
}
export function extractSamples(html) {
  const matches=[...html.matchAll(/<div\s+class=["'](input|output)["'][^>]*>[\s\S]*?<pre[^>]*>([\s\S]*?)<\/pre>/gi)];
  const samples=[];
  for(const m of matches){const text=decodeHtml(m[2].replace(/<br\s*\/?>/gi,'\n').replace(/<\/div>\s*<div[^>]*>/gi,'\n').replace(/<[^>]*>/g,''));if(m[1]==='input')samples.push({input:text});else{assert(samples.length&&!('output' in samples.at(-1)),'Unexpected sample HTML');samples.at(-1).output=text;}}
  assert(samples.length&&samples.every(s=>'output'in s),'Samples could not be parsed; import manually');return samples;
}
export class CodeforcesClient {
  constructor(cacheDirectory,{fetchImpl=fetch,intervalMs=2000}={}) {assert(intervalMs>=2000,'Crawl interval must be at least two seconds');this.directory=cacheDirectory;this.fetch=fetchImpl;this.interval=intervalMs;this.last=0;this.queue=Promise.resolve();}
  get(path) {
    assert(/^\/(api\/contest\.status\?|contest\/\d+\/(submission\/\d+|problem\/[A-Z]\d*)$)/.test(path),'Only metadata, submission and public problem pages allowed');
    const work=async()=>{
      const file=join(this.directory,sha256(path).slice(7)+'.txt');
      try{return await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
      await delay(Math.max(0,this.last+this.interval-Date.now()));this.last=Date.now();
      const r=await this.fetch('https://codeforces.com'+path,{headers:{'User-Agent':'AI-Falsifier-Research/0.1'},signal:AbortSignal.timeout(30000)});
      assert(r.ok,`Codeforces HTTP ${r.status}; stop rather than bypass access controls`);const body=await r.text();
      await mkdir(this.directory,{recursive:true});await writeFile(file,body,'utf8');return body;
    };
    const result=this.queue.then(work);this.queue=result.catch(()=>{});return result;
  }
  async submissions(contestId,index,{pages=1,count=1000,allowRuntimeError=false}={}) {
    assert(Number.isInteger(contestId)&&contestId>0&&/^[A-Z]\d*$/.test(index),'Invalid problem identity');
    const results=[];
    for(let page=0;page<pages;page++) {
      const response=JSON.parse(await this.get(`/api/contest.status?contestId=${contestId}&from=${page*count+1}&count=${count}`));assert(response.status==='OK','Codeforces API failure');
      results.push(...response.result.filter(s=>s.problem.index===index&&/python|pypy/i.test(s.programmingLanguage)&&['ACCEPTED','WRONG_ANSWER',...(allowRuntimeError?['RUNTIME_ERROR']:[])].includes(s.verdict)));
      if(response.result.length<count)break;
    }return results;
  }
  async source(contest,id) {assert(Number.isInteger(contest)&&Number.isInteger(id),'Numeric IDs required');return extractSource(await this.get(`/contest/${contest}/submission/${id}`));}
  async problem(contest,index) {assert(Number.isInteger(contest)&&/^[A-Z]\d*$/.test(index),'Invalid problem');const html=await this.get(`/contest/${contest}/problem/${index}`);return {html,samples:extractSamples(html),statementReviewRequired:true};}
}
