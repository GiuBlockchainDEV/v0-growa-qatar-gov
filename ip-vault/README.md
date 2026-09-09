# Growa IP Protection — Corporate Knowledge Vault

Minimal Obsidian vault for intellectual property deposit. Black-box architecture. Trade-secret safe.

## Open in Obsidian

1. Open Obsidian → **Open folder as vault**
2. Select this `ip-vault/` directory
3. Enable snippet: **Settings → Appearance → CSS snippets → growa-corporate**

## Design System

| Token | Value |
|-------|-------|
| Off-white background | `#F6F6F2` |
| Near-black | `#191815` |
| Growa green accent | `#35A853` |
| Card surface | `#FFFFFF` |
| Card border | `#E2E2DC` |

Headers use **Barlow Condensed** (bold, uppercase). Content uses modular `card` and `blackbox` callouts.

## Vault Structure

```
00-Index                  Hub
01-Corporate-Overview     Value & positioning
02-Black-Box-Architecture Protected component map
03-Platform-Ontology      Module registry & data domains
04-Intelligence-Systems   Analytics & Growa AI
05-Governance-Compliance  Regulatory & supply workflows
06-Trust-Boundary         Identity, isolation, API perimeter
07-IP-Register            Claims, redaction, glossary
```

## Export PDF

```bash
cd ip-vault && node export-pdf.mjs
```

Output: `Growa-IP-Protection.pdf`

## Content Rules

- Interfaces published, implementations protected
- Code snippets are abstract pseudocode only
- No credentials, URLs, or security policy logic
