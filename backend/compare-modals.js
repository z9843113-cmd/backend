const fs = require('fs');

const path1 = 'c:/Users/manso/OneDrive/Desktop/TTASK/backend-main/frontend/src/components/RequestStatusModal.jsx';
const path2 = 'c:/Users/manso/OneDrive/Desktop/backend/frontend/src/components/RequestStatusModal.jsx';

const content1 = fs.readFileSync(path1, 'utf8');
const content2 = fs.readFileSync(path2, 'utf8');

if (content1 === content2) {
  console.log('Both RequestStatusModal.jsx are identical!');
} else {
  console.log('RequestStatusModal.jsx files differ!');
  // Let's print out the content of the git repo one
  console.log('=== Git Repo RequestStatusModal.jsx ===');
  console.log(content2);
}
