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
    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('Amount') && content.includes('Method') && content.includes('Status')) {
        console.log(`FOUND FILE: ${fullPath}`);
      }
    }
  }
}

console.log('Searching for files containing Amount, Method, and Status:');
searchDir('c:/Users/manso/OneDrive/Desktop/TTASK/backend-main/frontend');
