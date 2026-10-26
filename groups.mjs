export const GROUPS=[{id:'normal',name:'Обычные'},{id:'whitelist',name:'Белые списки'}];
export function parseManifest(text,selections){let category='';const result=[];for(const raw of text.split(/\r?\n/)){const line=raw.trim();const m=line.match(/^===\s*(.*?)\s*===$/);if(m){category=m[1];continue}if(!line.startsWith('https://'))continue;const rule=selections.find(s=>category.includes(s.category));if(rule)result.push({name:'Автор · '+category,url:line,group:rule.group});}return result;}
export function groupedProfile(group,nodes,probeUrl){
 const outbounds=nodes.map((node,i)=>({...structuredClone(node.p.outbounds[0]),tag:'pool-'+i}));
 const block={tag:'block',protocol:'blackhole'},direct={tag:'direct',protocol:'freedom'};
 const russianRules=[{type:'field',domain:['geosite:category-ru','geosite:yandex','geosite:vk','regexp:(^|\\.)ru$','regexp:(^|\\.)xn--p1ai$','regexp:(^|\\.)su$'],outboundTag:'direct'},{type:'field',ip:['geoip:private'],outboundTag:'block'},{type:'field',ip:['geoip:ru'],outboundTag:'direct'}];
 const base={remarks:group.name,log:{loglevel:'warning'},dns:{servers:['1.1.1.1','8.8.8.8','localhost']},inbounds:[{tag:'socks-in',listen:'127.0.0.1',port:10808,protocol:'socks',settings:{auth:'noauth',udp:true},sniffing:{enabled:true,destOverride:['http','tls']}},{tag:'http-in',listen:'127.0.0.1',port:10809,protocol:'http',settings:{}}],outbounds:outbounds.length?[...outbounds,direct,block]:[block,direct]};
 if(!outbounds.length)return {...base,routing:{domainStrategy:'IPOnDemand',rules:[...russianRules,{type:'field',network:'tcp,udp',outboundTag:'block'}]}};
 return {...base,observatory:{subjectSelector:['pool-'],probeUrl,probeInterval:'30s',enableConcurrency:true},routing:{domainStrategy:'IPOnDemand',rules:[...russianRules,{type:'field',network:'tcp,udp',balancerTag:'auto'}],balancers:[{tag:'auto',selector:['pool-'],fallbackTag:'pool-0',strategy:{type:'leastPing'}}]}};
}
