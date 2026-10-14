// Toplijst: gedeeld via Firestore (REST, geen SDK nodig) als leaderboard-config.js is ingevuld,
// anders alleen de scores op dit apparaat.
import {LEADERBOARD} from './leaderboard-config.js';
const LOCAL='shift-toplijst-v1',NAME='shift-naam';
export const shared=!!(LEADERBOARD?.apiKey&&LEADERBOARD?.projectId);
const collection=LEADERBOARD?.collection||'shift_scores';
const base=shared?`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(LEADERBOARD.projectId)}/databases/(default)/documents`:'';

function readLocal(){try{return JSON.parse(localStorage.getItem(LOCAL))||[];}catch{return [];}}
function writeLocal(list){try{localStorage.setItem(LOCAL,JSON.stringify(list.slice(0,100)));}catch{}}
export function playerName(){try{return localStorage.getItem(NAME)||'';}catch{return '';}}
export function setPlayerName(name){try{localStorage.setItem(NAME,name);}catch{}}
const sortScores=list=>[...list].sort((a,b)=>b.score-a.score||a.date.localeCompare(b.date));

async function call(url,body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
    const data=await res.json().catch(()=>null);if(!res.ok)throw Error(data?.error?.message||'De toplijst weigerde deze score.');return data;}
  catch(e){throw Error(e.name==='AbortError'?'De toplijst reageert niet. Probeer het later opnieuw.':e.message.startsWith('Failed')?'Geen verbinding met de toplijst.':e.message);}
  finally{clearTimeout(timer);}
}
async function fetchShared(){
  const data=await call(`${base}:runQuery?key=${LEADERBOARD.apiKey}`,{structuredQuery:{from:[{collectionId:collection}],orderBy:[{field:{fieldPath:'score'},direction:'DESCENDING'}],limit:100}});
  return data.filter(x=>x.document).map(({document:{fields:f}})=>({name:f.naam?.stringValue||'?',score:Number(f.score?.integerValue||0),rounds:(f.rondes?.arrayValue?.values||[]).map(v=>Number(v.integerValue||0)),date:f.datum?.timestampValue||''}));
}
export async function top(){
  if(!shared)return {shared:false,list:sortScores(readLocal())};
  try{return {shared:true,list:sortScores(await fetchShared())};}
  catch(e){return {shared:false,error:e.message,list:sortScores(readLocal())};}
}
export async function submit({name,rounds,version,gameId}){
  const score=rounds.reduce((s,x)=>s+x,0),entry={name,score,rounds,date:new Date().toISOString(),gameId};
  const local=readLocal();if(!local.some(x=>x.gameId===gameId)){local.push(entry);writeLocal(sortScores(local));}
  if(!shared)return {shared:false,rank:sortScores(readLocal()).findIndex(x=>x.gameId===gameId)+1};
  await call(`${base}/${collection}?key=${LEADERBOARD.apiKey}`,{fields:{naam:{stringValue:name},score:{integerValue:String(score)},rondes:{arrayValue:{values:rounds.map(r=>({integerValue:String(r)}))}},versie:{stringValue:String(version).slice(0,40)},datum:{timestampValue:entry.date}}});
  const list=sortScores(await fetchShared().catch(()=>[]));
  return {shared:true,rank:list.filter(x=>x.score>score).length+1};
}
