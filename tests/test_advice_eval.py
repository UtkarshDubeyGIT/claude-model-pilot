import importlib.util
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('advice', ROOT/'scripts/evaluate-advice.py')
advice=importlib.util.module_from_spec(spec);spec.loader.exec_module(advice)
class AdviceEvaluationTests(unittest.TestCase):
 def test_format_failure_is_separate_from_correctness(self):
  r=advice.grade_answer({'answerRubric':{'goldJSON':{'n':2}}},'```json\n{"n":2}\n```')
  self.assertTrue(r['correctness']);self.assertFalse(r['format']);self.assertIsNone(r['depthPolish'])
 def test_human_review_is_never_silently_a_pass(self):
  r=advice.grade_answer({'answerRubric':{'goldJSON':None}},'plausible prose')
  self.assertIsNone(r['correctness']);self.assertIsNone(r['functionality']);self.assertIsNone(r['format'])
 def test_insufficient_evidence_is_a_missed_opportunity_not_justified_silence(self):
  s={'label':{'advice':True,'acceptableProfiles':['haiku/low']}}
  self.assertEqual(advice.outcome(s,{'action':'keep'}),'missed-advice')
  s['label']['advice']=False
  self.assertEqual(advice.outcome(s,{'action':'keep'}),'justified-silence')
 def test_wrong_profile_is_never_useful_advice(self):
  s={'label':{'advice':True,'acceptableProfiles':['opus/high']}}
  self.assertEqual(advice.outcome(s,{'action':'suggest','model':'haiku','effort':'low'}),'ineligible-advice')
