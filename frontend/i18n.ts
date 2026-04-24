import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => {
  return {
    locale: locale || 'es',
    messages: (await import(`./messages/${locale || 'es'}.json`)).default
  };
});
