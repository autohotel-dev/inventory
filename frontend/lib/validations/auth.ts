import { z } from "zod";
import { emailValidation, basicPasswordValidation } from "./common";

/**
 * Schema de validación para login
 */
export const loginSchema = z.object({
  email: emailValidation,
  password: z
    .string()
    .min(1, "La contraseña es requerida")
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
});

/**
 * Schema de validación para registro
 */
export const registerSchema = z.object({
  email: emailValidation,
  password: basicPasswordValidation,
  confirmPassword: z.string().min(1, "Confirma tu contraseña"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

/**
 * Schema de validación para recuperación de contraseña
 */
export const forgotPasswordSchema = z.object({
  email: emailValidation,
});

/**
 * Schema de validación para actualización de contraseña
 */
export const updatePasswordSchema = z.object({
  password: basicPasswordValidation,
  confirmPassword: z.string().min(1, "Confirma tu contraseña"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;
