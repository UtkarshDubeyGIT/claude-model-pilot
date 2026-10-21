import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/jev.js';
const fixture = () => ({ answers: {
  requirements: {type:'choice',choice:'sufficient',confidence:1,probabilities:{sufficient:1,uncertain:0}},
  complexity: { type: 'choice', choice: 'routine', confidence: 0.98, probabilities: { simple: 0.005, routine: 0.98, complex: 0.01, unknown: 0.005 } },
  independence: { type: 'choice', choice: 'independent', confidence: 0.98, probabilities: { independent: 0.99, dependent: 0.01 } }
}});
test('Jev request asks atomic complexity and independence questions', () => {
  assert.equal(typeof api.jevRequest, 'function');
  const r = api.jevRequest('Add a tooltip', 'jev-latest');
  assert.equal(r.model, 'jev-latest'); assert.equal(r.state.prompt, 'Add a tooltip');
  assert.deepEqual(Object.keys(r.questions), ['complexity', 'independence', 'requirements']);
});
test('Jev rubric separates supplied context and mechanical work from difficult open-ended reasoning', () => {
  const r = api.jevRequest('Return only JSON for this self-contained task.');
  assert.match(r.questions.complexity.criteria.simple, /arithmetic/);
  assert.match(r.questions.complexity.criteria.routine, /tracing/);
  assert.match(r.questions.complexity.instructions, /not the number of sentences/);
  assert.match(r.questions.independence.criteria.independent, /code supplied/);
  assert.match(r.questions.independence.instructions, /output format/);
  assert.equal(api.JEV_QUESTION_VERSION, 3);
});
test('Jev typed choices map to the conservative routing contract', () => {
  assert.equal(typeof api.parseJev, 'function');
  assert.deepEqual(api.parseJev(fixture()), { kind: 'routine', independent: true, confidence: 0.98 });
});
test('uncertainty, dependencies, malformed probabilities and unknown labels abstain', () => {
  assert.equal(typeof api.parseJev, 'function');
  for (const change of [
    r => r.answers.complexity.confidence = 0.5,
    r => r.answers.independence.choice = 'dependent',
    r => r.answers.complexity.probabilities.routine = 2,
    r => r.answers.complexity.choice = 'invented',
    r => delete r.answers.independence,
  ]) { const r = fixture(); change(r); assert.equal(api.parseJev(r), undefined); }
  assert.equal(api.parseJev(null), undefined);
});

test('Jev evaluation explains low confidence without discarding typed evidence', () => {
  assert.equal(typeof api.evaluateJev, 'function');
  const r = fixture();
  r.model = 'jev-1.13.0';
  r.answers.complexity.confidence = 0.7;
  const result = api.evaluateJev(r);
  assert.equal(result.status, 'abstained');
  assert.equal(result.classification, undefined);
  assert.deepEqual(result.reasons, ['complexity:low-confidence']);
  assert.equal(result.signals.complexity.choice, 'routine');
  assert.equal(result.signals.complexity.confidence, 0.7);
  assert.equal(result.signals.complexity.probabilities.routine, 0.98);
  assert.equal(result.model, 'jev-1.13.0');
  assert.deepEqual(result.policy, { version: 1, minConfidence: 0.95, minSelectedProbability: 0.95 });
});

test('Jev evaluation separates dependent tasks and unknown complexity from malformed responses', () => {
  assert.equal(typeof api.evaluateJev, 'function');
  const dependent = fixture();
  dependent.answers.independence = { type: 'choice', choice: 'dependent', confidence: 1, probabilities: { independent: 0, dependent: 1 } };
  assert.deepEqual(api.evaluateJev(dependent).reasons, ['independence:dependent-task']);
  const unknown = fixture();
  unknown.answers.complexity = { type: 'choice', choice: 'unknown', confidence: 1, probabilities: { simple: 0, routine: 0, complex: 0, unknown: 1 } };
  assert.deepEqual(api.evaluateJev(unknown).reasons, ['complexity:unknown-task']);
  assert.equal(api.evaluateJev(null).status, 'invalid-response');
});

test('Jev evidence rejects malformed distributions and never forwards arbitrary provider fields', () => {
  assert.equal(typeof api.evaluateJev, 'function');
  const r = fixture();
  r.model = 'private-prompt-copy';
  r.echo = 'private-prompt-copy';
  r.answers.complexity.choice = 'private-prompt-copy';
  r.answers.complexity.probabilities['private-prompt-copy'] = 1;
  r.answers.independence.explanation = 'private-prompt-copy';
  const result = api.evaluateJev(r);
  assert.equal(result.status, 'invalid-response');
  assert.deepEqual(result.reasons, ['complexity:invalid-choice']);
  assert.equal(result.signals.complexity, undefined);
  assert.equal(JSON.stringify(result).includes('private-prompt-copy'), false);
});

test('Jev policy requires both concentration confidence and selected probability', () => {
  assert.equal(typeof api.evaluateJev, 'function');
  const r = fixture();
  r.answers.complexity.probabilities = { simple: 0.1, routine: 0.8, complex: 0.1, unknown: 0 };
  assert.deepEqual(api.evaluateJev(r).reasons, ['complexity:low-selected-probability']);
  r.answers.complexity.probabilities.routine = 0.7;
  assert.deepEqual(api.evaluateJev(r).reasons, ['complexity:invalid-probabilities']);
});

test('uncertain correctness or required format vetoes advice',()=>{const r=fixture();r.answers.requirements={type:'choice',choice:'uncertain',confidence:1,probabilities:{sufficient:0,uncertain:1}};assert.equal(api.evaluateJev(r).status,'abstained')});
