import { PROFILES } from './profiles.js'
export const PROTECTION_VERSION = 2
export const COMPARISON_VERSION = 2
/** Pure, conservative policy. Scores are rule thresholds, not calibrated probabilities. */
export function family(model) {
  const value = String(model ?? '').toLowerCase();
  if (/^(haiku|sonnet|opus)$/.test(value)) return value;
  return /^claude-(haiku|sonnet|opus)-\d/.exec(value)?.[1] ?? null;
}

function guardReason(input) {
  const text = String(input.text ?? '').trim();
  const current = family(input.model);
  if (!current) return 'Unknown model or provider mapping; keep your selection.';
  if (input.pinned) return 'Your model choice is pinned.';
  if (input.permissionKnown === false) return 'Permission state is unknown.';
  if (input.planMode) return 'Planning is protected.';
  if (input.activeTask) return 'Ongoing task: preserve its model, effort and context.';
  if (input.attachments) return 'Attached or hidden context needs the selected model.';
  if (!text || text.startsWith('/')) return 'No independent task to route.';
  if (/\b(?:use|stay (?:on|with)|keep|switch to)\s+(?:the\s+)?(?:opus|sonnet|haiku|fable)\b/i.test(text)) return 'Respect the model requested in your prompt.';
  return null;
}
const isIndependent = text => /^(?:unrelated(?: question)?|new (?:topic|task)|separate question)\s*:/i.test(text);
const isRisk = text => /\b(?:architecture|architect|security|authentication|authorization|production|migration|data loss|race condition|deadlock|distributed|cryptograph|vulnerability|bypass|incident)\b/i.test(text);
const isFollowUp = text => /^(?:yes|no|ok(?:ay)?|continue|go ahead|do it|implement it|why|fix that|add tests)[.!?]*$/i.test(text);

/** Whether to ask a provider, independent of context-cost and model selection. */
export function classificationEligibility(input) {
  const text = String(input.text ?? '').trim();
  let reason = guardReason(input);
  const promotion = isRisk(text) && family(input.model) !== 'opus';
  if (!reason && input.activeTask && !isIndependent(text) && !promotion) reason = 'Ongoing task: preserve its reasoning and context.';
  if (!reason && isFollowUp(text)) reason = 'Short follow-ups inherit the task, not a lower tier.';
  if (!reason && (input.sinceSwitch ?? 99) < 3 && !promotion) reason = 'Switch cooldown protects continuity.';
  if (!reason && text.length > 4000) reason = 'Prompt exceeds the classifier input limit.';
  return { eligible: !reason, reason };
}

export function recommend(input) {
  const { model, effort } = input;
  const keep = reason => ({ action: 'keep', model, effort, reason, kind: 'unknown' });
  const text = String(input.text ?? '').trim();
  const current = family(model);
  const guard = guardReason(input);
  if (guard) return keep(guard);
  const eligibility = classificationEligibility(input);
  if (input.requireClassifier && !eligibility.eligible) return keep(eligibility.reason);
  const c = input.classification;
  const valid = c && ['simple', 'routine', 'complex', 'unknown'].includes(c.kind) && typeof c.independent === 'boolean' && typeof c.confidence === 'number' && c.confidence >= 0.95 && c.confidence <= 1;
  if (input.requireClassifier && (!valid || !c.independent || c.kind === 'unknown')) return keep('The provider has no confident independent decision; keep your selection.');
  if (input.requireClassifier && input.requirementsMet !== true) return keep('Candidate quality requirements are unverified.');
  const independent = isIndependent(text);
  const task = text.replace(/^(?:unrelated(?: question)?|new (?:topic|task)|separate question)\s*:\s*/i, '');
  const risk = isRisk(task);
  if (risk && !input.requireClassifier) return keep('High-impact work needs provider quality evidence.');
  if (input.activeTask && !independent) return keep('Ongoing task: preserve its reasoning and context.');
  if (isFollowUp(task)) return keep('Short follow-ups inherit the task, not a lower tier.');
  if ((input.sinceSwitch ?? 99) < 3) return keep('Switch cooldown protects continuity.');
  const work = /\b(?:implement|build|fix|deploy|design|refactor|code|test|debug|analy[sz]e|prove|compare)\b/i.test(task);
  const simple = task.length < 180 && !work && (/^what does [a-z0-9 -]{1,40} stand for\??$/i.test(task) || /^define [a-z -]{1,50}[.?]?$/i.test(task) || /^what is \d+\s*[+*\/-]\s*\d+\??$/i.test(task));

  let kind = input.requireClassifier ? (risk ? 'complex' : c.kind) : simple ? 'simple' : valid && c.independent ? c.kind : 'unknown';
  if (kind === 'unknown') return keep('Ambiguous task: keep the selected model.');
  const profile = (input.profiles ?? PROFILES)[kind];
  if (!profile || !['haiku', 'sonnet', 'opus'].includes(profile.model) || !['low', 'medium', 'high', 'xhigh', 'max'].includes(profile.effort)) return keep('No valid profile for this task.');
  const target = profile.model;
  const targetEffort = profile.effort;
  if (target === current && !['low','medium','high','xhigh','max'].includes(effort)) return keep('Current effort is unknown; effort-only advice is suppressed.');
  if (target === current && targetEffort === effort) return keep('The selected profile fits the available evidence.');
  const ranks = { haiku: 0, sonnet: 1, opus: 2 };
  const levels = ['low','medium','high','xhigh','max'];
  const stronger = ranks[target] > ranks[current] || (target === current && levels.indexOf(targetEffort) > levels.indexOf(effort));
  if (!stronger && ((!Number.isFinite(input.contextTokens) && !input.freshSession) || input.contextTokens > 8000)) return keep('Context reload may outweigh savings; keep the warm session.');
  const benefit = stronger ? 'Stronger reasoning for the required work; expected cost may increase.' : 'Lower expected inference cost; cache reload and Jev overhead may offset it.';
  const tradeoff = stronger ? 'More depth; potentially slower.' : 'May provide less depth or polish; correctness, functionality, safety and required format remain requirements.';
  return { action: 'suggest', model: target, effort: targetEffort, kind, benefit, tradeoff, reason: kind === 'simple' ? 'Independent, bounded question; a smaller model should suffice.' : kind === 'routine' ? 'Independent routine work can use the balanced model.' : 'Complex work merits stronger reasoning.' };
}
