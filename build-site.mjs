import qrcode from './qrcode.cjs';
import fs from 'node:fs/promises';
await fs.mkdir('dist',{recursive:true});let status;
try{status=JSON.parse(await fs.readFile('dist/status.json','utf8'))}catch{status={count:0,updatedAt:null}}
status.lastAttemptAt=new Date().toISOString();status.lastAttemptSucceeded=process.env.CHECK_SUCCEEDED==='true';
await fs.writeFile('dist/status.json',JSON.stringify(status,null,2));
await fs.copyFile('index.template.html','dist/index.html');await fs.writeFile('dist/.nojekyll','');

const [owner,repository]=(process.env.GITHUB_REPOSITORY||'D3v3l0p3r0/my-network-pages').split('/');
const projectPath=repository.toLowerCase()===owner.toLowerCase()+'.github.io'?'':repository+'/';
const subscription=new URL('happ.json','https://'+owner+'.github.io/'+projectPath).href;
const qr=qrcode(0,'M');qr.addData(subscription);qr.make();
await fs.writeFile('dist/qr.svg',qr.createSvgTag({cellSize:6,margin:24,scalable:true,alt:'Ссылка подписки Happ'}));
