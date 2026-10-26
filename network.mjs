import net from 'node:net';
import dns from 'node:dns/promises';
export function publicIP(ip){
 const version=net.isIP(ip);
 if(version===6){const s=ip.toLowerCase();return /^[23]/.test(s)&&!s.startsWith('2001:db8:');}
 if(version!==4)return false;
 const [a,b]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19)));
}
export async function publicHost(host){const ips=await dns.lookup(host,{all:true});return ips.length>0&&ips.every(x=>publicIP(x.address));}
