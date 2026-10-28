const fs = require('fs');
const t = fs.readFileSync('C:\\Users\\Tofee\\Desktop\\ice-portal-in-house\\src\\app\\incidents\\incident-status.tsx','utf8');
const i = t.indexOf('UNCLASSIFIED');
if(i>=0){
  const start = Math.max(0,i-120);
  const end = Math.min(t.length, i+200);
  process.stdout.write(t.slice(start,end));
}
