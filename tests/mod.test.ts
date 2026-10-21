import { expect, test, mock } from 'claude-code/testing'
const TEXT = 'What does HTTP stand for?'
function host(on, options = {}) {
  const seen = []
  on('command.run', () => ({ text: 'unhandled' }))
  on('command.register', () => ({ value: undefined }))
  on('session.model', () => ({ value: options.model ?? 'claude-opus-5-5' }))
  on('session.turns', () => ({ value: options.turns ?? 0 }))
  on('session.usage', () => ({ value: { context: { tokens: 0, window: 200000 }, rateLimits: [], startedAt: 0 } }))
  on('config.list', () => ({value: options.unknownEffort ? [] : [{key:'effortLevel',kind:'choice',label:'Effort',value:options.effort ?? 'high',provider:{kind:'engine'},isLocked:false}]}))
  on('session.start', () => ({ cwd: '/work' }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({text:'ok'}))
  on('classic.SessionStart', () => ({}))
  on('classic.UserPromptSubmit', () => ({}))
  on('classic.PostModelSwitch', () => ({}))
  on('prompt.edit', ($, e) => ({text:e.inputText,cursor:e.inputText.length}))
  on('prompt.change', ($,e) => ({text:e.text,cursor:e.cursor}))
  on('prompt.submit', ($,e) => ({text:e.text}))
  on('ui.render', () => ({type:'Text',props:{},children:['Other mod']}))
  on('ui.invalidate', () => ({value:undefined}))
  on('turn.step', async function* ($, e) {
    seen.push(e); yield {kind:'text',index:0,text:'ok'}
    return {turnId:e.turnId,index:e.index,answer:'ok',toolUses:[],stopReason:'end_turn',usage:options.usage ?? {model:e.model}}
  })
  return seen
}
function jev(on, kind='simple', options={}) {
  mock.env(on, options.noKey ? {} : {TYPESAFE_API_KEY:'test-key',...options.env})
  const clock=mock.clock(on);let calls=0
  on('http.fetch', async()=>{
    calls++
    if(options.delay) await clock.sleep(options.delay)
    if(options.error) throw new Error('private-provider-error')
    return {value:{ok:true,status:200,headers:{},text:JSON.stringify({answers:{
      complexity:{type:'choice',choice:kind,confidence:options.confidence ?? 1,probabilities:{simple:0,routine:0,complex:0,unknown:0,[kind]:1}},
      independence:{type:'choice',choice:'independent',confidence:1,probabilities:{independent:1,dependent:0}},
      requirements:{type:'choice',choice:'sufficient',confidence:1,probabilities:{sufficient:1,uncertain:0}},
    }})}}
  });return {clock,calls:()=>calls}
}
const cmd=($,args)=>$.command.run({command:'route',args})
const trace=async $=>JSON.parse((await cmd($,'trace')).text)
async function boot($,mode='default'){
 await $.session.start({surface:'terminal',isInteractive:true,cwd:'/work'})
 await $.classic.SessionStart({hook_event_name:'SessionStart',session_id:'s',transcript_path:'',cwd:'/work',permission_mode:mode,source:'startup'})
}
async function start($,text=TEXT,id='t',mode='default'){
 await $.classic.UserPromptSubmit({hook_event_name:'UserPromptSubmit',session_id:'s',transcript_path:'',cwd:'/work',permission_mode:mode,prompt:text})
 await $.turn.start({text,turnId:id})
}
async function step($,id='t',index=0,extra={}){
 const stream=$.turn.step({turnId:id,index,model:'claude-opus-5-5',effort:'high',messageCount:1,...extra})
 let s=await stream.next();while(!s.done)s=await stream.next();return s.value
}
async function check($,text=TEXT){await cmd($,'check '+text);return (await trace($)).recommendation}
async function accepted($,text=TEXT){const r=await check($,text);expect(r.acceptance).toBe('suggested');await cmd($,'accept '+r.id);return r}
async function edit($,text){await $.prompt.edit({text:'',cursor:0,start:0,end:0,inputText:text,kind:'insert'})}

test('auto migrates and never authorizes requests',async($,on)=>{
 const seen=host(on);jev(on);await boot($);expect((await cmd($,'auto')).text).toContain('removed')
 await check($);await start($);await step($);expect(seen[0].model).toBe('claude-opus-5-5');expect((await trace($)).counters.dispatched).toBe(0)
})
test('accepted draft applies throughout a tool loop and follow-ups',async($,on)=>{
 const seen=host(on);jev(on);await boot($);await accepted($);await start($);await step($);await step($,'t',1)
 await $.turn.complete({turnId:'t',answer:'ok'});await start($,'Continue','u');await step($,'u')
 expect(seen.map(x=>x.model)).toEqual(['claude-haiku-5-5','claude-haiku-5-5','claude-haiku-5-5'])
 expect(seen.every(x=>x.effort==='low')).toBe(true)
 const t=await trace($);expect(t.schemaVersion).toBe(2);expect(t.counters.accepted).toBe(1);expect(t.counters.confirmed).toBe(2)
})
test('changed draft invalidates consent',async($,on)=>{
 const seen=host(on);jev(on);await boot($);await accepted($);await edit($,'different');await start($);await step($)
 expect(seen[0].model).toBe('claude-opus-5-5')
})
test('dismissed recommendation cannot be accepted or repeated from cache',async($,on)=>{
 host(on);const f=jev(on);await boot($);const r=await check($);await cmd($,'dismiss '+r.id);await cmd($,'accept '+r.id);await check($)
 expect((await trace($)).recommendation.acceptance).toBe('dismissed');expect(f.calls()).toBe(1)
})
test('draft evaluation debounces for two seconds and reuses session cache',async($,on)=>{
 host(on);const f=jev(on);await boot($);await edit($,'draft');await f.clock.advance(1000);await edit($,TEXT);await f.clock.advance(1999)
 expect(f.calls()).toBe(0);await f.clock.advance(1);await f.clock.settle();expect(f.calls()).toBe(1)
 await edit($,'x');await edit($,TEXT);await f.clock.advance(2000);await f.clock.settle();expect(f.calls()).toBe(1)
})
test('background calls have a ten second minimum interval',async($,on)=>{
 host(on);const f=jev(on);await boot($);await edit($,TEXT);await f.clock.advance(2000);await f.clock.settle()
 await edit($,'Define DNS');await f.clock.advance(9999);await f.clock.settle();expect(f.calls()).toBe(1)
 await f.clock.advance(1);await f.clock.settle();expect(f.calls()).toBe(2)
})
test('slow responses neither block submission nor affect its request',async($,on)=>{
 const seen=host(on);const f=jev(on,'simple',{delay:5000});await boot($);await edit($,TEXT);await f.clock.advance(2000)
 await start($);await step($);await f.clock.advance(5000);await f.clock.settle()
 expect(seen[0].model).toBe('claude-opus-5-5');expect((await trace($)).counters.suggested).toBe(0)
})
for(const [name,extra] of [['missing key',{noKey:true}],['provider failure',{error:true}],['abstention',{confidence:0.8}]]){
 test(name+' stays quiet without claiming optimality',async($,on)=>{
  const seen=host(on);jev(on,'simple',extra);await boot($);await check($);await start($);await step($)
  expect(seen[0].model).toBe('claude-opus-5-5');expect((await trace($)).counters.suggested).toBe(0)
 })
}
test('planning chain including aside and implementation is protected at every effort',async($,on)=>{
 const seen=host(on);const f=jev(on);await boot($,'plan')
 for(const effort of ['low','medium','high','xhigh','max']){
  for(const [i,text] of ['Plan service','Continue','Unrelated question: define HTTP','Implement it','Return to plan'].entries()){
   await check($,text);await start($,text,effort+i,i===0?'plan':'default');await step($,effort+i,0,{effort})
  }
 }
 expect(f.calls()).toBe(0);expect(seen.every(x=>x.model==='claude-opus-5-5')).toBe(true);expect((await trace($)).counters.dispatched).toBe(0)
})
test('resumed sessions remain protected before classification',async($,on)=>{
 host(on,{turns:8});const f=jev(on);await boot($);await check($);expect(f.calls()).toBe(0)
})
test('new task does not override plan mode or pin',async($,on)=>{
 host(on);const f=jev(on);await boot($,'plan');await cmd($,'new');await check($);expect(f.calls()).toBe(0)
 await start($,'Plan','t','default');await cmd($,'pin');await cmd($,'new');await check($);expect(f.calls()).toBe(0)
})
test('same-model effort changes need acceptance and a known current effort',async($,on)=>{
 const seen=host(on,{model:'claude-haiku-5-5'});jev(on);await boot($);await accepted($);await start($);await step($,'t',0,{model:'claude-haiku-5-5'})
 expect(seen[0].effort).toBe('low')
})
test('unknown effort suppresses same-model advice',async($,on)=>{
 host(on,{model:'claude-haiku-5-5',unknownEffort:true});jev(on);await boot($);await check($);expect((await trace($)).counters.suggested).toBe(0)
})
for(const variant of ['plan','unknown-mode','host-model','effort','attachments','queue','new','off','manual','subagent']){
 test('accepted recommendation fails closed on '+variant,async($,on)=>{
  const seen=host(on);jev(on);await boot($);await accepted($)
  if(variant==='new'||variant==='off')await cmd($,variant)
  if(variant==='manual')await $.classic.PostModelSwitch({hook_event_name:'PostModelSwitch',session_id:'s',transcript_path:'',cwd:'/work',to_model:'claude-opus-5-5',source:'picker'})
  if(variant==='attachments'||variant==='queue')await $.prompt.submit({text:TEXT,origin:{kind:'composer'},attachments:variant==='attachments'?[{type:'image'}]:[],turnId:variant==='queue'?'running':undefined})
  await start($,TEXT,'t',variant==='plan'?'plan':variant==='unknown-mode'?'':'default')
  const extra=variant==='host-model'?{model:'claude-sonnet-5-5'}:variant==='effort'?{effort:'max'}:variant==='subagent'?{agentId:'a'}:{}
  await step($,'t',0,extra);expect(seen[0].model).toBe(extra.model??'claude-opus-5-5');expect(seen[0].effort).toBe(extra.effort??'high')
 })
}
test('model mismatch never confirms or retains accepted profile',async($,on)=>{
 const seen=host(on,{usage:{model:'claude-opus-5-5'}});jev(on);await boot($);await accepted($);await start($);await step($)
 expect((await trace($)).trace.application).toBe('model-mismatch');await start($,'Continue','u');await step($,'u')
 expect(seen[1].model).toBe('claude-opus-5-5');expect((await trace($)).counters.confirmed).toBe(0)
})
test('suggestion card composes with other mods and exposes both actions',async($,on)=>{
 host(on);jev(on);await boot($);await check($)
 const ui=await $.ui.mount({plugin:'model-pilot',surface:'terminal',component:'AbovePrompt',props:{}})
 expect(await ui.find({type:'Button',label:'Use for this task'})).toBeDefined()
 expect(await ui.find({type:'Button',label:'Dismiss'})).toBeDefined()
 expect(await ui.find({type:'Text',text:'Other mod'})).toBeDefined();await ui.unmount()
})
test('trace contains no prompt or key',async($,on)=>{
 host(on);jev(on);await boot($);await accepted($);const t=(await cmd($,'trace')).text
 expect(t.includes(TEXT)).toBe(false);expect(t.includes('test-key')).toBe(false)
})
test('only one physical Jev request exists even after UI timeout',async($,on)=>{
 host(on);const f=jev(on,'simple',{delay:20000});await boot($);await edit($,TEXT);await f.clock.advance(2000)
 await f.clock.advance(1600);await edit($,'Define DNS');await f.clock.advance(11000);expect(f.calls()).toBe(1)
 await f.clock.advance(10000);await f.clock.settle();expect((await trace($)).counters.accepted).toBe(0)
})
test('an outstanding debounce cannot overwrite explicit acceptance',async($,on)=>{
 host(on);const f=jev(on);await boot($);await edit($,TEXT);await accepted($);await f.clock.advance(2000);await f.clock.settle()
 expect((await trace($)).recommendation.acceptance).toBe('accepted')
})
test('button acceptance and dismissal work on terminal and desktop',async($,on)=>{
 host(on);jev(on);on('prompt.read',()=>({value:{text:TEXT,cursor:TEXT.length}}));await boot($);const r=await check($)
 for(const surface of ['terminal','desktop']){
  const ui=await $.ui.mount({plugin:'model-pilot',surface,component:'AbovePrompt',props:{}})
  if(surface==='terminal'){await ui.press({key:'accept-'+r.id});expect((await trace($)).recommendation.acceptance).toBe('accepted')}
  else expect(await ui.find({type:'Text',text:/Accepted/})).toBeDefined()
  await ui.unmount()
 }
})
test('unconsumed button becomes invalid when live composer differs',async($,on)=>{
 host(on);jev(on);on('prompt.read',()=>({value:{text:'different',cursor:9}}));await boot($);const r=await check($)
 const ui=await $.ui.mount({plugin:'model-pilot',surface:'terminal',component:'AbovePrompt',props:{}})
 await ui.press({key:'accept-'+r.id});expect((await trace($)).counters.accepted).toBe(0);await ui.unmount()
})
test('submission transfers acceptance before composer clear',async($,on)=>{
 const seen=host(on);jev(on);await boot($);await accepted($)
 await $.prompt.submit({text:TEXT,origin:{kind:'composer'}})
 await $.prompt.change({text:'',cursor:0,origin:{kind:'clear'}})
 await start($);await step($);expect(seen[0].model).toBe('claude-haiku-5-5')
})
test('slash acceptance restores the checked draft without accepting an edited task',async($,on)=>{
 host(on);const f=jev(on);let filled='';on('prompt.read',()=>({value:{text:'',cursor:0}}));on('prompt.fill',($,e)=>{filled=e.text;return {isFilled:true}})
 await boot($);const r=await check($);await edit($,'/route accept '+r.id)
 await $.prompt.change({text:'',cursor:0,origin:{kind:'clear'}});await cmd($,'accept '+r.id)
 await f.clock.advance(50);await f.clock.settle();expect(filled).toBe(TEXT);expect((await trace($)).recommendation.acceptance).toBe('accepted')
})
test('interactive clear-before-submit transfers consent in the same dispatch cycle',async($,on)=>{
 const seen=host(on);jev(on);await boot($);await accepted($)
 await $.prompt.change({text:'',cursor:0,origin:{kind:'clear'}})
 await $.prompt.submit({text:TEXT,origin:{kind:'composer'}})
 await start($);await step($);expect(seen[0].model).toBe('claude-haiku-5-5')
})
test('a composer clear without submission expires consent',async($,on)=>{
 const seen=host(on);const f=jev(on);await boot($);await accepted($)
 await $.prompt.change({text:'',cursor:0,origin:{kind:'clear'}});await f.clock.advance(0);await f.clock.settle()
 await start($);await step($);expect(seen[0].model).toBe('claude-opus-5-5')
})
test('non-plan permission-mode change invalidates unconsumed consent',async($,on)=>{
 const seen=host(on);jev(on);await boot($);await accepted($);await start($,TEXT,'t','acceptEdits');await step($)
 expect(seen[0].model).toBe('claude-opus-5-5')
})
test('configuration override after submission prevents application',async($,on)=>{
 const seen=host(on);jev(on);on('config.set',($,e)=>({value:e.value}));await boot($);await accepted($);await start($)
 await $.config.set({key:'effortLevel',value:'high'});await step($);expect(seen[0].model).toBe('claude-opus-5-5')
})
test('unmapped gateway target stays silent',async($,on)=>{
 host(on);jev(on,'simple',{env:{ANTHROPIC_BASE_URL:'https://example.invalid'}})
 await boot($);await check($);expect((await trace($)).counters.suggested).toBe(0)
})
test('explicit gateway mapping is used only after acceptance',async($,on)=>{
 const seen=host(on);jev(on,'simple',{env:{ANTHROPIC_BASE_URL:'https://example.invalid',ANTHROPIC_DEFAULT_HAIKU_MODEL:'tenant-small'}})
 await boot($);await accepted($);await start($);await step($);expect(seen[0].model).toBe('tenant-small')
})
