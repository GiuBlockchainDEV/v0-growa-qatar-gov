import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

const FILES = [
  '00-Index.md',
  '01-Executive-Summary.md',
  '02-Platform-Architecture.md',
  '03-Technology-Stack.md',
  '04-Module-Registry.md',
  '05-Intelligence-Workspaces.md',
  '06-Map-Centric-UX.md',
  '07-Compliance-Governance.md',
  '08-Supply-Chain.md',
  '09-Data-Model.md',
  '10-Auth-Access-Model.md',
  '11-Row-Level-Security.md',
  '12-Growa-AI-Methodology.md',
  '13-Internationalization.md',
  '14-API-Design.md',
  '15-IP-Claims-Summary.md',
  '16-Security-Redaction-Policy.md',
  '17-Glossary.md',
]

function stripObsidianLinks(content) {
  return content
    .replace(/← \[\[.*?\]\].*\n/g, '')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, display) => display || target)
    .replace(/^> \*\*Document classification:\*\*.*\n/gm, '')
    .replace(/^## Tags\n\n`#.*`\n\n/gm, '')
}

let combined = `---
title: "Growa Platform — Intellectual Property Vault"
subtitle: "Public-Safe Edition — IP Deposit Documentation"
author: "Growa Platform"
date: "September 2026"
---

<div style="page-break-after: always;"></div>

`

for (const file of FILES) {
  const content = readFileSync(join(__dirname, file), 'utf-8')
  combined += stripObsidianLinks(content) + '\n\n<div style="page-break-after: always;"></div>\n\n'
}

const combinedPath = join(__dirname, 'Growa-IP-Vault-Combined.md')
writeFileSync(combinedPath, combined)
console.log(`Combined markdown written to ${combinedPath}`)

const cssPath = join(__dirname, 'pdf-style.css')
const pdfPath = join(__dirname, 'Growa-IP-Vault.pdf')

execSync(
  `npx --yes md-to-pdf "${combinedPath}" --dest "${pdfPath}" --stylesheet "${cssPath}" --pdf-options '{"format":"A4","margin":{"top":"20mm","bottom":"20mm","left":"18mm","right":"18mm"},"printBackground":true}'`,
  { stdio: 'inherit', cwd: __dirname }
)

console.log(`PDF generated: ${pdfPath}`)
