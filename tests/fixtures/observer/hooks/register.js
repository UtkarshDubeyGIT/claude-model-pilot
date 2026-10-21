let requests = []
export function register(on) {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'bench-observe', description: 'Read benchmark request observations' })
    return next(e)
  })
  on('turn.start', ($, e, next) => { requests = []; return next(e) })
  on('turn.step', async function* ($, e, next) {
    const item = { model: e.model, effort: e.effort, step: e.index }
    if (!e.agentId) requests.push(item)
    const result = yield* next(e)
    item.apiModel = result.usage?.model
    return result
  })
  on('command.run', { command: 'bench-observe' }, () => ({ text: JSON.stringify({ schemaVersion: 1, requests }) }))
}
