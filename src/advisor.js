/** Session-memory consent ledger. Never serialize this object (it holds a draft).
 * Only `record` and counters are safe diagnostics. No acceptance survives reload. */
export const PRESENTATION_VERSION = 3
export class Advisor {
  constructor() {
    this.text = ''; this.revision = 0; this.task = 0; this.serial = 0
    this.record = null; this.dismissed = new Set()
    this.counters = { suggested: 0, accepted: 0, dispatched: 0, confirmed: 0 }
  }
  edit(text) {
    if (text === this.text) return false
    this.text = text; this.invalidate(); return true
  }
  invalidate(newTask = false) {
    this.revision++
    if (this.record && ['suggested','accepted'].includes(this.record.acceptance)) this.record.acceptance = 'invalidated'
    if (newTask) { this.task++; this.dismissed.clear() }
  }
  offer(decision, current, key = '') {
    if (decision.action !== 'suggest' || (key && this.dismissed.has(key))) return null
    this.record = { id: `r${++this.serial}`, current: { model: current.model, effort: current.effort ?? null },
      proposed: { model: decision.model, effort: decision.effort }, benefit: decision.benefit,
      tradeoff: decision.tradeoff, evidenceStatus: 'confident-provider-estimate', kind: decision.kind,
      taskRevision: this.task, draftRevision: this.revision, acceptance: 'suggested' }
    this.key = key; this.counters.suggested++; return this.record
  }
  valid(id) { return this.record?.id === id && this.record.taskRevision === this.task && this.record.draftRevision === this.revision }
  accept(id) {
    if (!this.valid(id) || this.record.acceptance !== 'suggested') return false
    this.record.acceptance = 'accepted'; this.counters.accepted++; return true
  }
  dismiss(id) {
    if (!this.valid(id) || !['suggested','accepted'].includes(this.record.acceptance)) return false
    this.record.acceptance = 'dismissed'; if (this.key) this.dismissed.add(this.key); return true
  }
  submit(text) {
    const record = this.record
    const accepted = record && this.valid(record.id) && record.acceptance === 'accepted' && this.text === text
    if (accepted) record.acceptance = 'consumed'
    this.invalidate()
    return accepted ? { ...record, current: { ...record.current }, proposed: { ...record.proposed } } : null
  }
}
