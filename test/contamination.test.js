import test from 'node:test';
import assert from 'node:assert/strict';
import { applyContamination } from '../src/contamination.js';
test('cutoff labels require snapshot-specific verification and are never invented',()=>{const p=[{publishedAt:'2020-01-01',contaminationGroup:'claimed'},{publishedAt:'2030-01-01'}];applyContamination(p,null,'m');assert(p.every(p=>p.contaminationGroup==='unverified'));assert.throws(()=>applyContamination(p,{verified:true,model:'other',cutoff:'2025-01-01',source:'source'},'m'));applyContamination(p,{verified:true,model:'m',cutoff:'2025-01-01',source:'source'},'m');assert.deepEqual(p.map(p=>p.contaminationGroup),['on-or-before-cutoff','after-cutoff']);});
