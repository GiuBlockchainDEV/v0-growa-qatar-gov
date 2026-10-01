import { cookies } from 'next/headers'
import { LOCALE_COOKIE, type Locale } from '@/lib/i18n/types'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from './providers'
import './globals.css'

/*
 * Brand typeface.
 * TT Commons Pro is the brand's choice (Brand Book p.33), but the files the
 * design system ships are Fontspring DEMO fonts, "Personal Use Only": they
 * cannot go into a product. DM Sans (SIL OFL) is the closest free geometric
 * substitute, and the same one the Growa SaaS uses.
 *
 * Served from `app/fonts/` rather than `next/font/google`: the build no
 * longer depends on reaching Google Fonts, and a government deployment
 * does not call a third-party font CDN at runtime.
 *
 * One variable file carries every weight the brand uses (300–700).
 */
const dmSans = localFont({
  src: [
    { path: './fonts/dm-sans-latin-wght-normal.woff2', weight: '100 1000', style: 'normal' },
    { path: './fonts/dm-sans-latin-ext-wght-normal.woff2', weight: '100 1000', style: 'normal' },
  ],
  variable: '--font-growa',
  display: 'swap',
})

/*
 * DM Sans has no Arabic glyphs and this interface is fully bilingual with a
 * mirrored layout. IBM Plex Sans Arabic (SIL OFL) shares DM Sans' neutral,
 * open geometry and ships the same five weights, so a mixed line
 * (numbers + Arabic) keeps one visual register.
 */
const plexArabic = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-arabic-arabic-300-normal.woff2', weight: '300', style: 'normal' },
    { path: './fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-arabic',
  display: 'swap',
  // Not preloaded: five Arabic weights (~200 KB) were fetched on every page
  // even in English. With the Arabic unicode-range the browser downloads a
  // face only when Arabic text is on screen.
  preload: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200E' }],
})

export const metadata: Metadata = {
  title: 'Growa Qatar',
  description: 'Agricultural operations platform for Qatar',
  generator: 'Growa',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/icon-32.png',
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  // The interface is light-first (brand surfaces are white / stone-50);
  // ink is reserved for strong inverse moments, not the browser chrome.
  themeColor: '#FFFFFF',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
}

/* The language is known on the server (cookie written by setLocale), so the
   first HTML already has the right text, `lang` and `dir`: with the choice
   only in localStorage the server rendered English and React had to throw
   the page away on Arabic sessions (hydration error #418). */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale: Locale = cookieLocale === 'ar' ? 'ar' : 'en'
  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      suppressHydrationWarning
      className={`${dmSans.variable} ${plexArabic.variable}`}
    >
      <body className="font-sans antialiased">
        <Providers initialLocale={locale}>
          {children}
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
