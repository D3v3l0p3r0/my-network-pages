export const GROUPS=[{id:'normal',name:'Обычные'},{id:'whitelist',name:'Белые списки'}];
export function parseManifest(text,selections){let category='';const result=[];for(const raw of text.split(/\r?\n/)){const line=raw.trim();const m=line.match(/^===\s*(.*?)\s*===$/);if(m){category=m[1];continue}if(!line.startsWith('https://'))continue;const rule=selections.find(s=>category.includes(s.category));if(rule)result.push({name:'Автор · '+category,url:line,group:rule.group});}return result;}
export function groupedProfile(group,nodes,probeUrl){
 const outbounds=nodes.map((node,i)=>({...structuredClone(node.p.outbounds[0]),tag:'pool-'+i}));
 const block={tag:'block',protocol:'blackhole'},direct={tag:'direct',protocol:'freedom'};
 const russianRules=[{type:'field',domain:['geosite:category-ru','geosite:yandex','geosite:vk','regexp:(^|\\.)ru$','regexp:(^|\\.)xn--p1ai$','regexp:(^|\\.)su$'],outboundTag:'direct'},{type:'field',ip:['geoip:private'],outboundTag:'block'},{type:'field',ip:['geoip:ru'],outboundTag:'direct'}];
 const base={remarks:group.name,log:{loglevel:'warning'},inbounds:[],outbounds:[block,direct,...outbounds]};
 if(!outbounds.length)return {...base,routing:{domainStrategy:'IPOnDemand',rules:[...russianRules,{type:'field',network:'tcp,udp',outboundTag:'block'}]}};
 return {...base,observatory:{subjectSelector:['pool-'],probeUrl,probeInterval:'30s',enableConcurrency:true},routing:{domainStrategy:'IPOnDemand',rules:[...russianRules,{type:'field',network:'tcp,udp',balancerTag:'auto'}],balancers:[{tag:'auto',selector:['pool-'],fallbackTag:'block',strategy:{type:'leastPing'}}]}};
}
