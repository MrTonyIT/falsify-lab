"""Trusted launcher. Source and input enter only the isolated Docker container.

87 = compile failure, 88 = missing tool/launcher failure, 142 = resource timeout.
Those reserved statuses are never correctness kills, even if user code emits one.
"""
import base64
import json
import os
import resource
import subprocess
import sys
import tempfile

SPECS = {
    'python': ('main.py', ['python3', '-I', '-m', 'py_compile', 'main.py'], ['python3', '-I', 'main.py']),
    'c': ('main.c', ['gcc', '-std=c17', '-O2', 'main.c', '-o', 'program', '-lm'], ['./program']),
    'cpp': ('main.cpp', ['g++', '-std=c++17', '-O2', 'main.cpp', '-o', 'program'], ['./program']),
    'javascript': ('main.js', ['node', '--check', 'main.js'], ['node', '--max-old-space-size=256', 'main.js']),
    'typescript': ('main.ts', ['tsc', '--target', 'ES2020', '--module', 'commonjs', '--strict', 'main.ts'], ['node', '--max-old-space-size=256', 'main.js']),
    'java': ('Main.java', ['javac', '-J-Xmx256m', '-J-XX:ActiveProcessorCount=2', 'Main.java'], ['java', '-Xmx256m', '-XX:ActiveProcessorCount=2', '-XX:ReservedCodeCacheSize=64m', 'Main']),
    'go': ('main.go', ['go', 'build', '-o', 'program', 'main.go'], ['./program']),
    'rust': ('main.rs', ['rustc', '--edition=2021', '-O', 'main.rs', '-o', 'program'], ['./program']),
    'csharp': ('Main.cs', ['mcs', '-out:program.exe', 'Main.cs'], ['mono', 'program.exe']),
    'ruby': ('main.rb', ['ruby', '-c', 'main.rb'], ['ruby', 'main.rb']),
    'php': ('main.php', ['php', '-l', 'main.php'], ['php', 'main.php']),
}

def main():
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_NOFILE, (128, 128))
    payload = json.load(sys.stdin)
    name, compile_cmd, run_cmd = SPECS[payload['language']]
    with tempfile.TemporaryDirectory(dir='/work') as work:
        os.chdir(work)
        os.environ.update(HOME=work, GOCACHE=work + '/cache', GOPATH=work + '/go',
                          GOMAXPROCS='2', GOPROXY='off', GOSUMDB='off', GO111MODULE='off')
        with open(name, 'w', encoding='utf-8') as source:
            source.write(payload['code'])
        # Compiler messages go to the host's bounded stderr, never candidate stdout.
        compiled = subprocess.run(compile_cmd, stdin=subprocess.DEVNULL,
                                  stdout=sys.stderr, stderr=sys.stderr, timeout=20)
        if compiled.returncode:
            return 87
        if payload.get('prepareOnly'):
            return 0
        with tempfile.TemporaryFile() as data:
            data.write(base64.b64decode(payload['input']))
            data.seek(0)
            result = subprocess.run(run_cmd, stdin=data, timeout=payload['runSeconds'])
        return result.returncode if result.returncode >= 0 else 128 - result.returncode

try:
    sys.exit(main())
except subprocess.TimeoutExpired:
    sys.exit(142)
except MemoryError:
    sys.exit(86)
except (OSError, ValueError, KeyError) as error:
    print('Sandbox launcher: ' + str(error), file=sys.stderr)
    sys.exit(88)
