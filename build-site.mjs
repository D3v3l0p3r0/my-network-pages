import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import qrcode from './qrcode.cjs';import {GROUPS,groupedProfile} from './groups.mjs';
await fs.mkdir('dist',{recursive:true});let status;
try{status=JSON.parse(await fs.readFile('dist/status.json','utf8'))}catch{status={count:0,updatedAt:null}}
const now=new Date().toISOString();status.lastBuildAt=now;status.lastAttemptAt=now;status.lastAttemptSucceeded=process.env.CHECK_SUCCEEDED==='true';
let pools;try{pools=JSON.parse(await fs.readFile('dist/pools.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
if(pools){
 const settings=JSON.parse(await fs.readFile('config.json','utf8'));
 if(!(settings.jsonSources||[]).length)for(const group of GROUPS)if(pools[group.id])pools[group.id].nodes=pools[group.id].nodes.filter(n=>!n.preferred);
 const profiles=GROUPS.map(g=>groupedProfile(g,pools[g.id]?.nodes||[],settings.testUrl));
 const xray=process.env.XRAY_BIN||(process.env.GITHUB_ACTIONS==='true'?'/tmp/xray/xray':null);
 if(xray){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'profile-build-'));try{for(let i=0;i<profiles.length;i++){const file=path.join(dir,i+'.json');await fs.writeFile(file,JSON.stringify(profiles[i]));await promisify(execFile)(xray,['run','-test','-c',file],{timeout:10000,maxBuffer:65536,env:{...process.env,XRAY_LOCATION_ASSET:process.env.XRAY_LOCATION_ASSET||path.dirname(xray)}})}}finally{await fs.rm(dir,{recursive:true,force:true})}}
 await fs.writeFile('dist/happ.json',JSON.stringify(profiles,null,2));await fs.writeFile('dist/pools.json',JSON.stringify(pools));
 status.groups||={};for(const g of GROUPS){status.groups[g.id]||={name:g.name,updatedAt:pools[g.id]?.updatedAt||null,lastAttemptSucceeded:false};status.groups[g.id].count=pools[g.id]?.nodes?.length||0}
 status.count=GROUPS.reduce((n,g)=>n+status.groups[g.id].count,0);status.profileCount=2;status.profileVersion=3;status.profileBuiltAt=now;
}
await fs.writeFile('dist/status.json',JSON.stringify(status,null,2));await fs.copyFile('index.template.html','dist/index.html');await fs.writeFile('dist/.nojekyll','');
const [owner,repository]=(process.env.GITHUB_REPOSITORY||'D3v3l0p3r0/my-network-pages').split('/');const projectPath=repository.toLowerCase()===owner.toLowerCase()+'.github.io'?'':repository+'/';const subscription=new URL('happ.json','https://'+owner+'.github.io/'+projectPath).href;const qr=qrcode(0,'M');qr.addData(subscription);qr.make();await fs.writeFile('dist/qr.svg',qr.createSvgTag({cellSize:6,margin:24,scalable:true,alt:'Ссылка подписки Happ'}));
