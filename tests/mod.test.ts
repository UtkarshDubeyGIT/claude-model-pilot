import { expect, test, mock } from 'claude-code/testing'

function host(on, options = {}) {
  const seen = []
  on('command.run', () => ({ text: 'unhandled' }))
  on('command.register', () => ({ value: undefined }))
  on('session.model', () => ({ value: options.model ?? 'claude-opus-5-5' }))
  on('session.turns', () => ({ value: options.turns ?? 0 }))
  on('session.usage', () => ({ value: { context: { tokens: options.unmeasured ? undefined : 0, window: 200000 }, rateLimits: [], startedAt: 0 } }))
  on('session.start', () => ({ cwd: '/work' }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.PostModelSwitch', () => ({}))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('turn.step', async function* ($, e) {
    seen.push(e)
    yield { kind: 'text', index: 0, text: 'ok' }
    return { turnId: e.turnId, index: e.index, answer: 'ok', toolUses: [], stopReason: 'end_turn', usage: options.usage ?? { model: e.model } }
  })
  return seen
}
async function start($, text = 'What does HTTP stand for?', id = 't', mode = 'default') {
  await $.classic.UserPromptSubmit({ hook_event_name: 'UserPromptSubmit', session_id: 's', transcript_path: '', cwd: '/work', permission_mode: mode, prompt: text })
  await $.turn.start({ text, turnId: id })
}
async function step($, id = 't', index = 0, extra = {}) {
  const stream = $.turn.step({ turnId: id, index, model: 'claude-opus-5-5', effort: 'high', messageCount: 1, ...extra })
  let s = await stream.next(); while (!s.done) s = await stream.next()
  return s.value
}
test('route command explains advisory defaults', async ($, on) => {
  mock.env(on, {})
  host(on)
  const r = await $.command.run({ command: 'route', args: '' })
  expect(r.text).toContain('advise')
})
test('profiles lists the active profile policy and resolved deployment IDs without enabling routing', async ($, on) => {
  host(on)
  mock.env(on, { ANTHROPIC_BASE_URL: 'https://example.invalid', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'tenant-small' })
  const r = JSON.parse((await $.command.run({ command: 'route', args: 'profiles' })).text)
  expect(r.schemaVersion).toBe(1)
  expect(r.profileVersion).toBe(1)
  expect(r.profiles.simple).toEqual({ model: 'haiku', effort: 'low' })
  expect(r.profiles.routine).toEqual({ model: 'sonnet', effort: 'medium' })
  expect(r.profiles.complex).toEqual({ model: 'opus', effort: 'high' })
  expect(r.modelIds.haiku).toBe('tenant-small')
  expect(r.modelIds.sonnet).toBe(null)
  expect((await $.command.run({ command: 'route', args: 'status' })).text).toContain('advise')
})
test('advisory mode leaves the request untouched', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  await start($); await step($)
  expect(seen[0].model).toBe('claude-opus-5-5')
  expect(seen[0].effort).toBe('high')
})
test('explicit auto routes all steps of a simple turn consistently', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  await $.command.run({ command: 'route', args: 'classifier off' })
  await $.command.run({ command: 'route', args: 'auto' })
  await start($); await step($); await step($, 't', 1)
  expect(seen.map(x => x.model)).toEqual(['claude-haiku-5-5', 'claude-haiku-5-5'])
  expect(seen[0].effort).toBe('low')
})
test('plan mode protects the selected model even with auto enabled', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  await $.command.run({ command: 'route', args: 'auto' })
  await start($, undefined, 't', 'plan'); await step($)
  expect(seen[0].model).toBe('claude-opus-5-5')
})
test('subagents and unrelated turn IDs are untouched', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  await $.command.run({ command: 'route', args: 'auto' }); await start($)
  await step($, 't', 0, { agentId: 'agent' }); await step($, 'other')
  expect(seen.map(x => x.model)).toEqual(['claude-opus-5-5', 'claude-opus-5-5'])
})
test('manual model selection pins and cancels pending routing', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  await $.command.run({ command: 'route', args: 'auto' }); await start($)
  await $.classic.PostModelSwitch({ hook_event_name: 'PostModelSwitch', session_id: 's', transcript_path: '', cwd: '/work', from_model: 'opus', to_model: 'opus', requested_model: 'opus', source: 'picker', context_tokens: 0, prompt_cache_warm: false, cache_ttl: '5m', estimated_cache_write_usd: 0, pricing: 'catalog' })
  await step($)
  expect(seen[0].model).toBe('claude-opus-5-5')
})
test('classifier failure passes the original request through', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  on('model.complete', () => ({ value: { isAnswered: false, reason: 'api-error' } }))
  await $.command.run({ command: 'route', args: 'auto' })
  await $.command.run({ command: 'route', args: 'classifier haiku' })
  await start($, 'Add a tooltip to the save button'); await step($)
  expect(seen[0].model).toBe('claude-opus-5-5')
})
test('an enabled optional classifier cannot silently fall back to simple keywords', async ($, on) => {
  const seen = host(on)
  mock.env(on, {})
  on('model.complete', () => ({ value: { isAnswered: false, reason: 'api-error' } }))
  await $.command.run({ command: 'route', args: 'auto' })
  await $.command.run({ command: 'route', args: 'classifier haiku' })
  await start($); await step($)
  expect(seen[0].model).toBe('claude-opus-5-5')
  expect(seen[0].effort).toBe('high')
})

