// Lists English text that has no Spanish yet in src/lib/i18n/es.ts.
//   npm run i18n:check           → prints what's missing
//   npm run i18n:check -- --json → the same, as a JSON list
//
// It finds text in three ways:
//   1. every t("…") call in src
//   2. labels in files whose text is translated later with t(someVariable)
//   3. error/success messages returned by server actions
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const ROOT = new URL("..", import.meta.url).pathname
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })
const unescape = (s) => JSON.parse(`"${s}"`)
const STRING = /"((?:[^"\\\n]|\\.)*)"/g

const keys = new Set()
const files = walk(join(ROOT, "src")).filter((f) => !f.includes("/i18n/"))

for (const f of files) {
  const src = readFileSync(f, "utf8")
  for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\\n]|\\.)*)"/g)) keys.add(unescape(m[1]))
}

// Files whose labels are shown through t(variable).
const LABEL_FILES = [
  "src/lib/constants.ts",
  "src/app/page.tsx",
  "src/lib/start-guide.ts",
  "src/lib/setup-progress.ts",
  "src/lib/menu-reader.ts",
  "src/components/app-nav.tsx",
  "src/components/market-filters.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/documents/page.tsx",
  "src/app/onboarding/page.tsx",
  "src/app/applications/page.tsx",
  "src/app/applications/[id]/page.tsx",
]
const looksLikeText = (s) => /^[A-Z¿¡✓#]/.test(s) && /[a-z]/.test(s) && !s.startsWith("use ")
for (const rel of LABEL_FILES) {
  let src
  try {
    src = readFileSync(join(ROOT, rel), "utf8")
  } catch {
    continue
  }
  src = src.replace(/^\s*(import|export \* from).*$/gm, "").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
  for (const m of src.matchAll(STRING)) {
    const s = unescape(m[1])
    if (looksLikeText(s) && !s.includes("/")) keys.add(s)
  }
}

// Messages from server actions.
for (const f of walk(join(ROOT, "src/actions"))) {
  const src = readFileSync(f, "utf8")
  for (const m of src.matchAll(/\b(?:error|success)\s*:\s*"((?:[^"\\\n]|\\.)*)"/g)) keys.add(unescape(m[1]))
  for (const m of src.matchAll(/\bfail\(\s*"((?:[^"\\\n]|\\.)*)"/g)) keys.add(unescape(m[1]))
}

const es = readFileSync(join(ROOT, "src/lib/i18n/es.ts"), "utf8")
const have = new Set()
for (const m of es.matchAll(/^\s*"((?:[^"\\\n]|\\.)*)"\s*:/gm)) have.add(unescape(m[1]))

const missing = [...keys].filter((k) => !have.has(k)).sort()
if (process.argv.includes("--json")) console.log(JSON.stringify(missing, null, 1))
else {
  for (const k of missing) console.log(k)
  console.error(`\n${keys.size} texts, ${missing.length} without Spanish.`)
}
