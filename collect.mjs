import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {publicHost} from './network.mjs';
import {randomInt} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {extract,profile,identity} from './core.mjs';
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
    return Date.now()-start;
  } catch {return null;} finally {
    if(child&&child.exitCode===null){await new Promise(resolve=>{child.once('exit',resolve);child.kill();setTimeout(()=>{child.kill('SIGKILL');resolve()},1000).unref();});}
    await fs.rm(dir,{recursive:true,force:true});
  }
}
const candidates=new Map();let failures=0;
for(const s of settings.sources) {
  try{for(const uri of extract(await download(s.url))){try{const p=profile(uri);const k=identity(p);if(!candidates.has(k)&&candidates.size<10000)candidates.set(k,{uri,p});}catch{}}}
  catch {failures++;}
}
console.log(JSON.stringify({sources:settings.sources.length,sourceFailures:failures,candidates:candidates.size,dryRun:dry}));
if(dry)process.exit(candidates.size?0:1);
if(!candidates.size)throw Error('No candidates: existing publication preserved');
await exec(xray,['version']);await exec('curl',['--version']);
const pool=[...candidates.values()];
for(let i=pool.length-1;i>0;i--){const j=randomInt(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
const queue=pool.slice(0,settings.maxCandidates), results=[];
await Promise.all(Array.from({length:settings.concurrency},async()=>{while(queue.length){const item=queue.shift();const ms=await check(item.p);if(ms!==null)results.push({...item,ms});}}));
results.sort((a,b)=>a.ms-b.ms);const best=results.slice(0,settings.maxPublished);
if(!best.length)throw Error('No verified nodes: existing publication preserved');
await fs.mkdir('dist',{recursive:true});
const stamp=new Date().toISOString();
await fs.writeFile('dist/happ.json',JSON.stringify(best.map(x=>({...x.p,remarks:x.p.remarks+' · '+x.ms+'ms'})),null,2));
await fs.writeFile('dist/sub.txt',best.map(x=>x.uri).join('\n')+'\n');
await fs.writeFile('dist/status.json',JSON.stringify({updatedAt:stamp,count:best.length,candidates:candidates.size,sourceFailures:failures,check:'HTTPS 204 through Xray; not a local ISP availability test'},null,2));
console.log(JSON.stringify({verified:best.length,updatedAt:stamp}));
