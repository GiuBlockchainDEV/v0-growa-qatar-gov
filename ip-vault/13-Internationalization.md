# Internationalization (i18n)

← [[12-Growa-AI-Methodology]] | [[00-Index]] | Next: [[14-API-Design]]

---

## Overview

Growa is designed for bilingual operation from the ground up. The Qatar deployment supports **English** and **Arabic** with full right-to-left (RTL) layout switching.

---

## Architecture

| Component | Implementation |
|-----------|----------------|
| Locales | `en` (default), `ar` |
| Direction | `ltr` for English, `rtl` for Arabic |
| Storage | Browser `localStorage` key for persistence |
| Provider | React context at application root |
| Toggle | User menu language switcher |

---

## Translation API

```typescript
const { locale, direction, setLocale, t } = useI18n()

// Usage
t('auth.sign_in')     // → "Sign In" or "تسجيل الدخول"
t('app.name')         // → "Growa Qatar" or localized equivalent
```

### Key Convention
Dot-notation keys organized by domain:
- `auth.*` — Authentication strings
- `app.*` — Application branding
- `common.*` — Shared UI labels
- `dashboard.*` — Dashboard-specific strings

Fallback: if key missing, the key itself is displayed (aids development).

---

## RTL Support

When Arabic is selected:
- `document.documentElement.dir` set to `rtl`
- `document.documentElement.lang` set to `ar`
- Layout components adapt via CSS logical properties and Tailwind direction utilities

---

## Bilingual Data Model

Operational entities store bilingual content:
- `name_en` / `name_ar` on farms, organizations, crops
- `description_en` / `description_ar` where applicable

UI displays content in the user's selected locale with fallback to English.

---

## Configuration

Environment-driven defaults:
- `NEXT_PUBLIC_DEFAULT_LOCALE` — Default locale (e.g., `en`)
- `NEXT_PUBLIC_SUPPORTED_LOCALES` — Comma-separated list (e.g., `en,ar`)

Country deployment config (`lib/config/country-qatar.ts`) defines Qatar-specific locale preferences.

---

## Coverage Scope

| Area | Bilingual |
|------|-----------|
| Authentication pages | ✅ Full |
| Dashboard navigation | ✅ Full |
| Common UI components | ✅ Full |
| Intelligence workspaces | Partial (metrics in English) |
| Growa AI briefings | English only (by design) |
| Database content | Bilingual fields where applicable |

---

## Related Notes

- [[02-Platform-Architecture]]
- [[03-Technology-Stack]]
- [[09-Data-Model]]
