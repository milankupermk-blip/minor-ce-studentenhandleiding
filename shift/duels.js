// Duels zonder server. Een uitdaging is een link met een seed: beide spelers krijgen
// daardoor exact dezelfde vragen. Scores reizen mee in de link; niets verlaat het apparaat
// behalve wat je zelf deelt.
const KEY='shift-uitdagingen-v1';
function read(fallback){try{return JSON.parse(localStorage.getItem(KEY))??fallback;}catch{return fallback;}}
function write(value){try{localStorage.setItem(KEY,JSON.stringify(value));}catch{}}

export function seededRng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function newSeed(){return crypto.getRandomValues(new Uint32Array(1))[0];}
const newId=()=>[...crypto.getRandomValues(new Uint8Array(5))].map(n=>n.toString(16).padStart(2,'0')).join('');

const b64e=text=>btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64d=text=>new TextDecoder().decode(Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));

const cleanName=name=>String(name||'').replace(/\s+/g,' ').trim().slice(0,24);
function validPlayer(p){return p&&typeof p.n==='string'&&p.n.trim()&&Array.isArray(p.r)&&p.r.length===4&&p.r.every(x=>Number.isInteger(x)&&x>=0&&x<=120);}

export function encode(challenge){
  const payload={v:1,id:challenge.id,b:challenge.bank,s:challenge.seed,w:challenge.week,a:{n:challenge.a.n,r:challenge.a.r}};
  if(challenge.o)payload.o={n:challenge.o.n,r:challenge.o.r};
  const url=new URL('./',location.href);url.search='';url.hash='';url.searchParams.set('uitdaging',b64e(JSON.stringify(payload)));return url.href;
}
export function decode(text){
  let p;try{p=JSON.parse(b64d(String(text).trim()));}catch{throw Error('Deze uitdagingslink is beschadigd. Vraag om een nieuwe link.');}
  if(p?.v!==1||!/^[a-f0-9]{10}$/.test(p.id)||!Number.isInteger(p.s)||p.s<0||p.s>0xFFFFFFFF||!Number.isInteger(p.w)||p.w<0||p.w>6||typeof p.b!=='string'||!validPlayer(p.a)||(p.o&&!validPlayer(p.o)))throw Error('Deze uitdagingslink klopt niet.');
  return {id:p.id,bank:p.b,seed:p.s,week:p.w,a:{n:cleanName(p.a.n),r:p.a.r},o:p.o?{n:cleanName(p.o.n),r:p.o.r}:null};
}
export function linkParam(value){
  const v=String(value||'').trim();if(!v)return null;
  try{const u=new URL(v,location.href);return u.searchParams.get('uitdaging')||(u.searchParams.has('duel')?null:v);}catch{return v;}
}
export const total=r=>r.reduce((s,x)=>s+x,0);
export function winner(a,o){const x=total(a.r),y=total(o.r);return x===y?'tie':x>y?'a':'o';}

export const challenges={
  list:()=>read([]),
  name:()=>read([]).find(x=>x.myName)?.myName||'',
  get:id=>read([]).find(x=>x.id===id)||null,
  save(record){const all=read([]).filter(x=>x.id!==record.id);all.unshift({...record,updatedAt:Date.now()});write(all.slice(0,40));return record;},
  create(name,week,bank){return {id:newId(),seed:newSeed(),week,bank,role:'a',myName:cleanName(name),a:null,o:null};},
  cleanName
};
