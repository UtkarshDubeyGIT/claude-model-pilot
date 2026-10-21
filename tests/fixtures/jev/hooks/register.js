// Loaded ONLY by live-eval.py --offline in an isolated, temporary Claude config.
export function register(on) {
  on('http.fetch', ($, e) => {
    if (e.url !== 'https://api.typesafe.ai/v1/systemone') throw new Error('Unexpected HTTP destination in offline test')
    const body = JSON.parse(e.init.body)
    if (e.init.headers.Authorization !== 'Bearer offline-fixture' || !body.questions.complexity || !body.questions.independence) throw new Error('Bad Jev contract')
    const prompt = body.state.prompt
    const kind = prompt.includes('sumPositive') ? 'routine' : prompt.includes('migration') ? 'complex' : 'simple'
    return { value: { ok: true, status: 200, headers: {}, text: JSON.stringify({ answers: {
      complexity: { type: 'choice', choice: kind, confidence: 1, probabilities: { simple: 0, routine: 0, complex: 0, unknown: 0, [kind]: 1 } },
      independence: { type: 'choice', choice: 'independent', confidence: 1, probabilities: { independent: 1, dependent: 0 } },
    }, usage: { input_tokens: 20, output_tokens: 10 } }) } }
  })
}
