/** Versioned policy profiles, independent of the classifier and host transport. */
export const PROFILE_VERSION = 1
export const PROFILES = {
  simple: { model: 'haiku', effort: 'low' },
  routine: { model: 'sonnet', effort: 'medium' },
  complex: { model: 'opus', effort: 'high' },
}
// Explicit API IDs: turn.step does NOT resolve Claude Code's /model aliases.
// Deployments can override these with ANTHROPIC_DEFAULT_{FAMILY}_MODEL.
export const MODEL_IDS = {
  haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5',
}
export function resolveTarget(target, models = MODEL_IDS) {
  const id = models[target]
  return typeof id === 'string' && id.trim() && !/\s/.test(id) &&
    !['haiku', 'sonnet', 'opus', 'default', 'best', 'opusplan'].includes(id) ? id : null
}
