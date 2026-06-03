const fs = require('fs');

const path1 = 'c:/Users/manso/OneDrive/Desktop/TTASK/backend-main/frontend/src/pages/user/BuyJToken.jsx';
const path2 = 'c:/Users/manso/OneDrive/Desktop/backend/frontend/src/pages/user/BuyJToken.jsx';

const content1 = fs.readFileSync(path1, 'utf8').split('\n');
const content2 = fs.readFileSync(path2, 'utf8').split('\n');

console.log(`BuyJToken.jsx Lines: local=${content1.length}, git=${content2.length}`);

for (let i = 0; i < Math.max(content1.length, content2.length); i++) {
  const line1 = content1[i] ? content1[i].trim() : null;
  const line2 = content2[i] ? content2[i].trim() : null;
  if (line1 !== line2) {
    console.log(`Line ${i+1} differs:`);
    console.log(`  local: ${line1}`);
    console.log(`  git  : ${line2}`);
  }
}
