import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAccountActive } from './types.js';

describe('isAccountActive', () => {
  it('treats a missing flag as active so older docs still work', () => {
    assert.equal(isAccountActive({ active: true }), true);
    assert.equal(isAccountActive({} as { active: boolean }), true);
    assert.equal(isAccountActive(undefined), false);
    assert.equal(isAccountActive({ active: false }), false);
  });
});
