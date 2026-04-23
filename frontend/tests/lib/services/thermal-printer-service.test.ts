import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { generatePrintFolio } from '../../../lib/services/thermal-printer-service';

describe('thermal-printer-service', () => {
  describe('generatePrintFolio', () => {
    it('should generate a folio in the correct format', () => {
      const folio = generatePrintFolio();

      const parts = folio.split('-');
      assert.strictEqual(parts.length, 3);
      assert.strictEqual(parts[0], 'COM');

      // Date part check
      assert.strictEqual(parts[1].length, 6);

      // Random part check
      assert.strictEqual(parts[2].length, 4);
      assert.ok(/^\d{4}$/.test(parts[2]), 'Random part should be 4 digits');
    });

    it('should generate unique folios with high probability', () => {
      const set = new Set();
      // Test with 50 to avoid high birthday paradox collision chance on 10000 range
      for (let i = 0; i < 50; i++) {
        set.add(generatePrintFolio());
      }
      assert.ok(set.size > 45, 'Should have high uniqueness');
    });
  });
});
