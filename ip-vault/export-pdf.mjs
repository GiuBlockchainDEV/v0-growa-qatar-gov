import { readFileSync, writeFileSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

const FILES = [
  '00-Index.md',
  '01-Corporate-Overview.md',
  '02-Black-Box-Architecture.md',
  '03-Platform-Ontology.md',
  '04-Intelligence-Systems.md',
  '05-Governance-Compliance.md',
  '06-Trust-Boundary.md',
  '07-IP-Register.md',
]

const COVER_HTML = `
<div class="cover-page">
  <div>
    <div class="cover-accent"></div>
    <div class="cover-brand">Growa Platform</div>
    <h1 class="cover-title">IP Protection<br>Knowledge System</h1>
    <p class="cover-subtitle">
      Corporate documentation establishing platform ownership, sovereign capability,
      and architectural intent — with trade secrets and security logic strictly protected.
    </p>
  </div>
  <div class="cover-meta">
    <div class="cover-meta-item"><strong>Classification</strong>Intellectual Property — Public-Safe</div>
    <div class="cover-meta-item"><strong>Version</strong>2.0 Corporate</div>
    <div class="cover-meta-item"><strong>Date</strong>September 2026</div>
    <div class="cover-meta-item"><strong>Approach</strong>Black-Box Architecture</div>
  </div>
  <div class="cover-footer">GROWA · SOVEREIGN AGRICULTURAL OPERATIONS PLATFORM · ALL RIGHTS RESERVED</div>
</div>
`

function transformCallouts(md) {
  return md.replace(
    /> \[!(card|blackbox)\] (.+)\n((?:> .+\n?)*)/g,
    (_, type, title, body) => {
      const cls = type === 'blackbox' ? 'growa-blackbox' : 'growa-card'
      const cleanBody = body.replace(/^> /gm, '').trim()
      return `<div class="${cls}"><div class="${cls}-header">${title}</div><div class="${cls}-body">\n\n${cleanBody}\n\n</div></div>\n\n`
    }
  )
}

function stripObsidian(md) {
  return md
    .replace(/← \[\[.*?\]\].*\n/g, '')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, _t, display) => display || _t)
    .replace(/^`#.*`\n\n/gm, '')
}

let combined = COVER_HTML + '\n<div class="content-wrapper">\n'

for (const file of FILES) {
  const raw = readFileSync(join(__dirname, file), 'utf-8')
  const processed = transformCallouts(stripObsidian(raw))
  combined += `<div class="page-section">\n\n${processed}\n\n</div>\n\n`
}

combined += '</div>\n'

const mdPath = join(__dirname, 'Growa-IP-Protection.md')
writeFileSync(mdPath, combined)
console.log(`Markdown written: ${mdPath}`)

const pdfPath = join(__dirname, 'Growa-IP-Protection.pdf')
const cssPath = join(__dirname, 'pdf-style.css')

execSync(
  `npx --yes md-to-pdf "${mdPath}" --stylesheet "${cssPath}" --pdf-options '{"format":"A4","margin":{"top":"0","bottom":"0","left":"0","right":"0"},"printBackground":true}'`,
  { stdio: 'inherit', cwd: __dirname }
)

// md-to-pdf outputs alongside source file
const generated = mdPath.replace(/\.md$/, '.pdf')
if (generated !== pdfPath) {
  renameSync(generated, pdfPath)
}

console.log(`PDF generated: ${pdfPath}`)
