import { recommend, family, classificationEligibility, PROTECTION_VERSION, COMPARISON_VERSION } from '../src/policy.js'
import { reportedClassifierTokens } from '../src/classification.js'
import { MODEL_IDS, PROFILES, PROFILE_VERSION, resolveTarget } from '../src/profiles.js'
import { jevRequest, evaluateJev, JEV_QUESTION_VERSION } from '../src/jev.js'
import { Advisor, PRESENTATION_VERSION } from '../src/advisor.js'

const advisor = new Advisor()
let mode = 'advise', classifier = 'jev', pinned = false
let permissionValue
let permissionKnown = false, planMode = true, activeTask = false, freshSession = false
let model = '', effort, contextTokens, modelIds = { ...MODEL_IDS }
let controlDraft = false, clearTimer, clearing = false
let timer, physicalFlight = false, lastCall = -Infinity, busy = false
let attachments = false, queueProtected = false, pending = null, submitted = null, sticky = null
let trace = null, classifierCalls = 0, classifierTokens = 0
let assessmentRevision = -1, assessmentPhase = null
const cache = new Map() // Bounded, session-only; never serialized.
const versions = { assessment: JEV_QUESTION_VERSION, protection: PROTECTION_VERSION, comparison: COMPARISON_VERSION, presentation: PRESENTATION_VERSION, profiles: PROFILE_VERSION }
const validEffort = value => ['low','medium','high','xhigh','max'].includes(value)
const sameModel = (actual, expected) => actual === expected || (['haiku','sonnet','opus'].includes(expected) && family(actual) === expected)
const render = $ => { try { $.ui.invalidate('ui.render') } catch {} }
function invalidate($, newTask = false) { timer?.cancel(); advisor.invalidate(newTask); submitted = null; if(pending)pending.profile=null; render($) }
function input(text) {
  return {text, model: sticky?.model || model, effort: sticky?.effort ?? effort, pinned, permissionKnown,
    planMode, activeTask, freshSession, contextTokens, attachments: attachments || queueProtected}
}
function contextKey() { return JSON.stringify([model,effort,permissionKnown,planMode,activeTask,pinned,advisor.task,contextTokens,freshSession,attachments,queueProtected]) }
// Presentation only: rendering never reads a draft, calls Jev or authorizes a change.
function bandStatus() {
  if(mode==='off')return 'off'
  if(classifier!=='jev')return 'Jev disabled'
  if(pinned)return 'model pinned'
  if(!permissionKnown)return 'waiting for session state'
  if(planMode)return 'planning protected'
  if(activeTask)return 'task protected'
  if(attachments||queueProtected)return 'attached or queued context protected'
  const r=advisor.record
  if(r&&advisor.valid(r.id))return {suggested:'advice ready',accepted:'accepted · send matching draft',dismissed:'suggestion dismissed'}[r.acceptance] || 'waiting for draft'
  if(!advisor.text.trim())return 'ready for a new draft'
  if(assessmentRevision!==advisor.revision)return 'waiting for typing to pause'
  if(assessmentPhase)return assessmentPhase
  const p=trace?.provider
  if(p?.status==='missing-key')return 'TypeSafe key missing'
  if(p?.status==='abstained')return 'insufficient evidence'
  if(['timeout-or-network-error','http-error','invalid-response'].includes(p?.status))return 'Jev unavailable'
  if(trace?.application==='unmapped-target')return 'target mapping missing'
  if(p?.status==='skipped')return 'draft protected'
  if(trace?.decision?.action==='keep')return 'no change suggested'
  return 'waiting for assessment'
}
function assessmentSummary() {
  const p=trace?.provider
  if (!p) return 'No draft assessment yet.'
  const provider=[p.status, p.reason, ...(p.reasons || [])].filter(Boolean).join('; ')
  return [provider, trace?.decision?.reason, trace?.application==='unmapped-target'?'Target deployment mapping is missing.':null].filter(Boolean).join(' — ')
}
async function diagnostics($) {
  let keyConfigured=null
  try { const key=(await $.env.get('TYPESAFE_API_KEY'))?.trim();keyConfigured=Boolean(key&&!/[\r\n]/.test(key)) } catch {}
  const eligibility=classificationEligibility(input(advisor.text))
  const reason=mode==='off'?'Advice is off.':classifier!=='jev'?'Jev assessment is off.':eligibility.reason || (keyConfigured===false?'TypeSafe key is missing.':'Draft is eligible; confident evidence is still required.')
  let nextStep='Pause on a standalone draft for two seconds. Advice is not guaranteed; inspect the last assessment below.'
  if(mode==='off')nextStep='Use /route advise to enable advice.'
  else if(classifier!=='jev')nextStep='Use /route classifier jev to enable assessment.'
  else if(pinned)nextStep='Your manual model choice is pinned. Use /route unpin only if you want advice again; other protections still apply.'
  else if(!permissionKnown)nextStep='This host may expose permission state only with the first normal answer. Finish that task, then use /route new for a genuinely independent task; the command cannot bypass unknown state.'
  else if(planMode)nextStep='Keep the planning profile. Leaving plan mode alone does not end the task; /route new cannot override plan mode.'
  else if(activeTask)nextStep='Only after finishing this task, use /route new for an independent task. Follow-ups and asides stay protected.'
  else if(keyConfigured===false)nextStep='Export TYPESAFE_API_KEY privately in the launching shell, then restart Claude. Never paste the key into chat.'
  return {permission:permissionKnown?permissionValue:'unknown',model,effort:effort??null,keyConfigured,
    activeTask,pinned,contextTokens:Number.isFinite(contextTokens)?contextTokens:null,eligibility,reason,nextStep}
}
async function refresh($) {
  const selected = await $.session.model()
  // Read the live menu, never write config or infer effective effort from saved defaults.
  let selectedEffort
  try {
    const rows = await $.config.list()
    const row = rows.find(r => ['effortLevel','effort'].includes(r.key) && r.provider?.kind === 'engine')
    if (validEffort(row?.value)) selectedEffort = row.value
  } catch {}
  if (model && selected !== model) { sticky = null; invalidate($) }
  if (selectedEffort !== undefined && effort !== undefined && selectedEffort !== effort) { sticky = null; invalidate($) }
  model = selected
  if (selectedEffort !== undefined) effort = selectedEffort
  try { contextTokens = (await $.session.usage()).context.tokens } catch { contextTokens = undefined }
}
function permission($, value) {
  const known = typeof value === 'string' && ['default','acceptEdits','bypassPermissions','dontAsk','plan','auto'].includes(value)
  const plan = !known || value === 'plan'
  if (value !== permissionValue) invalidate($)
  permissionValue=value
  permissionKnown = known; planMode = plan
  if (value === 'plan') activeTask = true // Leaving plan mode never clears the task lock.
}
function schedule($, delay = 2000) {
  timer?.cancel()
  timer = $.clock.after(delay, () => { void assess($).catch(() => {}) })
}
async function provider($, text, revision) {
  const key = (await $.env.get('TYPESAFE_API_KEY'))?.trim()
  if (!key || /[\r\n]/.test(key)) return {status:'missing-key'}
  if (physicalFlight) return {status:'busy'}
  physicalFlight = true
  let started=false
  let deadline
  let expired = false
  try {
    const configuredModel = (await $.env.get('TYPESAFE_MODEL'))?.trim() || 'jev-latest'
    const now=await $.clock.now()
    if(busy||revision!==advisor.revision||mode==='off'||classifier!=='jev'||!classificationEligibility(input(text)).eligible)return {status:'stale'}
    lastCall=now;classifierCalls++;started=true
    const request = $.http.fetch('https://api.typesafe.ai/v1/systemone', {
      method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(jevRequest(text,configuredModel)),
    }).catch(() => null).finally(() => {
      // A timeout cannot cancel host HTTP. Do not allow a second physical request.
      physicalFlight = false
      if (expired && !busy && advisor.text.trim()) schedule($)
    })
    const response = await Promise.race([request,new Promise(resolve => {deadline=$.clock.after(1500,()=>{expired=true;resolve(null)})})])
    if (!response) return {status:'timeout-or-network-error'}
    if (!response.ok) return {status:'http-error',httpStatus:response.status}
    if (response.text.length > 65536) return {status:'invalid-response'}
    const data=JSON.parse(response.text)
    classifierTokens += reportedClassifierTokens(data.usage)
    return evaluateJev(data)
  } catch { return {status:'invalid-response'} }
  finally { deadline?.cancel();if(!started)physicalFlight=false }
}
async function assess($) {
  if (busy || mode === 'off' || classifier !== 'jev') return
  if (advisor.record && advisor.valid(advisor.record.id) && ['suggested','accepted','dismissed'].includes(advisor.record.acceptance)) return
  const revision = advisor.revision
  await refresh($)
  if (revision !== advisor.revision) return
  const current = input(advisor.text)
  const eligibility = classificationEligibility(current)
  trace = {provider:{name:'jev',status:'skipped',reason:eligibility.reason},application:'not-dispatched',planMode,versions}
  assessmentRevision=revision;assessmentPhase=null
  if (!eligibility.eligible) { render($);return }
  const fingerprint = contextKey()
  const key = JSON.stringify([advisor.text,fingerprint])
  let evidence = cache.get(key)
  if (!evidence) {
    if (physicalFlight) { assessmentPhase='waiting for Jev';render($);schedule($); return }
    const wait = 10000 - ((await $.clock.now()) - lastCall)
    if (wait > 0) { assessmentPhase='waiting for call interval';render($);schedule($,wait); return }
    assessmentPhase='assessing draft';render($)
    evidence = await provider($,advisor.text,revision)
    if (!['stale','missing-key','busy','timeout-or-network-error','http-error','invalid-response'].includes(evidence.status)) {
      cache.set(key,evidence);if(cache.size>32)cache.delete(cache.keys().next().value)
    }
  }
  if (busy || revision !== advisor.revision || fingerprint !== contextKey()) return
  assessmentPhase=null
  trace.provider = {name:'jev',...evidence}
  const decision = recommend({...current,requireClassifier:true,classification:evidence.classification,
    requirementsMet:evidence.status==='accepted' && evidence.signals?.requirements?.choice==='sufficient'})
  trace.decision = decision
  if (decision.action === 'suggest') {
    modelIds = await loadModelIds($)
    if (revision !== advisor.revision || fingerprint !== contextKey() || busy) return
    if (resolveTarget(decision.model,modelIds)) advisor.offer(decision,current,key)
    else trace.application='unmapped-target'
  }
  render($)
}
async function accept($, id, fromButton = false) {
  await refresh($)
  if (fromButton) {
    const draft = await $.prompt.read()
    if (draft.text !== advisor.text) { invalidate($); return false }
  }
  if (busy || mode==='off' || !classificationEligibility(input(advisor.text)).eligible) return false
  const ok=advisor.accept(id);render($);return ok
}
async function loadModelIds($) {
  const [haiku, sonnet, opus, bedrock, vertex, foundry, gateway] = await Promise.all([
    $.env.get('ANTHROPIC_DEFAULT_HAIKU_MODEL'), $.env.get('ANTHROPIC_DEFAULT_SONNET_MODEL'),
    $.env.get('ANTHROPIC_DEFAULT_OPUS_MODEL'), $.env.get('CLAUDE_CODE_USE_BEDROCK'),
    $.env.get('CLAUDE_CODE_USE_VERTEX'), $.env.get('CLAUDE_CODE_USE_FOUNDRY'), $.env.get('ANTHROPIC_BASE_URL'),
  ])
  const custom = [bedrock, vertex, foundry].some(v => v === '1' || v === 'true') || Boolean(gateway)
  return { haiku: haiku?.trim() || (custom ? null : MODEL_IDS.haiku),
    sonnet: sonnet?.trim() || (custom ? null : MODEL_IDS.sonnet),
    opus: opus?.trim() || (custom ? null : MODEL_IDS.opus) }
}

