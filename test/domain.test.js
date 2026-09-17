import test from 'node:test';
import assert from 'node:assert/strict';
import { Verdict, LIMITS, publicProblem, devTarget, validateConfig } from '../src/domain.js';
test('six canonical verdicts and fixed protocol limits',()=>{assert.equal(Object.keys(Verdict).length,6);assert.equal(LIMITS.attempts,3);assert.equal(LIMITS.inputBytes,8*1024*1024);});
test('public projections discard evaluator material and reject held-out',()=>{assert.deepEqual(publicProblem({id:'p',statement:'s',constraints:'c',references:['SECRET'],validator:'PRIVATE'}),{id:'p',statement:'s',constraints:'c'});assert.throws(()=>devTarget({split:'held-out',code:'SECRET'}),/DEV/);});
test('configuration fails closed',()=>{const c={model:'mock',reasoningEffort:'high',maxCompletionTokens:16000,costLimitUsd:1,responseCache:false,pricing:{input:0,cachedInput:0,output:0}};assert.equal(validateConfig(c),c);assert.throws(()=>validateConfig({...c,responseCache:true}));assert.throws(()=>validateConfig(c,true));});
