const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else {
      const ext = path.extname(file);
      if (['.jsx', '.js', '.tsx', '.ts', '.html', '.json', '.vue'].includes(ext)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('Request Details') || content.includes('RequestDetails')) {
          console.log(`FOUND IN FILE: ${fullPath}`);
        }
      }
    }
  }
}

console.log('Searching in c:/Users/manso/OneDrive/Desktop/TTASK:');
searchDir('c:/Users/manso/OneDrive/Desktop/TTASK');
