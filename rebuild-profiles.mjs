import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {GROUPS,groupedProfile} from './groups.mjs';
const exec=promisify(execFile),settings=JSON.parse(await fs.readFile('config.json','utf8'));
let pools;try{pools=JSON.parse(await fs.readFile('dist/pools.json','utf8'))}catch{console.log('No saved pools; profile rebuild skipped');process.exit(0)}
const profiles=GROUPS.map(g=>groupedProfile(g,pools[g.id]?.nodes||[],settings.testUrl));
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'profile-validate-'));
try{for(let i=0;i<profiles.length;i++){const f=path.join(dir,i+'.json');await fs.writeFile(f,JSON.stringify(profiles[i]));await exec(process.env.XRAY_BIN||'xray',['run','-test','-c',f],{timeout:10000,maxBuffer:65536})}}finally{await fs.rm(dir,{recursive:true,force:true})}
await fs.writeFile('dist/happ.json',JSON.stringify(profiles,null,2));
let status=JSON.parse(await fs.readFile('dist/status.json','utf8'));status.profileVersion=3;status.profileBuiltAt=new Date().toISOString();await fs.writeFile('dist/status.json',JSON.stringify(status,null,2));console.log('Rebuilt and Xray-validated two Happ profiles from previously checked nodes');
