import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Sanity Test', () => {
  it('should verify basic math and environment', () => {
    assert.strictEqual(1 + 1, 2);
  });
});
