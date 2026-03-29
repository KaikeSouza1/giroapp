// cleanup-static.mjs
// Remove export const dynamic = 'force-static' e generateStaticParams das API routes
// Mantenha nas PAGES (elas usam pattern diferente com Client Component separado)

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = process.cwd()

// Padrões que queremos REMOVER (apenas de API routes)
const PATTERNS_TO_REMOVE = [
  /export const dynamic = ['"]force-static['"]\s*\n?/g,
  /export function generateStaticParams\(\) \{ return \[\] \}\s*\n?/g,
  /\/\/ ← adicionar\s*\n?/g,
  /\/\/ Necessário para output: export\s*\n?/g,
  /\/\/ 👇 NECESSÁRIO PARA O BUILD ESTÁTICO \(CAPACITOR\)\s*\n?/g,
  /\/\/ 👇 CONFIGURAÇÃO OBRIGATÓRIA PARA O BUILD ESTÁTICO \(CAPACITOR\)\s*\n?/g,
  /\/\/ 👇 NECESSÁRIO PARA O BUILD ESTÁTICO\s*\n?/g,
  /\/\/ Necessário para output: export\s*\n?/g,
  /\/\/ ← ADICIONAR\s*\n?/g,
]

function walkDir(dir, fileList = []) {
  const files = readdirSync(dir)
  files.forEach(file => {
    const filePath = join(dir, file)
    if (statSync(filePath).isDirectory()) {
      if (!['node_modules', '.next', '.git', 'out'].includes(file)) {
        walkDir(filePath, fileList)
      }
    } else if (file === 'route.ts' || file === 'route.js') {
      fileList.push(filePath)
    }
  })
  return fileList
}

const apiRoutes = walkDir(join(ROOT, 'src', 'app', 'api'))

let changedCount = 0

for (const filePath of apiRoutes) {
  let content = readFileSync(filePath, 'utf8')
  const original = content

  for (const pattern of PATTERNS_TO_REMOVE) {
    content = content.replace(pattern, '')
  }

  // Remove linhas em branco duplas que sobraram
  content = content.replace(/\n{3,}/g, '\n\n')

  if (content !== original) {
    writeFileSync(filePath, content, 'utf8')
    console.log(`✅ Limpo: ${relative(ROOT, filePath)}`)
    changedCount++
  } else {
    console.log(`⏭️  Sem mudanças: ${relative(ROOT, filePath)}`)
  }
}

console.log(`\n🎉 Concluído! ${changedCount} arquivo(s) limpo(s).`)
