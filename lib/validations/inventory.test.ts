import { describe, it, expect } from 'vitest';
import { simpleProductSchema } from './inventory';

describe('simpleProductSchema', () => {
  const validProduct = {
    name: 'Test Product',
    sku: 'SKU-123',
    price: 100,
    cost: 50,
    min_stock: 10,
    unit: 'pcs',
    description: 'A test product description',
    barcode: '123456789012',
    is_active: true,
  };

  it('should validate a correct product successfully', () => {
    const result = simpleProductSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it('should validate successfully without optional fields', () => {
    const { description, barcode, ...productWithoutOptional } = validProduct;
    const result = simpleProductSchema.safeParse(productWithoutOptional);
    expect(result.success).toBe(true);
  });

  describe('Field validation errors', () => {
    it('should fail when name is empty', () => {
      const result = simpleProductSchema.safeParse({ ...validProduct, name: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('El nombre es requerido');
      }
    });

    it('should fail when sku is empty', () => {
      const result = simpleProductSchema.safeParse({ ...validProduct, sku: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('El SKU es requerido');
      }
    });

    it('should fail when price is negative', () => {
      const result = simpleProductSchema.safeParse({ ...validProduct, price: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('El precio debe ser mayor a 0');
      }
    });

    it('should allow price to be 0', () => {
      const result = simpleProductSchema.safeParse({ ...validProduct, price: 0 });
      expect(result.success).toBe(true);
    });

    it('should fail when cost is negative', () => {
      const result = simpleProductSchema.safeParse({ ...validProduct, cost: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('El costo debe ser mayor a 0');
      }
    });

    it('should allow cost to be 0', () => {
      const result = simpleProductSchema.safeParse({ ...validProduct, cost: 0 });
      expect(result.success).toBe(true);
    });

    it('should fail when min_stock is negative', () => {
      const result = simpleProductSchema.safeParse({ ...validProduct, min_stock: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('El stock mínimo no puede ser negativo');
      }
    });

    it('should allow min_stock to be 0', () => {
      const result = simpleProductSchema.safeParse({ ...validProduct, min_stock: 0 });
      expect(result.success).toBe(true);
    });

    it('should fail when unit is empty', () => {
      const result = simpleProductSchema.safeParse({ ...validProduct, unit: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('La unidad es requerida');
      }
    });
  });

  describe('Type validation errors', () => {
    it('should fail when required fields are missing', () => {
      const result = simpleProductSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('should fail when field types are incorrect', () => {
      const result = simpleProductSchema.safeParse({
        ...validProduct,
        price: '100', // Should be number
        is_active: 'true', // Should be boolean
      });
      expect(result.success).toBe(false);
    });
  });
});
