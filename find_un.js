const fs = require('fs');
const t = fs.readFileSync('C:\\Users\\Tofee\\Desktop\\ice-portal-in-house\\src\\app\\incidents\\incident-status.tsx','utf8');
const lines = t.split(/\r?\n/);
for(let i=0;i<lines.length;i++){
  if(lines[i].includes('UNCLASSIFIED')){
    for(let j=Math.max(0,i-5); j<Math.min(lines.length,i+15); j++){
      console.log((j+1)+': '+lines[j]);
    }
    break;
  }
}