test('classifier success routes a routine task and retains it for follow-up', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  on('model.complete', () => ({ value: { isAnswered: true, text: '{"kind":"routine","independent":true,"confidence":0.98}', usage: { input_tokens: 30, output_tokens: 15 } } }))
  await $.command.run({ command: 'route', args: 'auto' })
  await $.command.run({ command: 'route', args: 'classifier haiku' })
  await start($, 'Add a tooltip to the save button'); await step($)
  await start($, 'Add tests for it', 't2'); await step($, 't2')
  expect(seen.map(x => x.model)).toEqual(['claude-sonnet-5-5', 'claude-sonnet-5-5'])
})
test('unknown permission mode never routes', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  await $.command.run({ command: 'route', args: 'auto' })
  await $.turn.start({ text: 'What does HTTP stand for?', turnId: 't' }); await step($)
  expect(seen[0].model).toBe('claude-opus-5-5')
})
test('host fallback on first step is respected', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  await $.command.run({ command: 'route', args: 'auto' })
  await start($); await step($, 't', 0, { model: 'claude-sonnet-5-5' })
  expect(seen[0].model).toBe('claude-sonnet-5-5')
})
test('attachments prevent automatic downgrade', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await $.command.run({ command: 'route', args: 'auto' })
  await $.prompt.submit({ text: 'What does HTTP stand for?', attachments: [{ type: 'image', source: 'image' }] })
  await start($); await step($)
  expect(seen[0].model).toBe('claude-opus-5-5')
})
test('session start registers route and protects a resumed task', async ($, on) => {
  mock.env(on, {})
  const seen = host(on, { turns: 9 })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const r = await $.command.run({ command: 'route', args: '' })
  expect(r.text).toContain('ongoing task protected')
  await $.command.run({ command: 'route', args: 'auto' })
  await start($); await step($)
  expect(seen[0].model).toBe('claude-opus-5-5')
})
test('draft edits provide advice without modifying text or calling a model', async ($, on) => {
  mock.env(on, {})
  host(on)
  on('prompt.edit', ($, e) => ({ text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: e.start + e.inputText.length }))
  const r = await $.prompt.edit({ origin: { kind: 'composer' }, text: 'What does ', cursor: 10, start: 10, end: 10, inputText: 'HTTP stand for?' })
  expect(r.text).toBe('What does HTTP stand for?')
})
test('routine follow-up retains its chosen reasoning effort', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  on('model.complete', () => ({ value: { isAnswered: true, text: '{"kind":"routine","independent":true,"confidence":0.98}' } }))
  await $.command.run({ command: 'route', args: 'auto' })
  await $.command.run({ command: 'route', args: 'classifier haiku' })
  await start($, 'Add a tooltip'); await step($)
  await start($, 'Add tests', 't2'); await step($, 't2')
  expect(seen.map(x => x.effort)).toEqual(['medium', 'medium'])
})
test('entering planning discards an old automatic work model', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  on('model.complete', () => ({ value: { isAnswered: true, text: '{"kind":"routine","independent":true,"confidence":0.98}' } }))
  await $.command.run({ command: 'route', args: 'auto' })
  await $.command.run({ command: 'route', args: 'classifier haiku' })
  await start($, 'Add a tooltip'); await step($)
  await start($, 'Plan the next feature', 't2', 'plan'); await step($, 't2')
  await start($, 'Implement it', 't3'); await step($, 't3')
  expect(seen.map(x => x.model)).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5-5'])
})
test('observed usage includes input, output, cache reads and writes separately', async ($, on) => {
  mock.env(on, {})
  host(on, { usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40, model: 'claude-opus-5-5' } })
  await start($); await step($)
  const r = await $.command.run({ command: 'route', args: 'status' })
  expect(r.text).toContain('Observed main requests: input 10, output 20, cache read 30, cache write 40')
})
test('terminal advice composes with other mods in the prompt band', async ($, on) => {
  mock.env(on, {})
  host(on)
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['Other mod'] }))
  on('prompt.edit', ($, e) => ({ text: e.inputText, cursor: e.inputText.length }))
  await $.command.run({ command: 'route', args: 'classifier off' })
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.classic.UserPromptSubmit({ hook_event_name: 'UserPromptSubmit', session_id: 's', transcript_path: '', cwd: '/work', permission_mode: 'default', prompt: '' })
  await $.prompt.edit({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: 'What does HTTP stand for?' })
  const ui = await $.ui.mount({ plugin: 'model-pilot', surface: 'terminal', component: 'AbovePrompt', props: {} })
  expect(await ui.find({ type: 'Text', text: /Suggest haiku/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Other mod/ })).toBeDefined()
  await ui.unmount()
})
test('a queued prompt remains protected after the preceding turn completes', async ($, on) => {
  mock.env(on, {})
  const seen = host(on)
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.complete', () => ({ text: '' }))
  await $.command.run({ command: 'route', args: 'auto' })
  await start($, 'What does DNS stand for?', 'previous')
  await $.prompt.submit({ text: 'What does HTTP stand for?', turnId: 'previous', wait: true })
  await $.turn.complete({ turnId: 'previous', isAborted: false, answer: 'Domain Name System', durationMs: 1, usage: null })
  await start($); await step($)
  expect(seen[0].model).toBe('claude-opus-5-5')
})

