import importlib.util
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('benchmark', ROOT / 'scripts/benchmark.py')
bench = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bench)

class BenchmarkTests(unittest.TestCase):
    def test_matrix_covers_every_current_tier_and_named_effort(self):
        models, tasks = bench.load_specs()
        jobs = bench.build_jobs(models, tasks, 1, 7)
        matrix = [j for j in jobs if j['phase'] == 'matrix']
        self.assertEqual(len(matrix), 120)
        self.assertEqual({j['family'] for j in matrix}, {'haiku', 'sonnet', 'opus', 'fable'})
        self.assertEqual({j['effort'] for j in matrix}, {'low', 'medium', 'high', 'xhigh', 'max'})
        self.assertEqual(len({j['id'] for j in jobs}), len(jobs))
        self.assertEqual(len(jobs), 131)
        self.assertEqual(sum(len(j['prompts']) for j in jobs), 146)
    def test_gold_answers_pass_but_wrong_types_and_partial_answers_fail(self):
        _, tasks = bench.load_specs()
        for task in tasks:
            self.assertTrue(bench.grade(task, task['example_answer'])['passed'], task['id'])
            self.assertFalse(bench.grade(task, {})['passed'], task['id'])
        self.assertFalse(bench.grade(tasks[1], {'total_cents': True})['passed'])
    def test_scheduler_checks_feasibility_not_just_claimed_optimum(self):
        _, tasks = bench.load_specs()
        task = next(t for t in tasks if t['grader'] == 'schedule')
        self.assertFalse(bench.grade(task, {'makespan':10,'starts':{k:0 for k in 'ABCDEF'}})['passed'])
    def test_effort_clamp_or_fallback_is_not_attributed_to_requested_cell(self):
        good={'request':{'model':'claude-opus-5-5','effort':'max','apiModel':'claude-opus-5-5'},'response_models':['claude-opus-5-5'],'is_error':False,'subtype':'success'}
        self.assertTrue(bench.valid_dispatch(good,'claude-opus-5-5','max'))
        good['request']['effort']='high'
        self.assertFalse(bench.valid_dispatch(good,'claude-opus-5-5','max'))
        good['request']['effort']='max';good['response_models']=['claude-sonnet-5-5']
        self.assertFalse(bench.valid_dispatch(good,'claude-opus-5-5','max'))
    def test_budget_does_not_treat_unreported_cost_as_free(self):
        self.assertIsNone(bench.reported_spend([{'turns':[{'cost_usd':None}]}]))
        self.assertEqual(bench.reported_spend([{'turns':[{'cost_usd':.02},{'cost_usd':.03}]}]),.05)
    def test_plan_is_reproducible_and_repetitions_are_distinct(self):
        models,tasks=bench.load_specs()
        self.assertEqual(bench.build_jobs(models,tasks,1,42),bench.build_jobs(models,tasks,1,42))
        self.assertNotEqual(bench.build_jobs(models,tasks,1,42),bench.build_jobs(models,tasks,1,43))
        jobs=bench.build_jobs(models,tasks,2,42)
        self.assertEqual(len(jobs),257)
        self.assertEqual(len(set(j['id'] for j in jobs)),257)

if __name__ == '__main__': unittest.main()

class BenchmarkReportTests(unittest.TestCase):
    def test_report_does_not_rank_invalid_or_partial_cells(self):
        import tempfile
        data={'offline':False,'complete':False,'repeats':1,'task_count':1,'planned_jobs':2,'models':[{'family':'haiku','efforts':['low','high']}], 'results':[
            {'id':'low','phase':'matrix','family':'haiku','effort':'low','passed':False,'turns':[{'valid_dispatch':False,'cost_usd':.001}]},
            {'id':'high','phase':'matrix','family':'haiku','effort':'high','passed':True,'turns':[{'valid_dispatch':True,'cost_usd':.02,'quality':{'passed':True,'score':1},'wall_ms':10}]}]}
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'report.md'
            bench.report(data,path)
            text=path.read_text()
            self.assertIn('**haiku/high**',text)
            self.assertNotIn('**haiku/low**',text)
            self.assertIn('partial results',text)
            data['offline']=True
            bench.report(data,path)
            self.assertNotIn('Lowest observed',path.read_text())

