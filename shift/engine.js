// Spelregels van SHIFT: vijf rondes van elk maximaal 120 punten.
export const ROUND_TYPES = ['sprint','door','puzzle','connect','final'];
export const DURATIONS = [120,90,90,90,75];
export const MAX_SCORE = 120*ROUND_TYPES.length;
export const FINAL_POINTS = 8;      // per gevonden finale-antwoord; 15 antwoorden = 120
export const PUZZLE_MISTAKES = 3;
export const CONNECT_MISTAKES = 6;

export const normalize = value => String(value).replace(/­/g,'').normalize('NFKC').toLocaleLowerCase('nl').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’‘]/g,"'").replace(/[-–—]/g,' ').replace(/[.,!?;:]/g,'').replace(/\s+/g,' ').trim();
export function shuffle(items,rng=Math.random) { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }
const inputForm=value=>normalize(value).replace(/^(?:ik denk (?:vooral )?aan|denk (?:ook )?aan|bijvoorbeeld|zoals)\s+/,'').replace(/^(?:de|het|een)\s+/,'');
const compact=value=>value.replace(/\s/g,'').replace(/['₂₃₆]/g,m=>({'₂':'2','₃':'3','₆':'6'}[m]??''));
function spellingDistance(a,b){
  const shortest=Math.min(a.length,b.length),limit=shortest>=10?2:shortest>=4?1:0;
  if(!limit||Math.abs(a.length-b.length)>limit)return Infinity;
  // Wacht op een typpauze voordat een bijna volledig woord telt.
  if((a.startsWith(b)||b.startsWith(a))&&(shortest<5||Math.abs(a.length-b.length)>1))return Infinity;
  const rows=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)rows[i][0]=i;for(let j=0;j<=b.length;j++)rows[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
    rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
  }
  const distance=rows[a.length][b.length];return distance<=limit?distance:Infinity;
}
export function matchAnswer(text,answers,found=[],allowSameAnswerPrefix=false,allowTypos=false) {
  const value=inputForm(text),joined=compact(value); if(!value)return {kind:'none'};
  let candidates=answers.filter(a=>a.aliases.some(v=>inputForm(v)===value));
  if(!candidates.length&&joined.length>=2)candidates=answers.filter(a=>a.aliases.some(v=>compact(inputForm(v))===joined));
  if(!candidates.length&&allowTypos){const scores=answers.map(a=>({answer:a,distance:Math.min(...a.aliases.map(v=>spellingDistance(joined,compact(inputForm(v)))))}));const best=Math.min(...scores.map(s=>s.distance));if(Number.isFinite(best))candidates=scores.filter(s=>s.distance===best).map(s=>s.answer);}
  if(candidates.length>1){const open=candidates.filter(a=>!found.includes(a.id));if(open.length===1)candidates=open;}
  if(candidates.length!==1)return {kind:candidates.length?'ambiguous':'none'};
  const a=candidates[0];
  if(!allowSameAnswerPrefix&&answers.some(other=>other.aliases.some(v=>compact(inputForm(v)).startsWith(joined)&&compact(inputForm(v))!==joined)))return {kind:'prefix',answer:a};
  return {kind:found.includes(a.id)?'duplicate':'correct',answer:a};
}
export function roundPoints(found,total){return Math.round(120*Math.min(found,total)/total);}

// Kies items die recent niet zijn gespeeld, met zoveel mogelijk verschillende onderwerpen.
function pickVaried(items,count,recent,rng){
  const fresh=items.filter(x=>!recent.includes(x.id)),pool=fresh.length>=count?fresh:items;
  const out=[],topics=new Set();
  for(const x of shuffle(pool,rng)){if(out.length===count)break;if(!topics.has(x.topic)){out.push(x);topics.add(x.topic);}}
  for(const x of shuffle(pool,rng)){if(out.length===count)break;if(!out.includes(x))out.push(x);}
  return out;
}
function connectionPairs(items,count,recent,rng){
 const compatible=(p,chosen)=>chosen.every(x=>normalize(x.label)!==normalize(p.label)&&normalize(x.definition)!==normalize(p.definition)&&!x.conflictIds?.includes(p.id)&&!p.conflictIds?.includes(x.id));
 for(let attempt=0;attempt<24;attempt++){
  const fresh=shuffle(items.filter(x=>!recent.includes(x.id)),rng),old=shuffle(items.filter(x=>recent.includes(x.id)),rng),chosen=[];
  for(const p of [...fresh,...old]){if(chosen.length===count)break;if(compatible(p,chosen))chosen.push(p);}
  if(chosen.length===count)return shuffle(chosen,rng);
 }
 throw new Error('Te weinig eenduidige connecties in de vragenbank.');
}
export function createGame(bank,timed=true,recent=[],rng=Math.random,now=Date.now()) {
  const choice=pickVaried(bank.sprints.filter(q=>q.kind==='choice'),3,recent,rng);
  const typed=pickVaried(bank.sprints.filter(q=>q.kind==='input'),3,recent,rng);
  const questions=[choice[0],typed[0],choice[1],typed[1],choice[2],typed[2]].map(q=>({...q,entry:q.kind==='input'?'input':'choice',options:q.kind==='input'?[]:shuffle([q.answer,...q.distractors],rng)}));
  const door=pickVaried(bank.doors,1,recent,rng)[0];
  const puzzle=pickVaried(bank.puzzles,1,recent,rng)[0];
  const pairs=connectionPairs(bank.terms,6,recent,rng);
  const finals=pickVaried(bank.finals,6,recent,rng);
  const labels=shuffle([...puzzle.groups.map(g=>({id:g.id,label:g.label})),...puzzle.decoys.map((label,i)=>({id:puzzle.id+'-decoy'+i,label}))],rng);
  const rounds=[{type:'sprint',questions,index:0,results:[],answered:false},
    {type:'door',question:door,found:[]},
    {type:'puzzle',question:puzzle,labels,found:[],selected:[],candidate:null,mistakes:0,
      cards:shuffle(puzzle.groups.flatMap(g=>g.cards.map((text,i)=>({id:g.id+'-c'+i,group:g.id,text}))),rng)},
    {type:'connect',pairs,found:[],left:null,mistakes:0,rightOrder:shuffle(pairs.map(p=>p.id),rng)},
    {type:'final',queue:finals,index:0,found:[]}]
    .map((r,i)=>({...r,seconds:DURATIONS[i],score:0,deadline:null}));
  return {id:'game-'+now+'-'+Math.floor(rng()*1e9),version:bank.version,timed,round:0,status:'intro',rounds,createdAt:now};
}
export function startRound(game,now=Date.now()){
  if(game.status!=='intro')return false;game.status='active';game.rounds[game.round].deadline=game.timed?now+game.rounds[game.round].seconds*1000:null;return true;
}
export function remaining(game,now=Date.now()) {const r=game.rounds[game.round];const at=r.feedbackStartedAt??now;return !game.timed?null:r.deadline==null?r.seconds:Math.max(0,Math.ceil((r.deadline-at)/1000));}
export function finishRound(game){if(game.status!=='active')return false;game.status='review';return true;}
export function expire(game,now=Date.now()){if(game.status==='active'&&game.timed&&remaining(game,now)===0){finishRound(game);return true;}return false;}
export function nextRound(game){if(game.status!=='review')return false;if(game.round===ROUND_TYPES.length-1)game.status='finished';else{game.round++;game.status='intro';}return true;}
export function answerDoor(game,text,now=Date.now(),allowSameAnswerPrefix=false,allowTypos=false){
  if(expire(game,now)||game.status!=='active')return {kind:'closed'};
  const r=game.rounds[game.round];if(r.type!=='door')return {kind:'closed'};
  const match=matchAnswer(text,r.question.answers,r.found,allowSameAnswerPrefix,allowTypos);
  if(match.kind==='correct'){r.found.push(match.answer.id);r.score=roundPoints(r.found.length,r.question.goal);if(r.found.length>=r.question.goal)finishRound(game);}
  return match;
}
export function answerSprint(game,text,now=Date.now()){
  if(expire(game,now)||game.status!=='active')return {kind:'closed'};
  const r=game.rounds[game.round];if(r.type!=='sprint'||r.answered)return {kind:'closed'};
  const q=r.questions[r.index];const correct=q.entry==='choice'?normalize(text)===normalize(q.answer):matchAnswer(text,[{id:q.id,aliases:q.aliases}],[],true,true).kind==='correct';
  r.results.push({id:q.id,correct,given:text});r.answered=true;r.feedbackStartedAt=now;r.score=roundPoints(r.results.filter(x=>x.correct).length,r.questions.length);
  return {kind:correct?'correct':'wrong',answer:q.answer};
}
export function advanceSprint(game,now=Date.now()){const r=game.rounds[game.round];if(game.status!=='active'||r.type!=='sprint'||!r.answered)return false;
  if(game.timed&&r.feedbackStartedAt!=null&&r.deadline!=null)r.deadline+=Math.max(0,now-r.feedbackStartedAt);
  r.feedbackStartedAt=null;
  if(r.index===r.questions.length-1)finishRound(game);else{r.index++;r.answered=false;}return true;}
export function selectCard(game,id,now=Date.now()){
  if(expire(game,now)||game.status!=='active')return {kind:'closed'};
  const r=game.rounds[game.round];if(r.type!=='puzzle'||r.candidate)return {kind:'closed'};
  const card=r.cards.find(x=>x.id===id);if(!card||r.found.includes(card.group))return {kind:'closed'};
  r.selected=r.selected.includes(id)?r.selected.filter(x=>x!==id):[...r.selected,id];
  if(r.selected.length<r.question.groupSize)return {kind:'selected'};
  const groups=new Set(r.selected.map(x=>r.cards.find(y=>y.id===x).group));
  if(groups.size===1){r.candidate=card.group;return {kind:'name'};}
  r.selected=[];r.mistakes++;if(r.mistakes>=PUZZLE_MISTAKES)finishRound(game);return {kind:'wrong'};
}
// Een goede groep levert de helft van de punten; het juiste verband benoemen de andere helft.
function puzzleScore(r){const n=r.question.groups.length;return Math.round(120*(r.found.length+r.named.length)/(2*n));}
export function nameGroup(game,id,now=Date.now()){
  if(expire(game,now)||game.status!=='active')return {kind:'closed'};
  const r=game.rounds[game.round];if(r.type!=='puzzle'||!r.candidate)return {kind:'closed'};
  r.named??=[];const correct=r.candidate===id;
  r.found.push(r.candidate);if(correct)r.named.push(r.candidate);r.score=puzzleScore(r);
  r.candidate=null;r.selected=[];if(r.found.length===r.question.groups.length||r.mistakes>=PUZZLE_MISTAKES)finishRound(game);
  return {kind:correct?'correct':'wrong'};
}
export function connect(game,left,right,now=Date.now()){
  if(expire(game,now)||game.status!=='active')return {kind:'closed'};
  const r=game.rounds[game.round];if(r.type!=='connect'||r.found.includes(left)||!r.pairs.some(x=>x.id===left)||!r.pairs.some(x=>x.id===right)||r.found.includes(right))return {kind:'closed'};
  r.left=null;const correct=left===right;if(correct){r.found.push(left);r.score=roundPoints(r.found.length,r.pairs.length);}else{r.mistakes++;}
  if(r.found.length===r.pairs.length||r.mistakes>=CONNECT_MISTAKES)finishRound(game);return {kind:correct?'correct':'wrong'};
}
export const finalQuestion=r=>r.queue[r.index];
export const finalFound=(r,q=finalQuestion(r))=>r.found.filter(id=>q&&q.answers.some(a=>a.id===id));
export function answerFinal(game,text,now=Date.now(),allowSameAnswerPrefix=false,allowTypos=false){
  if(expire(game,now)||game.status!=='active')return {kind:'closed'};
  const r=game.rounds[game.round];if(r.type!=='final')return {kind:'closed'};
  const q=finalQuestion(r);const match=matchAnswer(text,q.answers,r.found,allowSameAnswerPrefix,allowTypos);
  if(match.kind==='correct'){r.found.push(match.answer.id);r.score=Math.min(120,r.found.length*FINAL_POINTS);
    if(r.score>=120)finishRound(game);else if(finalFound(r,q).length>=q.goal)passFinal(game,now,true);}
  return match;
}
export function passFinal(game,now=Date.now(),internal=false){
  if(!internal&&(expire(game,now)||game.status!=='active'))return false;
  const r=game.rounds[game.round];if(r.type!=='final')return false;
  r.index++;if(r.index>=r.queue.length)finishRound(game);return true;
}
export const totalScore=game=>game.rounds.reduce((s,r)=>s+r.score,0);
export function usedIds(game){return game.rounds.flatMap(r=>r.questions?.map(q=>q.id)||r.pairs?.map(p=>p.id)||r.queue?.map(q=>q.id)||[r.question.id]);}
