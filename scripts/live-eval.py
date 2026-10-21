#!/usr/bin/env python3
"""Real Claude host evaluation. --offline uses synthetic Jev and model responses."""
import argparse
import http.server
import json
import os
from pathlib import Path
import queue
import subprocess
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    ('simple', 'opus', 'high', 'default', ['What does HTTP stand for?']),
    ('routine', 'opus', 'high', 'default', ['Write a JavaScript function sumPositive(numbers) that returns the sum of positive finite numbers in an array; ignore everything else. Include three inline examples.']),
    ('complex', 'sonnet', 'medium', 'default', ['Design a safe zero-downtime migration of a multi-tenant payments ledger from integer cents to currency-specific decimal amounts. Explain invariants, dual writes, reconciliation and rollback; do not write files.']),
    ('planning', 'opus', 'high', 'plan', ['Plan a multi-tenant authentication service. Cover tenant isolation, token revocation, deployment and rollback. Do not use tools or write files.', 'Continue with the failure cases.', 'What does HTTP stand for?', 'Return to our plan: explain how to test tenant isolation.']),
]
EXPECTED = {'simple': ('haiku', 'low'), 'routine': ('sonnet', 'medium'), 'complex': ('opus', 'high'), 'planning': ('opus', 'high')}

class MockAPI(http.server.BaseHTTPRequestHandler):
    """Wire-level assertions catch aliases that the native unit harness accepts."""
    requests = []
    def log_message(self, *_):
        pass
    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if 'count_tokens' in self.path:
            self.send_response(200); self.end_headers(); self.wfile.write(b'{"input_tokens":100}')
            return
        model = data.get('model')
        self.requests.append({'model': model, 'effort': data.get('output_config', {}).get('effort')})
        if model not in ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']:
            self.send_response(404); self.send_header('Content-Type', 'application/json'); self.end_headers()
            self.wfile.write(json.dumps({'type': 'error', 'error': {'type': 'not_found_error', 'message': 'Unresolved or unexpected model ID'}}).encode())
            return
        self.send_response(200); self.send_header('Content-Type', 'text/event-stream'); self.end_headers()
        message = {'id': 'msg_offline', 'type': 'message', 'role': 'assistant', 'model': model, 'content': [], 'stop_reason': None, 'stop_sequence': None, 'usage': {'input_tokens': 100, 'output_tokens': 1}}
        events = [('message_start', {'message': message}),
                  ('content_block_start', {'index': 0, 'content_block': {'type': 'text', 'text': ''}}),
                  ('content_block_delta', {'index': 0, 'delta': {'type': 'text_delta', 'text': 'Synthetic offline response; not a quality evaluation.'}}),
                  ('content_block_stop', {'index': 0}),
                  ('message_delta', {'delta': {'stop_reason': 'end_turn', 'stop_sequence': None}, 'usage': {'output_tokens': 10}}),
                  ('message_stop', {})]
        for typ, body in events:
            self.wfile.write(('event: ' + typ + '\ndata: ' + json.dumps({'type': typ, **body}) + '\n\n').encode())
            self.wfile.flush()

def parse_trace(text):
    # Claude prefixes local command output with the plugin name.
    return json.loads(text[text.index('{'):])

def assess(row, offline=False):
    failures = []
    scenario = row['scenario']
    family, effort = EXPECTED[scenario]
    if row.get('error'): failures.append(row['error'])
    if len(row['turns']) != (4 if scenario == 'planning' else 1): failures.append('incomplete-turns')
    for index, turn in enumerate(row['turns']):
        trace = turn.get('trace', {}).get('trace') or {}
        answer = turn['answer']
        request = trace.get('request', {})
        provider = trace.get('provider', {})
        checks = {
            'answer-error': not answer.get('is_error') and answer.get('subtype') == 'success',
            'response-model': bool(answer['response_models']) and all(m.startswith('claude-' + family + '-') for m in answer['response_models']),
            'request-model': request.get('model', '').startswith('claude-' + family + '-'),
            'request-effort': request.get('effort') == effort,
            'api-model': request.get('apiModel') in answer['response_models'],
        }
        if scenario == 'planning':
            checks.update({'planning-protection': trace.get('planMode') is True,
                           'no-classifier': turn.get('trace', {}).get('classifierCalls') == 0,
                           'no-switch': turn.get('trace', {}).get('counters',{}).get('dispatched',turn.get('trace', {}).get('dispatchAttempts')) == 0})
        else:
            checks.update({'jev-called': turn.get('trace', {}).get('classifierCalls') == 1,
                           'jev-kind': provider.get('classification', {}).get('kind') == scenario,
                           'jev-accepted': provider.get('status') == 'accepted',
                           'switch-confirmed': trace.get('application') == 'confirmed-model'})
        if offline:
            wire = turn.get('wire', [])
            checks['wire-model-and-effort'] = len(wire) == 1 and wire[0] == {'model': request.get('model'), 'effort': effort}
        failures.extend(f'turn-{index + 1}:{label}' for label, passed in checks.items() if not passed)
    return {'passed': not failures, 'failures': failures}

