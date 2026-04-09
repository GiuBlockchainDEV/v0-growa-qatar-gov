'use client'

/**
 * Growa Qatar - Language Toggle Component
 * Step 0.4: i18n baseline
 * 
 * Allows users to switch between English and Arabic.
 */

import { useLocale, useI18n, localeConfigs, type Locale } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Globe } from 'lucide-react'

export function LanguageToggle() {
  const { locale, setLocale } = useLocale()
  const { t } = useI18n()

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('language.switch')}>
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.values(localeConfigs).map((config) => (
          <DropdownMenuItem
            key={config.code}
            onClick={() => handleLocaleChange(config.code)}
            className={locale === config.code ? 'bg-accent' : ''}
          >
            <span className="font-medium">{config.nativeName}</span>
            {locale !== config.code && (
              <span className="text-muted-foreground ms-2">({config.name})</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
