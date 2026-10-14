// Duels zonder server. Een uitdaging is een link met een seed: beide spelers krijgen
// daardoor exact dezelfde vragen. Scores reizen mee in de link, met een controlegetal
// zodat handmatig aangepaste links worden herkend.
const KEY='shift-uitdagingen-v2';
const ROUNDS=5;
function read(fallback){try{return JSON.parse(localStorage.getItem(KEY))??fallback;}catch{return fallback;}}
function write(value){try{localStorage.setItem(KEY,JSON.stringify(value));}catch{}}

export function seededRng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function newSeed(){return crypto.getRandomValues(new Uint32Array(1))[0];}
const newId=()=>[...crypto.getRandomValues(new Uint8Array(5))].map(n=>n.toString(16).padStart(2,'0')).join('');

const b64e=text=>btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64d=text=>new TextDecoder().decode(Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));
// cyrb53: snelle niet-cryptografische hash. Houdt knutselen aan links tegen, geen vastberaden valsspeler.
function checksum(text,seed=0x5f1f7){let h1=0xdeadbeef^seed,h2=0x41c6ce57^seed;for(let i=0;i<text.length;i++){const ch=text.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(36);}

const cleanName=name=>String(name||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
function validPlayer(p){return p&&typeof p.n==='string'&&p.n.trim()&&Array.isArray(p.r)&&p.r.length===ROUNDS&&p.r.every(x=>Number.isInteger(x)&&x>=0&&x<=120);}
const body=p=>JSON.stringify([p.v,p.id,p.b,p.s,p.a.n,p.a.r,p.o?.n??'',p.o?.r??[]]);

export function encode(challenge){
  const payload={v:2,id:challenge.id,b:challenge.bank,s:challenge.seed,a:{n:challenge.a.n,r:challenge.a.r}};
  if(challenge.o)payload.o={n:challenge.o.n,r:challenge.o.r};
  payload.h=checksum(body(payload));
  const url=new URL('./',location.href);url.search='';url.hash='';url.searchParams.set('uitdaging',b64e(JSON.stringify(payload)));return url.href;
}
export function decode(text){
  let p;try{p=JSON.parse(b64d(String(text).trim()));}catch{throw Error('Deze uitdagingslink is beschadigd. Vraag om een nieuwe link.');}
  if(p?.v===1)throw Error('Deze uitdaging komt uit een oudere versie van SHIFT met vier rondes. Start een nieuw duel.');
  if(p?.v!==2||!/^[a-f0-9]{10}$/.test(p.id)||!Number.isInteger(p.s)||p.s<0||p.s>0xFFFFFFFF||typeof p.b!=='string'||!validPlayer(p.a)||(p.o&&!validPlayer(p.o)))throw Error('Deze uitdagingslink klopt niet.');
  if(p.h!==checksum(body(p)))throw Error('Deze link is na het delen aangepast. Vraag om de originele link.');
  return {id:p.id,bank:p.b,seed:p.s,a:{n:cleanName(p.a.n),r:p.a.r},o:p.o?{n:cleanName(p.o.n),r:p.o.r}:null};
}
export function linkParam(value){
  const v=String(value||'').trim();if(!v)return null;
  try{const u=new URL(v,location.href);return u.searchParams.get('uitdaging')||(u.searchParams.has('duel')?null:v);}catch{return v;}
}
export const total=r=>r.reduce((s,x)=>s+x,0);
export function winner(a,o){const x=total(a.r),y=total(o.r);return x===y?'tie':x>y?'a':'o';}

export const challenges={
  list:()=>read([]),
  get:id=>read([]).find(x=>x.id===id)||null,
  save(record){const all=read([]).filter(x=>x.id!==record.id);all.unshift({...record,updatedAt:Date.now()});write(all.slice(0,40));return record;},
  create(name,bank){return {id:newId(),seed:newSeed(),bank,role:'a',myName:cleanName(name),a:null,o:null};},
  cleanName
};
