#!/usr/bin/env python3
"""All-current-tier effort sweep. Offline mode validates plumbing, never quality."""
import argparse
import copy
import hashlib
import http.server
import json
import math
import os
from pathlib import Path
import queue
import random
import statistics
import subprocess
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
PLAN = ['Plan a multi-tenant authentication service with tenant isolation, revocation and rollback. The project codename is CEDAR-17. Keep the plan concise.', 'Continue with failure cases.', 'What does HTTP stand for?', 'Return to our plan. State its codename and one tenant-isolation test.']

def load_specs():
    return json.loads((ROOT/'benchmarks/models.json').read_text())['models'], json.loads((ROOT/'benchmarks/tasks.json').read_text())['tasks']

def source_metadata():
    paths=[ROOT/'package.json',ROOT/'.claude-plugin/plugin.json',ROOT/'hooks/hooks.json',ROOT/'benchmarks/models.json',ROOT/'benchmarks/tasks.json',ROOT/'scripts/benchmark.py']
    paths+=list((ROOT/'scripts').glob('*.py'))+[ROOT/'benchmarks/advice.json']
    paths+=list((ROOT/'src').rglob('*.js'))+list((ROOT/'hooks').rglob('*.js'))
    files={str(path.relative_to(ROOT)):hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(paths)}
    return {'package_version':json.loads((ROOT/'package.json').read_text())['version'],
        'plugin_version':json.loads((ROOT/'.claude-plugin/plugin.json').read_text())['version'],
        'files':files,'sha256':hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest()}

def build_jobs(models, tasks, repeats, seed):
    matrix, routed = [], []
    for repeat in range(repeats):
        for task in tasks:
            for model in models:
                for effort in model['efforts']:
                    matrix.append({'id':f"matrix:{model['family']}:{effort}:{task['id']}:{repeat}", 'phase':'matrix', 'family':model['family'], 'model':model['id'], 'effort':effort, 'task':task['id'], 'repeat':repeat, 'prompts':[task['prompt']]})
            routed.append({'id':f"router:{task['id']}:{repeat}", 'phase':'router', 'family':'opus', 'model':'claude-opus-5-5', 'effort':'high', 'task':task['id'], 'repeat':repeat, 'prompts':[task['prompt']]})
    rng = random.Random(seed); rng.shuffle(matrix); rng.shuffle(routed)
    continuity = [{'id':'continuity:'+e, 'phase':'continuity', 'family':'opus', 'model':'claude-opus-5-5', 'effort':e, 'task':None, 'repeat':0, 'prompts':PLAN} for e in ['low','medium','high','xhigh','max']]
    return matrix + routed + continuity

def select_jobs(jobs, section):
    return jobs if section=='all' else [job for job in jobs if job['phase']==section]

def equal_json(a,b):
    if isinstance(a,bool) or isinstance(b,bool): return type(a) is type(b) and a == b
    if isinstance(a,dict) and isinstance(b,dict): return a.keys() == b.keys() and all(equal_json(a[k],b[k]) for k in a)
    if isinstance(a,list) and isinstance(b,list): return len(a) == len(b) and all(equal_json(x,y) for x,y in zip(a,b))
    return a == b

def grade(task, answer):
    if task['grader'] == 'exact':
        checks={'exact_json':equal_json(answer,task['example_answer'])}
    else:
        starts = answer.get('starts',{}) if isinstance(answer,dict) else {}
        durations=task['durations']
        valid=isinstance(starts,dict) and set(starts)==set(durations) and all(type(t) is int and t >= 0 for t in starts.values())
        checks={'valid_start_times':valid,'dependencies':False,'capacity':False,'optimal_makespan':False}
        if valid:
            finish={k:starts[k]+d for k,d in durations.items()}
            checks['dependencies']=all(starts[k]>=finish[p] for k,parents in task['dependencies'].items() for p in parents)
            checks['capacity']=all(sum(starts[k]<=t<finish[k] for k in starts)<=2 for t in starts.values())
            checks['optimal_makespan']=type(answer.get('makespan')) is int and answer['makespan']==max(finish.values())==task['optimum']
    return {'passed':all(checks.values()),'score':sum(checks.values())/len(checks),'checks':checks}

