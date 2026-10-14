// Eigen quizmuziek, live gesynthetiseerd met Web Audio. Geen samples of tv-opnames:
// een origineel thema in de sfeer van een tv-quiz (mineur, pauken, tikkende klok).
const NOTE = (() => { const names = {C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
  return n => { const m = /^([A-G][#b]?)(\d)$/.exec(n); return 440 * 2 ** ((names[m[1]] + 12 * (+m[2] + 1) - 69) / 12); }; })();

// Thema: 6 maten van 4 tellen in d-klein. [tel, duur in tellen, noot]
const THEME = {
  bpm: 144,
  melody: [
    [0,1.5,'D5'],[1.5,.5,'A4'],[2,.5,'D5'],[2.5,.5,'E5'],[3,1,'F5'],
    [4,.5,'F5'],[4.5,.5,'E5'],[5,1,'D5'],[6,.5,'F5'],[6.5,.5,'G5'],[7,1,'A5'],
    [8,1.5,'Bb5'],[9.5,.5,'A5'],[10,.5,'G5'],[10.5,.5,'F5'],[11,1,'E5'],
    [12,.5,'E5'],[12.5,.5,'F5'],[13,.5,'E5'],[13.5,.5,'C#5'],[14,1,'A4'],[15,.5,'C#5'],[15.5,.5,'E5'],
    [16,.5,'D5'],[16.5,.5,'F5'],[17,1,'A5'],[18,1.5,'D6'],[19.5,.25,'C6'],[19.75,.25,'Bb5'],
    [20,1,'A5']
  ],
  bars: [['D2',['D4','F4','A4']],['Bb1',['D4','F4','Bb4']],['G1',['D4','G4','Bb4']],['A1',['C#4','E4','A4']],['D2',['D4','F4','A4']],['A1',['C#4','E4','A4']]],
  final: { beat: 21, chord: ['D3','A3','D4','F#4','A4','D5'], bell: 'D6' }
};

export class QuizAudio {
  constructor(){this.context=null;this.master=null;this.sfxBus=null;this.musicBus=null;this.enabled=true;this.musicEnabled=true;this.nodes=new Set();this.musicNodes=new Set();this.loop=null;this.tickKey='';this.roundKey='';this.noise=null;this.beat=0;}
  async unlock(){
    if(!this.enabled)return;
    try{
      this.context??=new(window.AudioContext||window.webkitAudioContext)();
      if(!this.master){
        const c=this.context;this.master=c.createGain();this.master.gain.value=.42;
        const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;
        this.master.connect(comp);comp.connect(c.destination);
        this.sfxBus=c.createGain();this.sfxBus.connect(this.master);
        this.musicBus=c.createGain();this.musicBus.gain.value=this.musicEnabled?.75:0;this.musicBus.connect(this.master);
        const len=c.sampleRate*.5,buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;this.noise=buf;
      }
      await this.context.resume();
    }catch{}
  }
  get ready(){return this.enabled&&this.context&&this.context.state==='running';}
  setEnabled(value){this.enabled=value;if(this.master)this.master.gain.value=value?.42:0;if(!value)this.stop();}
  setMusic(value){this.musicEnabled=value;if(this.musicBus)this.musicBus.gain.value=value?.75:0;if(!value){this.stopMusic();this.stopLoop();}}

  track(node,music){const set=music?this.musicNodes:this.nodes;set.add(node);node.onended=()=>{set.delete(node);try{node.disconnect();}catch{}};}
  env(g,t,dur,vol,attack=.008,release=.06){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+attack);g.gain.setValueAtTime(vol,Math.max(t+attack,t+dur-release));g.gain.exponentialRampToValueAtTime(.0001,t+dur);}
  osc(type,freq,t,dur,vol,{music=false,attack,release,cutoff,detune=0,glide}={}){
    const c=this.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.detune.value=detune;
    if(glide)o.frequency.exponentialRampToValueAtTime(glide,t+dur);
    let out=o;if(cutoff){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=cutoff;o.connect(f);out=f;}
    out.connect(g);g.connect(music?this.musicBus:this.sfxBus);this.env(g,t,dur,vol,attack,release);this.track(o,music);o.start(t);o.stop(t+dur+.02);
  }
  burst(t,dur,vol,{type='highpass',freq=3000,q=1,music=false}={}){
    const c=this.context,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;f.type=type;f.frequency.value=freq;f.Q.value=q;
    s.connect(f);f.connect(g);g.connect(music?this.musicBus:this.sfxBus);this.env(g,t,dur,vol,.002,dur*.8);this.track(s,music);s.start(t);s.stop(t+dur+.02);
  }
  // Instrumenten
  lead(n,t,dur,vol=.075){const f=NOTE(n);this.osc('sawtooth',f,t,dur,vol,{music:true,cutoff:2600,detune:-6,release:.08});this.osc('square',f,t,dur,vol*.6,{music:true,cutoff:1800,detune:6,release:.08});}
  bass(n,t,dur,vol=.12){this.osc('sawtooth',NOTE(n),t,dur,vol,{music:true,cutoff:520,release:.05});this.osc('sine',NOTE(n),t,dur,vol*.9,{music:true});}
  pad(notes,t,dur,vol=.028){for(const n of notes)for(const d of[-9,9])this.osc('sawtooth',NOTE(n),t,dur,vol,{music:true,cutoff:1100,detune:d,attack:.18,release:.3});}
  timp(n,t,vol=.32,music=true){const f=NOTE(n);this.osc('sine',f*1.5,t,.7,vol,{music,glide:f,release:.5});this.burst(t,.12,vol*.35,{type:'lowpass',freq:420,music});}
  tick(t,high=true,vol=.05,music=false){this.burst(t,.03,vol,{type:'bandpass',freq:high?3200:1900,q:6,music});}
  bell(n,t,dur=1.6,vol=.06){const f=NOTE(n);this.osc('sine',f,t,dur,vol,{music:true,release:dur*.9});this.osc('sine',f*2.76,t,dur*.5,vol*.35,{music:true,release:dur*.45});}

  // Openingsthema (~10 s)
  theme(){
    if(!this.ready||!this.musicEnabled)return;this.stopMusic();this.stopLoop();
    const c=this.context,b=60/THEME.bpm,t0=c.currentTime+.08;this.musicBus.gain.cancelScheduledValues(t0);this.musicBus.gain.setValueAtTime(.75,t0);
    THEME.bars.forEach(([root,chord],bar)=>{const t=t0+bar*4*b;
      this.pad(chord,t,4*b);this.timp(root.replace(/\d/,m=>+m+1),t,.3);
      const r=NOTE(root),pattern=[0,0,12,0,0,7,12,0];pattern.forEach((semi,i)=>{const f=r*2**(semi/12);this.osc('sawtooth',f,t+i*b/2,b*.42,.1,{music:true,cutoff:600,release:.04});this.osc('sine',f,t+i*b/2,b*.42,.09,{music:true});});
      for(let i=0;i<4;i++)this.tick(t+i*b,i%2===0,.045,true);
      if(bar===3)for(let i=0;i<8;i++)this.timp('A2',t+i*b/2,.08+i*.025);
    });
    for(const [beat,dur,n] of THEME.melody)this.lead(n,t0+beat*b,dur*b*.95);
    const fin=t0+THEME.final.beat*b;this.timp('D3',fin,.42);this.pad(THEME.final.chord,fin,3*b,.034);for(const n of THEME.final.chord.slice(1))this.osc('sawtooth',NOTE(n),fin,b*.6,.05,{music:true,cutoff:2200,release:.1});this.bell(THEME.final.bell,fin,3*b,.07);
    this.burst(fin,1.4,.05,{type:'highpass',freq:6000,music:true});
  }
  // Korte jingle vóór elke ronde (~2,5 s)
  sting(){
    if(!this.ready||!this.musicEnabled)return;this.stopMusic();
    const b=60/THEME.bpm,t=this.context.currentTime+.05;
    ['A4','D5','F5','A5'].forEach((n,i)=>this.lead(n,t+i*b/2,b*.45,.07));
    this.timp('D3',t+2*b,.36);this.pad(['D4','F4','A4','D5'],t+2*b,2.5*b,.032);this.bell('A5',t+2*b,2*b,.05);
    for(let i=0;i<4;i++)this.tick(t+i*b/2,i%2===0,.05,true);
  }
  stopMusic(fade=0){
    if(!this.context)return;const nodes=[...this.musicNodes];this.musicNodes.clear();
    if(fade&&this.musicBus){const t=this.context.currentTime;this.musicBus.gain.cancelScheduledValues(t);this.musicBus.gain.setValueAtTime(this.musicBus.gain.value,t);this.musicBus.gain.linearRampToValueAtTime(.0001,t+fade);
      setTimeout(()=>{for(const n of nodes){try{n.stop();}catch{}}if(this.musicBus)this.musicBus.gain.value=this.musicEnabled?.75:0;},fade*1000+30);return;}
    for(const n of nodes){try{n.stop();}catch{}}
  }
  cue(kind){
    if(!this.ready)return;const t=this.context.currentTime;
    if(kind==='correct'){[587.33,739.99,880,1174.66].forEach((f,i)=>this.osc('triangle',f,t+i*.055,.22,.12));this.osc('sine',110,t,.15,.1,{glide:55});}
    if(kind==='wrong'){this.osc('sawtooth',196,t,.2,.06,{cutoff:900,glide:150});this.osc('sawtooth',146.83,t+.12,.3,.06,{cutoff:700,glide:110});}
    if(kind==='start'){if(this.musicEnabled)this.sting();else[293.66,440,587.33].forEach((f,i)=>this.osc('triangle',f,t+i*.1,.24,.09));}
    if(kind==='end'){this.stopLoop();this.osc('sine',73.42,t,.9,.22,{glide:55});this.burst(t,.5,.08,{type:'lowpass',freq:300});[880,659.25,587.33].forEach((f,i)=>this.osc('triangle',f,t+.05+i*.13,.4,.07));}
    if(kind==='complete'){this.stopLoop();if(this.musicEnabled&&this.musicBus){const b=60/THEME.bpm;['D5','F#5','A5','D6'].forEach((n,i)=>this.lead(n,t+i*b/2,b*.48,.07));this.timp('D3',t+2*b,.4);this.pad(['D4','F#4','A4','D5'],t+2*b,4*b,.035);this.bell('D6',t+2*b,4*b,.07);this.burst(t+2*b,1.6,.05,{type:'highpass',freq:6000,music:true});}
      else [392,523.25,659.25,783.99,1046.5].forEach((f,i)=>this.osc('triangle',f,t+i*.1,.36,.11));}
    if(kind==='tick'){this.tick(t,true,.09);this.osc('sine',880,t,.05,.035);}
  }
  // Tikkende klok met lage puls tijdens een actieve ronde.
  stage(active,key){
    if(!active||!this.enabled){this.stopLoop();return;}if(this.loop&&this.roundKey===key)return;this.stopLoop();this.roundKey=key;this.beat=0;
    const pulse=()=>{if(document.hidden||!this.ready)return;const t=this.context.currentTime;const high=this.beat%2===0;if(!this.urgent)this.tick(t,high,.05);
      if(this.musicEnabled&&this.beat%4===0){this.osc('sine',73.42,t,.5,.06,{glide:65});this.osc('sawtooth',73.42,t,.35,.025,{cutoff:300});}
      if(this.musicEnabled&&this.beat%16===8)this.pad(['D3','A3'],t,3.6,.012);
      this.beat++;};
    pulse();this.loop=setInterval(pulse,1000);
  }
  countdown(key,seconds){if(key===this.tickKey)return;this.tickKey=key;this.urgent=seconds>0&&seconds<=10;if(seconds>0&&seconds<=10)this.cue('tick');}
  stopLoop(){clearInterval(this.loop);this.loop=null;this.roundKey='';this.urgent=false;}
  stop(){this.stopLoop();this.stopMusic();for(const node of this.nodes){try{node.stop();}catch{}}this.nodes.clear();}
}
