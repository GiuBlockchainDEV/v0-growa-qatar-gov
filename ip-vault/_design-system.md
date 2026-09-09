# Growa Corporate Design System

> Internal reference for the IP Protection knowledge vault visual language.

## Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `growa-off-white` | `#F6F6F2` | Page background, section fills |
| `growa-near-black` | `#191815` | Primary text, dark sections, code blocks |
| `growa-card` | `#FFFFFF` | Modular content cards |
| `growa-border` | `#E2E2DC` | Card and table borders |
| `growa-green` | `#35A853` | Accents, rules, highlights |
| `growa-muted` | `#6B6B66` | Secondary text |

## Typography

| Role | Family | Weight | Style |
|------|--------|--------|-------|
| Display / H1–H2 | Barlow Condensed | 700 | Uppercase, tight tracking |
| Body | Source Sans 3 | 400 | Normal case |
| Code / Black-box | JetBrains Mono | 400 | Abstract snippets only |

## Components

### Card Callout
```markdown
> [!card] Section Title
> Content inside a white modular card.
```

### Black-Box Callout
```markdown
> [!blackbox] Protected Component
> High-level interface description. Implementation withheld.
```

## Content Rules

1. **Black-box first** — show interfaces, never implementations
2. **Abstract snippets** — pseudocode with generic names
3. **No secrets** — zero credentials, URLs, or policy logic
4. **Value legibility** — every section answers *why it matters*
