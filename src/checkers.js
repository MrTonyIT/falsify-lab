import { assert } from './domain.js';
const text=b=>Buffer.isBuffer(b)?b.toString('utf8'):String(b);
export function normalizedLines(value) { return text(value).replace(/\r\n/g,'\n').split('\n').map(s=>s.trimEnd()).join('\n').replace(/\n+$/,''); }
export const lineChecker=(expected,got)=>normalizedLines(expected)===normalizedLines(got);
export function tokenChecker(expected,got) {
  const tokens=v=>text(v).trim().split(/\s+/).filter(Boolean).map(t=>/^(yes|no)$/i.test(t)?t.toLowerCase():t);
  const a=tokens(expected), b=tokens(got); return a.length===b.length && a.every((x,i)=>x===b[i]);
}
export function checkerFor(name) { assert(['tokens','lines'].includes(name),'Unsupported special/float/print-any checker'); return name==='tokens'?tokenChecker:lineChecker; }
