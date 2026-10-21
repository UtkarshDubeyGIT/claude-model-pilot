#!/usr/bin/env python3
"""Explicit, labeled advisor evaluation. No network unless --live is supplied."""
import argparse
import collections
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('benchmark',ROOT/'scripts/benchmark.py')
bench=importlib.util.module_from_spec(spec);spec.loader.exec_module(bench)
BRIDGE="""
import {readFileSync} from 'node:fs';
import {jevRequest,evaluateJev} from './src/jev.js';
import {recommend,classificationEligibility} from './src/policy.js';
const x=JSON.parse(readFileSync(0,'utf8'));
const s=x.scenario, input={...s.current,...s.context,text:s.prompt};
const evidence=x.replay?{status:'synthetic-label',classification:{kind:s.label.kind,independent:s.label.independent,confidence:1}}:evaluateJev(x.response);
const requirementsMet=x.replay?s.label.requirementsMet:evidence.status==='accepted'&&evidence.signals?.requirements?.choice==='sufficient';
console.log(JSON.stringify({request:jevRequest(s.prompt),eligibility:classificationEligibility(input),evidence,
 decision:recommend({...input,requireClassifier:true,classification:evidence.classification,requirementsMet})}));
"""
def bridge(scenario,response=None,replay=False):
    p=subprocess.run(['node','--input-type=module','-e',BRIDGE],cwd=ROOT,input=json.dumps({'scenario':scenario,'response':response,'replay':replay}),text=True,capture_output=True,check=True)
    return json.loads(p.stdout)

def outcome(scenario,decision):
    label=scenario['label']
    if decision['action']!='suggest': return 'missed-advice' if label['advice'] else 'justified-silence'
    profile=decision['model']+'/'+decision['effort']
    if profile not in label['acceptableProfiles']:return 'ineligible-advice'
    return 'useful-advice' if label['advice'] else 'unnecessary-advice'

def grade_answer(scenario,text):
    gold=scenario['answerRubric']['goldJSON']
    if gold is None:return {'correctness':None,'functionality':None,'format':None,'depthPolish':None,'review':'human-review-required'}
    result=bench.evaluate_answer({'grader':'exact','example_answer':gold},text)
    return {'correctness':result['semantic']['passed'],'functionality':result['semantic']['passed'],
            'format':result['format']['passed'],'depthPolish':None,'review':'deterministic-json-contract','formatMode':result['format']['mode']}

def answer(scenario,profile,cwd,budget):
    model='claude-'+profile['model']+'-5-5'
    job={'phase':'matrix','model':model,'effort':profile['effort']}
    session=bench.ClaudeSession(job,cwd,dict(os.environ),180,budget)
    try:
        session.send('/route off')
        result=session.send(scenario['prompt'])
        observed=session.command_json('/bench-observe').get('requests',[])
        result['request']=observed[-1] if observed else {}
        result['valid_dispatch']=bench.valid_dispatch(result,model,profile['effort'])
        result['scores']=grade_answer(scenario,result.get('result',''))
        # Observed effort is the outgoing request, not proof of provider-internal effort.
        result['cost_usd']=result.pop('total_cost_usd',None)
        result['latency_ms']=result.pop('wall_ms',None)
        return result
    finally:session.close()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    modes=p.add_mutually_exclusive_group();modes.add_argument('--live',action='store_true');modes.add_argument('--policy-replay',action='store_true')
    p.add_argument('--split',choices=['calibration','heldout','all'],default='calibration')
    p.add_argument('--answers',action='store_true',help='With --live, buy paired baseline/candidate Claude answers for suggested profiles')
    p.add_argument('--budget-usd',type=float,default=5,help='Soft Claude stop; excludes TypeSafe and may overshoot by one request')
    p.add_argument('--output',type=Path)
    args=p.parse_args()
    if args.answers and not args.live:p.error('--answers requires --live')
    if not math.isfinite(args.budget_usd) or args.budget_usd<=0:p.error('budget must be finite and positive')
    corpus=ROOT/'benchmarks/advice.json';data=json.loads(corpus.read_text())
    cases=[s for s in data['scenarios'] if args.split=='all' or s['split']==args.split]
    if not args.live and not args.policy_replay:
        print(json.dumps({'scenarios':len(cases),'split':args.split,'paid':False,'next':'Use --policy-replay for offline label replay, or --live for billed Jev assessment; add --answers for paired quality/cost measurements.'},indent=2));return 0
    key=os.environ.get('TYPESAFE_API_KEY','').strip()
    if args.live and (not key or '\n' in key or '\r' in key):p.error('Export TYPESAFE_API_KEY in this shell; never put it in arguments.')
    report={'schemaVersion':1,'source':bench.source_metadata(),'corpusSha256':hashlib.sha256(corpus.read_bytes()).hexdigest(),
      'split':args.split,'mode':'live' if args.live else 'synthetic-policy-replay','complete':False,'planned':len(cases),
      'claims':'Policy replay cannot measure Jev accuracy. Answer scores require valid dispatch and human review where marked. TypeSafe money excluded.', 'results':[]}
    output=args.output or ROOT/'evals'/('advice-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'.json')
    output.parent.mkdir(parents=True,exist_ok=True)
    spend=0;cost_known=True
    with tempfile.TemporaryDirectory(prefix='model-pilot-advice-') as cwd:
        for i,s in enumerate(cases):
            initial=bridge(s,replay=args.policy_replay)
            start=time.monotonic();response=None;error=None
            if args.live and initial['eligibility']['eligible']:
                try:
                    req=urllib.request.Request('https://api.typesafe.ai/v1/systemone',data=json.dumps(initial['request']).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
                    with urllib.request.urlopen(req,timeout=15) as r:raw=r.read(65537)
                    if len(raw)>65536:raise ValueError('response-size')
                    response=json.loads(raw)
                except Exception as e:error=type(e).__name__
            assessment=initial if args.policy_replay else bridge(s,response=response)
            row={'id':s['id'],'category':s['category'],'evidence':assessment['evidence'],'decision':assessment['decision'],
                 'outcome':outcome(s,assessment['decision']),'classifier_latency_ms':round((time.monotonic()-start)*1000),
                 'provider_error':error,'answers':{}}
            if args.live and not initial['eligibility']['eligible']:row['evidence']={'status':'skipped','reason':initial['eligibility']['reason']}
            if args.answers and row['decision']['action']=='suggest':
                for name,profile in [('baseline',s['current']),('candidate',row['decision'])]:
                    if not cost_known or spend>=args.budget_usd:break
                    try:
                        result=answer(s,profile,cwd,min(1,args.budget_usd-spend));row['answers'][name]=result
                        cost=result['cost_usd']
                        if type(cost) not in [int,float] or not math.isfinite(cost) or cost<0:cost_known=False
                        else:spend+=cost
                    except Exception as e:row['answers'][name]={'error':type(e).__name__};cost_known=False
            report['results'].append(row)
            report.update(complete=len(report['results'])==len(cases),reported_claude_usd=spend,cost_known=cost_known,
                outcomes=dict(collections.Counter(r['outcome'] for r in report['results'])))
            output.write_text(json.dumps(report,indent=2)+'\n')
            print(f"[{i+1}/{len(cases)}] {s['id']}: {row['outcome']}",flush=True)
            if args.answers and (not cost_known or spend>=args.budget_usd):break
    print('Saved '+str(output));return 0
if __name__=='__main__':raise SystemExit(main())
