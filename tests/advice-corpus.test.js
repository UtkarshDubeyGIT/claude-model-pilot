import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {recommend} from '../src/policy.js'
const corpus=JSON.parse(readFileSync(new URL('../benchmarks/advice.json',import.meta.url)))
test('48 labeled scenarios have disjoint balanced calibration and held-out partitions',()=>{
 assert.equal(corpus.scenarios.length,48)
 assert.equal(new Set(corpus.scenarios.map(s=>s.id)).size,48)
 for(const split of ['calibration','heldout']){
 const cases=corpus.scenarios.filter(s=>s.split===split);assert.equal(cases.length,24)
 for(const c of ['simple','routine','deeper','output_constraints','ambiguous','continuity'])assert.equal(cases.filter(s=>s.category===c).length,4)
 }
})
for(const s of corpus.scenarios)test('labeled policy replay: '+s.id,()=>{
 const d=recommend({...s.current,...s.context,text:s.prompt,requireClassifier:true,requirementsMet:s.label.requirementsMet,
 classification:{kind:s.label.kind,independent:s.label.independent,confidence:1}})
 assert.equal(d.action==='suggest',s.label.advice)
 if(d.action==='suggest')assert.ok(s.label.acceptableProfiles.includes(`${d.model}/${d.effort}`))
})
