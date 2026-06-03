const fs = require('fs');

const path1 = 'c:/Users/manso/OneDrive/Desktop/TTASK/backend-main/frontend/src/pages/admin/AdminJTokenRequests.jsx';
const path2 = 'c:/Users/manso/OneDrive/Desktop/backend/frontend/src/pages/admin/AdminJTokenRequests.jsx';

const content1 = fs.readFileSync(path1, 'utf8');
const content2 = fs.readFileSync(path2, 'utf8');

if (content1 === content2) {
  console.log('Both AdminJTokenRequests.jsx are identical!');
} else {
  console.log('AdminJTokenRequests.jsx files differ!');
  // Let's print out the differences or the size
  console.log(`Sizes: local=${content1.length}, git=${content2.length}`);
}
