import {BANK,TOPICS} from './vragen.js';
import {seededRng} from './duels.js';
import {QuizAudio} from './audio.js';
import {createMultiplayerUI} from './multiplayer-ui.js';
import * as board from './leaderboard.js';
import {ROUND_TYPES,MAX_SCORE,FINAL_POINTS,PUZZLE_MISTAKES,CONNECT_MISTAKES,createGame,startRound,remaining,expire,nextRound,finishRound,answerDoor,answerSprint,advanceSprint,selectCard,nameGroup,connect,answerFinal,passFinal,finalQuestion,finalFound,matchAnswer,totalScore,usedIds} from './engine.js';

const $=selector=>document.querySelector(selector), app=$('#app');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NAMES={sprint:'KennisSprint',door:'Open Deur',puzzle:'Verbandenpuzzel',connect:'Connectie',final:'Finale'};
const NUMBERS={sprint:'01',door:'02',puzzle:'03',connect:'04',final:'05'};
const DESCRIPTIONS={
  sprint:'Zes vragen: drie meerkeuze en drie waarbij je het begrip typt. Na elke vraag lees je de uitleg; de klok pauzeert dan.',
  door:'Waar denk jij aan bij het onderwerp? Vind vijf verborgen begrippen. Synoniemen en kleine typefouten tellen mee.',
  puzzle:'Twaalf kaarten, drie groepen van vier. Pas op voor kaarten die bij meerdere groepen lijken te horen. Benoem daarna het verband: dat levert de andere helft van de punten op. Je mag drie fouten maken.',
  connect:'Koppel elk begrip aan de juiste omschrijving. Zes paren in twee sets. Je mag zes fouten maken.',
  final:`Typ zo veel mogelijk antwoorden bij elke vraag. Elk antwoord is ${FINAL_POINTS} punten waard. Weet je niets meer? Pas en ga door naar de volgende vraag.`
};
const KEY='shift-v2';let storageWarning=false;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(KEY+key))??fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(KEY+key,JSON.stringify(value));}catch{if(!storageWarning){storageWarning=true;toast('Je browser kan voortgang niet opslaan. Dit potje blijft wel speelbaar.',true);}}}
let prefs={sound:true,music:true,...read('-prefs',{})};
let history=read('-history',[]),recent=read('-recent',[]),game=read('-game',null),view='home';
if(!game||!['intro','active','review','finished'].includes(game.status)||!Array.isArray(game.rounds)||game.rounds.length!==ROUND_TYPES.length||game.round<0||game.round>=ROUND_TYPES.length||!game.rounds.every(r=>Object.hasOwn(NAMES,r.type)))game=null;
let pendingStart=null,toastTimeout=null,typeTimeout=null,installPrompt=null,composing=false,lastFocus=null;
function save(){if(game)write('-game',game);write('-prefs',prefs);}
function toast(text,error=false){if(document.body.classList.contains('keyboard-open')&&!error&&$('.input-help')){$('.input-help').textContent=text;$('#toast').className='toast';return;}const el=$('#toast');el.textContent=text;el.className='toast visible'+(error?' error':'');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.className='toast',2000);}

// ─── Geluid ───
const quizAudio=new QuizAudio();let reviewedCue='';
function initAudio(){quizAudio.setEnabled(prefs.sound);quizAudio.setMusic(prefs.music);return quizAudio.unlock();}
function bling(){quizAudio.cue('correct');}
function syncAudio(){const r=game?.rounds[game.round];quizAudio.stage(view==='game'&&game?.status==='active'&&!r?.answered&&!document.hidden,game?.id+'-'+game?.round);if(view==='game'&&(game?.status==='review'||game?.status==='finished')){const key=game.id+'-'+game.round+'-'+game.status;if(key!==reviewedCue){reviewedCue=key;quizAudio.cue(game.status==='finished'?'complete':'end');}}}
function confetti(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;for(let i=0;i<28;i++){const x=document.createElement('i');x.className='confetti';x.style.left=Math.random()*100+'vw';x.style.background=['#5C7A5A','#D0E3CF','#7D6034'][i%3];x.style.animationDelay=Math.random()*.4+'s';document.body.append(x);setTimeout(()=>x.remove(),2200);}}

