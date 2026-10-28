const fs = require('fs');
const t = fs.readFileSync('C:\\Users\\Tofee\\Desktop\\ice-portal-in-house\\src\\app\\incidents\\incident-queue.tsx','utf8');
const i = t.indexOf('All report types');
if(i>=0){
  const start = Math.max(0,i-100);
  const end = Math.min(t.length,i+100);
  process.stdout.write(t.slice(start,end));
}
