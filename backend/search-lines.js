const fs = require('fs');

const files = [
  'c:/Users/manso/OneDrive/Desktop/TTASK/backend-main/frontend/src/pages/user/BuyJToken.jsx',
  'c:/Users/manso/OneDrive/Desktop/TTASK/backend-main/frontend/src/pages/user/Deposit.jsx',
  'c:/Users/manso/OneDrive/Desktop/TTASK/backend-main/frontend/src/pages/user/Withdraw.jsx'
];

files.forEach(file => {
  console.log(`\n=== LINES IN ${file} ===`);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('Order') || line.includes('Status') || line.includes('N/A')) {
      console.log(`${idx+1}: ${line.trim()}`);
    }
  });
});
