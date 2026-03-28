import { describe, it, expect } from 'vitest';
import { forgotPasswordSchema } from './auth';

describe('forgotPasswordSchema', () => {
  it('should pass with a valid email', () => {
    const validData = { email: 'test@example.com' };
    const result = forgotPasswordSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should fail when email is empty', () => {
    const invalidData = { email: '' };
    const result = forgotPasswordSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('El correo electrónico es requerido');
    }
  });

  it('should fail with an invalid email format', () => {
    const invalidData = { email: 'not-an-email' };
    const result = forgotPasswordSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Ingresa un correo electrónico válido');
    }
  });

  it('should fail when email is missing', () => {
    const invalidData = {};
    const result = forgotPasswordSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid input: expected string, received undefined');
    }
  });
});