// ─── Dialogen ───
function closeModal(){const el=$('#dialog-root');el.innerHTML='';if(lastFocus?.isConnected)lastFocus.focus();}
function modal(title,body,actions){lastFocus=document.activeElement;$('#dialog-root').innerHTML=`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">${esc(title)}</h2>${body}<div class="options">${actions}</div></section></div>`;$('#dialog-root button')?.focus();}
function showRules(){modal('Zo speel je SHIFT',`<p>Vijf rondes, elk maximaal 120 punten: ${ROUND_TYPES.map(t=>NAMES[t]).join(', ')}. Samen ${MAX_SCORE} punten.</p><p>Bij typvragen worden synoniemen en kleine typefouten herkend. Een goed antwoord telt meteen; je hoeft niet op Enter te drukken.</p><p>In de puzzel krijg je punten voor elke juiste groep én voor het juiste verband. In de finale is elk antwoord ${FINAL_POINTS} punten waard.</p><p>Je kunt tussen rondes stoppen. In een gestarte ronde loopt de klok door, ook als je de app sluit.</p><p>Solo zet je je score op de toplijst. Bij multiplayer speel je eerst zelf en deel je daarna een link; je tegenstander krijgt dezelfde vragen.</p>`,'<button class="primary" data-action="close">Begrepen</button>');}
const topicTag=item=>item?.topic?`<span class="source-link">Onderwerp · ${esc(TOPICS[item.topic]||item.topic)}</span>`:'';
const best=()=>history.length?Math.max(...history.map(x=>x.score)):0;

// ─── Startscherm ───
function home(){multiplayer.stop();view='home';quizAudio.stop();window.history.replaceState(null,'',location.pathname);closeModal();
  const resume=game&&game.status!=='finished'?`<div class="resume"><div><strong>Je potje wacht op je</strong><p>${game.challenge?'Duel':'Solo'} · ronde ${game.round+1}: ${NAMES[game.rounds[game.round].type]}</p></div><button class="secondary" data-action="resume">Verder →</button></div>`:'';
  document.body.dataset.view='home';
  app.innerHTML=`<section class="app-home"><div class="home-heading"><div><p class="eyebrow">DUURZAAMHEID · KENNIS EN ONTWIKKELINGEN</p><h1>Ready to shift?</h1></div><button class="rating-preview" data-action="leaderboard"><span>Jouw record</span><b>${best()||'—'}</b></button></div>${resume}
  <section class="play-panel"><div class="panel-top"><h2>Hoe wil je spelen?</h2><span class="pill">5 rondes · ${MAX_SCORE} punten</span></div>
  <div class="mode-cards"><button class="mode-card primary-card" data-action="solo"><span class="mode-icon" aria-hidden="true">◎</span><span><strong>Solo</strong><small>Speel tegen de klok en kom op de toplijst</small></span><span aria-hidden="true">→</span></button>
  <button class="mode-card" data-multi="create"><span class="mode-icon" aria-hidden="true">⚔</span><span><strong>Multiplayer</strong><small>Daag iemand uit met een link: dezelfde vragen, wie scoort het hoogst?</small></span><span aria-hidden="true">↗</span></button></div>
  <p class="fineprint">Klimaat · regelgeving · circulaire economie · natuur · keten · claims · energie</p></section>
  <div class="round-strip">${ROUND_TYPES.map(t=>`<article class="round-tile"><span>${NUMBERS[t]}</span><h3>${NAMES[t]}</h3></article>`).join('')}</div>
  <div class="footer-note"><button class="help-button" data-action="rules">Spelregels</button>${history.length?'<button class="help-button" data-action="history">Mijn resultaten</button>':''}</div></section>
  <nav class="app-tabs" aria-label="Game"><button class="active" data-action="home">Spelen</button><button data-multi="hub">Duels</button><button data-action="leaderboard">Toplijst</button></nav>`;
}

