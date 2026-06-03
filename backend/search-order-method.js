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
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes('order') && content.toLowerCase().includes('method') && content.toLowerCase().includes('status')) {
        console.log(`MATCHING FILE: ${fullPath}`);
        // Let's print the lines that contain these
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes('order') || line.toLowerCase().includes('status') || line.toLowerCase().includes('method') || line.toLowerCase().includes('details')) {
            console.log(`  ${idx+1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

console.log('Searching in frontend/src:');
searchDir('c:/Users/manso/OneDrive/Desktop/TTASK/backend-main/frontend/src');
