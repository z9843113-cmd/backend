const fs = require('fs');

const path = 'c:/Users/manso/OneDrive/Desktop/backend/frontend/src/pages/admin/AdminJTokenRequests.jsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

console.log(`Searching in Git admin file ${path}:`);
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('order') || line.toLowerCase().includes('status') || line.toLowerCase().includes('method') || line.toLowerCase().includes('details')) {
    console.log(`${idx+1}: ${line.trim()}`);
  }
});
