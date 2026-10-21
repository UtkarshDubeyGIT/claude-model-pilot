/** Provider-neutral contract. Strip everything except policy inputs. */
export function normalizeClassification(value) {
  if (!value || !['simple', 'routine', 'complex', 'unknown'].includes(value.kind) ||
      typeof value.independent !== 'boolean' || !Number.isFinite(value.confidence) ||
      value.confidence < 0 || value.confidence > 1) return undefined
  return { kind: value.kind, independent: value.independent, confidence: value.confidence }
}

/** Provider counters are untrusted data too; they must never become trace text. */
export function reportedClassifierTokens(usage) {
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0
  const total = count(usage?.input_tokens) + count(usage?.output_tokens)
  return Number.isSafeInteger(total) ? total : 0
}