class AnswerEvaluationTests(unittest.TestCase):
    def setUp(self):
        _, tasks = bench.load_specs()
        self.task = next(t for t in tasks if t['id'] == 'integer_arithmetic')
    def test_bare_json_passes_semantics_and_format(self):
        result = bench.evaluate_answer(self.task, '{"total_cents":1145}')
        self.assertTrue(result['semantic']['passed'])
        self.assertTrue(result['format']['passed'])
        self.assertEqual(result['verdict'], 'pass')
    def test_prose_and_fences_are_format_failures_not_wrong_answers(self):
        for text in ['Calculation: 597+698-150=1145.\n{"total_cents":1145}', '```json\n{"total_cents":1145}\n```']:
            with self.subTest(text=text):
                result = bench.evaluate_answer(self.task, text)
                self.assertTrue(result['semantic']['passed'])
                self.assertFalse(result['format']['passed'])
                self.assertEqual(result['verdict'], 'format_only')
    def test_conflicting_or_repeated_objects_are_not_cherry_picked(self):
        for text in ['{"total_cents":3}\nActually {"total_cents":1145}', '{"total_cents":1145}\n{"total_cents":1145}', '{"broken": nope}\n{"total_cents":1145}']:
            with self.subTest(text=text):
                result = bench.evaluate_answer(self.task, text)
                self.assertFalse(result['semantic']['passed'])
                self.assertEqual(result['format']['mode'], 'ambiguous_json')
    def test_explanatory_arrays_do_not_hide_one_final_schema_object(self):
        _, tasks = bench.load_specs()
        task = next(t for t in tasks if t['id'] == 'interval_boundaries')
        import json
        text = 'Sort [1,3], [2,4]; [3,5] overlaps.\n' + json.dumps(task['example_answer'])
        self.assertTrue(bench.evaluate_answer(task,text)['semantic']['passed'])
    def test_duplicate_keys_nonfinite_and_wrong_answer_do_not_pass(self):
        for text in ['{"total_cents":0,"total_cents":1145}', '{"total_cents":NaN}', '{"total_cents":Infinity}', '{"total_cents":3}']:
            with self.subTest(text=text):
                self.assertFalse(bench.evaluate_answer(self.task,text)['semantic']['passed'])
    def test_trailing_explanation_is_recovered_but_marked_noncompliant(self):
        result = bench.evaluate_answer(self.task, '{"total_cents":1145}\nThat is the total.')
        self.assertTrue(result['semantic']['passed'])
        self.assertFalse(result['format']['passed'])
    def test_rescore_preserves_raw_evidence_and_original_scores(self):
        import copy
        data = {'results':[{'id':'x','phase':'matrix','task':self.task['id'],'complete':True,'passed':False,'turns':[{'result':'Result: {"total_cents":1145}','valid_dispatch':True,'quality':{'passed':False,'score':0,'checks':{'exact_json':False}}}]}]}
        original = copy.deepcopy(data)
        rescored = bench.rescore(data,{self.task['id']:self.task})
        self.assertEqual(data,original)
        turn = rescored['results'][0]['turns'][0]
        self.assertEqual(turn['result'],original['results'][0]['turns'][0]['result'])
        self.assertEqual(turn['original_quality'],original['results'][0]['turns'][0]['quality'])
        self.assertTrue(turn['answer_evaluation']['semantic']['passed'])
        self.assertFalse(rescored['results'][0]['passed'])

class SessionProgressTests(unittest.TestCase):
    def session(self, events):
        import io
        from unittest.mock import Mock
        session=bench.ClaudeSession.__new__(bench.ClaudeSession)
        session.proc=Mock();session.proc.stdin=io.StringIO()
        session.messages=Mock();session.messages.get.side_effect=events
        session.timeout=300
        return session
    def test_long_turn_reports_elapsed_without_changing_deadline(self):
        from unittest.mock import patch
        session=self.session([bench.queue.Empty,{'type':'result','result':'done','subtype':'success','is_error':False}])
        updates=[];session.progress=updates.append
        with patch.object(bench.time,'monotonic',side_effect=[0,0,30,30,31]):
            answer=session.send('private prompt')
        self.assertEqual(answer['wall_ms'],31000)
        self.assertEqual(session.messages.get.call_args_list[0].kwargs['timeout'],30)
        self.assertEqual(len(updates),1)
        self.assertIn('30s elapsed',updates[0])
        self.assertNotIn('private prompt',updates[0])
    def test_expired_wait_is_a_timeout_not_an_unbounded_poll(self):
        from unittest.mock import patch
        session=self.session([bench.queue.Empty]);session.timeout=10;session.progress=None
        with patch.object(bench.time,'monotonic',side_effect=[0,0,10]):
            with self.assertRaises(TimeoutError):session.send('task')
        self.assertEqual(session.messages.get.call_args.kwargs['timeout'],10)

