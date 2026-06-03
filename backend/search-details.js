const fs = require('fs');
const path = require('path');

const root = 'c:/Users/manso/OneDrive/Desktop/backend/frontend/src';

function search(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      search(full);
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      const text = fs.readFileSync(full, 'utf8');
      const lines = text.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('request details')) {
          console.log(`${full}:${idx+1}: ${line.trim()}`);
        }
      });
    }
  }
}

console.log('Searching in Git frontend src:');
search(root);