// ─── Toplijst ───
async function leaderboardView(){
  multiplayer.stop();view='board';document.body.dataset.view='duel';quizAudio.stop();closeModal();
  app.innerHTML='<div class="duel-page"><h1>Toplijst</h1><p class="subtle" role="status">Scores ophalen…</p></div>';
  const {shared,list,error}=await board.top();if(view!=='board')return;const me=board.playerName();
  const note=shared?'Iedereen die SHIFT solo speelt, komt op deze lijst.':error?`De gedeelde toplijst is nu niet bereikbaar (${esc(error)}). Je ziet de scores op dit apparaat.`:'Dit zijn de scores op dit apparaat. Een gedeelde toplijst voor iedereen is voorbereid; zie TOPLIJST.md in de repo.';
  app.innerHTML=`<div class="duel-page"><h1>Toplijst</h1><p class="lead">${note}</p><div class="rank-list">${list.length?list.slice(0,50).map((p,i)=>`<div class="rank-row ${me&&p.name===me?'mine':''}"><span>${i+1}</span><div><strong>${esc(p.name)}</strong><small>${p.date?new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',year:'numeric'}).format(new Date(p.date)):''}${p.rounds?.length?' · '+p.rounds.join(' / '):''}</small></div><b>${p.score}</b></div>`).join(''):'<p class="subtle">Nog geen scores. Speel solo en zet de eerste score neer.</p>'}</div><div class="duel-links"><button class="primary" data-action="solo">Speel solo</button><button class="secondary" data-action="home">Naar start</button></div></div>
  <nav class="app-tabs" aria-label="Game"><button data-action="home">Spelen</button><button data-multi="hub">Duels</button><button class="active" data-action="leaderboard">Toplijst</button></nav>`;
  window.scrollTo({top:0,behavior:'instant'});
}
function leaderBox(){
  if(game.submitted)return `<div class="leader-box"><strong>${game.submitted.shared?'Je score staat op de toplijst':'Je score staat op de toplijst van dit apparaat'} · plek ${game.submitted.rank}</strong><button class="secondary" data-action="leaderboard">Bekijk de toplijst</button></div>`;
  return `<div class="leader-box"><label class="duel-field" for="board-name">Zet je score op de toplijst<input id="board-name" class="answer-input" maxlength="24" autocomplete="nickname" placeholder="Je naam" value="${esc(board.playerName())}"></label><button class="primary" data-action="submit-score">Op de toplijst</button></div>`;
}

// ─── Spelscherm ───
const showTimer=()=>game.status==='active'||game.status==='intro';
function gameShell(body){const r=game.rounds[game.round];return `<div class="game-wrap"><div class="game-meta"><span>${game.challenge?'Duel':'Solo'} · tegen de klok</span><div class="step-dots" aria-label="Ronde ${game.round+1} van ${ROUND_TYPES.length}">${ROUND_TYPES.map((_,i)=>`<span class="${i<game.round||game.status==='finished'?'done':i===game.round?'current':''}"></span>`).join('')}</div></div><section class="game-card"><div class="game-top"><span class="round-label">${game.status==='finished'?'Uitslag':`${game.round+1} / ${ROUND_TYPES.length} · ${NAMES[r.type]}`}</span><div class="score-wrap"><span class="score-value" id="score">${totalScore(game)}<small>PUNTEN</small></span>${showTimer()?`<span class="timer" id="timer" aria-label="Resterende tijd">${timerText()}</span>`:''}</div></div>${body}</section><div class="below-game"><button class="help-button" data-action="leave">← Naar startscherm</button><button class="help-button" data-action="rules">Spelregels</button></div></div>`;}
function timerText(){const s=remaining(game);return s===null?'VRIJ':Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function bar(n,total,points=Math.round(120*n/total)){return `<div class="progress-label"><span>${n} van ${total}</span><span>${points} / 120 punten</span></div><div class="progress-bar"><span style="width:${Math.min(100,100*n/total)}%"></span></div>`;}
const inputBox=(label,help,extra='')=>`<div class="input-zone"><label class="input-label" for="answer-input">${label}</label><input class="answer-input" id="answer-input" placeholder="Typ je antwoord…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"><p class="input-help">${help}</p>${extra}</div>`;
function render(){if(!game){home();return;}view='game';document.body.dataset.view='game';clearTimeout(typeTimeout);closeModal();expire(game);save();const r=game.rounds[game.round];syncAudio();
  if(game.status==='finished'){result();return;}
  if(game.status==='review'){review();return;}
  if(game.status==='intro'){app.innerHTML=gameShell(`<div class="intro"><div class="round-number" aria-hidden="true">${NUMBERS[r.type]}</div><p class="eyebrow">${game.round===ROUND_TYPES.length-1?'DE LAATSTE RONDE':'KLAAR VOOR DE VOLGENDE RONDE?'}</p><h1 class="screen-title" tabindex="-1">${NAMES[r.type]}</h1><p>${DESCRIPTIONS[r.type]}</p><div class="intro-facts"><span>${r.seconds} seconden</span><span>120 punten</span></div><button class="primary wide" data-action="start">Start de ronde <span>→</span></button><p class="fineprint">De vraag verschijnt zodra je start.</p></div>`);return;}
  if(r.type==='sprint'){
    const q=r.questions[r.index],answer=r.results.at(-1);
    const body=q.entry==='choice'?`<div class="options">${q.options.map(o=>`<button class="option ${r.answered&&o===q.answer?'correct':r.answered&&o===answer?.given&&!answer.correct?'wrong':''}" data-choice="${esc(o)}" ${r.answered?'disabled':''}>${esc(o)}</button>`).join('')}</div>`
      :r.answered?'':inputBox('TYP HET BEGRIP','Goed? Dan ga je automatisch door. Geen idee? Controleer of sla over.','<button class="secondary" data-action="check">Controleer mijn antwoord</button>');
    app.innerHTML=gameShell(`<div class="progress-label"><span>Vraag ${r.index+1} / ${r.questions.length} · ${q.entry==='choice'?'meerkeuze':'typ het antwoord'}</span><span>${r.score} / 120 punten</span></div><h1 class="round-title">${esc(q.prompt)}</h1>${body}${r.answered?`<div class="item-feedback ${answer.correct?'is-correct':'is-wrong'}" role="status"><strong>${answer.correct?'Goed gezien.':'Het antwoord: '+esc(q.answer)}</strong>${!answer.correct&&q.entry==='input'&&answer.given?`<p class="subtle">Jij typte: ${esc(answer.given)}</p>`:''}<p>${esc(q.explanation)}</p>${topicTag(q)}<span class="feedback-clock">Klok gepauzeerd · lees de uitleg</span><button class="primary wide" data-action="sprint-next">${r.index===r.questions.length-1?'Ronde afronden':'Volgende vraag'} →</button></div>`:'<button class="quiet" data-action="skip">Deze vraag overslaan →</button>'}`);
    if(!r.answered&&q.entry==='input')focusInput();
    if(r.answered){const feedback=$('.item-feedback');feedback.setAttribute('tabindex','-1');feedback.focus({preventScroll:true});feedback.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  }else if(r.type==='door'){
    const found=r.found.map(id=>r.question.answers.find(a=>a.id===id));
    app.innerHTML=gameShell(`<h1 class="round-title">${esc(r.question.prompt)}</h1>${bar(found.length,r.question.goal)}<div class="answer-slots">${Array.from({length:r.question.goal},(_,i)=>`<div class="answer-slot ${found[i]?'found':''}"><b>${found[i]?'✓':i+1}</b><span>${found[i]?esc(found[i].label):'Nog te ontdekken'}</span></div>`).join('')}</div>${inputBox('TYP ÉÉN BEGRIP','Synoniemen en kleine typefouten worden herkend.')}<button class="quiet" data-action="end">Ronde afronden</button>`);focusInput();
  }else if(r.type==='puzzle'){
    const named=r.named||[];
    app.innerHTML=gameShell(`<h1 class="round-title">${esc(r.question.prompt)}</h1>${bar(r.found.length+named.length,2*r.question.groups.length,r.score).replace(/\d+ van \d+/,`${r.found.length} van ${r.question.groups.length} groepen`)}${r.question.groups.filter(g=>r.found.includes(g.id)).map(g=>`<div class="solved-group ${named.includes(g.id)?'':'unnamed'}"><h3>${named.includes(g.id)?'✓':'½'} ${esc(g.label)}</h3><p>${g.cards.map(esc).join(' · ')}</p></div>`).join('')}<div class="cards-grid">${r.cards.filter(c=>!r.found.includes(c.group)).map(c=>`<button class="word-card ${r.selected.includes(c.id)?'selected':''}" data-card="${c.id}" aria-pressed="${r.selected.includes(c.id)}">${esc(c.text)}</button>`).join('')}</div><div class="attempts">${PUZZLE_MISTAKES-r.mistakes} fouten over · tik ${r.question.groupSize} kaarten aan</div><button class="quiet" data-action="end">Ronde afronden</button>`);
    if(r.candidate)modal('Welk verband heb je gevonden?',`<p>${r.selected.map(id=>esc(r.cards.find(c=>c.id===id).text)).join(' · ')}</p>`,r.labels.map(g=>`<button class="option" data-group="${g.id}">${esc(g.label)}</button>`).join(''));
  }else if(r.type==='connect'){
    // Een set is pas klaar als al haar eigen paren zijn gevonden.
    const page=r.pairs.slice(0,3).every(p=>r.found.includes(p.id))?r.pairs.slice(3,6):r.pairs.slice(0,3);
    const right=r.rightOrder.filter(id=>page.some(p=>p.id===id)).map(id=>page.find(p=>p.id===id));
    app.innerHTML=gameShell(`<h1 class="round-title">Leg de juiste connecties.</h1><p class="subtle">Tik een begrip aan, daarna zijn omschrijving.</p>${bar(r.found.length,6)}<div class="connect-grid"><div class="connect-column">${page.map(p=>`<button class="connect-card ${r.found.includes(p.id)?'matched':''} ${r.left===p.id?'selected':''}" data-left="${p.id}" ${r.found.includes(p.id)?'disabled':''}>${esc(p.label)}</button>`).join('')}</div><div class="connect-column">${right.map(p=>`<button class="connect-card definition ${r.found.includes(p.id)?'matched':''}" data-right="${p.id}" ${r.found.includes(p.id)?'disabled':''}>${esc(p.definition)}</button>`).join('')}</div></div><div class="attempts">${CONNECT_MISTAKES-r.mistakes} fouten over · ${r.found.length<3?'set 1':'set 2'} van 2</div><button class="quiet" data-action="end">Ronde afronden</button>`);
  }else{
    const q=finalQuestion(r),mine=finalFound(r,q).map(id=>q.answers.find(a=>a.id===id));
    app.innerHTML=gameShell(`<div class="progress-label"><span>Vraag ${r.index+1} / ${r.queue.length}</span><span>${r.found.length} ${r.found.length===1?'antwoord':'antwoorden'} · ${r.score} / 120 punten</span></div><div class="progress-bar"><span style="width:${100*r.score/120}%"></span></div><h1 class="round-title">${esc(q.prompt)}</h1><div class="answer-slots">${Array.from({length:q.goal},(_,i)=>`<div class="answer-slot ${mine[i]?'found':''}"><b>${mine[i]?'✓':i+1}</b><span>${mine[i]?esc(mine[i].label):'…'}</span></div>`).join('')}</div>${inputBox('TYP EEN ANTWOORD',`Elk goed antwoord: +${FINAL_POINTS} punten.`)}<div class="final-actions"><button class="secondary" data-action="final-pass">Pas → volgende vraag</button><button class="quiet" data-action="end">Ronde afronden</button></div>`);focusInput();
  }
}
function focusInput(){const el=$('#answer-input');el?.focus({preventScroll:true});if(window.visualViewport&&window.visualViewport.height<500)el?.scrollIntoView({block:'nearest'});}
function reviewItems(r){
  if(r.type==='door')return r.question.answers.map(a=>({label:a.label,correct:r.found.includes(a.id),explanation:a.explanation||'',possible:true}));
  if(r.type==='puzzle')return r.question.groups.map(g=>({label:g.label,correct:(r.named||[]).includes(g.id),explanation:g.cards.join(' · ')+(g.explanation?' — '+g.explanation:'')}));
  if(r.type==='connect')return r.pairs.map(p=>({label:p.label,correct:r.found.includes(p.id),explanation:p.definition+(p.explanation?'. '+p.explanation:'')}));
  if(r.type==='final')return r.queue.slice(0,Math.max(1,Math.min(r.queue.length,r.index+1))).map(q=>({label:q.prompt,correct:finalFound(r,q).length>0,explanation:q.answers.map(a=>(r.found.includes(a.id)?'✓ ':'')+a.label).join(' · ')+'. '+q.explanation}));
  return r.questions.map(q=>({label:q.answer,correct:r.results.find(x=>x.id===q.id)?.correct||false,explanation:q.explanation,topic:q.topic}));
}
function review(){const r=game.rounds[game.round];app.innerHTML=gameShell(`<div class="review-header"><span class="pill">RONDE AFGEROND</span><h1 class="screen-title" tabindex="-1">${r.score===120?'Alles gevonden. Lekker!':r.score>=60?'Goed op weg.':'Nieuwe kennis om mee te nemen.'}</h1><div class="round-score">${r.score}<small> / 120</small></div><p class="subtle">${NAMES[r.type]} · bekijk wat je wist en wat je kunt herhalen.</p></div>${r.type==='puzzle'&&r.question.explanation?`<p class="subtle puzzle-explanation">${esc(r.question.explanation)}</p>`:''}<div class="review-actions"><button class="primary" data-action="next">${game.round===ROUND_TYPES.length-1?'Bekijk je uitslag':'Volgende ronde'} →</button></div><details class="review-list" open><summary>${r.type==='door'?'Mogelijke antwoorden ('+r.question.answers.length+')':'Antwoorden en uitleg'}</summary>${r.type==='door'?`<p class="subtle">Je moest ${r.question.goal} verschillende begrippen vinden. Deze telden allemaal mee. ${esc(r.question.explanation)}</p>`:''}${reviewItems(r).map(x=>`<div class="review-item ${x.correct||x.possible?'':'missed'}"><strong><span class="mark">${x.correct?'✓':x.possible?'·':'○'}</span>${esc(x.label)}</strong>${x.explanation?`<p>${esc(x.explanation)}</p>`:''}${topicTag(x)}</div>`).join('')}</details><p class="fineprint">Neem de tijd. De volgende klok loopt pas als je start.</p>`);$('.screen-title')?.focus();}
function result(){const score=totalScore(game);const previous=history.filter(x=>x.id!==game.id);
  const isBest=!previous.length||score>Math.max(...previous.map(x=>x.score));
  if(!history.some(x=>x.id===game.id)){history.unshift({id:game.id,mode:game.challenge?'duel':'solo',score,date:new Date().toISOString(),rounds:game.rounds.map(r=>({type:r.type,score:r.score}))});history=history.slice(0,50);write('-history',history);recent=[...usedIds(game),...recent].slice(0,150);write('-recent',recent);if(isBest)confetti();}
  app.innerHTML=gameShell(`<div class="review-header"><span class="pill">${isBest?'PERSOONLIJK RECORD':'POTJE VOLTOOID'}</span><h1 class="screen-title" tabindex="-1">${score>=450?'De slimste van de duurzaamheid.':score>=250?'Je ziet steeds meer verbanden.':'Elke poging maakt je sterker.'}</h1><div class="result-circle"><b>${score}</b><span>van ${MAX_SCORE} punten</span></div></div><div class="result-rows">${game.rounds.map(r=>`<div class="result-row"><span>${NUMBERS[r.type]} ${NAMES[r.type]}</span><b>${r.score} / 120</b></div>`).join('')}</div>${game.challenge?multiplayer.finish(game,game.rounds.map(r=>r.score)):''}${leaderBox()}<button class="primary wide" data-action="again">${game.challenge?'Naar mijn duels':'Nog een potje'} →</button><div class="review-actions"><button class="quiet" data-action="home">Naar start</button><button class="quiet" data-action="all-explanations">Alle uitleg bekijken</button></div>`);$('.screen-title')?.focus();}

// ─── Starten ───
function begin(){multiplayer.stop();window.history.replaceState(null,'',location.pathname);initAudio().then(()=>quizAudio.theme());game=createGame(BANK,true,recent);save();render();}
function startSolo(){if(game&&game.status!=='finished'){pendingStart=begin;modal('Een nieuw potje beginnen?','<p>Het openstaande potje wordt vervangen. Je afgeronde resultaten blijven bewaard.</p>','<button class="primary" data-action="confirm-pending">Begin nieuw potje</button><button class="secondary" data-action="close">Bewaar mijn potje</button>');}else begin();}
function startChallenge(rec,onStart=()=>{}){
  if(game?.challenge?.id===rec.id&&game.status!=='finished'){initAudio();render();return;}
  const go=()=>{onStart();window.history.replaceState(null,'',location.pathname);initAudio().then(()=>quizAudio.theme());game=createGame(BANK,true,[],seededRng(rec.seed));game.challenge={id:rec.id,role:rec.role};save();render();};
  if(game&&game.status!=='finished'){pendingStart=go;modal('Duel beginnen?','<p>Je openstaande potje wordt vervangen. Je afgeronde resultaten blijven bewaard.</p>','<button class="primary" data-action="confirm-pending">Begin het duel</button><button class="secondary" data-action="close">Annuleer</button>');}else go();
}
async function submitScore(button){
  const name=String($('#board-name')?.value||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
  if(!name){toast('Vul eerst je naam in.',true);$('#board-name')?.focus();return;}
  board.setPlayerName(name);button.disabled=true;button.textContent='Bezig…';
  try{game.submitted=await board.submit({name,rounds:game.rounds.map(r=>r.score),version:BANK.version,gameId:game.id});save();render();toast('Je staat op plek '+game.submitted.rank+'.');}
  catch(e){button.disabled=false;button.textContent='Opnieuw proberen';toast(e.message,true);}
}
function handleAnswer(result,before){if(result.kind==='correct'){bling();const delta=totalScore(game)-before;toast(delta?'+'+delta+' punten · gevonden!':'Goed gevonden!');save();render();}else if(result.kind==='duplicate'){toast('Dit antwoord had je al.');const el=$('#answer-input');if(el)el.value='';}else if(result.kind==='wrong'){quizAudio.cue('wrong');toast('Nog niet de juiste combinatie.',true);save();render();}else if(result.kind==='closed'&&game.status==='review')render();}
function historyModal(){modal('Jouw laatste resultaten',`<div class="result-rows">${history.slice(0,10).map(h=>`<div class="result-row"><span>${h.mode==='duel'?'Duel':'Solo'}<br><small>${new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short'}).format(new Date(h.date))}</small></span><b>${h.score} / ${MAX_SCORE}</b></div>`).join('')}</div>`,'<button class="primary" data-action="close">Sluiten</button>');}
const multiplayer=createMultiplayerUI({app,esc,toast,modal,closeModal,NAMES,max:MAX_SCORE,version:BANK.version,getGame:()=>game,setView:v=>{view=v;document.body.dataset.view=v;quizAudio.stop();},startChallenge,correct:bling});

// ─── Interactie ───
function checkTyped(){const r=game.rounds[game.round];if(r?.type!=='sprint'||r.answered)return;const value=$('#answer-input')?.value||'';if(!value.trim()){toast('Typ eerst een antwoord, of sla de vraag over.');return;}const res=answerSprint(game,value);quizAudio.cue(res.kind==='correct'?'correct':'wrong');save();render();}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(multiplayer.route(button))return;
  const before=game?totalScore(game):0;const r=game?.rounds[game.round];
  if(button.dataset.choice){const res=answerSprint(game,button.dataset.choice);if(res.kind==='correct')bling();else if(res.kind==='wrong')quizAudio.cue('wrong');save();render();return;}
  if(button.dataset.card){const res=selectCard(game,button.dataset.card);save();if(res.kind==='wrong'){quizAudio.cue('wrong');toast('Deze vier horen niet bij één groep.',true);}render();return;}
  if(button.dataset.group){const res=nameGroup(game,button.dataset.group);if(res.kind==='wrong'){quizAudio.cue('wrong');toast('Groep gevonden, maar dat is niet het verband. Halve punten.',true);save();render();}else handleAnswer(res,before);return;}
  if(button.dataset.left){if(game.status!=='active')return;r.left=button.dataset.left;save();render();return;}
  if(button.dataset.right){if(!r.left){toast('Kies eerst een begrip.');return;}handleAnswer(connect(game,r.left,button.dataset.right),before);return;}
  const action=button.dataset.action;
  if(action==='close')closeModal();
  if(action==='rules')showRules();
  if(action==='history')historyModal();
  if(action==='leaderboard')void leaderboardView();
  if(action==='solo')startSolo();
  if(action==='again'){if(game?.challenge)multiplayer.hub();else begin();}
  if(action==='confirm-pending'&&pendingStart){const go=pendingStart;pendingStart=null;go();}
  if(action==='resume'){initAudio();render();}
  if(action==='start'){initAudio().then(()=>quizAudio.cue('start'));startRound(game);save();render();}
  if(action==='sprint-next'){advanceSprint(game);save();render();window.scrollTo({top:0,behavior:'instant'});}
  if(action==='next'){nextRound(game);save();render();window.scrollTo({top:0,behavior:'instant'});}
  if(action==='skip'){answerSprint(game,'');save();render();}
  if(action==='check')checkTyped();
  if(action==='final-pass'){passFinal(game);save();render();}
  if(action==='submit-score')void submitScore(button);
  if(action==='end')modal('Deze ronde afronden?','<p>Je gevonden antwoorden blijven tellen. Niet gevonden antwoorden leveren geen punten op.</p>','<button class="primary" data-action="confirm-end">Ronde afronden</button><button class="secondary" data-action="close">Verder spelen</button>');
  if(action==='confirm-end'){finishRound(game);save();render();}
  if(action==='leave'){if(game.status==='active')modal('Even stoppen?','<p>De klok van deze gestarte ronde blijft doorlopen. Tussen rondes kun je zonder tijdverlies stoppen.</p>','<button class="primary" data-action="home">Bewaar en naar start</button><button class="secondary" data-action="close">Verder spelen</button>');else home();}
  if(action==='home')home();
  if(action==='all-explanations'){modal('Neem de kennis mee',game.rounds.map(rr=>`<details><summary>${NAMES[rr.type]}</summary>${reviewItems(rr).map(x=>`<div class="review-item"><strong>${esc(x.label)}</strong>${x.explanation?`<p>${esc(x.explanation)}</p>`:''}</div>`).join('')}</details>`).join(''),'<button class="primary" data-action="close">Sluiten</button>');$('.modal').style.maxHeight='85dvh';$('.modal').style.overflow='auto';}
});
function typeAnswer(event){if(event.target.id!=='answer-input'||composing||game?.status!=='active'||view!=='game')return;const r=game.rounds[game.round],before=totalScore(game);
  clearTimeout(typeTimeout);const value=event.target.value;
  const accept=(allowPrefix,allowTypos=false)=>{if(view!=='game'||game.status!=='active'||game.rounds[game.round]!==r||$('#answer-input')?.value!==value)return;
    if(r.type==='door'){const res=answerDoor(game,value,Date.now(),allowPrefix,allowTypos);handleAnswer(res,before);return res;}
    if(r.type==='final'){const res=answerFinal(game,value,Date.now(),allowPrefix,allowTypos);handleAnswer(res,before);return res;}
    if(r.type==='sprint'&&!r.answered){const q=r.questions[r.index],res=matchAnswer(value,[{id:q.id,aliases:q.aliases}],[],allowPrefix,allowTypos);if(res.kind==='correct'){answerSprint(game,value);bling();save();render();}return res;}
  };
  const res=accept(false);if(res?.kind==='prefix'||res?.kind==='none')typeTimeout=setTimeout(()=>{const delayed=accept(true,true);if(delayed?.kind==='none'&&value.trim().length>4){const help=$('.input-help');if(help)help.textContent=r.type==='sprint'?'Nog geen match. Probeer een andere formulering of kies Controleer.':'Nog geen match. Probeer één begrip of een andere formulering.';}},550);
}
document.addEventListener('input',typeAnswer);document.addEventListener('compositionstart',()=>composing=true);document.addEventListener('compositionend',event=>{composing=false;typeAnswer(event);});
document.addEventListener('keydown',event=>{const dialog=$('[role=dialog]');if(dialog){const buttons=[...dialog.querySelectorAll('button,a')];if(event.key==='Tab'&&buttons.length){const first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}if(event.key==='Escape'&&!game?.rounds[game.round]?.candidate)closeModal();}
  if(event.target.id==='answer-input'&&event.key==='Enter'){event.preventDefault();if(game?.rounds[game.round]?.type==='sprint')checkTyped();}
  if(event.target.id==='board-name'&&event.key==='Enter'){event.preventDefault();$('[data-action=submit-score]')?.click();}});
$('#home-button').addEventListener('click',()=>{if(view==='game'&&game.status==='active')modal('Naar het startscherm?','<p>Je voortgang wordt bewaard. De klok van deze gestarte ronde loopt door.</p>','<button class="primary" data-action="home">Naar startscherm</button><button class="secondary" data-action="close">Verder spelen</button>');else home();});
function soundState(){const m=$('#music-button');m.textContent=prefs.music?'Muziek aan':'Muziek uit';m.setAttribute('aria-pressed',String(prefs.music));m.disabled=!prefs.sound;quizAudio.setMusic(prefs.music);const b=$('#sound-button');b.textContent=prefs.sound?'Geluid aan':'Geluid uit';b.setAttribute('aria-pressed',String(prefs.sound));b.setAttribute('aria-label',prefs.sound?'Geluid uitschakelen':'Geluid inschakelen');b.title=prefs.sound?'Geluid aan':'Geluid uit';quizAudio.setEnabled(prefs.sound);}
$('#sound-button').addEventListener('click',()=>{prefs.sound=!prefs.sound;save();soundState();if(prefs.sound){initAudio();syncAudio();}});
$('#music-button').addEventListener('click',()=>{prefs.music=!prefs.music;save();soundState();if(prefs.music)initAudio().then(()=>{if(view!=='game'||game?.status!=='active')quizAudio.theme();syncAudio();});});
window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{syncAudio();if(!document.hidden&&game){if(expire(game)){save();if(view==='game')render();}}});
setInterval(()=>{if(!game||game.status!=='active')return;if(expire(game)){save();if(view==='game')render();return;}syncAudio();if(view==='game'&&!document.hidden&&!game.rounds[game.round].answered){const seconds=remaining(game);quizAudio.countdown(game.id+'-'+game.round+'-'+seconds,seconds);}const el=$('#timer');if(el&&view==='game'){el.textContent=timerText();el.classList.toggle('urgent',!game.rounds[game.round].answered&&remaining(game)<=10);}},150);
if(window.visualViewport){let baselineHeight=innerHeight,baselineWidth=innerWidth;const updateViewport=()=>{const h=visualViewport.height;if(Math.abs(innerWidth-baselineWidth)>70){baselineHeight=innerHeight;baselineWidth=innerWidth;}baselineHeight=Math.max(baselineHeight,h);const editing=document.activeElement?.matches('input');document.documentElement.style.setProperty('--visible-height',h+'px');document.body.classList.toggle('keyboard-open',!!editing&&Math.max(innerHeight,baselineHeight)-h>140);};visualViewport.addEventListener('resize',updateViewport);document.addEventListener('focusin',updateViewport);document.addEventListener('focusout',()=>setTimeout(updateViewport,0));updateViewport();}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install-button').hidden=false;});
$('#install-button').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;$('#install-button').hidden=true;});
window.addEventListener('appinstalled',()=>$('#install-button').hidden=true);
if('serviceWorker'in navigator){const hadController=!!navigator.serviceWorker.controller;let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadController&&!refreshing){refreshing=true;save();location.reload();}});navigator.serviceWorker.register('./sw.js').catch(()=>{});}
soundState();if(!multiplayer.handleUrl())home();
