#!/usr/bin/env python3
"""Real macOS Keychain lifecycle, unique test entry, synthetic secret only.

Runs each action in a fresh process. Never touches Model Pilot's real entry.
No network, credentials in argv, config writes, or plaintext fallback.
"""
import json
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import uuid

ROOT = Path(__file__).resolve().parent
PROGRAM = '''import json,sys
from keychain import MacKeychain
p=json.load(sys.stdin)
s=MacKeychain(service=p['service'].encode(),interactive=False)
if p['action']=='set': s.set(p['value'])
elif p['action']=='verify': assert s.read()==p['value']
elif p['action']=='remove': s.remove(); assert s.read() is None
print('PASS')
'''


def check_host(service):
    """A disposable plugin copy reads only the test entry through its real helper."""
    spec=importlib.util.spec_from_file_location('live',ROOT/'live-eval.py')
    live=importlib.util.module_from_spec(spec);spec.loader.exec_module(live)
    with tempfile.TemporaryDirectory(prefix='model-pilot-keychain-host-') as temporary:
        base=Path(temporary);plugin=base/'plugin';config=base/'config';config.mkdir()
        for directory in ['hooks','src','.claude-plugin','tests/fixtures/jev']:
            shutil.copytree(ROOT.parent/directory,plugin/directory,ignore=shutil.ignore_patterns('types','__pycache__'))
        (plugin/'scripts').mkdir()
        helper=(ROOT/'keychain.py').read_text().replace("SERVICE = b'ai.model-pilot.typesafe'",'SERVICE = '+repr(service.encode()))
        (plugin/'scripts/keychain.py').write_text(helper)
        live.ROOT=plugin
        server=live.http.server.ThreadingHTTPServer(('127.0.0.1',0),live.MockAPI)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        env={k:v for k,v in os.environ.items() if not k.startswith(('ANTHROPIC_','CLAUDE_','TYPESAFE_'))}
        env.update(CLAUDE_CONFIG_DIR=str(config),ANTHROPIC_API_KEY='offline-fixture',
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC='1',ANTHROPIC_BASE_URL=f'http://127.0.0.1:{server.server_port}')
        for family in ['HAIKU','SONNET','OPUS']:env['ANTHROPIC_DEFAULT_'+family+'_MODEL']='claude-'+family.lower()+'-5-5'
        try:
            row=live.run_case(live.CASES[0],str(config),env,True)
            if not row['assessment']['passed']:
                raise RuntimeError('Saved-key host integration failed: '+','.join(row['assessment']['failures']))
            credential=row['turns'][0]['trace']['diagnostics']['credential']
            if credential['source']!='saved' or credential['state']!='verified':
                raise RuntimeError('Host did not verify the saved test credential')
            print('PASS: real Claude host loaded the saved test key with no export and applied only explicitly accepted advice.')
        finally:
            server.shutdown();server.server_close()


def main():
    if sys.argv[1:] not in ([],['--host']):raise SystemExit('Usage: credential-smoke.py [--host]')
    if sys.platform != 'darwin':
        raise SystemExit('This opt-in smoke test requires macOS Keychain.')
    service = 'ai.model-pilot.typesafe.test.' + uuid.uuid4().hex
    values = ['synthetic-' + uuid.uuid4().hex for _ in range(2)]
    def run(action, value=None):
        r = subprocess.run([sys.executable, '-c', PROGRAM], cwd=ROOT, text=True,
            input=json.dumps({'service':service,'action':action,'value':value}), capture_output=True, timeout=15)
        if r.returncode or r.stdout.strip() != 'PASS':
            raise RuntimeError('Keychain smoke failed: ' + action + ' (process output withheld)')
        if any(v in r.stdout or v in r.stderr for v in values):
            raise RuntimeError('Unexpected synthetic secret in output')
    try:
        run('set',values[0]);run('verify',values[0])
        run('set',values[1]);run('verify',values[1])
        if '--host' in sys.argv:
            run('set','offline-fixture');check_host(service)
        run('remove');run('remove')
        print('PASS: set, reload in fresh process, replace, delete, and idempotent delete. No real key used.')
    finally:
        run('remove')


if __name__=='__main__':
    main()
