const fs = require('fs');
const t = fs.readFileSync('C:\\Users\\Tofee\\Desktop\\ice-portal-in-house\\src\\app\\incidents\\incident-queue.tsx','utf8');
const m = t.match(/options=\[[^\]]+\]/);
if(m) process.stdout.write(m[0]);
