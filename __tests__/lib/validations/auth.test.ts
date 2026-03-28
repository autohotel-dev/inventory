import { describe, it, expect } from 'vitest';
import { registerSchema } from '@/lib/validations/auth';

describe('registerSchema', () => {
  it('should validate a correct payload', () => {
    const validData = {
      email: 'test@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    };

    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  describe('email validation', () => {
    it('should reject empty email', () => {
      const result = registerSchema.safeParse({
        email: '',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('El correo electrónico es requerido');
      }
    });

    it('should reject invalid email format', () => {
      const result = registerSchema.safeParse({
        email: 'invalid-email',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Ingresa un correo electrónico válido');
      }
    });
  });

  describe('password validation', () => {
    it('should reject empty password', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: '',
        confirmPassword: ''
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const passwordErrors = result.error.issues.filter(issue => issue.path.includes('password'));
        expect(passwordErrors.some(err => err.message.includes('La contraseña es requerida') || err.message.includes('al menos 6 caracteres'))).toBe(true);
      }
    });

    it('should reject password less than 6 characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Pw1',
        confirmPassword: 'Pw1'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const passwordErrors = result.error.issues.filter(issue => issue.path.includes('password'));
        expect(passwordErrors.some(err => err.message.includes('al menos 6 caracteres'))).toBe(true);
      }
    });

    it('should reject password missing uppercase letter', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'password123!',
        confirmPassword: 'password123!'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const passwordErrors = result.error.issues.filter(issue => issue.path.includes('password'));
        expect(passwordErrors.some(err => err.message.includes('al menos una mayúscula'))).toBe(true);
      }
    });

    it('should reject password missing lowercase letter', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'PASSWORD123!',
        confirmPassword: 'PASSWORD123!'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const passwordErrors = result.error.issues.filter(issue => issue.path.includes('password'));
        expect(passwordErrors.some(err => err.message.includes('una minúscula'))).toBe(true);
      }
    });

    it('should reject password missing a number', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password!',
        confirmPassword: 'Password!'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const passwordErrors = result.error.issues.filter(issue => issue.path.includes('password'));
        expect(passwordErrors.some(err => err.message.includes('un número'))).toBe(true);
      }
    });
  });

  describe('confirm password validation', () => {
    it('should reject when passwords do not match', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password1234!'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        // Find the issue specifically for the confirmPassword path
        const confirmError = result.error.issues.find(i => i.path.includes('confirmPassword'));
        expect(confirmError).toBeDefined();
        expect(confirmError?.message).toBe('Las contraseñas no coinciden');
      }
    });
  });
});
