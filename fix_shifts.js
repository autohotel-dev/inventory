const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function processFiles(directories) {
  directories.forEach(dir => {
    if (fs.existsSync(dir)) {
      walkDir(dir, (filePath) => {
        if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
          let content = fs.readFileSync(filePath, 'utf8');
          // Replace matching cases
          const regex = /\.eq\(['"`]status['"`],\s*['"`]active['"`]\)\s*\n?\s*\.maybeSingle\(\)/g;
          
          if (regex.test(content)) {
            const newContent = content.replace(regex, (match) => {
              return match.replace('.maybeSingle()', '.order("clock_in_at", { ascending: false }).limit(1).maybeSingle()');
            });
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Fixed:', filePath);
          }
        }
      });
    }
  });
}

processFiles([
  '/home/epigibson/Documentos/Desarrollos/inventory/frontend',
  '/home/epigibson/Documentos/Desarrollos/inventory/mobile'
]);
