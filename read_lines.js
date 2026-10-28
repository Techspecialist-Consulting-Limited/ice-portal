const fs = require('fs');
const lines = fs.readFileSync('C:\\Users\\Tofee\\Desktop\\ice-portal-in-house\\src\\app\\incidents\\incident-status.tsx').toString().split('\n');
for(let i=46; i<=60 && i<lines.length; i++) {
  console.log((i+1)+': '+lines[i]);
}