def parse_answer(text):
    try: return answer_decoder().decode(text.strip())
    except (ValueError,TypeError): return None

def answer_decoder():
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result: raise ValueError('duplicate JSON key')
            result[key] = value
        return result
    def finite_constant(_): raise ValueError('non-finite JSON constant')
    return json.JSONDecoder(object_pairs_hook=unique_object, parse_constant=finite_constant)

def evaluate_answer(task, text):
    """Score the answer without rewarding prose/fences or cherry-picking objects.

    Every corpus schema is an object. Recover exactly one complete object for
    semantic grading. Other braces, multiple objects, or malformed/duplicate
    fields make recovery ambiguous. No LLM judge and no requests are involved.
    """
    text = text.strip() if isinstance(text, str) else ''
    decoder = answer_decoder()
    value = parse_answer(text)
    strict = isinstance(value, dict)
    mode = 'strict_json' if strict else 'unparseable'
    if not strict:
        candidates = []
        cursor = 0
        while cursor < len(text):
            start = text.find('{', cursor)
            if start < 0: break
            try:
                item, length = decoder.raw_decode(text[start:])
            except (ValueError, TypeError):
                cursor = start + 1
                continue
            end = start + length
            candidates.append((item, start, end))
            cursor = end
        if len(candidates) == 1:
            item, start, end = candidates[0]
            outside = text[:start] + text[end:]
            if '{' in outside or '}' in outside:
                mode = 'ambiguous_json'
            else:
                value = item
                mode = 'fenced_json' if text.startswith('```') and text.endswith('```') else 'embedded_json'
        elif len(candidates) > 1:
            mode = 'ambiguous_json'
        if mode in ('ambiguous_json', 'unparseable'): value = None
    semantic = grade(task, value)
    verdict = 'pass' if semantic['passed'] and strict else 'format_only' if semantic['passed'] else 'semantic_failure'
    return {'semantic':semantic, 'format':{'passed':strict, 'mode':mode}, 'verdict':verdict}

def row_passed(row):
    return row['complete'] and all(t.get('valid_dispatch') and t.get('quality',{'passed':True})['passed'] and t.get('routing_passed',True) and t.get('continuity_passed',True) and t.get('recalls_codename',True) for t in row['turns'])

def score_turn(turn, task):
    evaluation = evaluate_answer(task, turn.get('result'))
    turn['answer_evaluation'] = evaluation
    turn['quality'] = {**evaluation['semantic'], 'passed':evaluation['verdict']=='pass'}

def rescore(data, tasks):
    """Return a derived artifact; never mutate original answers or scores."""
    result = copy.deepcopy(data)
    result['scoringVersion'] = 2
    for row in result['results']:
        row.setdefault('original_passed', row['passed'])
        for turn in row['turns']:
            if row.get('task'):
                turn.setdefault('original_quality', copy.deepcopy(turn.get('quality')))
                score_turn(turn, tasks[row['task']])
        row['passed'] = row_passed(row)
    result['passed'] = result.get('complete',False) and all(r['passed'] for r in result['results'])
    return result

def valid_dispatch(turn, model, effort):
    request=turn.get('request',{})
    return (not turn.get('is_error') and turn.get('subtype')=='success' and request.get('model')==model and request.get('effort')==effort and request.get('apiModel')==model and turn.get('response_models')==[model] and 'max_tokens' not in turn.get('stop_reasons',[]))