test('Jev cannot be enabled without a key and never prints the key', async ($, on) => {
  mock.env(on, {})
  host(on)
  const r = await $.command.run({ command: 'route', args: 'classifier jev' })
  expect(r.text).toContain('TYPESAFE_API_KEY')
  expect(r.text).toContain('not enabled')
})
test('Jev sends bearer authentication to TypeSafe and routes a typed answer', async ($, on) => {
  const seen = host(on)
  let request
  on('env.get', ($, e) => ({ value: e.name === 'TYPESAFE_API_KEY' ? 'test-only-key' : undefined }))
  mock.clock(on)
  on('http.fetch', ($, e) => {
    request = e
    return { value: { ok: true, status: 200, headers: {}, text: JSON.stringify({ answers: {
      complexity: { type: 'choice', choice: 'routine', confidence: 1, probabilities: { simple: 0, routine: 1, complex: 0, unknown: 0 } },
      independence: { type: 'choice', choice: 'independent', confidence: 1, probabilities: { independent: 1, dependent: 0 } }
    }, usage: { input_tokens: 40, output_tokens: 10 } }) } }
  })
  await $.command.run({ command: 'route', args: 'auto' })
  const r = await $.command.run({ command: 'route', args: 'classifier jev' })
  expect(r.text.includes('test-only-key')).toBe(false)
  await start($, 'Add a tooltip'); await step($)
  expect(request.url).toBe('https://api.typesafe.ai/v1/systemone')
  expect(request.init.headers.Authorization).toBe('Bearer test-only-key')
  expect(seen[0].model).toBe('claude-sonnet-5-5')
})
test('TypeSafe rejection preserves the original request without exposing response details', async ($, on) => {
  const seen = host(on)
  mock.env(on, { TYPESAFE_API_KEY: 'test-only-key' })
  mock.clock(on)
  on('http.fetch', () => ({ value: { ok: false, status: 401, headers: {}, text: 'sensitive-provider-detail' } }))
  await $.command.run({ command: 'route', args: 'auto' })
  await $.command.run({ command: 'route', args: 'classifier jev' })
  await start($, 'Add a tooltip'); await step($)
  expect(seen[0].model).toBe('claude-opus-5-5')
  const r = await $.command.run({ command: 'route', args: 'status' })
  expect(r.text.includes('sensitive-provider-detail')).toBe(false)
})
test('Jev deadline continues on the original model and ignores a late answer', async ($, on) => {
  const seen = host(on)
  mock.env(on, { TYPESAFE_API_KEY: 'test-only-key' })
  const clock = mock.clock(on)
  on('http.fetch', async () => {
    await clock.sleep(5000)
    return { value: { ok: true, status: 200, headers: {}, text: JSON.stringify({ answers: {
      complexity: { type: 'choice', choice: 'routine', confidence: 1, probabilities: { simple: 0, routine: 1, complex: 0, unknown: 0 } },
      independence: { type: 'choice', choice: 'independent', confidence: 1, probabilities: { independent: 1, dependent: 0 } }
    } }) } }
  })
  await $.command.run({ command: 'route', args: 'auto' })
  await $.command.run({ command: 'route', args: 'classifier jev' })
  const starting = start($, 'Add a tooltip')
  await clock.settle(); await clock.advance(1500); await starting
  await step($); await clock.advance(3500); await step($, 't', 1)
  expect(seen.map(e => e.model)).toEqual(['claude-opus-5-5', 'claude-opus-5-5'])
})
test('Jev is the default decision model even for a keyword-simple question', async ($, on) => {
  const seen = host(on)
  mock.env(on, { TYPESAFE_API_KEY: 'test-only-key' })
  mock.clock(on)
  let calls = 0
  on('http.fetch', () => {
    calls += 1
    return { value: { ok: true, status: 200, headers: {}, text: JSON.stringify({ answers: {
      complexity: { type: 'choice', choice: 'routine', confidence: 1, probabilities: { simple: 0, routine: 1, complex: 0, unknown: 0 } },
      independence: { type: 'choice', choice: 'independent', confidence: 1, probabilities: { independent: 1, dependent: 0 } }
    } }) } }
  })
  await $.command.run({ command: 'route', args: 'auto' })
  await start($); await step($)
  expect(calls).toBe(1)
  expect(seen[0].model).toBe('claude-sonnet-5-5')
})
test('default Jev with no key preserves even a keyword-simple request', async ($, on) => {
  const seen = host(on)
  mock.env(on, {})
  await $.command.run({ command: 'route', args: 'auto' })
  await start($); await step($)
  expect(seen[0].model).toBe('claude-opus-5-5')
})
test('status records outgoing model and effort plus the model reported by the API', async ($, on) => {
  host(on, { usage: { model: 'claude-opus-5-5', input_tokens: 1, output_tokens: 1 } })
  await start($, 'Plan an authentication service', 't', 'plan'); await step($)
  const r = await $.command.run({ command: 'route', args: 'status' })
  expect(r.text).toContain('Last request: claude-opus-5-5 / high; API model: claude-opus-5-5')
})

