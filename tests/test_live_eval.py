"""The evaluation must fail for the original live results and false switch claims."""
import copy
import importlib.util
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('live_eval', ROOT / 'scripts/live-eval.py')
eval_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(eval_module)

class EvaluationTests(unittest.TestCase):
    def good_case(self):
        return {'scenario': 'simple', 'turns': [{'answer': {'is_error': False, 'subtype': 'success', 'response_models': ['claude-haiku-5-5']}, 'trace': {
            'classifierCalls': 1, 'trace': {'provider': {'status': 'accepted', 'classification': {'kind': 'simple'}},
                'application': 'confirmed-model', 'request': {'model': 'claude-haiku-5-5', 'effort': 'low', 'apiModel': 'claude-haiku-5-5'}}}}]}
    def test_original_failed_routes_do_not_pass(self):
        # Synthetic reproductions retain the original failure modes without
        # depending on private live logs in an open-source checkout.
        for scenario in ['simple', 'routine', 'complex']:
            row = {'scenario':scenario, 'turns':[{'answer':{
                'is_error':False, 'subtype':'success',
                'response_models':['claude-opus-5-5']},
                'status':'Suggest haiku · low effort. Routed turns: 1.'}]}
            self.assertFalse(eval_module.assess(row)['passed'])
    def test_matching_evidence_passes(self):
        self.assertTrue(eval_module.assess(self.good_case())['passed'])
    def test_wrong_effort_model_or_missing_provider_fails(self):
        for field, value in [('model', 'claude-opus-5-5'), ('effort', 'high'), ('apiModel', 'claude-opus-5-5')]:
            row = copy.deepcopy(self.good_case())
            row['turns'][0]['trace']['trace']['request'][field] = value
            self.assertFalse(eval_module.assess(row)['passed'])
        row = self.good_case()
        row['turns'][0]['trace']['classifierCalls'] = 0
        self.assertFalse(eval_module.assess(row)['passed'])
    def test_offline_requires_wire_evidence(self):
        self.assertFalse(eval_module.assess(self.good_case(), offline=True)['passed'])

if __name__ == '__main__': unittest.main()
