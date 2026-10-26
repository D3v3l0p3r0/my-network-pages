import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {publicHost} from './network.mjs';
import {randomInt} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {extract,profile,identity} from './core.mjs';
import {GROUPS,parseManifest,groupedProfile} from './groups.mjs';
import {jsonCandidates} from './json-sources.mjs';
const exec=promisify(execFile), settings=JSON.parse(await fs.readFile('config.json','utf8'));
const dry=process.argv.includes('--dry-run'), xray=process.env.XRAY_BIN||'xray';
async function download(url) {
  for(let i=0;i<5;i++) {
    const u=new URL(url); if(u.protocol!=='https:'||!(await publicHost(u.hostname))) throw Error('Source must use public HTTPS');
    const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(15000)});
    if(r.status>=300&&r.status<400){url=new URL(r.headers.get('location'),u).href;await r.body?.cancel();continue;}
    if(!r.ok) throw Error('Source HTTP error');
    let size=0;const chunks=[];
    for await(const b of r.body){size+=b.length;if(size>settings.maxSourceBytes)throw Error('Source too large');chunks.push(b);}
    return Buffer.concat(chunks).toString('utf8');
  }
  throw Error('Too many redirects');
}
async function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
async function check(p) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'vpn-check-'));let child;
  try {
    const host=p.outbounds[0].settings.vnext[0].address;
    if(!(await publicHost(host)))return null;
    const port=await freePort(), cfg=structuredClone(p);
    cfg.inbounds=[{listen:'127.0.0.1',port,protocol:'http',settings:{}}];
    const file=path.join(dir,'config.json');await fs.writeFile(file,JSON.stringify(cfg));
    child=spawn(xray,['run','-c',file],{stdio:'ignore'});
    let failed=false; child.on('error',()=>failed=true);child.on('exit',()=>failed=true);
    // Wait for this isolated Xray instance rather than assuming process startup time.
    for(let i=0;i<40;i++) {
      if(failed)return null;
      const ready=await new Promise(r=>{const s=net.connect(port,'127.0.0.1');s.setTimeout(100);s.on('connect',()=>{s.destroy();r(true)});s.on('error',()=>r(false));s.on('timeout',()=>{s.destroy();r(false)});});
      if(ready)break;await new Promise(r=>setTimeout(r,50));
    }
    const start=Date.now();
    const {stdout}=await exec('curl',['--silent','--show-error','--fail','--noproxy','','--proxy','http://127.0.0.1:'+port,'--connect-timeout','5','--max-time','10','--output',path.join(dir,'body'),'--write-out','%{http_code}',settings.testUrl],{timeout:12000,maxBuffer:1024});
    if(stdout.trim()!=='204')return null;
    if(settings.youtubeTestUrl){const yt=await exec('curl',['--silent','--show-error','--head','--noproxy','','--proxy','http://127.0.0.1:'+port,'--connect-timeout','5','--max-time','8','--output',path.join(dir,'youtube-headers'),'--write-out','%{http_code}',settings.youtubeTestUrl],{timeout:10000,maxBuffer:1024});if(!/^[23]\d\d$/.test(yt.stdout.trim()))return null;}
    return Date.now()-start;
  } catch {return null;} finally {
    if(child&&child.exitCode===null){await new Promise(resolve=>{child.once('exit',resolve);child.kill();setTimeout(()=>{child.kill('SIGKILL');resolve()},1000).unref();});}
    await fs.rm(dir,{recursive:true,force:true});
  }
}
const candidates=new Map();let failures=0;
function addCandidate(item,group){const k=identity(item.p);if(!candidates.has(k)&&candidates.size<10000)candidates.set(k,{...item,groups:[]});const found=candidates.get(k);if(found){if(!found.groups.includes(group))found.groups.push(group);if(item.preferred)found.preferred=true;if(item.locallyTested)found.locallyTested=true}}
for(const source of settings.jsonSources||[]){try{for(const item of jsonCandidates(await download(source.url),source.selections))addCandidate(item,item.group)}catch{failures++}}
const sources=[...settings.sources];
for(const manifest of settings.manifests||[]){try{const found=parseManifest(await download(manifest.url),manifest.selections);for(const s of found){if(!s.url.startsWith(manifest.allowedPrefix))continue;sources.push(s)}}catch{failures++}}
for(const s of sources) {
 try{for(const uri of extract(await download(s.url))){try{const p=profile(uri);addCandidate({uri,p,locallyTested:!!s.locallyTested},s.group||'normal');}catch{}}}catch{failures++}
}
console.log(JSON.stringify({sources:sources.length,sourceFailures:failures,candidates:candidates.size,dryRun:dry}));
if(dry)process.exit(candidates.size?0:1);
if(!candidates.size)throw Error('No candidates: existing publication preserved');
await exec(xray,['version']);await exec('curl',['--version']);
const selected=new Map(),budget=Math.max(1,Math.floor(settings.maxCandidates/GROUPS.length));
for(const group of GROUPS){const pool=[...candidates.entries()].filter(([,x])=>x.groups.includes(group.id));for(let i=pool.length-1;i>0;i--){const j=randomInt(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}pool.sort((a,b)=>(2*Number(!!b[1].locallyTested)+Number(!!b[1].preferred))-(2*Number(!!a[1].locallyTested)+Number(!!a[1].preferred)));for(const [key,item]of pool.slice(0,budget))selected.set(key,item)}
const queue=[...selected.values()],results=[];
await Promise.all(Array.from({length:settings.concurrency},async()=>{while(queue.length){const item=queue.shift();const ms=await check(item.p);if(ms!==null)results.push({...item,ms});}}));
results.sort((a,b)=>a.ms-b.ms);
if(!results.length)throw Error('No verified nodes: existing publication preserved');
let previous={};try{previous=JSON.parse(await fs.readFile('dist/pools.json','utf8'))}catch{}
if(!(settings.jsonSources||[]).length)for(const g of GROUPS)if(previous[g.id])previous[g.id].nodes=previous[g.id].nodes.filter(n=>!n.preferred);
const stamp=new Date().toISOString(),pools={},groups={};
for(const group of GROUPS){const available=results.filter(x=>x.groups.includes(group.id));const reserve=available.filter(x=>x.locallyTested||x.preferred).sort((a,b)=>Number(!!b.locallyTested)-Number(!!a.locallyTested)).slice(0,Math.min(6,settings.maxPublished));const fresh=[...reserve,...available.filter(x=>!reserve.includes(x))].slice(0,settings.maxPublished);const old=previous[group.id];pools[group.id]=fresh.length?{updatedAt:stamp,nodes:fresh}:old||{updatedAt:null,nodes:[]};groups[group.id]={name:group.name,count:pools[group.id].nodes.length,updatedAt:pools[group.id].updatedAt,lastAttemptSucceeded:fresh.length>0,whitelistVerifiedLocally:false};}
const profiles=GROUPS.map(g=>groupedProfile(g,pools[g.id].nodes,settings.testUrl));
const validation=await fs.mkdtemp(path.join(os.tmpdir(),'vpn-groups-'));
try{for(let i=0;i<profiles.length;i++){const file=path.join(validation,i+'.json');await fs.writeFile(file,JSON.stringify(profiles[i]));await exec(xray,['run','-test','-c',file],{timeout:10000,maxBuffer:65536});}}finally{await fs.rm(validation,{recursive:true,force:true})}
await fs.mkdir('dist',{recursive:true});
await fs.writeFile('dist/happ.json',JSON.stringify(profiles,null,2));
await fs.writeFile('dist/pools.json',JSON.stringify(pools));
await fs.writeFile('dist/sub.txt',GROUPS.flatMap(g=>pools[g.id].nodes.map(x=>x.uri).filter(Boolean)).join('\n')+'\n');
await fs.writeFile('dist/status.json',JSON.stringify({updatedAt:stamp,count:GROUPS.reduce((n,g)=>n+groups[g.id].count,0),profileCount:2,groups,candidates:candidates.size,sourceFailures:failures,check:'HTTPS 204 through Xray; whitelist classification is source-declared, not verified from a restricted carrier'},null,2));
console.log(JSON.stringify({profiles:2,groups,updatedAt:stamp}));
