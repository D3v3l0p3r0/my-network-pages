export const GROUPS=[{id:'normal',name:'Обычные'},{id:'whitelist',name:'Белые списки'}];
export function parseManifest(text,selections){let category='';const result=[];for(const raw of text.split(/\r?\n/)){const line=raw.trim();const m=line.match(/^===\s*(.*?)\s*===$/);if(m){category=m[1];continue}if(!line.startsWith('https://'))continue;const rule=selections.find(s=>category.includes(s.category));if(rule)result.push({name:'Автор · '+category,url:line,group:rule.group});}return result;}
export function groupedProfile(group,nodes,probeUrl){
 const outbounds=nodes.map((node,i)=>({...structuredClone(node.p.outbounds[0]),tag:'pool-'+i}));
 const block={tag:'block',protocol:'blackhole'};
 if(!outbounds.length)return {remarks:group.name,log:{loglevel:'warning'},inbounds:[],outbounds:[block],routing:{rules:[{type:'field',network:'tcp,udp',outboundTag:'block'}]}};
 return {remarks:group.name,log:{loglevel:'warning'},inbounds:[],outbounds:[block,...outbounds],observatory:{subjectSelector:['pool-'],probeUrl,probeInterval:'30s',enableConcurrency:true},routing:{domainStrategy:'AsIs',rules:[{type:'field',ip:['geoip:private'],outboundTag:'block'},{type:'field',network:'tcp,udp',balancerTag:'auto'}],balancers:[{tag:'auto',selector:['pool-'],fallbackTag:'block',strategy:{type:'leastPing'}}]}};
}
