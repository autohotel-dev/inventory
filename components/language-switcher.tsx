"use client";

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { locales, type Locale } from '@/i18n-config';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: Locale) => {
    // Remove current locale from pathname if it exists
    const pathnameWithoutLocale = pathname.startsWith(`/${locale}`) 
      ? pathname.slice(`/${locale}`.length) 
      : pathname;
    
    // Add new locale to pathname (unless it's the default)
    const newPath = newLocale === 'es' 
      ? pathnameWithoutLocale || '/'
      : `/${newLocale}${pathnameWithoutLocale}`;
    
    router.push(newPath);
  };

  return (
    <div className="flex items-center gap-1">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => switchLocale(loc)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            locale === loc
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          }`}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