def score_routing(turn, task, trace):
    # This suite tests the published default profiles. A valid classification
    # alone must never count as a successful route when the host stayed on Opus.
    model,effort={'simple':('claude-haiku-5-5','low'),'routine':('claude-sonnet-5-5','medium'),'complex':('claude-opus-5-5','high')}[task['kind']]
    detail=trace.get('trace',{});provider=detail.get('provider',{})
    classification=provider.get('classification',{})
    request=detail.get('request',{})
    turn['classification_passed']=trace.get('classifierCalls')==1 and provider.get('status')=='accepted' and classification.get('kind')==task['kind'] and classification.get('independent') is True
    turn['valid_dispatch']=valid_dispatch(turn,model,effort)
    trace_matches=request.get('model')==model and request.get('effort')==effort and request.get('apiModel')==model
    switch_confirmed=task['kind']=='complex' or (detail.get('application')=='confirmed-model' and trace.get('counters',{}).get('dispatched',trace.get('dispatchAttempts'))==1 and trace.get('counters',{}).get('confirmed',trace.get('confirmedRoutedTurns'))==1)
    turn['profile_applied']=turn['valid_dispatch'] and trace_matches and switch_confirmed
    turn['routing_passed']=turn['classification_passed'] and turn['profile_applied']

def reported_spend(rows):
    costs=[t.get('cost_usd') for r in rows for t in r.get('turns',[])]
    if any(not isinstance(c,(int,float)) or not math.isfinite(c) or c < 0 for c in costs): return None
    return sum(costs)

