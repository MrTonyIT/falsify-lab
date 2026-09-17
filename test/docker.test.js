import test from 'node:test';
import assert from 'node:assert/strict';
import { DockerSandbox } from '../src/sandbox.js';
const enabled=process.env.FALSIFIER_DOCKER_TEST==='1';
test('real Docker isolation and resource classification', {skip:!enabled,timeout:60000},async()=>{
  const s=new DockerSandbox({image:process.env.FALSIFIER_SANDBOX_IMAGE??'ai-falsifier-python:local'});await s.check();
  const ok=await s.run('import os\nprint(os.getuid())\nprint(input())',Buffer.from('hello\n'));assert.equal(ok.stdout.toString(),'65534\nhello\n');
  const gen=await s.run('print(input())',Buffer.from('secret\n'),{role:'generator',seconds:2});assert(gen.crashed);
  const crash=await s.run('raise ValueError("fixture")');assert(crash.crashed&&!crash.mle&&!crash.timedOut);
  const timeout=await s.run('while True: pass',Buffer.alloc(0),{seconds:2});assert(timeout.timedOut);
  const overflow=await s.run('print("x"*10000)',Buffer.alloc(0),{maxBytes:100});assert(overflow.overflow);
  const filesystem=await s.run('open("/forbidden", "w").write("x")');assert(filesystem.crashed);
  const network=await s.run('import socket\nsocket.create_connection(("1.1.1.1", 80), timeout=1)');assert(network.crashed);
  const memory=await s.run('x=bytearray(2*1024*1024*1024)');assert(memory.mle);
});