function fakeJev(on, kind = 'simple') {
  mock.env(on, { TYPESAFE_API_KEY: 'test-only-key' })
  mock.clock(on)
  let calls = 0
  on('http.fetch', () => {
    calls++
    return { value: { ok: true, status: 200, headers: {}, text: JSON.stringify({ answers: {
      complexity: { type: 'choice', choice: kind, confidence: 1, probabilities: { simple: 0, routine: 0, complex: 0, unknown: 0, [kind]: 1 } },
      independence: { type: 'choice', choice: 'independent', confidence: 1, probabilities: { independent: 1, dependent: 0 } }
    } }) } }
  })
  return () => calls
}
test('fresh unmeasured session calls Jev and sends a concrete model ID', async ($, on) => {
  const seen = host(on, { unmeasured: true })
  const calls = fakeJev(on)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'route', args: 'auto' })
  await start($); await step($)
  expect(calls()).toBe(1)
  expect(seen[0].model).toBe('claude-haiku-5-5')
  expect(seen[0].effort).toBe('low')
})
test('complex promotion sends a full model ID and high effort', async ($, on) => {
  const seen = host(on, { model: 'claude-sonnet-5', unmeasured: true })
  fakeJev(on, 'complex')
  await $.command.run({ command: 'route', args: 'auto' })
  await start($, 'Design a production migration')
  await step($, 't', 0, { model: 'claude-sonnet-5', effort: 'medium' })
  expect(seen[0].model).toBe('claude-opus-5-5')
  expect(seen[0].effort).toBe('high')
})
test('an API model mismatch must not count as a confirmed switch', async ($, on) => {
  host(on, { usage: { model: 'claude-opus-5-5' } })
  fakeJev(on)
  await $.command.run({ command: 'route', args: 'auto' })
  await start($); await step($)
  const r = await $.command.run({ command: 'route', args: 'status' })
  expect(r.text).toContain('Confirmed routed turns: 0')
  expect(r.text).toContain('model-mismatch')
})
test('Opus plan, follow-ups and simple aside never call Jev', async ($, on) => {
  const seen = host(on, { unmeasured: true })
  const calls = fakeJev(on)
  await $.command.run({ command: 'route', args: 'auto' })
  for (const [index, text] of ['Plan an authentication service', 'Continue', 'What does HTTP stand for?', 'Implement it'].entries()) {
    await start($, text, 'p' + index, index < 3 ? 'plan' : 'default')
    await step($, 'p' + index)
  }
  expect(calls()).toBe(0)
  expect(seen.every(e => e.model === 'claude-opus-5-5' && e.effort === 'high')).toBe(true)
})
test('a gateway model target uses the explicit deployment mapping', async ($, on) => {
  const seen = host(on)
  mock.env(on, { ANTHROPIC_BASE_URL: 'https://example.invalid', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'tenant-small' })
  await $.command.run({ command: 'route', args: 'classifier off' })
  await $.command.run({ command: 'route', args: 'auto' })
  await start($); await step($)
  expect(seen[0].model).toBe('tenant-small')
  const trace = JSON.parse((await $.command.run({ command: 'route', args: 'trace' })).text)
  expect(trace.trace.application).toBe('confirmed-model')
})
test('an unmapped gateway never sends a guessed model ID', async ($, on) => {
  const seen = host(on)
  mock.env(on, { ANTHROPIC_BASE_URL: 'https://example.invalid' })
  await $.command.run({ command: 'route', args: 'classifier off' })
  await $.command.run({ command: 'route', args: 'auto' })
  await start($); await step($)
  expect(seen[0].model).toBe('claude-opus-5-5')
  expect((await $.command.run({ command: 'route', args: 'status' })).text).toContain('unmapped-target')
})
test('new task in a resumed unmeasured session calls Jev but cannot downgrade', async ($, on) => {
  const seen = host(on, { turns: 8, unmeasured: true })
  const calls = fakeJev(on)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'route', args: 'auto' })
  await $.command.run({ command: 'route', args: 'new' })
  await start($); await step($)
  expect(calls()).toBe(1)
  expect(seen[0].model).toBe('claude-opus-5-5')
})
test('host fallback after dispatch wins and does not retain the routed work profile', async ($, on) => {
  const seen = host(on)
  fakeJev(on, 'routine')
  await $.command.run({ command: 'route', args: 'auto' })
  await start($, 'Write a sorting function'); await step($)
  await step($, 't', 1, { model: 'claude-haiku-5-5', effort: 'low' })
  await start($, 'Continue', 'follow'); await step($, 'follow')
  expect(seen.map(e => e.model)).toEqual(['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'])
})
test('trace distinguishes provider choice, policy decision, dispatch and API model', async ($, on) => {
  host(on)
  fakeJev(on, 'routine')
  await $.command.run({ command: 'route', args: 'auto' })
  await start($, 'Write a sorting function'); await step($)
  const result = (await $.command.run({ command: 'route', args: 'trace' })).text
  const trace = JSON.parse(result)
  expect(trace.schemaVersion).toBe(1)
  expect(trace.trace.provider.classification.kind).toBe('routine')
  expect(trace.trace.decision.effort).toBe('medium')
  expect(trace.trace.request.model).toBe('claude-sonnet-5-5')
  expect(trace.trace.request.apiModel).toBe('claude-sonnet-5-5')
  expect(trace.confirmedRoutedTurns).toBe(1)
  expect(result.includes('test-only-key')).toBe(false)
  expect(result.includes('Write a sorting')).toBe(false)
})
test('provider trace strips unrelated fields from the optional Haiku response', async ($, on) => {
  host(on)
  mock.env(on, {})
  on('model.complete', () => ({ value: { isAnswered: true, text: '{"kind":"routine","independent":true,"confidence":0.99,"echo":"private-prompt-copy"}' } }))
  await $.command.run({ command: 'route', args: 'classifier haiku' })
  await start($, 'Write a sorting function'); await step($)
  const trace = (await $.command.run({ command: 'route', args: 'trace' })).text
  expect(trace.includes('private-prompt-copy')).toBe(false)
})
test('structured trace includes reported classifier tokens for benchmark overhead', async ($, on) => {
  host(on)
  fakeJev(on)
  await start($); await step($)
  const trace = JSON.parse((await $.command.run({ command: 'route', args: 'trace' })).text)
  expect(trace.classifierTokens).toBe(0)
})

