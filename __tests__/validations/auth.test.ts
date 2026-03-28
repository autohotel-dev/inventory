import { describe, it, expect } from "vitest";
import { loginSchema } from "@/lib/validations/auth";

describe("loginSchema", () => {
  describe("email validation", () => {
    it("should accept a valid email", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject an invalid email", () => {
      const result = loginSchema.safeParse({
        email: "invalid-email",
        password: "password123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Ingresa un correo electrónico válido");
      }
    });

    it("should reject an empty email", () => {
      const result = loginSchema.safeParse({
        email: "",
        password: "password123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("El correo electrónico es requerido");
      }
    });
  });

  describe("password validation", () => {
    it("should accept a valid password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject a password that is too short", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "12345",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("La contraseña debe tener al menos 6 caracteres");
      }
    });

    it("should reject an empty password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("La contraseña es requerida");
      }
    });
  });
});
