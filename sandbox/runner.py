"""Trusted bootstrap, used only INSIDE a fresh Linux container.

No reference, validator, API credentials or corpus files are mounted.
Raw program stdout is captured by the host; programs cannot forge JSON verdicts.
"""
import base64
import json
import os
import random
import resource
import signal
import sys
import tempfile

seconds = int(sys.argv[1])
resource.setrlimit(resource.RLIMIT_CPU, (seconds, seconds))
resource.setrlimit(resource.RLIMIT_CORE, (0, 0))

# The host also enforces elapsed time and kills the whole container.
signal.alarm(seconds)
payload = json.load(sys.stdin)
resource.setrlimit(resource.RLIMIT_NOFILE, (payload['openFiles'], payload['openFiles']))
source = payload.pop('code')
random.seed(payload['seed'])
data = b'' if payload['role'] == 'generator' else base64.b64decode(payload['input'])
with tempfile.TemporaryFile() as stream:
    stream.write(data)
    stream.seek(0)
    os.dup2(stream.fileno(), 0)
sys.stdin = open(0, encoding='utf-8', closefd=False)
sys.argv = ['submission.py']
try:
    exec(compile(source, 'submission.py', 'exec'), {'__name__': '__main__'})
except MemoryError:
    os._exit(86)
