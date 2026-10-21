import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Advisor } from '../src/advisor.js'
import { recommend } from '../src/policy.js'
const input = {text:'Extract the names from this list.',model:'claude-opus-5-5',effort:'high',freshSession:true,contextTokens:0,requireClassifier:true,classification:{kind:'simple',independent:true,confidence:1},requirementsMet:true}
const proposal = {action:'suggest',model:'haiku',effort:'low',kind:'simple',reason:'Lower expected cost',benefit:'Lower expected cost',tradeoff:'Less depth'}
test('no application token exists without explicit matching acceptance',()=>{
 const s=new Advisor(); s.edit('a'); const r=s.offer(proposal,input); assert.equal(s.submit('a'),null)
 s.edit('b'); s.offer(proposal,input); assert.equal(s.accept(r.id),false)
})
test('editing invalidates acceptance even if the old text returns',()=>{
 const s=new Advisor(); s.edit('a'); const r=s.offer(proposal,input); assert.equal(s.accept(r.id),true)
 s.edit('b');s.edit('a');assert.equal(s.submit('a'),null)
})
test('acceptance is single use and bound to text and task revision',()=>{
 const s=new Advisor();s.edit('a');const r=s.offer(proposal,input);s.accept(r.id)
 assert.equal(s.submit('a').id,r.id);assert.equal(s.submit('a'),null)
 s.edit('b');const q=s.offer(proposal,input);s.accept(q.id);s.invalidate(true);assert.equal(s.submit('b'),null)
})
test('dismissal suppresses duplicate evidence for the same draft/context',()=>{
 const s=new Advisor();s.edit('a');const r=s.offer(proposal,input,'key');s.dismiss(r.id)
 assert.equal(s.offer(proposal,input,'key'),null)
})
test('records contain revisions and profiles but no raw drafts',()=>{
 const s=new Advisor();s.edit('private draft');s.offer(proposal,input)
 assert.equal(JSON.stringify(s.record).includes('private draft'),false)
 assert.equal(s.record.current.model,input.model);assert.equal(s.record.proposed.effort,'low')
})
test('ongoing work blocks all promotions, aside prefixes and effort changes',()=>{
 for(const text of ['Unrelated question: define HTTP','Fix production authentication','Continue']){
 const r=recommend({...input,text,model:'haiku',activeTask:true});assert.equal(r.action,'keep')
 }
})
test('same-model effort advice requires known effort and quality eligibility',()=>{
 assert.equal(recommend({...input,model:'haiku'}).action,'suggest')
 assert.equal(recommend({...input,model:'haiku',effort:undefined}).action,'keep')
 assert.equal(recommend({...input,requirementsMet:false}).action,'keep')
})
test('cache cost uncertainty blocks cheaper advice but not a necessary upgrade',()=>{
 const r=recommend({...input,model:'haiku',contextTokens:30000,classification:{kind:'complex',independent:true,confidence:1}})
 assert.equal(r.action,'suggest');assert.equal(r.model,'opus')
 assert.equal(recommend({...input,contextTokens:30000}).action,'keep')
})
