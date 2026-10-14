import {challenges,encode,decode,linkParam,total,winner} from './duels.js';
import {playerName,setPlayerName} from './leaderboard.js';
// Duels via een link: speler A speelt vijf rondes en deelt een link; speler B speelt
// dezelfde vragen en stuurt de uitslag terug. Geen server, geen wachten op beurten.
export function createMultiplayerUI(ui){
 const {app,esc,toast,modal,closeModal,NAMES}=ui;let invite=null;
 const ROUNDS=Object.values(NAMES);
 const field=(id,label,value='')=>`<label class="duel-field" for="${id}">${label}<input id="${id}" class="answer-input" value="${esc(value)}" maxlength="24" autocomplete="nickname" placeholder="Je voornaam of nickname"></label>`;
 function page(html){ui.setView('duel');closeModal();app.innerHTML=`<div class="duel-page">${html}</div>`;window.scrollTo({top:0,behavior:'instant'});}
 const stop=()=>{};
 function shareBox(url,label,text){return `<div class="invite-box"><label for="invite-link">${esc(label)}</label><input id="invite-link" readonly value="${esc(url)}"><div class="invite-actions"><button class="primary" data-multi="share" data-url="${esc(url)}" data-text="${esc(text)}">Deel link</button><button class="secondary" data-multi="copy">Kopieer link</button></div></div>`;}
 function board(rec){
  const players=[rec.a,rec.o];
  const cols=players.map((p,i)=>`<div class="duel-player"><span>${esc(p?.n||(i?'Tegenstander':'Uitdager'))}${(rec.role==='a'?0:rec.role==='o'?1:-1)===i?' · jij':''}</span><strong>${p?total(p.r):'—'}<small> / ${ui.max}</small></strong><span>${p?'alle rondes gespeeld':'nog niet gespeeld'}</span></div>`).join('');
  const table=`<div class="duel-table-wrap"><table class="duel-table"><thead><tr><th>Ronde</th>${players.map((p,i)=>`<th>${esc(p?.n||(i?'Tegenstander':'Uitdager'))}</th>`).join('')}</tr></thead><tbody>${ROUNDS.map((label,i)=>`<tr><td>${label}</td>${players.map(p=>`<td>${p?p.r[i]:'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<div class="duel-scoreboard">${cols}</div>${table}`;
 }
 function verdict(rec){if(!rec.a||!rec.o)return '';const w=winner(rec.a,rec.o);if(w==='tie')return 'Gelijkspel!';const meWon=(w==='a')===(rec.role==='a');return meWon?'Jij wint dit duel!':`${esc((w==='a'?rec.a:rec.o).n)} wint dit duel.`;}
 function summary(rec){
  let lead,extra='';
  if(rec.role==='a'&&!rec.a){lead='Je hebt dit duel nog niet afgemaakt.';extra=resumeButton(rec);}
  else if(rec.role==='a'&&!rec.o){lead='Wacht op je tegenstander. Deel de link als je dat nog niet deed.';extra=shareBox(encode(rec),'Uitdagingslink','Speel vijf SHIFT-rondes tegen mij. Zelfde vragen, zelfde tijd.');}
  else if(rec.role==='o'&&!rec.o){lead='Je hebt deze uitdaging nog niet afgemaakt.';extra=resumeButton(rec);}
  else{lead=verdict(rec);if(rec.role==='o')extra=shareBox(encode(rec),'Stuur de uitslag terug naar '+rec.a.n,'Ik heb je SHIFT-uitdaging gespeeld. Bekijk de uitslag.');}
  page(`<h1>Duel</h1><p class="lead">${lead}</p>${board(rec)}${extra}<div class="duel-links"><button class="help-button" data-multi="hub">Mijn duels</button><button class="help-button" data-action="home">Naar start</button></div><p class="fineprint">Zelfde vragen · zelfde tijd · 120 punten per ronde.</p>`);
 }
 function resumeButton(rec){const g=ui.getGame();return g?.challenge?.id===rec.id&&g.status!=='finished'?'<button class="primary wide" data-action="resume">Verder spelen →</button>':'<p class="subtle">Dit potje is vervangen door een ander spel en kan niet meer worden afgemaakt.</p>';}
 function hubMarkup(){const records=challenges.list();return `<h1>Mijn duels</h1><p class="lead">Daag iemand uit met een link. Jullie spelen dezelfde vragen, ieder wanneer het uitkomt, en vergelijken daarna de uitslag.</p><div class="duel-list">${records.length?records.map(x=>{const me=x.role==='a'?x.a:x.o,them=x.role==='a'?x.o:x.a;const status=!me?'Nog niet afgemaakt':!them?'Wacht op tegenstander':verdict(x);return `<button class="duel-list-row ${me&&them?'':'my-turn'}" data-multi="open" data-id="${x.id}"><span><strong>${esc([x.a?.n||x.myName,x.o?.n||(x.role==='o'?x.myName:'')].filter(Boolean).join(' & ')||'Duel')}</strong><small>${status}</small></span><b>${[x.a,x.o].filter(Boolean).map(p=>total(p.r)).join(' – ')}</b></button>`;}).join(''):'<div class="home-note">Je hebt nog geen duels. Daag iemand uit vanaf het startscherm.</div>'}</div><div class="join-by-link"><label class="duel-field" for="duel-link">Heb je een uitdaging of uitslag ontvangen?<input id="duel-link" class="answer-input" placeholder="Plak de link" autocomplete="off"></label><button class="secondary" data-multi="find">Open link</button></div><button class="primary" data-multi="create">Daag iemand uit</button><p class="fineprint">Duels worden op dit apparaat bewaard. Scores gaan alleen mee in de links die je zelf deelt.</p>`;}
 function hub(){invite=null;page(hubMarkup());history.replaceState(null,'',location.pathname);}
 function inviteScreen(c){
  invite=c;const mismatch=c.bank!==ui.version;
  page(`<p class="eyebrow">UITDAGING</p><h1>${esc(c.a.n)} daagt je uit!</h1><p class="lead">Vijf rondes tegen de klok, over de duurzaamheidskennis die elke professional nodig heeft. Je krijgt precies dezelfde vragen. De score van ${esc(c.a.n)} zie je pas als je klaar bent.</p>${mismatch?'<div class="home-note">Let op: deze uitdaging is gemaakt met een andere versie van de vragen. De vragen kunnen dus iets afwijken.</div>':''}<div class="join-form">${field('join-name','Jouw naam',playerName())}<button class="primary wide" data-multi="accept">Accepteer de uitdaging →</button></div><div class="duel-links"><button class="help-button" data-multi="hub">Mijn duels</button><button class="help-button" data-action="home">Naar start</button></div>`);
  history.replaceState(null,'',encode(c));
 }
 function openParam(param){
  let c;try{c=decode(param);}catch(e){page(`<h1>Uitdaging openen</h1><p>${esc(e.message)}</p><button class="primary" data-multi="hub">Mijn duels</button>`);return;}
  const mine=challenges.get(c.id);
  if(c.o){ // uitslag teruggestuurd
   if(mine?.role==='a'){mine.a??=c.a;mine.o=c.o;challenges.save(mine);ui.correct?.();summary(mine);return;}
   if(mine?.role==='o'){summary(mine);return;}
   summary({...c,role:'view'});return;
  }
  if(mine){summary(mine);return;}
  inviteScreen(c);
 }
 function oldDuel(id){page(`<h1>Oud duel</h1><p class="lead">Deze link hoort bij een duel op de server van de oorspronkelijke SHIFT. Die server werkt niet vanaf deze kopie.</p><a class="primary wide" style="display:block;text-align:center;text-decoration:none" href="https://fabianb88.github.io/shift/?duel=${esc(id)}">Open het duel in de originele SHIFT ↗</a><p class="subtle">Hier kun je een nieuw duel starten via een link. Dat werkt zonder server.</p><div class="duel-links"><button class="help-button" data-multi="create">Daag iemand uit</button><button class="help-button" data-action="home">Naar start</button></div>`);}
 function create(){modal('Daag iemand uit',`<p>Vijf rondes tegen de klok. Speel eerst zelf, daarna deel je een link. Je tegenstander krijgt exact dezelfde vragen.</p>${field('duel-name','Jouw naam',playerName())}`,'<button class="primary" data-multi="create-confirm">Start mijn rondes</button><button class="secondary" data-action="close">Annuleer</button>');document.querySelector('#duel-name')?.focus();}
 function needName(id){const name=challenges.cleanName(document.querySelector('#'+id)?.value);if(!name){toast('Vul eerst je naam in.',true);document.querySelector('#'+id)?.focus();return null;}setPlayerName(name);return name;}
 async function multi(button){const action=button.dataset.multi;try{
  if(action==='hub'||action==='ranking')return hub();
  if(action==='open'){const rec=challenges.get(button.dataset.id);if(rec)summary(rec);return;}
  if(action==='create')return create();
  if(action==='create-confirm'){const name=needName('duel-name');if(!name)return;const rec=challenges.create(name,ui.version);ui.startChallenge(rec,()=>challenges.save(rec));return;}
  if(action==='accept'){const name=needName('join-name');if(!name||!invite)return;const rec={id:invite.id,seed:invite.seed,bank:invite.bank,role:'o',myName:name,a:invite.a,o:null};ui.startChallenge(rec,()=>challenges.save(rec));return;}
  if(action==='find'){const raw=document.querySelector('#duel-link').value;try{const old=new URL(raw.trim(),location.href).searchParams.get('duel');if(/^[a-f0-9]{24}$/.test(old||''))return oldDuel(old);}catch{}const p=linkParam(raw);if(!p)throw Error('Plak een volledige uitdagingslink.');return openParam(p);}
  if(action==='share'){const url=button.dataset.url;if(navigator.share){try{await navigator.share({title:'SHIFT · duel',text:button.dataset.text,url});return;}catch(e){if(e.name==='AbortError')return;}}try{await navigator.clipboard.writeText(url);toast('Link gekopieerd.');}catch{document.querySelector('#invite-link')?.select();toast('Selecteer en kopieer de link.');}return;}
  if(action==='copy'){const input=document.querySelector('#invite-link');try{await navigator.clipboard.writeText(input.value);toast('Link gekopieerd.');}catch{input.select();toast('Selecteer en kopieer de link.');}return;}
 }catch(e){toast(e.message,true);}}
 function route(button){if(button.dataset.multi){void multi(button);return true;}return false;}
 // Wordt aangeroepen als een duelpotje klaar is: bewaart de score en geeft het deelblok terug.
 function finish(game,scores){
  const rec=challenges.get(game.challenge.id);if(!rec)return '';const me={n:rec.myName,r:scores};
  if(rec.role==='a'&&!rec.a){rec.a=me;challenges.save(rec);}if(rec.role==='o'&&!rec.o){rec.o=me;challenges.save(rec);}
  if(rec.role==='a'&&!rec.o)return `<div class="duel-result"><h2>Jouw uitdaging staat klaar</h2><p class="subtle">Stuur deze link naar je tegenstander. Die speelt dezelfde vragen en stuurt daarna de uitslag terug.</p>${shareBox(encode(rec),'Uitdagingslink','Speel vijf SHIFT-rondes tegen mij. Zelfde vragen, zelfde tijd.')}</div>`;
  return `<div class="duel-result"><h2>${verdict(rec)}</h2>${board(rec)}${rec.role==='o'?shareBox(encode(rec),'Stuur de uitslag terug naar '+rec.a.n,'Ik heb je SHIFT-uitdaging gespeeld. Bekijk de uitslag.'):''}</div>`;
 }
 function handleUrl(){const params=new URL(location.href).searchParams;const c=params.get('uitdaging');if(c){openParam(c);return true;}const old=params.get('duel');if(/^[a-f0-9]{24}$/.test(old||'')){oldDuel(old);return true;}return false;}
 return {route,hub,stop,finish,handleUrl,create};
}