test('an abstention records its exact gate and safe signals while preserving model and effort', async ($, on) => {
  const seen = host(on)
  mock.env(on, { TYPESAFE_API_KEY: 'test-only-key' })
  mock.clock(on)
  on('http.fetch', () => ({ value: { ok: true, status: 200, headers: {}, text: JSON.stringify({
    model: 'jev-1.13.0', echo: 'private-prompt-copy', answers: {
      complexity: { type: 'choice', choice: 'simple', confidence: 0.8, probabilities: { simple: 0.98, routine: 0.01, complex: 0.01, unknown: 0 } },
      independence: { type: 'choice', choice: 'independent', confidence: 1, probabilities: { independent: 1, dependent: 0 } }
    }, usage: { input_tokens: 50, output_tokens: 20 }
  }) } }))
  await $.command.run({ command: 'route', args: 'auto' })
  await start($); await step($)
  const raw = (await $.command.run({ command: 'route', args: 'trace' })).text
  const trace = JSON.parse(raw)
  expect(trace.trace.provider.status).toBe('abstained')
  expect(trace.trace.provider.reasons).toEqual(['complexity:low-confidence'])
  expect(trace.trace.provider.signals.complexity.confidence).toBe(0.8)
  expect(trace.trace.provider.model).toBe('jev-1.13.0')
  expect(trace.trace.provider.policy.minConfidence).toBe(0.95)
  expect(trace.trace.provider.questionVersion).toBe(2)
  expect(trace.dispatchAttempts).toBe(0)
  expect(trace.classifierTokens).toBe(70)
  expect(seen[0].model).toBe('claude-opus-5-5')
  expect(seen[0].effort).toBe('high')
  expect(raw.includes('private-prompt-copy')).toBe(false)
  expect(raw.includes('test-only-key')).toBe(false)
  const status = (await $.command.run({ command: 'route', args: 'status' })).text
  expect(status).toContain('complexity:low-confidence')
})

test('provider usage fields cannot inject arbitrary text into the public trace', async ($, on) => {
  host(on)
  mock.env(on, { TYPESAFE_API_KEY: 'test-only-key' })
  mock.clock(on)
  on('http.fetch', () => ({ value: { ok: true, status: 200, headers: {}, text: JSON.stringify({
    answers: {}, usage: { input_tokens: 'private-prompt-copy', output_tokens: -5 }
  }) } }))
  await start($); await step($)
  const raw = (await $.command.run({ command: 'route', args: 'trace' })).text
  expect(raw.includes('private-prompt-copy')).toBe(false)
  expect(JSON.parse(raw).classifierTokens).toBe(0)
})
