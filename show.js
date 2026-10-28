const fs = require('fs');
const l = fs.readFileSync('C:\\Users\\Tofee\\Desktop\\ice-portal-in-house\\src\\app\\incidents\\incident-status.tsx','utf8').split(/\r?\n/);
for(let i=46;i<65;i++){ if(l[i]!==undefined) console.log(i+1+': '+l[i]); }
