import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../src/policy.js';
const decide = (overrides = {}) => {
  assert.equal(typeof policy.recommend, 'function', 'routing policy must exist');
  return policy.recommend({ text: 'What does HTTP stand for?', model: 'claude-opus-5-5', effort: 'high', turn: 1, contextTokens: 0, ...overrides });
};
test('a standalone definition can use Haiku and low effort', () => {
  const r = decide(); assert.equal(r.model, 'haiku'); assert.equal(r.effort, 'low');
});
test('planning mode preserves the exact selected model and effort', () => {
  const r = decide({ planMode: true }); assert.equal(r.model, 'claude-opus-5-5'); assert.equal(r.effort, 'high');
});
test('brief follow-ups and implementation of a plan retain continuity', () => {
  for (const text of ['yes', 'continue', 'implement it', 'why?', 'fix that', 'add tests']) {
    assert.equal(decide({ text, activeTask: true, turn: 5 }).action, 'keep');
  }
});
test('a selected or pinned model is never overridden', () => {
  assert.equal(decide({ pinned: true }).action, 'keep');
});
test('a long context does not switch for a tiny answer', () => {
  assert.equal(decide({ contextTokens: 25000 }).action, 'keep');
});
test('unknown models, attachments and ambiguous prompts fail conservatively', () => {
  for (const data of [{ model: 'company-custom' }, { attachments: true }, { text: 'make it better' }]) {
    assert.equal(decide(data).action, 'keep');
  }
});
test('a simple question in an active task needs an explicit topic boundary', () => {
  assert.equal(decide({ activeTask: true }).action, 'keep');
  assert.equal(decide({ text: 'Unrelated question: what does HTTP stand for?', activeTask: true }).model, 'haiku');
});
test('risk signals outrank simplicity and promote weak models', () => {
  const r = decide({ model: 'haiku', text: 'Fix a production authentication bypass and data loss bug' });
  assert.equal(r.model, 'opus'); assert.equal(r.effort, 'high');
});
test('code implementation is not classified as a trivial definition', () => {
  assert.equal(decide({ text: 'What does HTTP stand for? Then implement authentication.' }).action, 'keep');
});
test('manual model instructions in the prompt prevent automatic routing', () => {
  assert.equal(decide({ text: 'Use Opus. What does HTTP stand for?' }).action, 'keep');
});
test('cooldown prevents oscillation and low confidence cannot downgrade', () => {
  assert.equal(decide({ sinceSwitch: 1 }).action, 'keep');
  assert.equal(decide({ text: 'Explain a small piece of code', classification: { kind: 'simple', independent: true, confidence: 0.6 } }).action, 'keep');
});
test('validated classifier can suggest a routine task on Sonnet', () => {
  const r = decide({ text: 'Add a tooltip to the save button', classification: { kind: 'routine', independent: true, confidence: 0.98 } });
  assert.equal(r.model, 'sonnet'); assert.equal(r.effort, 'medium');
});
test('malformed classifier output is ignored', () => {
  assert.equal(decide({ text: 'Do this', classification: { kind: 'simple', independent: 'yes', confidence: 1 } }).action, 'keep');
});
test('Jev-primary policy cannot substitute a keyword guess for a missing decision', () => {
  assert.equal(decide({ requireClassifier: true }).action, 'keep');
});
test('Jev-primary policy uses the returned classification ahead of simple keywords', () => {
  assert.equal(decide({ requireClassifier: true, classification: { kind: 'routine', independent: true, confidence: 0.99 } }).model, 'sonnet');
});
test('Jev eligibility does not depend on missing context measurement or current tier', () => {
  assert.equal(policy.classificationEligibility({text:'What does HTTP stand for?',model:'haiku'}).eligible, true);
  assert.equal(policy.classificationEligibility({text:'Continue',model:'opus',activeTask:true}).eligible, false);
});
test('only a verified fresh session may downgrade without context measurement', () => {
  assert.equal(decide({contextTokens:undefined,freshSession:true}).model, 'haiku');
  assert.equal(decide({contextTokens:undefined,freshSession:false}).action, 'keep');
});
test('profile mapping can evolve without changing provider classification', () => {
  const r = decide({profiles:{simple:{model:'sonnet',effort:'medium'}}});
  assert.equal(r.model,'sonnet'); assert.equal(r.effort,'medium');
});
