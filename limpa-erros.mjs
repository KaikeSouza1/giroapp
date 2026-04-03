import fs from 'fs';
import path from 'path';

// O diretório que vamos varrer (todo o seu código fonte)
const DIR_TO_SCAN = './src';

// Lista de palavras em inglês do banco antigo e suas novas traduções.
// O regex (['"`]) garante que só vamos alterar se for uma string isolada no código.
const REPLACEMENTS = [
  { from: /(['"`])org_admin(['"`])/g, to: "$1admin_org$2" },
  { from: /(['"`])run(['"`])/g, to: "$1corrida$2" },
  { from: /(['"`])cycling(['"`])/g, to: "$1cicloturismo$2" },
  { from: /(['"`])walk(['"`])/g, to: "$1caminhada$2" },
  { from: /(['"`])draft(['"`])/g, to: "$1rascunho$2" },
  { from: /(['"`])medium(['"`])/g, to: "$1medio$2" },
  { from: /(['"`])completed(['"`])/g, to: "$1concluido$2" },
  { from: /(['"`])in_progress(['"`])/g, to: "$1em_andamento$2" },
  { from: /(['"`])paused(['"`])/g, to: "$1pausado$2" },
  { from: /(['"`])cancelled(['"`])/g, to: "$1cancelado$2" },
  { from: /(['"`])easy(['"`])/g, to: "$1facil$2" },
  { from: /(['"`])hard(['"`])/g, to: "$1dificil$2" },
  { from: /(['"`])extreme(['"`])/g, to: "$1extremo$2" },
  { from: /(['"`])pending(['"`])/g, to: "$1pendente$2" },
  { from: /(['"`])approved(['"`])/g, to: "$1aprovado$2" },
  { from: /(['"`])rejected(['"`])/g, to: "$1rejeitado$2" }
];

let filesChanged = 0;

function walkDirAndReplace(currentPath) {
  const files = fs.readdirSync(currentPath);

  for (const file of files) {
    const fullPath = path.join(currentPath, file);
    
    // Se for pasta, entra nela (ignora node_modules por segurança)
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        walkDirAndReplace(fullPath);
      }
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      // Se for arquivo de código, lê o conteúdo
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      REPLACEMENTS.forEach(r => {
        if (r.from.test(content)) {
          content = content.replace(r.from, r.to);
          modified = true;
        }
      });

      // Se achou algo pra mudar, salva o arquivo de volta
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Corrigido: ${fullPath}`);
        filesChanged++;
      }
    }
  }
}

console.log("🚀 Iniciando varredura implacável de traduções...");
walkDirAndReplace(DIR_TO_SCAN);
console.log(`🔥 Finalizado! ${filesChanged} arquivos foram corrigidos.`);