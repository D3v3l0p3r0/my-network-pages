import {createHash} from 'node:crypto';
export function extract(text) {
  let t=text.trim();
  if (!t.includes('://') && !t.startsWith('[') && !t.startsWith('{')) {
    try { t=Buffer.from(t.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'); } catch {}
  }
  return t.split(/\r?\n/).map(s=>s.trim()).filter(s=>s.startsWith('vless://'));
}
export function profile(uri) {
  const u=new URL(uri), q=u.searchParams, host=u.hostname.replace(/^\[|\]$/g,'');
  if(u.protocol!=='vless:' || !host || !u.port || !/^[0-9a-f-]{36}$/i.test(u.username)) throw Error('Invalid VLESS');
  const network=q.get('type')||'tcp', security=q.get('security')||'none';
  if(!['tcp','ws','xhttp','grpc'].includes(network)) throw Error('Unsupported transport');
  if(!['none','tls','reality'].includes(security)) throw Error('Unsupported security');
  if(q.get('allowInsecure')==='1') throw Error('Insecure certificate verification');
  const streamSettings={network,security};
  if(security==='tls') streamSettings.tlsSettings={serverName:q.get('sni')||host,allowInsecure:false,...(q.get('fp')?{fingerprint:q.get('fp')}:{})};
  if(security==='reality') {
    if(!q.get('pbk')||!q.get('sni')) throw Error('Incomplete Reality');
    streamSettings.realitySettings={serverName:q.get('sni'),fingerprint:q.get('fp')||'chrome',publicKey:q.get('pbk'),shortId:q.get('sid')||'',spiderX:q.get('spx')||'/'};
  }
  if(network==='ws') streamSettings.wsSettings={path:q.get('path')||'/',headers:{Host:q.get('host')||q.get('sni')||host}};
  if(network==='xhttp') streamSettings.xhttpSettings={path:q.get('path')||'/',host:q.get('host')||q.get('sni')||host,mode:q.get('mode')||'auto'};
  if(network==='grpc') streamSettings.grpcSettings={serviceName:q.get('serviceName')||'',multiMode:q.get('mode')==='multi'};
  const user={id:decodeURIComponent(u.username),encryption:'none',...(q.get('flow')?{flow:q.get('flow')}:{})};
  return {remarks:decodeURIComponent(u.hash.slice(1))||'VLESS',log:{loglevel:'warning'},inbounds:[],outbounds:[{tag:'proxy',protocol:'vless',settings:{vnext:[{address:host,port:Number(u.port),users:[user]}]},streamSettings},{tag:'direct',protocol:'freedom'},{tag:'block',protocol:'blackhole'}],routing:{rules:[{type:'field',ip:['geoip:private'],outboundTag:'block'}]}};
}
export function identity(p) { return createHash('sha256').update(JSON.stringify(p.outbounds[0])).digest('hex'); }
