const fs = require('fs');
const file = 'D:/2. NATA_PROJECTAPP/PM_LABHA/MLPHoma/src/components/ahsp/AHSPCreationModeDialog.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/rounded-2xl/g, 'rounded-xl');
content = content.replace(/rounded-xl/g, 'rounded-lg');
content = content.replace(/font-black/g, 'font-bold');
content = content.replace(/shadow-lg/g, 'shadow-md');
content = content.replace(/p-5/g, 'p-4');
content = content.replace(/text-3xl/g, 'text-xl');
content = content.replace(/text-xl/g, 'text-lg');

fs.writeFileSync(file, content);
console.log('Done refactoring AHSPCreationModeDialog.tsx');
