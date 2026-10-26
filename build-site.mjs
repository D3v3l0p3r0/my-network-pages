import fs from 'node:fs/promises';
await fs.mkdir('dist',{recursive:true});let status;
try{status=JSON.parse(await fs.readFile('dist/status.json','utf8'))}catch{status={count:0,updatedAt:null}}
status.lastAttemptAt=new Date().toISOString();status.lastAttemptSucceeded=process.env.CHECK_SUCCEEDED==='true';
await fs.writeFile('dist/status.json',JSON.stringify(status,null,2));
await fs.copyFile('index.template.html','dist/index.html');await fs.writeFile('dist/.nojekyll','');