async function draftChanged($,text) {
    // Slash acceptance is a control action, not a replacement task draft.
    if (/^\/route(?:\s|$)/.test(text)) { controlDraft=true;timer?.cancel();return }
    controlDraft=false;clearTimer?.cancel();clearing=false
    if (advisor.edit(text)) { submitted=null;render($);schedule($) }
  }

export function register(on) {
  on('session.start', async ($,e,next)=>{
    try {
      await refresh($)
      const turns=await $.session.turns();activeTask=turns>0;freshSession=turns===0
      await $.command.register({name:'route',description:'Model Pilot: draft advice with explicit acceptance',argumentHint:'[status|trace|profiles|accept ID|dismiss ID|check PROMPT|advise|off|pin|unpin|new]'})
    } catch { activeTask=true }
    render($)
    return next(e)
  })
  on('classic.SessionStart',($,e,next)=>{permission($,e.permission_mode);return next(e)})
  on('classic.UserPromptSubmit',($,e,next)=>{permission($,e.permission_mode);return next(e)})
  on('config.set',async($,e,next)=>{
    if(['effort','effortLevel','model','permissionMode','defaultMode'].includes(e.key)){invalidate($);sticky=null;effort=undefined}
    return next(e)
  })
  on('classic.PostModelSwitch',($,e,next)=>{
    model=e.to_model;effort=undefined;sticky=null;pending=null;invalidate($)
    if(['command','picker','sdk'].includes(e.source))pinned=true
    return next(e)
  })
  on('prompt.edit',async($,e,next)=>{const result=await next(e);await draftChanged($,result.text);return result})
  on('prompt.change',async($,e,next)=>{
    // After submit, the consent is already tied to that immutable submission.
    if(e.origin.kind==='clear'&&!e.text){
      if(!submitted&&!controlDraft){
        // Claude clears the composer immediately before prompt.submit. Give that
        // same dispatch cycle the opportunity to capture consent; a standalone
        // clear expires at the next timer tick, and any edit invalidates at once.
        clearing=true;timer?.cancel()
        const revision=advisor.revision
        clearTimer=$.clock.after(0,()=>{
          if(clearing&&revision===advisor.revision){clearing=false;advisor.edit('');render($)}
        })
      }
    }else await draftChanged($,e.text)
    return next(e)
  })
  on('prompt.submit',($,e,next)=>{
    if (e.text?.startsWith('/route')) return next(e)
    queueProtected=Boolean(queueProtected || e.turnId || e.wait)
    attachments=Boolean(e.attachments?.length || e.context?.length || !['composer','sdk'].includes(e.origin?.kind))
    clearTimer?.cancel();clearing=false
    const token=advisor.submit(e.text)
    submitted={text:e.text,token:(!attachments&&!queueProtected)?token:null,task:advisor.task}
    timer?.cancel();render($);return next(e)
  })
  on('ui.render',{component:'PromptHint'},($,e,next)=>{
    if(/\bplan mode\b/i.test(e.props.hint)){permission($,'plan')}
    return next(e)
  })
  on('prompt.attachment',($,e,next)=>{
    if(['plan_mode','plan_mode_reentry'].includes(e.type))permission($,'plan')
    return next(e)
  })
  on('ui.render',{component:'AbovePrompt'},async($,e,next)=>{
    const rest=await next(e)
    if(e.props?.hasSurvey)return rest
    const {Box,Text,Button}=$.ui.resolve(e)
    const r=advisor.record
    const shown=mode!=='off'&&!clearing&&!busy&&!e.props?.isWorking&&r && advisor.valid(r.id) && ['suggested','accepted'].includes(r.acceptance)
    const current=sticky?.label || family(model) || 'host model'
    const currentEffort=sticky?.effort ?? effort
    const state=bandStatus()
    const protectedState=/protected|pinned/.test(state)
    const attention=/missing|unavailable/.test(state)
    const ready=/advice ready|accepted/.test(state)
    const waiting=/waiting|assessing/.test(state)
    const icon=protectedState?'🔒':attention?'⚠️':ready?'✨':waiting?'⏳':'💤'
    const tone=attention?'yellow':ready?'green':protectedState?'cyan':undefined
    const separator=key=>Text({key,dimColor:true,children:['│']})
    const statusLine=Box({flexDirection:'row',alignItems:'center',columnGap:1,paddingX:1,flexWrap:'wrap',children:[
      Text({key:'brand',color:'cyan',children:['🧭 Model Pilot']}),
      separator('model-separator'),
      Text({key:'model',bold:true,children:[current[0].toUpperCase()+current.slice(1)]}),
      ...(currentEffort?[Text({key:'effort',dimColor:true,children:[`· ${currentEffort}`]})]:[]),
      separator('state-separator'),
      Text({key:'state',...(tone?{color:tone}:{dimColor:true}),children:[`${icon} ${state}`]}),
      separator('help-separator'),
      Text({key:'help',dimColor:true,children:['/route']}),
    ]})
    const children=[rest,statusLine]
    if(sticky) children.push(Text({dimColor:true,children:[`Model Pilot · active task: ${sticky.label} / ${sticky.effort} (API model confirmed; effort requested)`]}))
    if(shown) {
      children.push(Text({children:[`Model Pilot ${r.id} · ${r.proposed.model} / ${r.proposed.effort} · ${r.benefit} ${r.tradeoff}`]}))
      if(r.acceptance==='accepted')children.push(Text({dimColor:true,children:[`Accepted ${r.id} for this draft; applies when you send.`]}))
      else children.push(Box({flexDirection:'row',children:[
        Button({key:`accept-${r.id}`,label:'Use for this task',onPress:()=>accept($,r.id,true)}),
        Button({key:`dismiss-${r.id}`,label:'Dismiss',onPress:()=>{advisor.dismiss(r.id);render($)}}),
      ]}))
    }
    return Box({flexDirection:'column',children})
  })
  on('command.run',{command:'route'},async($,e)=>{
    const raw=e.args.trim();const arg=raw.toLowerCase()
    if(arg==='trace')return {text:JSON.stringify({schemaVersion:2,versions,diagnostics:await diagnostics($),trace,recommendation:advisor.record,counters:advisor.counters,classifierCalls,classifierTokens})}
    if(arg==='profiles')return {text:JSON.stringify({schemaVersion:2,profileVersion:PROFILE_VERSION,profiles:PROFILES,modelIds:await loadModelIds($)})}
    if(arg==='auto')return {text:'Automatic routing was removed in 0.6. Use the suggestion’s “Use for this task” button or /route accept <id>. No request changes without individual acceptance.'}
    if(arg.startsWith('check ')){
      advisor.edit(raw.slice(6));await assess($)
      const r=advisor.record
      return {text:r&&advisor.valid(r.id)&&r.acceptance==='suggested'?`${r.id}: ${r.proposed.model} / ${r.proposed.effort}. ${r.benefit} ${r.tradeoff} Use /route accept ${r.id} or /route dismiss ${r.id}; then send the exact checked prompt.`:`No actionable advice. ${(await diagnostics($)).reason}\nLast assessment: ${assessmentSummary()}\nSee /route status for setup and protection details; silence does not prove optimality.`}
    }
    if(arg.startsWith('accept ')){
      const ok=await accept($,arg.slice(7))
      if(ok&&controlDraft){
        const revision=advisor.revision
        $.clock.after(50,async()=>{
          try {
            const box=await $.prompt.read()
            if(revision===advisor.revision&&(!box.text||box.text===`/route ${raw}`)) await $.prompt.fill({text:advisor.text})
          } catch {}
        })
      }
      return {text:ok?'Accepted for the matching draft and task only. Send the exact draft; edits invalidate acceptance.':'Recommendation expired, protected, or unavailable. No change authorized.'}
    }
    if(arg.startsWith('dismiss ')){const ok=advisor.dismiss(arg.slice(8));render($);return {text:ok?'Dismissed.':'Recommendation expired or unavailable.'}}
    if(arg==='off'){mode='off';sticky=null;pending=null;invalidate($)}
    else if(arg==='advise'){mode='advise';invalidate($)}
    else if(arg==='pin'){pinned=true;sticky=null;pending=null;invalidate($)}
    else if(arg==='unpin'){pinned=false;invalidate($)}
    else if(arg==='new'){activeTask=planMode;queueProtected=false;attachments=false;sticky=null;pending=null;invalidate($,true)}
    else if(arg==='classifier off'){classifier=false;invalidate($)}
    else if(['classifier jev','classifier on'].includes(arg)){classifier='jev';invalidate($)}
    else if(arg==='classifier haiku')return {text:'0.6 uses Jev for quality assessment. The legacy Haiku classifier is retired; use /route classifier jev or off.'}
    else if(arg&&arg!=='status')return {text:'Usage: /route [status|trace|profiles|check PROMPT|accept ID|dismiss ID|advise|off|pin|unpin|new|classifier jev|classifier off]'}
    const d=await diagnostics($)
    return {text:`Model Pilot 0.6.3 experimental: ${mode}; ${pinned?'pinned':'unpinned'}; ${activeTask?'ongoing task protected':'new task'}.\nPre-send advice sends eligible unfinished drafts to TypeSafe, separately billed. No persistent draft logs. /route off disables advice.\nPermission: ${d.permission}; Key: ${d.keyConfigured===null?'unknown':d.keyConfigured?'present':'missing'} (presence only, not authentication verified). Context tokens: ${d.contextTokens??'unknown'}.\nCurrent eligibility: ${d.reason}\n${d.nextStep}\nLast assessment: ${assessmentSummary()}\nProvider: ${trace?.provider?.status||'not-run'}; application: ${trace?.application||'none'}.\nSuggested ${advisor.counters.suggested}; accepted ${advisor.counters.accepted}; dispatched ${advisor.counters.dispatched}; confirmed ${advisor.counters.confirmed}. Classifier calls ${classifierCalls}; reported tokens ${classifierTokens}.\nActive task profile: ${sticky?`${sticky.label}/${sticky.effort}`:'host selection'}. Saved defaults unchanged. /route new establishes a task boundary; plan mode and pins still apply.`}
  })
  on('turn.start',async($,e,next)=>{
    if(e.agentId)return next(e)
    timer?.cancel();busy=true
    // Submission never calls or awaits the provider.
    await refresh($)
    const token=submitted?.text===e.text&&submitted.task===advisor.task?submitted.token:advisor.submit(e.text)
    submitted=null
    const safe=mode!=='off'&&!pinned&&permissionKnown&&!attachments&&!queueProtected
    const accepted=safe&&!planMode&&!activeTask&&token&&sameModel(model,token.current.model)?token:null
    pending={turnId:e.turnId,task:advisor.task,hostModel:model,hostEffort:effort,profile:safe?(accepted?.proposed||sticky):null,accepted,attempted:false,confirmed:false}
    trace={...trace,turnId:e.turnId,planMode,versions,application:accepted?'accepted':sticky&&safe?'task-profile':'unchanged'}
    activeTask=true;render($);return next(e)
  })
  on('turn.step',async function*($,e,next){
    let request=e,state=null
    if(!e.agentId){
      // The actual outgoing effort is authoritative for future comparisons.
      if(validEffort(e.effort))effort=e.effort
      const p=pending
      if(p?.turnId===e.turnId&&p.profile){
        const originalEffort=p.accepted?.current.effort??p.hostEffort
        const valid=mode!=='off'&&!pinned&&permissionKnown&&!attachments&&!queueProtected&&p.task===advisor.task&&
          sameModel(e.model,p.hostModel)&&(originalEffort==null||e.effort===originalEffort)&&(!p.accepted||!planMode)
        if(!valid){p.profile=null;sticky=null;trace.application='protection-or-host-change'}
        else {
          const target=resolveTarget(p.profile.model,modelIds)|| (p.accepted?null:p.profile.model)
          if(target){
            request={...e,model:target,effort:p.profile.effort};state=p
            if(!p.attempted){p.attempted=true;advisor.counters.dispatched++;if(advisor.record?.id===p.accepted?.id)advisor.record.acceptance='dispatched'}
            trace.application='dispatched'
          }else {trace.application='unmapped-target';p.profile=null}
        }
      }
    }
    const observed={model:request.model,effort:request.effort}
    if(!e.agentId){if(!trace)trace={versions};trace.request=observed}
    let result
    try { result=yield* next(request) }
    catch(error){if(state){state.profile=null;sticky=null;trace.application='request-failed'}throw error}
    if(!e.agentId){
      freshSession=false;observed.apiModel=result.usage?.model
      if(state&&state.profile&&pending===state&&trace.turnId===e.turnId){
        const matched=observed.apiModel===request.model
        trace.application=matched?'confirmed-model':observed.apiModel?'model-mismatch':'unverified'
        if(matched&&!state.confirmed){
          state.confirmed=true;advisor.counters.confirmed++
          sticky={model:request.model,label:state.accepted?.proposed.model||sticky?.label||family(request.model),effort:request.effort}
          if(advisor.record?.id===state.accepted?.id)advisor.record.acceptance='confirmed'
          render($)
        }else if(!matched){sticky=null;state.profile=null}
      }
    }
    return result
  })
  on('turn.complete',($,e,next)=>{
    if(!e.agentId){busy=false;pending=null;attachments=false;render($)}
    return next(e)
  })
}
