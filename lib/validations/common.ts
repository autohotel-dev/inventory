/**
 * Validaciones comunes reutilizables
 */
import { z } from "zod";

/**
 * Validación de email
 */
export const emailValidation = z
    .string()
    .min(1, "El correo electrónico es requerido")
    .email("Ingresa un correo electrónico válido")
    .toLowerCase()
    .trim();

/**
 * Validación de teléfono mexicano (10 dígitos)
 */
export const phoneValidation = z
    .string()
    .regex(/^[0-9]{10}$/, "El teléfono debe tener 10 dígitos")
    .optional()
    .or(z.literal(""));

/**
 * Validación de RFC mexicano
 * Formato: 3-4 letras + 6 dígitos (fecha) + 3 caracteres alfanuméricos
 */
export const rfcValidation = z
    .string()
    .regex(
        /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/,
        "RFC inválido. Formato: ABCD123456XYZ"
    )
    .toUpperCase()
    .trim()
    .optional()
    .or(z.literal(""));

/**
 * Validación de código postal mexicano (5 dígitos)
 */
export const postalCodeValidation = z
    .string()
    .regex(/^[0-9]{5}$/, "El código postal debe tener 5 dígitos")
    .optional()
    .or(z.literal(""));

/**
 * Validación de contraseña segura
 * Mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial
 */
export const strongPasswordValidation = z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
        "La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&)"
    );

/**
 * Validación de contraseña básica
 * Mínimo 6 caracteres, al menos una mayúscula, una minúscula y un número
 */
export const basicPasswordValidation = z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "La contraseña debe contener al menos una mayúscula, una minúscula y un número"
    );

/**
 * Validación de URL
 */
export const urlValidation = z
    .string()
    .url("Ingresa una URL válida")
    .optional()
    .or(z.literal(""));

/**
 * Validación de número positivo
 */
export const positiveNumberValidation = z
    .number()
    .min(0, "El valor debe ser mayor o igual a 0");

/**
 * Validación de número positivo mayor a cero
 */
export const positiveNonZeroValidation = z
    .number()
    .min(0.01, "El valor debe ser mayor a 0");

/**
 * Validación de porcentaje (0-100)
 */
export const percentageValidation = z
    .number()
    .min(0, "El porcentaje debe ser mayor o igual a 0")
    .max(100, "El porcentaje debe ser menor o igual a 100");

/**
 * Validación de fecha en el futuro
 */
export const futureDateValidation = z
    .string()
    .refine(
        (date) => new Date(date) > new Date(),
        "La fecha debe ser en el futuro"
    );

/**
 * Validación de fecha en el pasado
 */
export const pastDateValidation = z
    .string()
    .refine(
        (date) => new Date(date) < new Date(),
        "La fecha debe ser en el pasado"
    );

/**
 * Validación de rango de fechas
 */
export const dateRangeValidation = z.object({
    startDate: z.string().min(1, "La fecha de inicio es requerida"),
    endDate: z.string().min(1, "La fecha de fin es requerida"),
}).refine(
    (data) => new Date(data.endDate) >= new Date(data.startDate),
    {
        message: "La fecha de fin debe ser posterior o igual a la fecha de inicio",
        path: ["endDate"],
    }
);

/**
 * Validación de SKU (código único de producto)
 * Alfanumérico, guiones y guiones bajos permitidos
 */
export const skuValidation = z
    .string()
    .min(1, "El SKU es requerido")
    .regex(
        /^[A-Z0-9_-]+$/,
        "El SKU solo puede contener letras mayúsculas, números, guiones y guiones bajos"
    )
    .toUpperCase()
    .trim();

/**
 * Validación de código de barras
 */
export const barcodeValidation = z
    .string()
    .regex(/^[0-9]{8,13}$/, "El código de barras debe tener entre 8 y 13 dígitos")
    .optional()
    .or(z.literal(""));

/**
 * Validación de nombre (sin números ni caracteres especiales)
 */
export const nameValidation = z
    .string()
    .min(1, "El nombre es requerido")
    .regex(
        /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
        "El nombre solo puede contener letras y espacios"
    )
    .trim();

/**
 * Validación de texto no vacío
 */
export const nonEmptyStringValidation = z
    .string()
    .min(1, "Este campo es requerido")
    .trim();
