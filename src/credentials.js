/** Secret values stay in private session memory, never in diagnostics or traces. */
export class Credentials {
  #saved
  #key
  #source = 'none'
  #state = 'missing'
  #generation = 0
  constructor(saved) { this.#saved = saved }
  async resolve(readEnvironment, readSaved) {
    let environment
    try { environment = await readEnvironment() }
    catch { return this.#select(undefined, 'unavailable', 'unavailable') }
    // A nonempty but invalid override must not silently use a different account.
    const override = typeof environment === 'string' && environment.length > 0
    if (!override && readSaved) {
      let result
      try { result = await readSaved() } catch { result = {state:'unavailable'} }
      this.#saved = result.state==='present'?result.key:undefined
      if (!['present','missing'].includes(result.state))return this.#select(undefined,'keychain',result.state==='unsupported'?'unsupported':'unavailable')
    }
    const raw = override ? environment : this.#saved
    const source = override ? 'environment' : raw ? 'saved' : 'none'
    const key = typeof raw === 'string' ? raw.trim() : ''
    const valid = key.length > 0 && key.length <= 4096 && /^[\x21-\x7e]+$/.test(key) && !/[\r\n]/.test(raw)
    return this.#select(valid ? key : undefined, source, raw ? 'invalid' : 'missing')
  }
  #select(key, source, absentState) {
    if (key !== this.#key || source !== this.#source) {
      this.#generation++
      this.#key = key; this.#source = source
      this.#state = key ? 'unverified' : absentState
    } else if (!key) this.#state = absentState
    return {key, generation:this.#generation}
  }
  observe(generation, httpStatus) {
    if (generation !== this.#generation || !this.#key) return
    if (httpStatus >= 200 && httpStatus < 300) this.#state = 'verified'
    else if ([401,403].includes(httpStatus)) this.#state = 'rejected'
    // Transport, quota and server errors are not proof of bad credentials.
  }
  removeSaved() {
    this.#saved = undefined
    if (this.#source === 'saved') this.#select(undefined, 'none', 'missing')
  }
  status() {
    return {source:this.#source, state:this.#state, present:Boolean(this.#key),
      savedConfigured:Boolean(this.#saved), environmentOverridesSaved:this.#source==='environment'&&Boolean(this.#saved)}
  }
}