class SectionSelectionTests(unittest.TestCase):
    def test_targeted_sections_do_not_repeat_other_workloads(self):
        models,tasks=bench.load_specs()
        jobs=bench.build_jobs(models,tasks,1,42)
        for section,count,turns in [('all',131,146),('matrix',120,120),('router',6,6),('continuity',5,20)]:
            with self.subTest(section=section):
                selected=bench.select_jobs(jobs,section)
                self.assertEqual(len(selected),count)
                self.assertEqual(sum(len(j['prompts']) for j in selected),turns)
                if section!='all':self.assertEqual({j['phase'] for j in selected},{section})
    def test_router_dry_run_works_without_credentials(self):
        import subprocess,sys,json,os
        env={k:v for k,v in os.environ.items() if not k.startswith(('TYPESAFE_','ANTHROPIC_'))}
        result=subprocess.run([sys.executable,str(ROOT/'scripts/benchmark.py'),'--dry-run','--section','router'],env=env,text=True,capture_output=True,check=True)
        data=json.loads(result.stdout)
        self.assertEqual(data['section'],'router')
        self.assertEqual(data['sessions'],6)
        self.assertEqual(data['answer_turns'],6)

class ScheduleSchemaTests(unittest.TestCase):
    def test_bad_starts_container_is_scored_as_failure(self):
        _,tasks=bench.load_specs();task=next(t for t in tasks if t['grader']=='schedule')
        self.assertFalse(bench.grade(task,{'starts':list('ABCDEF'),'makespan':10})['passed'])

class RouterApplicationTests(unittest.TestCase):
    def evidence(self,kind='simple'):
        import copy
        model,effort={'simple':('claude-haiku-5-5','low'),'routine':('claude-sonnet-5-5','medium'),'complex':('claude-opus-5-5','high')}[kind]
        request={'model':model,'effort':effort,'apiModel':model}
        turn={'request':request,'response_models':[model],'is_error':False,'subtype':'success'}
        changed=kind!='complex'
        trace={'classifierCalls':1,'dispatchAttempts':int(changed),'confirmedRoutedTurns':int(changed),'trace':{'provider':{'status':'accepted','classification':{'kind':kind,'independent':True}},'application':'confirmed-model' if changed else 'kept','request':copy.deepcopy(request)}}
        return turn,trace
    def test_accepted_label_is_not_an_applied_route(self):
        turn,trace=self.evidence()
        for request in [turn['request'],trace['trace']['request']]:request.update(model='claude-opus-5-5',effort='high',apiModel='claude-opus-5-5')
        turn['response_models']=['claude-opus-5-5']
        trace['trace']['application']='kept';trace['dispatchAttempts']=0;trace['confirmedRoutedTurns']=0
        bench.score_routing(turn,{'kind':'simple'},trace)
        self.assertTrue(turn['classification_passed'])
        self.assertFalse(turn['profile_applied'])
        self.assertFalse(turn['routing_passed'])
    def test_expected_profiles_require_independent_observed_and_trace_evidence(self):
        for kind in ['simple','routine','complex']:
            turn,trace=self.evidence(kind)
            bench.score_routing(turn,{'kind':kind},trace)
            self.assertTrue(turn['routing_passed'],kind)
        turn,trace=self.evidence();trace['trace']['request']['effort']='high'
        bench.score_routing(turn,{'kind':'simple'},trace)
        self.assertFalse(turn['profile_applied'])
    def test_required_switch_needs_confirmation_not_only_matching_model(self):
        for field in ['dispatchAttempts','confirmedRoutedTurns']:
            turn,trace=self.evidence();trace[field]=0
            bench.score_routing(turn,{'kind':'simple'},trace)
            self.assertFalse(turn['routing_passed'])
        turn,trace=self.evidence();trace['trace']['application']='kept'
        bench.score_routing(turn,{'kind':'simple'},trace)
        self.assertFalse(turn['routing_passed'])

class ProvenanceTests(unittest.TestCase):
    def test_source_provenance_records_versions_and_relative_file_hashes(self):
        metadata=bench.source_metadata()
        self.assertRegex(metadata['sha256'],r'^[0-9a-f]{64}$')
        self.assertIn('package_version',metadata)
        self.assertIn('plugin_version',metadata)
        self.assertIn('src/jev.js',metadata['files'])
        self.assertTrue(all(not Path(name).is_absolute() for name in metadata['files']))
