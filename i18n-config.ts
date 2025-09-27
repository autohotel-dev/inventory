// Can be imported from a shared config
export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale = 'es' as const;
