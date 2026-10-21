import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as profiles from '../src/profiles.js'
test('model targets are concrete and deployment mappings are injectable', () => {
  assert.equal(profiles.resolveTarget('opus'), 'claude-opus-5-5')
  assert.equal(profiles.resolveTarget('sonnet', { sonnet: 'tenant-sonnet' }), 'tenant-sonnet')
  assert.equal(profiles.resolveTarget('sonnet', { sonnet: 'sonnet' }), null)
  assert.equal(profiles.resolveTarget('unknown'), null)
})
