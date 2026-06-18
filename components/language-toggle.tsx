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
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Globe } from 'lucide-react'

export function LanguageToggle() {
  const { locale, setLocale } = useLocale()
  const { t } = useI18n()
  const menuAlign = locale === 'ar' ? 'start' : 'end'

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
      <DropdownMenuContent
        align={menuAlign}
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        className="z-[2600] min-w-[11rem]"
      >
        <DropdownMenuLabel>{t('language.switch')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {Object.values(localeConfigs).map((config) => (
          <DropdownMenuItem
            key={config.code}
            onSelect={() => handleLocaleChange(config.code)}
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
