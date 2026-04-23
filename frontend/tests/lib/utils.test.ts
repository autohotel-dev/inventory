import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { generateSecureRandomNumber, generateSecureRandomString } from '../../lib/utils';

describe('utils - Cryptographic Functions', () => {
  describe('generateSecureRandomNumber', () => {
    it('should generate numbers within the specified range', () => {
      const min = 0;
      const max = 9999;
      for (let i = 0; i < 100; i++) {
        const num = generateSecureRandomNumber(min, max);
        assert.ok(num >= min && num <= max, `Generated number ${num} is outside the range [${min}, ${max}]`);
      }
    });
  });

  describe('generateSecureRandomString', () => {
    it('should generate a string of the correct length', () => {
      const length = 10;
      const str = generateSecureRandomString(length);
      assert.strictEqual(str.length, length);
    });

    it('should only contain valid characters', () => {
      const length = 50;
      const str = generateSecureRandomString(length);
      const validCharsRegex = /^[A-Za-z0-9]+$/;
      assert.ok(validCharsRegex.test(str), `String ${str} contains invalid characters`);
    });
  });
});
