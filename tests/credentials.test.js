import test from 'node:test'
import assert from 'node:assert/strict'
import { Credentials } from '../src/credentials.js'

test('credential diagnostics never serialize either secret',async()=>{
 const c=new Credentials('saved-secret')
 await c.resolve(async()=> 'env-secret')
 assert.deepEqual(c.status(),{source:'environment',state:'unverified',present:true,savedConfigured:true,environmentOverridesSaved:true})
 assert.equal(JSON.stringify(c),'{}')
 assert.doesNotMatch(JSON.stringify(c.status()),/saved-secret|env-secret/)
})
test('rotation invalidates authentication and ignores stale verification',async()=>{
 const c=new Credentials('saved-secret')
 const old=await c.resolve(async()=>undefined)
 c.observe(old.generation,200);assert.equal(c.status().state,'verified')
 const fresh=await c.resolve(async()=>'replacement')
 c.observe(old.generation,401);assert.equal(c.status().state,'unverified')
 c.observe(fresh.generation,403);assert.equal(c.status().state,'rejected')
 c.observe(fresh.generation,200);assert.equal(c.status().state,'verified')
})
test('quota and network errors are not invalid credentials',async()=>{
 const c=new Credentials('saved-secret');const r=await c.resolve(async()=>undefined)
 for(const status of [429,500,undefined]) { c.observe(r.generation,status);assert.equal(c.status().state,'unverified') }
})
test('bad override or denied environment access never silently falls back',async()=>{
 const c=new Credentials('saved-secret')
 for(const v of ['\nkey','bad key','\x00key','x'.repeat(4097),'  ']) {
  assert.equal((await c.resolve(async()=>v)).key,undefined)
  assert.equal(c.status().state,'invalid')
 }
 assert.equal((await c.resolve(async()=>{throw Error('private')})).key,undefined)
 assert.equal(c.status().state,'unavailable')
 assert.equal((await c.resolve(async()=>undefined)).key,'saved-secret')
})
test('removal clears saved credentials but preserves environment override',async()=>{
 const c=new Credentials('saved-secret');await c.resolve(async()=>'env-secret')
 c.removeSaved();assert.equal((await c.resolve(async()=>'env-secret')).key,'env-secret')
 assert.equal(c.status().savedConfigured,false)
 assert.equal((await c.resolve(async()=>undefined)).key,undefined)
 assert.equal(c.status().state,'missing')
})