def run_case(case, cwd, env, offline):
    name, model, effort, permission, prompts = case
    cmd = ['claude', '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
           '--plugin-dir', str(ROOT), '--setting-sources', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
           '--tools', '', '--no-session-persistence', '--model', model, '--effort', effort,
           '--permission-mode', permission, '--max-budget-usd', '1',
           '--system-prompt', 'Answer the user concisely, at most 250 words. No tools. For code, use a compact code block.']
    if offline: cmd += ['--plugin-dir', str(ROOT / 'tests/fixtures/jev')]
    proc = subprocess.Popen(cmd, cwd=cwd, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
    messages = queue.Queue()
    def read_stdout():
        for line in proc.stdout:
            try: messages.put(json.loads(line))
            except ValueError: pass
        messages.put({'type': 'eof'})
    threading.Thread(target=read_stdout, daemon=True).start()
    # Never persist raw diagnostics or environment/provider errors.
    def drain_stderr():
        for _ in proc.stderr: pass
    threading.Thread(target=drain_stderr, daemon=True).start()
    def send(prompt):
        proc.stdin.write(json.dumps({'type': 'user', 'message': {'role': 'user', 'content': prompt}}) + '\n')
        proc.stdin.flush()
        end = time.monotonic() + 120
        models = []
        while time.monotonic() < end:
            event = messages.get(timeout=max(.1, end - time.monotonic()))
            if event.get('type') == 'assistant':
                model = event.get('message', {}).get('model')
                if model and model not in models: models.append(model)
            if event.get('type') == 'result':
                return {k: event.get(k) for k in ['result', 'is_error', 'subtype', 'duration_api_ms', 'total_cost_usd', 'usage', 'modelUsage']} | {'response_models': models}
            if event.get('type') == 'eof': raise RuntimeError('Claude exited before a result')
        raise TimeoutError('Turn deadline')
    row = {'scenario': name, 'initial_model': model, 'initial_effort': effort, 'permission_mode': permission, 'turns': []}
    try:
        row['setup'] = send('/route advise')
        if name != 'planning':
            row['host_initialization'] = send('Reply READY. This initializes the host lifecycle for the following independent test task.')
            send('/route new')
            send('/route check '+prompts[0])
            advice = parse_trace(send('/route trace')['result'])
            record = advice.get('recommendation')
            row['advice'] = advice
            if record and record['acceptance'] == 'suggested':
                send('/route accept '+record['id'])
        for prompt in prompts:
            before = len(MockAPI.requests)
            answer = send(prompt)
            status = send('/route status')
            trace = parse_trace(send('/route trace')['result'])
            turn = {'prompt': prompt, 'answer': answer, 'routing_status': status['result'], 'trace': trace}
            if offline: turn['wire'] = MockAPI.requests[before:]
            row['turns'].append(turn)
            if answer.get('is_error'): break
    except Exception as error:
        row['error'] = type(error).__name__
    finally:
        proc.stdin.close()
        try: proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.terminate()
            try: proc.wait(timeout=10)
            except subprocess.TimeoutExpired: proc.kill(); proc.wait()
    row['assessment'] = assess(row, offline)
    return row

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--planning-only', action='store_true')
    parser.add_argument('--offline', action='store_true', help='Real Claude host, synthetic Jev and local model API; no inference billing')
    args = parser.parse_args()
    if not args.offline and not args.planning_only and not os.environ.get('TYPESAFE_API_KEY'):
        raise SystemExit('TYPESAFE_API_KEY is absent. Run from the terminal where it is exported.')
    cases = [CASES[-1]] if args.planning_only else CASES
    stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
    output = ROOT / 'evals' / (('offline-host-' if args.offline else 'live-results-') + stamp + '.json')
    results = []
    server = None
    with tempfile.TemporaryDirectory(prefix='model-pilot-eval-') as cwd:
        env = dict(os.environ)
        if args.offline:
            server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), MockAPI)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            # Isolate host settings and replace/remove credential/provider variables.
            for key in list(env):
                if key.startswith(('ANTHROPIC_', 'CLAUDE_', 'TYPESAFE_')): env.pop(key)
            env.update({'CLAUDE_CONFIG_DIR': cwd, 'ANTHROPIC_API_KEY': 'offline-fixture',
                        'TYPESAFE_API_KEY': 'offline-fixture', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC': '1',
                        'ANTHROPIC_BASE_URL': f'http://127.0.0.1:{server.server_port}'})
            for family in ['HAIKU', 'SONNET', 'OPUS']:
                env['ANTHROPIC_DEFAULT_' + family + '_MODEL'] = 'claude-' + family.lower() + '-5-5'
        try:
            for case in cases:
                print('Running ' + case[0] + '...', flush=True)
                row = run_case(case, cwd, env, args.offline)
                results.append(row)
                print(json.dumps(row['assessment']), flush=True)
                output.write_text(json.dumps({'schemaVersion': 2, 'generated_at': stamp, 'offline': args.offline,
                    'complete': len(results) == len(cases), 'passed': len(results) == len(cases) and all(r['assessment']['passed'] for r in results), 'cases': results}, indent=2) + '\n')
        finally:
            if server: server.shutdown(); server.server_close()
    print('Saved results: ' + str(output), flush=True)
    return 0 if all(row['assessment']['passed'] for row in results) else 1

if __name__ == '__main__':
    raise SystemExit(main())
