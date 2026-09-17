import { assert } from './domain.js';
export function applyContamination(problems,evidence,model) {
  if(!evidence){for(const p of problems)p.contaminationGroup='unverified';return null;}
  assert(evidence.verified===true&&evidence.model===model&&evidence.source&&/^\d{4}-\d{2}-\d{2}$/.test(evidence.cutoff),'Verified cutoff evidence for exact snapshot required');
  const cutoff=Date.parse(evidence.cutoff);assert(Number.isFinite(cutoff),'Invalid cutoff date');
  for(const p of problems){const date=Date.parse(p.publishedAt);p.contaminationGroup=Number.isFinite(date)?date<=cutoff?'on-or-before-cutoff':'after-cutoff':'unverified';}
  return evidence;
}
