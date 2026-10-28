const fs = require('fs');
const str = fs.readFileSync('C:\\Users\\Tofee\\Desktop\\ice-portal-in-house\\src\\app\\dashboard\\mock-data.ts').toString();
const start = str.indexOf('export const incidents');
let i = start;
let count = 0;
const endArr = str.indexOf('];', start);
while (true) {
  const idx = str.indexOf('id:', i);
  if (idx === -1 || idx > endArr) break;
  const q1 = str.indexOf('"', idx);
  const q2 = str.indexOf('"', q1 + 1);
  if (q1 === -1 || q2 === -1) break;
  const incId = str.substring(q1 + 1, q2);
  const e1 = str.indexOf('\n    },', idx);
  const e2 = str.indexOf('\n  },', idx);
  const cand = [e1, e2].filter(x => x !== -1);
  if (cand.length === 0) break;
  const oe = Math.min(...cand);
  const obj = str.substring(idx, oe);
  count++;
  console.log(count + ': ' + incId + ': ' + (obj.includes('incidentType') ? 'Y' : 'N'));
  i = oe;
}