class ClaudeSession:
    def __init__(self, job, cwd, env, timeout, budget, fixture=None, progress=None):
        cmd=['claude','-p','--input-format','stream-json','--output-format','stream-json','--verbose','--plugin-dir',str(ROOT),'--plugin-dir',str(ROOT/'tests/fixtures/observer'),'--setting-sources','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--tools','','--no-session-persistence','--model',job['model'],'--effort',job['effort'],'--permission-mode','plan' if job['phase']=='continuity' else 'default','--max-budget-usd',str(budget),'--system-prompt','Solve the supplied task. Follow its output schema exactly. Do not use tools. If no schema is supplied, keep your response under 200 words.']
        if fixture: cmd += ['--plugin-dir',str(fixture)]
        self.proc=subprocess.Popen(cmd,cwd=cwd,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
        self.messages=queue.Queue(); self.timeout=timeout; self.progress=progress
        def stdout():
            for line in self.proc.stdout:
                try:self.messages.put(json.loads(line))
                except ValueError:pass
            self.messages.put({'type':'eof'})
        def stderr():
            for _ in self.proc.stderr:pass
        threading.Thread(target=stdout,daemon=True).start();threading.Thread(target=stderr,daemon=True).start()
    def send(self,prompt):
        start=time.monotonic(); end=start+self.timeout
        self.proc.stdin.write(json.dumps({'type':'user','message':{'role':'user','content':prompt}})+'\n');self.proc.stdin.flush()
        models=[];stops=[]
        while True:
            remaining=end-time.monotonic()
            if remaining<=0:raise TimeoutError('turn-deadline')
            try:
                event=self.messages.get(timeout=min(30,remaining))
            except queue.Empty:
                now=time.monotonic()
                if now>=end:raise TimeoutError('turn-deadline')
                if self.progress:self.progress(f"  Waiting for Claude response: {now-start:.0f}s elapsed (deadline {self.timeout:g}s)")
                continue
            if event.get('type')=='assistant':
                msg=event.get('message',{});model=msg.get('model')
                if model and model not in models:models.append(model)
                if msg.get('stop_reason'):stops.append(msg['stop_reason'])
            if event.get('type')=='result':
                result={k:event.get(k) for k in ['result','is_error','subtype','total_cost_usd','duration_api_ms','usage','modelUsage']}
                # Never write raw API/credential error details to a benchmark artifact.
                if result['is_error']:result['result']=''
                return {**result,'response_models':models,'stop_reasons':stops,'wall_ms':round((time.monotonic()-start)*1000)}
            if event.get('type')=='eof':raise RuntimeError('early-exit')
    def command_json(self,command):
        text=self.send(command).get('result') or ''
        return json.loads(text[text.index('{'):])
    def close(self):
        self.proc.stdin.close()
        try:self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.proc.terminate()
            try:self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:self.proc.kill();self.proc.wait()

def run_job(job, tasks, cwd, env, timeout, budget, fixture=None, progress=None):
    row={**job,'turns':[]}; session=None; previous_cost=0
    try:
        session=ClaudeSession(job,cwd,env,timeout,budget,fixture,progress)
        session.send('/route off' if job['phase']=='matrix' else '/route advise')
        if job['phase']=='router':
            session.send('Reply READY. Initialize the host for the next independent benchmark task.')
            session.send('/route new')
            session.send('/route check '+job['prompts'][0])
            advice=session.command_json('/route trace')
            row['advice']=advice
            record=advice.get('recommendation')
            if record and record.get('acceptance')=='suggested':
                session.send('/route accept '+record['id'])
        for index,prompt in enumerate(job['prompts']):
            if progress: progress(f"  Answer {index+1}/{len(job['prompts'])}: waiting for {job['family']}/{job['effort']} (timeout {timeout:g}s)")
            turn=session.send(prompt)
            if progress: progress(f"  Answer received in {turn['wall_ms']/1000:.1f}s; checking model and routing trace")
            cumulative=turn.pop('total_cost_usd')
            turn['cost_usd']=cumulative-previous_cost if isinstance(cumulative,(int,float)) else None
            if isinstance(cumulative,(int,float)): previous_cost=cumulative
            row['turns'].append(turn)
            observed=session.command_json('/bench-observe').get('requests',[])
            turn['observed_requests']=observed
            turn['request']=observed[-1] if observed else {}
            if job['phase']=='matrix':
                turn['valid_dispatch']=valid_dispatch(turn,job['model'],job['effort'])
            else:
                trace=session.command_json('/route trace');turn['routing_trace']=trace
                if job['phase']=='continuity':
                    turn['valid_dispatch']=valid_dispatch(turn,job['model'],job['effort'])
                    turn['continuity_passed']=turn['valid_dispatch'] and trace.get('classifierCalls')==0 and trace.get('counters',{}).get('dispatched',trace.get('dispatchAttempts'))==0 and trace.get('trace',{}).get('planMode') is True
                    if index==len(job['prompts'])-1:turn['recalls_codename']='CEDAR-17' in turn['result']
                else:
                    score_routing(turn,tasks[job['task']],trace)
            if job['task']:
                score_turn(turn,tasks[job['task']])
            if turn.get('is_error'):break
    except Exception as error:
        row['error']=type(error).__name__
    finally:
        if session:session.close()
    row['complete']=not row.get('error') and len(row['turns'])==len(job['prompts'])
    row['passed']=row_passed(row)
    # Prompts already live in the versioned corpus; don't duplicate them in every row.
    row.pop('prompts',None)
    return row

def make_offline_fixture(directory,tasks):
    path=Path(directory)/'jev-fixture';(path/'.claude-plugin').mkdir(parents=True);(path/'hooks').mkdir()
    (path/'.claude-plugin/plugin.json').write_text('{"name":"benchmark-synthetic-jev","version":"0.0.1"}')
    (path/'hooks/hooks.json').write_text('{"modules":["./register.js"]}')
    labels=json.dumps({t['prompt']:t['kind'] for t in tasks})
    (path/'hooks/register.js').write_text('const labels='+labels+''';
export function register(on) { on('http.fetch', ($, e) => {
 if(e.url !== 'https://api.typesafe.ai/v1/systemone' || e.init.headers.Authorization !== 'Bearer offline-fixture') throw new Error('Unexpected fixture request');
 const kind=labels[JSON.parse(e.init.body).state.prompt]; if(!kind) throw new Error('Unknown synthetic prompt');
 return {value:{ok:true,status:200,headers:{},text:JSON.stringify({answers:{requirements:{type:'choice',choice:'sufficient',confidence:1,probabilities:{sufficient:1,uncertain:0}},complexity:{type:'choice',choice:kind,confidence:1,probabilities:{simple:0,routine:0,complex:0,unknown:0,[kind]:1}},independence:{type:'choice',choice:'independent',confidence:1,probabilities:{independent:1,dependent:0}}},usage:{input_tokens:20,output_tokens:10}})}};
}) }
''')
    return path

class OfflineAPI(http.server.BaseHTTPRequestHandler):
    tasks=[];models=[]
    def log_message(self,*_):pass
    def do_POST(self):
        data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if 'count_tokens' in self.path:
            self.send_response(200);self.end_headers();self.wfile.write(b'{"input_tokens":100}');return
        model=data.get('model');effort=data.get('output_config',{}).get('effort')
        if model not in self.models or effort not in ['low','medium','high','xhigh','max']:
            self.send_response(400);self.end_headers();self.wfile.write(b'{"type":"error","error":{"type":"invalid_request_error","message":"Unexpected model or effort"}}');return
        # Match the current task in the real serialized request. Synthetic gold is
        # intentionally used ONLY here to exercise graders and reporting plumbing.
        raw=json.dumps(data.get('messages',[]),ensure_ascii=False)
        task=next((t for t in self.tasks if json.dumps(t['prompt'],ensure_ascii=False)[1:-1] in raw),None)
        answer=json.dumps(task['example_answer']) if task else 'Synthetic plan CEDAR-17: verify tenant isolation.'
        self.send_response(200);self.send_header('Content-Type','text/event-stream');self.end_headers()
        message={'id':'msg_fixture','type':'message','role':'assistant','model':model,'content':[],'stop_reason':None,'stop_sequence':None,'usage':{'input_tokens':100,'output_tokens':1}}
        events=[('message_start',{'message':message}),('content_block_start',{'index':0,'content_block':{'type':'text','text':''}}),('content_block_delta',{'index':0,'delta':{'type':'text_delta','text':answer}}),('content_block_stop',{'index':0}),('message_delta',{'delta':{'stop_reason':'end_turn','stop_sequence':None},'usage':{'output_tokens':10}}),('message_stop',{})]
        for typ,body in events:self.wfile.write(('event: '+typ+'\ndata: '+json.dumps({'type':typ,**body})+'\n\n').encode());self.wfile.flush()

def answer_metrics(turn):
    evaluation = turn.get('answer_evaluation')
    if evaluation: return evaluation['semantic']['passed'], evaluation['format']['passed']
    # Legacy report fixtures retain their original combined quality measurement.
    passed = turn.get('quality', {}).get('passed', False)
    return passed, passed

def matrix_summary(data):
    summaries = []
    for model in data['models']:
        for effort in model['efforts']:
            rows = [r for r in data['results'] if r['phase']=='matrix' and r['family']==model['family'] and r['effort']==effort]
            turns = [t for r in rows for t in r['turns'] if t.get('valid_dispatch')]
            metrics = [answer_metrics(t) for t in turns]
            summaries.append({'family':model['family'], 'effort':effort, 'attempted':len(rows), 'valid':len(turns),
                'semantic_passes':sum(semantic for semantic,_ in metrics),
                'format_passes':sum(format_ok for _,format_ok in metrics),
                'full_passes':sum(semantic and format_ok for semantic,format_ok in metrics),
                'format_only_failures':sum(semantic and not format_ok for semantic,format_ok in metrics),
                'median_wall_ms':statistics.median(t['wall_ms'] for t in turns) if turns else None,
                'cost_usd':reported_spend(rows)})
    return summaries

def report(data,path):
    rows=data['results']; cells=matrix_summary(data)
    spend=reported_spend(rows)
    lines=['# Model/effort benchmark', '', '**SYNTHETIC OFFLINE VALIDATION — no model-quality or cost conclusions.**' if data['offline'] else '**Live provider benchmark.**', '', f"Coverage: {len(rows)}/{data['planned_jobs']} sessions; complete: {data['complete']}. Repetitions: {data['repeats']}.", '',
        'Semantic correctness and strict JSON-only format compliance are scored separately. A single unambiguous JSON object may be recovered from prose or a code fence for semantic grading, but that response still fails the format requirement. Multiple objects, duplicate keys, and malformed competing objects are not cherry-picked.', '',
        'Invalid model/effort dispatches, truncation and unavailable models are not attributed to the requested combination. Scores cover short, deterministic tasks; they do not measure long-horizon agentic capability.', '',
        '| Model | Effort | Valid / attempted | Correct answers | JSON only | Format-only failures | Median wall ms | Claude USD |',
        '|---|---|---:|---:|---:|---:|---:|---:|']
    for cell in cells:
        cost=f"{cell['cost_usd']:.6f}" if cell['cost_usd'] is not None else 'unreported'
        latency=f"{cell['median_wall_ms']:.0f}" if cell['median_wall_ms'] is not None else '—'
        lines.append(f"| {cell['family']} | {cell['effort']} | {cell['valid']} / {cell['attempted']} | {cell['semantic_passes']} | {cell['format_passes']} | {cell['format_only_failures']} | {latency} | {cost} |")
    router=[r for r in rows if r['phase']=='router'];planning=[r for r in rows if r['phase']=='continuity']
    router_turns=[t for r in router for t in r['turns']]
    abstentions=sum(t.get('routing_trace',{}).get('trace',{}).get('provider',{}).get('status')=='abstained' for t in router_turns)
    lines += ['', '## Routing and continuity', '',
        f"Jev accepted expected classifications: {sum(t.get('classification_passed',t.get('routing_passed',False)) for t in router_turns)}/{len(router_turns)}; provider abstentions: {abstentions}.",
        f"Legacy six-case expected advice/profile check passed: {sum(t.get('routing_passed',False) for t in router_turns)}/{len(router_turns)}. Default profiles are Haiku/low, Sonnet/medium and Opus/high.",
        f"Router answer semantics: {sum(answer_metrics(t)[0] for t in router_turns)}/{len(router_turns)}; strict JSON-only format: {sum(answer_metrics(t)[1] for t in router_turns)}/{len(router_turns)}.",
        f"Opus planning + codename recall: {sum(r['passed'] for r in planning)}/{len(planning)} effort levels passed.", '',
        '| Planning effort | Protected turns | Total wall seconds | Claude USD |', '|---|---:|---:|---:|']
    for row in planning:
        cost=reported_spend([row]);cost_text=f'{cost:.6f}' if cost is not None else 'unreported'
        lines.append(f"| {row['effort']} | {sum(t.get('continuity_passed',False) for t in row['turns'])}/{len(row['turns'])} | {sum(t['wall_ms'] for t in row['turns'])/1000:.1f} | {cost_text} |")
    lines += ['',f"Total reported Claude cost: ${spend:.6f}." if spend is not None else 'Total reported Claude cost is incomplete.',
        'Costs include reported Claude usage only. TypeSafe monetary cost is not included; classifier token reports appear in routing traces. Fresh CLI sessions share identical prompts but provider cache reuse can still occur; cache token categories are retained. A single repetition is exploratory, not a statistically reliable ranking. In 0.6 the harness explicitly accepts each displayed suggestion; users are never opted into automatic changes. Router-section costs include the host initialization answer. No policy is changed automatically.']
    if not data['offline']:
        expected=data['task_count']*data['repeats']
        eligible=[c for c in cells if c['attempted']==expected and c['valid']==expected and c['full_passes']==expected and c['cost_usd'] is not None]
        if eligible:
            best=min(eligible,key=lambda c:c['cost_usd'])
            lines += ['', f"Lowest observed Claude cost among fully covered combinations passing every task and format check: **{best['family']}/{best['effort']}**, ${best['cost_usd']:.6f}. This is a result on this corpus, not a deployment recommendation."]
        else:lines += ['','No fully covered combination passed every task and format check; no cheapest-quality-preserving profile is selected.']
    lines += ['','## Failures / incomplete coverage','']
    failures=[r for r in rows if not r['passed']]
    for row in failures:
        reasons=[]
        if row.get('error'): reasons.append(row['error'])
        for turn in row['turns']:
            if not turn.get('valid_dispatch'):reasons.append('dispatch mismatch or incomplete')
            if 'answer_evaluation' in turn and turn['answer_evaluation']['verdict']!='pass':reasons.append(turn['answer_evaluation']['verdict']+': '+turn['answer_evaluation']['format']['mode'])
            if turn.get('routing_passed') is False:reasons.append('expected profile not applied/confirmed' if turn.get('classification_passed') else 'classification not accepted/expected')
            if turn.get('continuity_passed') is False:reasons.append('continuity failure')
        lines.append(f"- {row['id']}: {'; '.join(dict.fromkeys(reasons)) or 'inspect JSON checks'}")
    if not failures:lines.append('None in completed sessions.')
    if not data['complete']:lines.append('Unrun sessions remain; partial results must not be treated as a completed benchmark.')
    if data.get('source_evidence'):
        lines += ['', 'Derived from '+data['source_evidence']['file']+'. Original evidence was not modified.', 'Source SHA-256: `'+data['source_evidence']['sha256']+'`.']
    path.write_text('\n'.join(lines)+'\n')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline',action='store_true');parser.add_argument('--dry-run',action='store_true')
    parser.add_argument('--repeats',type=int,default=1);parser.add_argument('--seed',type=int,default=20261022)
    parser.add_argument('--budget-usd',type=float,default=10,help='Soft stop on reported Claude cost; excludes TypeSafe; an in-flight request can exceed it')
    parser.add_argument('--session-budget-usd',type=float,default=1)
    parser.add_argument('--timeout',type=float,default=300);parser.add_argument('--resume',type=Path)
    parser.add_argument('--rescore',type=Path,help='Rescore a saved result without model calls; write a separate .rescored artifact')
    parser.add_argument('--section',choices=['all','matrix','router','continuity'],default='all',help='Run only this section; router runs six Jev cases without repeating the model matrix')
    parser.add_argument('--limit',type=int,help='Run at most this many additional sessions (for smoke tests)')
    args=parser.parse_args()
    if args.repeats<1 or not all(math.isfinite(x) and x>0 for x in [args.budget_usd,args.session_budget_usd,args.timeout]):parser.error('Repetitions and budgets/timeouts must be positive.')
    if args.limit is not None and args.limit<1:parser.error('--limit must be positive')
    models,tasks=load_specs();jobs=select_jobs(build_jobs(models,tasks,args.repeats,args.seed),args.section)
    fingerprint=hashlib.sha256(json.dumps({'models':models,'tasks':tasks,'jobs':jobs},sort_keys=True).encode()).hexdigest()
    if args.rescore:
        if args.resume or args.offline or args.dry_run:parser.error('--rescore cannot be combined with --resume, --offline or --dry-run')
        source=args.rescore
        original=source.read_bytes();data=json.loads(original)
        original_jobs=select_jobs(build_jobs(models,tasks,data['repeats'],data['seed']),data.get('section','all'))
        original_fingerprint=hashlib.sha256(json.dumps({'models':models,'tasks':tasks,'jobs':original_jobs},sort_keys=True).encode()).hexdigest()
        if data['fingerprint']!=original_fingerprint:parser.error('Saved result does not match the current task corpus and model catalog; use its original corpus to rescore.')
        output=source.with_suffix('.rescored.json')
        if output.exists():parser.error('Derived output already exists; preserve it or choose a fresh source copy.')
        data=rescore(data,{t['id']:t for t in tasks})
        data['source_evidence']={'file':source.name,'sha256':hashlib.sha256(original).hexdigest()}
        output.write_text(json.dumps(data,indent=2)+'\n');report(data,output.with_suffix('.md'))
        print('Rescored without model calls: '+str(output.with_suffix('.md')),flush=True)
        return 0
    if args.dry_run:
        print(json.dumps({'models':models,'section':args.section,'combinations':len({(j['family'],j['effort']) for j in jobs if j['phase']=='matrix'}),'sessions':len(jobs),'answer_turns':sum(len(j['prompts']) for j in jobs),'repeats':args.repeats,'soft_claude_budget_usd':args.budget_usd},indent=2));return 0
    if not args.offline and not os.environ.get('TYPESAFE_API_KEY'):parser.error('Run from the shell holding TYPESAFE_API_KEY and Claude authentication.')
    output=args.resume or ROOT/'evals'/('benchmark-'+('offline-' if args.offline else 'live-')+time.strftime('%Y%m%dT%H%M%S',time.gmtime())+f'-{time.time_ns()%1000000000:09d}.json')
    if args.resume:
        data=json.loads(output.read_text())
        if data['fingerprint']!=fingerprint or data['offline']!=args.offline:parser.error('Resume requires identical corpus, catalog, seed, repeats, section and offline/live mode.')
        if data.get('source') and data['source']['sha256']!=source_metadata()['sha256']:parser.error('Resume source changed; start a new run to avoid mixing plugin or grader versions.')
    else:
        data={'schemaVersion':1,'scoringVersion':2,'source':source_metadata(),'offline':args.offline,'section':args.section,'fingerprint':fingerprint,'repeats':args.repeats,'seed':args.seed,'models':models,'task_count':len(tasks),'planned_jobs':len(jobs),'complete':False,'results':[]}
    completed={r['id'] for r in data['results']};by_task={t['id']:t for t in tasks};server=None
    print(f"{len(jobs)} sessions / {sum(len(j['prompts']) for j in jobs)} answer turns; remaining {len(jobs)-len(completed)}. Output: {output}",flush=True)
    with tempfile.TemporaryDirectory(prefix='model-pilot-benchmark-') as cwd:
        env=dict(os.environ);fixture=None
        if args.offline:
            for key in list(env):
                if key.startswith(('ANTHROPIC_','CLAUDE_','TYPESAFE_')):env.pop(key)
            OfflineAPI.tasks=tasks;OfflineAPI.models=[m['id'] for m in models]
            server=http.server.ThreadingHTTPServer(('127.0.0.1',0),OfflineAPI)
            threading.Thread(target=server.serve_forever,daemon=True).start()
            env.update({'CLAUDE_CONFIG_DIR':cwd,'ANTHROPIC_API_KEY':'offline-fixture','TYPESAFE_API_KEY':'offline-fixture','CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC':'1','ANTHROPIC_BASE_URL':f'http://127.0.0.1:{server.server_port}'})
            for model in models:env['ANTHROPIC_DEFAULT_'+model['family'].upper()+'_MODEL']=model['id']
            fixture=make_offline_fixture(cwd,tasks)
        count=0
        try:
            for job in jobs:
                if job['id'] in completed:continue
                spend=reported_spend(data['results'])
                if spend is None or spend>=args.budget_usd:
                    data['stop_reason']='unreported-cost' if spend is None else 'budget-threshold';break
                if args.limit is not None and count>=args.limit:data['stop_reason']='session-limit';break
                print(f"[{len(data['results'])+1}/{len(jobs)}] {job['id']}",flush=True)
                row=run_job(job,by_task,cwd,env,args.timeout,min(args.session_budget_usd,args.budget_usd-spend),fixture,progress=lambda message:print(message,flush=True))
                data['results'].append(row);count+=1
                data['complete']=len(data['results'])==len(jobs)
                data['passed']=data['complete'] and all(r['passed'] for r in data['results'])
                temp=output.with_suffix('.tmp');temp.write_text(json.dumps(data,indent=2)+'\n');temp.replace(output)
                report(data,output.with_suffix('.md'))
                print('PASS' if row['passed'] else 'FAIL (recorded; see report)',flush=True)
                if row.get('error') or any(t.get('cost_usd') is None for t in row['turns']):data['stop_reason']='incomplete-or-unreported-cost';break
        finally:
            if server:server.shutdown();server.server_close()
            data['complete']=len(data['results'])==len(jobs);data['passed']=data['complete'] and all(r['passed'] for r in data['results'])
            output.write_text(json.dumps(data,indent=2)+'\n');report(data,output.with_suffix('.md'))
    print('Report: '+str(output.with_suffix('.md')),flush=True)
    return 0 if data['passed'] else 1

if __name__=='__main__':raise SystemExit(main())
