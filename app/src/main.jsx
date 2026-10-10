import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, ArrowClockwise, Backpack, BookOpenText, Compass, FlagPennant, Waves, Check, CaretLeft, CaretRight, Crown, GearSix, Heart, House, Lightbulb, LockKey, MapTrifold, Pause, Play, Snowflake, Sparkle, SpeakerHigh, SpeakerSlash, Star, UsersThree, X } from '@phosphor-icons/react';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-600.css';
import '@fontsource/rubik/latin-700.css';
import { CHAPTERS, COMPANIONS, DIFFICULTIES, LEVELS, PIECES, goalName, activeLevel, ACTS, SHAPES, MECHANICS } from './levels.js';
import { Game, adjacent } from './engine.js';
import { awardWin, readProfile, saveProfile, checkpointRun, claimQuest, claimChest, quests, CHESTS, regionStars, deleteProfile, refreshDaily } from './storage.js';
import { sound } from './audio.js';
import { Sprite, Character, Stars, Difficulty, IconButton, GoalIcon, MechanicIcon, Landmark, BoardPreview, art, mapArt } from './Art.jsx';
import CampaignMap from './CampaignMap.jsx';
import Journal, {RewardContents} from './Journal.jsx';
import LoadingScreen from './LoadingScreen.jsx';
import GameBoard from './GameBoard.jsx';
import {SettingsLinks,NotificationSettings,PrivacyCenter,isPolicyPage,policyKey} from './SettingsCenter.jsx';
import {syncNotificationGame} from './notifications.js';
import './style.css';
import './expedition.css';
import './campaign.css';

if(globalThis.PenguNative)document.documentElement.classList.add('native-app');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const review = new URLSearchParams(location.search).has('review');

function App() {
  const [profile,setProfile]=useState(readProfile);
  const profileRef=useRef(profile);
  const [screen,setScreen]=useState('home');
  const mapMemory=useRef(null);
  const [previewPhase,setPreviewPhase]=useState(0);
  const [loot,setLoot]=useState(null);
  const [relic,setRelic]=useState(0);
  const [chest,setChest]=useState(null);
  const [loadProgress,setLoadProgress]=useState(0);
  const [loadFailed,setLoadFailed]=useState(false);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [dialog,setDialog]=useState(null);
  const [preview,setPreview]=useState(null);
  const [state,setState]=useState(null);
  const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState(null);
  const [focusedCell,setFocusedCell]=useState(0);
  const [clearing,setClearing]=useState([]);
  const [hint,setHint]=useState([]);
  const [booster,setBooster]=useState(null);
  const [message,setMessage]=useState('');
  const [combo,setCombo]=useState('');
  const [invalid,setInvalid]=useState([]);
  const [reward,setReward]=useState(0);
  const [ready,setReady]=useState(false);
  const engine=useRef(null), busyRef=useRef(false), actionRef=useRef(0), toastTimer=useRef(null), pointer=useRef(null), suppressClick=useRef(false);
  const current=state?activeLevel(state.levelId,state.phaseIndex):null;
  const previewStage=preview?activeLevel(preview.id,previewPhase):null;
  const pendingQuests=quests(profile).filter(q=>!q.claimed&&q.value>=q.target).length;
  const totalStars=Object.values(profile.stars).reduce((a,b)=>a+b,0);
  const nextLevel=Math.min(100,profile.unlocked);
  const homeLevel=profile.run?.levelId||nextLevel;
  const reduced= !profile.motion || matchMedia('(prefers-reduced-motion: reduce)').matches;

  function updateProfile(next) {
    const value=typeof next==='function'?next(profileRef.current):next;
    profileRef.current=value;setProfile(value);saveProfile(value);
  }
  useEffect(()=>{syncNotificationGame(profile);},[profile]);
  function openSettingsPage(page){setDialog(null);go(page);}
  function backToSettings(){setScreen('home');location.hash='home';setTimeout(()=>setDialog('settings'),0);}
  function eraseSave(){
    globalThis.PenguNative?.eraseGameData?.();
    actionRef.current++;engine.current=null;setState(null);setPreview(null);setDialog(null);
    updateProfile(deleteProfile());go('home');toast('Your save has been deleted. A fresh expedition awaits.');
  }
  function toast(text) {setMessage(text);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setMessage(''),2800);}
  function go(to) {
    if(busyRef.current)return;
    setDialog(null);setPreview(null);setScreen(to);setSelected(null);setBooster(null);
    if(location.hash!==`#${to}`)location.hash=to;
    sound('tap',profileRef.current.sound);
  }
  function begin(levelId, resume=false) {
    if(!review && levelId>profileRef.current.unlocked)return toast('Finish the previous level to unlock this one.');
    const level=LEVELS[levelId-1];
    if(!level)return;
    const p=profileRef.current;
    let game;
    try {game=resume&&p.run?.levelId===levelId?new Game(level,0,p.run):null;}catch{game=null;}
    if(!game) {
      const attempt=(p.attempts[levelId]||0)+1;
      game=new Game(level,level.seed+(attempt-1)*104729);
      game.companion=COMPANIONS[p.companion].type<level.colors?p.companion:0;
      updateProfile({...p,attempts:{...p.attempts,[levelId]:attempt},run:game.snapshot()});
    }
    engine.current=game;setFocusedCell(game.board.findIndex(Boolean));setState(game.snapshot());setScreen('play');setDialog(null);setPreview(null);setSelected(null);setHint([]);setBooster(null);setClearing([]);setCombo('');
    if(game.status==='won') {
      const before=profileRef.current;
      if(!review || game.level.id<=before.unlocked){const after=awardWin(before,game.root.id,game.stars(),game.seed);setReward(after.coins-before.coins);updateProfile(after);}
      setDialog('won');
    } else if(game.status==='lost')setDialog('lost');else if(game.status==='phase')setDialog('phase');
    location.hash=`play/${levelId}`;
    sound('special',p.sound);
  }

  useEffect(()=>{
    let live=true,done=0;const started=performance.now();
    setLoadFailed(false);setLoadProgress(0);
    const sources=['frosthaven','coral-cove','aurora-peaks','pieces','kip','rook','juno','chick'].map(art).concat(['landmarks-a','landmarks-b'].map(mapArt));
    const tick=()=>{done++;if(live)setLoadProgress(Math.round(done/(sources.length+1)*100));};
    const load=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{tick();resolve();};img.onerror=()=>reject(new Error(src));img.src=src;});
    Promise.all([document.fonts.ready.then(tick),...sources.map(load)]).then(async()=>{await sleep(Math.max(0,1200-(performance.now()-started)));if(live)setReady(true);}).catch(()=>{if(live)setLoadFailed(true);});
    // Let the native splash give way to the real, accessible loading screen.
    const frame=requestAnimationFrame(()=>requestAnimationFrame(()=>globalThis.PenguNative?.ready()));
    return()=>{live=false;cancelAnimationFrame(frame);};
  },[loadAttempt]);
  useEffect(()=>{
    const hash=()=>{
      if(busyRef.current){location.replace(`#play/${engine.current?.root.id||1}`);return;}
      const [page,id]=location.hash.slice(1).split('/');
      if(page==='play'&&id){if(engine.current?.root.id!==+id)begin(+id,true);else{setScreen('play');const status=engine.current.status;setDialog(['phase','won','lost'].includes(status)?status:null);}}
      else if(['home','journey','journal','friends','backpack','notifications','privacy','privacy-policy','terms','deletion','support','licenses'].includes(page)){setScreen(page);setDialog(null);}
      else if(!page)setScreen('home');
    };
    const route=e=>{const target=e.detail;if(['home','journey','journal','friends','backpack'].includes(target)){if(busyRef.current){setTimeout(()=>route(e),300);return;}go(target);}};
    const launched=globalThis.PenguNative?.launchRoute?.();if(launched)location.hash=launched;
    hash();addEventListener('hashchange',hash);addEventListener('pengu:route',route);
    const fresh=()=>{const next=refreshDaily(profileRef.current);if(next!==profileRef.current)updateProfile(next);};
    addEventListener('focus',fresh);addEventListener('pengu:notifications',fresh);
    const dayTimer=setInterval(fresh,60000);
    return()=>{removeEventListener('hashchange',hash);removeEventListener('pengu:route',route);removeEventListener('focus',fresh);removeEventListener('pengu:notifications',fresh);clearInterval(dayTimer);clearTimeout(toastTimer.current);};
  },[]);

  useEffect(()=>{
    window.__penguNativeBack=()=>{
      if(busyRef.current)return true;
      const chooser=document.querySelector('.region-picker-button[aria-expanded="true"]');
      if(chooser){chooser.click();return true;}
      if(dialog){if(['won','lost','phase'].includes(dialog))go('journey');else setDialog(null);return true;}
      if(screen==='play'){setDialog('pause');return true;}
      if(['privacy-policy','terms','deletion','support','licenses'].includes(screen)){go('privacy');return true;}
      if(['privacy','notifications'].includes(screen)){backToSettings();return true;}
      if(screen!=='home'){go('home');return true;}
      return false;
    };
    const pause=()=>{if(screen==='play'&&engine.current?.status==='playing')setDialog('pause');};
    addEventListener('pengu:native-pause',pause);
    return()=>{delete window.__penguNativeBack;removeEventListener('pengu:native-pause',pause);};
  },[screen,dialog]);

  useEffect(()=>{
    if(screen!=='play' || busy || dialog || !engine.current || state?.status!=='playing')return;
    const timer=setTimeout(()=>setHint(engine.current.legalMoves()[0]||[]),7000);
    return()=>clearTimeout(timer);
  },[screen,busy,state,dialog]);

  useEffect(()=>{
    if(!import.meta.env.DEV)return;
    window.__pengu={getState:()=>engine.current?.snapshot(),legalMoves:()=>engine.current?.legalMoves(),getProfile:()=>profileRef.current,begin:(id)=>begin(id),advance:()=>animate(engine.current.advancePhase()),engine:()=>engine.current};
    return()=>{delete window.__pengu;};
  },[]);

  async function animate(result) {
    if(!result.valid){sound('invalid',profileRef.current.sound);return;}
    const action=++actionRef.current;
    busyRef.current=true;setBusy(true);setSelected(null);setHint([]);setBooster(null);
    // Checkpoint rules state before presentation, so backgrounding mid-cascade is safe.
    updateProfile(p=>checkpointRun(p,result.state));
    try {
      for(const frame of result.frames) {
        if(action!==actionRef.current)return;
        if(frame.type==='clear') {
          setState(frame.before);setClearing(frame.cells);
          if(frame.combo>1)setCombo(frame.combo>=4?'AVALANCHE!':frame.combo===3?'ICE BREAKER!':'NICE CHAIN!');
          else if(frame.fired>1)setCombo('DOUBLE TROUBLE!');
          sound(frame.fired?'special':'match',profileRef.current.sound,frame.combo);
          await sleep(reduced?25:210);setClearing([]);setState(frame.after);
        } else {
          setState(frame.after);
          if(frame.type==='current'){setCombo('TIDE TURN!');sound('tap',profileRef.current.sound);}
          if(frame.type==='phase'){setFocusedCell(frame.after.board.findIndex(Boolean));toast(`Next stage. ${frame.carry} moves carried over.`);}
          if(frame.type==='shuffle')toast('Fresh possibilities! Your board was reshuffled.');
          if(frame.type==='rescue'){setCombo('Friend found!');sound('special',profileRef.current.sound);}
          if(frame.type==='gift')toast(`${COMPANIONS[engine.current.companion].name} made you a special!`);
          if(frame.type==='tide')toast('Rook cracked every layer of ice.');
          await sleep(reduced?15:frame.type==='drop'?210:frame.type==='swap'?170:90);
        }
      }
      const game=engine.current;
      updateProfile(p=>({...p,run:['playing','phase','won'].includes(game.status)?game.snapshot():null}));
      if(game.status==='won') {
        const before=profileRef.current;
        // Review-only future levels don't alter the real campaign unlock state.
        if(review && game.level.id>before.unlocked){setReward(0);}
        else {const after=awardWin(before,game.root.id,game.stars(),game.seed);setReward(after.coins-before.coins);updateProfile(after);}
        setDialog('won');sound('win',profileRef.current.sound);
      } else if(game.status==='phase'){setDialog('phase');sound('win',profileRef.current.sound);}
      else if(game.status==='lost'){setDialog('lost');sound('invalid',profileRef.current.sound);}
    } finally {busyRef.current=false;setBusy(false);setClearing([]);setCombo('');}
  }
  function swap(a,b) {
    if(busyRef.current||dialog||!engine.current)return;
    const result=engine.current.swap(a,b);
    if(!result.valid){setInvalid([a,b]);setTimeout(()=>setInvalid([]),350);setSelected(null);toast('Try a swap that makes a match.');sound('invalid',profile.sound);return;}
    if(profileRef.current.haptics)globalThis.PenguNative?.haptic();
    animate(result);
  }
  function selectCell(i) {
    if(busyRef.current||dialog||state?.status!=='playing')return;
    if(booster==='hammer') {
      const result=engine.current.boost('hammer',i);
      if(!result.valid)return toast('Choose a piece or coral. Penguins are for rescuing.');
      updateProfile(p=>({...p,boosters:{...p.boosters,hammer:p.boosters.hammer-1}}));animate(result);return;
    }
    if(!engine.current.board[i])return;
    if(engine.current.nets[i])return toast('Match this piece in place, or blast it free of the net.');
    setHint([]);
    if(selected===i && engine.current.board[i].special){animate(engine.current.activate(i));return;}
    if(selected!=null && adjacent(selected,i,current.cols)){swap(selected,i);return;}
    setSelected(selected===i?null:i);sound('tap',profile.sound);
  }
  function pointerDown(e,i) {
    if(busyRef.current)return;
    pointer.current={i,x:e.clientX,y:e.clientY};suppressClick.current=false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerUp(e) {
    const start=pointer.current;pointer.current=null;if(!start)return;
    const dx=e.clientX-start.x,dy=e.clientY-start.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<16)return;
    suppressClick.current=true;
    const target=start.i+(Math.abs(dx)>Math.abs(dy)?(dx>0?1:-1):(dy>0?current.cols:-current.cols));
    if(target>=0&&target<current.mask.length&&adjacent(start.i,target,current.cols))swap(start.i,target);
  }
  function useBooster(kind) {
    if(busyRef.current)return;
    if(kind==='hint'){setHint(engine.current.legalMoves()[0]||[]);toast('Look for the two glowing pieces.');return;}
    if(profile.boosters[kind]<=0){setDialog('supplies');return;}
    if(kind==='hammer'){setBooster(booster==='hammer'?null:'hammer');setSelected(null);toast(booster==='hammer'?'Hammer put away.':'Tap a piece or coral to break it.');return;}
    const result=engine.current.boost(kind);
    if(result.valid){updateProfile(p=>({...p,boosters:{...p.boosters,[kind]:p.boosters[kind]-1}}));animate(result);}
  }
  function purchase(kind) {
    const cost=kind==='hammer'?60:40;
    if(profileRef.current.coins<cost)return toast('Earn shells by finishing new levels or improving your stars.');
    updateProfile(p=>({...p,coins:p.coins-cost,boosters:{...p.boosters,[kind]:p.boosters[kind]+1}}));toast('Packed and ready.');
  }
  function openPreview(id) {
    if(!review && id>profile.unlocked)return toast(`Finish level ${id-1} to open this adventure.`);
    setPreview(LEVELS[id-1]);setPreviewPhase(0);setDialog('preview');
  }

  function collectQuest(id){const result=claimQuest(profileRef.current,id);if(!result)return;updateProfile(result.profile);setLoot(result);setDialog('reward');sound('win',profileRef.current.sound);}
  function openChest(chapter,tier){setChest({chapter,tier});setDialog('chest');}
  function collectChest(){const result=claimChest(profileRef.current,chest.chapter,chest.tier);if(!result)return;updateProfile(result.profile);setLoot(result);setDialog('reward');sound('win',profileRef.current.sound);}
  function openRelic(id){setRelic(id);setDialog('relic');}
  const renderNav=()=> <nav className="bottom-nav" aria-label="Main navigation">{[[House,'home','Camp'],[MapTrifold,'journey','Journey'],[BookOpenText,'journal','Journal'],[UsersThree,'friends','Crew'],[Backpack,'backpack','Pack']].map(([Icon,key,label])=><button key={key} className={screen===key?'active':''} aria-current={screen===key?'page':undefined} onClick={()=>go(key)}><Icon size={26} weight={screen===key?'fill':'duotone'}/><span>{label}</span>{key==='journal'&&pendingQuests>0&&<i className="nav-notification">{pendingQuests}</i>}</button>)}</nav>;
  const renderTop=({title,back=false})=><header className="top-bar">{back?<IconButton label="Back to home" onClick={()=>go('home')}><ArrowLeft weight="bold"/></IconButton>:<div className="small-logo"><Snowflake weight="bold"/>pengucrush</div>}{title&&<strong>{title}</strong>}<div className="top-actions"><div className="currency" title="Shells earned through play"><Sprite index={2}/><b>{profile.coins}</b></div><IconButton label="Settings" onClick={()=>setDialog('settings')}><GearSix weight="fill"/></IconButton></div></header>;
  const renderProgress=({level,snapshot=state})=><div className="goal-list">{level.goals.map((goal,i)=>{
    const value=snapshot?(goal.kind==='collect'?snapshot.counts.collect[goal.piece]:snapshot.counts[goal.kind]):0;
    return <div key={i} className={`goal ${value>=goal.target?'goal-complete':''}`} title={goalName(goal)}><GoalIcon goal={goal}/><span>{value>=goal.target?<Check weight="bold" size={24}/>:<><b>{Math.max(0,goal.target-value)}</b><small>{goal.kind==='special'?'specials':goal.kind==='collect'?PIECES[goal.piece].short:goal.kind==='rescue'?(goal.target-value===1?'chick':'chicks'):goal.kind}</small></>}</span></div>;
  })}</div>;

  const renderSupplies=()=> <div className="supplies-grid">{['hammer','shuffle'].map(kind=><div className="supply" key={kind}>{kind==='hammer'?<Sprite index={11}/>:<span className="shuffle-art"><ArrowClockwise weight="bold"/></span>}<h3>{kind==='hammer'?'Ice hammer':'Snow shuffle'}</h3><p>{kind==='hammer'?'Break a piece or chip the coral.':'Shake up the whole board.'}</p><span className="owned">{profile.boosters[kind]} in your backpack</span><button className="secondary-button" onClick={()=>purchase(kind)}><Sprite index={2}/>{kind==='hammer'?60:40}<span>Get one</span></button></div>)}</div>;

  return <main className={`app-shell ${reduced?'reduce-motion':''} screen-${screen}`} style={{'--world':`url("${art(current&&screen==='play'?CHAPTERS[current.chapter].art:'frosthaven')}")`}}>
    {!ready&&<LoadingScreen progress={loadProgress} failed={loadFailed} onRetry={()=>setLoadAttempt(n=>n+1)}/>}
    <div className="world-backdrop"/>
    {screen==='notifications'&&<div className="view settings-view"><NotificationSettings onBack={backToSettings} onPrivacy={()=>go('privacy-policy')}/></div>}
    {isPolicyPage(screen)&&<div className="view settings-view"><PrivacyCenter key={screen} page={policyKey(screen)} onNavigate={go} onBack={backToSettings} onDelete={eraseSave}/></div>}
    {screen==='home'&&<section className="home-view view">
      {renderTop({})}
      <div className="home-title"><span className="eyebrow">PACK LIGHT. CRUSH BIG.</span><h1><span>PENGU</span><span>CRUSH<span className="title-spark">✦</span></span></h1><span className="title-ribbon">BEYOND THE HORIZON</span></div>
      <div className="hero-scene"><div className="hero-halo"/><Sprite index={1} className="float-piece float-one"/><Sprite index={2} className="float-piece float-two"/><Sprite index={4} className="float-piece float-three"/><Character index={0} className="hero-pip"/><span className="pip-shadow"/><div className="hello-note">Crew’s ready.<br/><b>Are you?</b><Heart size={15} weight="fill"/></div></div>
      <div className="home-play"><div className="next-chapter"><span className="eyebrow">NEXT STOP</span><h2>{CHAPTERS[Math.min(9,Math.floor((homeLevel-1)/10))].name}</h2><p>{profile.unlocked>100&&!profile.run?'All ten beacons restored. The sky is yours.':`Level ${homeLevel} · ${LEVELS[homeLevel-1].name}`}</p></div><button className="primary-button" onClick={()=>profile.run?begin(profile.run.levelId,true):openPreview(nextLevel)}><Play weight="fill" size={22}/>{profile.run?`Continue level ${profile.run.levelId}`:profile.unlocked===1?'LET’S GO':'KEEP GOING'}<ArrowRight weight="bold" size={21}/></button><button className="home-map-link" onClick={()=>go('journey')}><MapTrifold weight="duotone"/>Open the map <span>·</span><Star weight="fill"/>{totalStars}/300</button></div>
      {renderNav()}
    </section>}

    {screen==='journey'&&<section className="journey-view view">{renderTop({title:"The expedition",back:true})}<CampaignMap profile={profile} review={review} onPreview={openPreview} onChest={openChest} onRelic={openRelic} memory={mapMemory} reduced={reduced}/>{renderNav()}</section>}
    {screen==='journal'&&<section className="journal-view view">{renderTop({title:"Your journal",back:true})}<Journal profile={profile} onClaim={collectQuest} onRelic={openRelic}/>{renderNav()}</section>}

    {screen==='friends'&&<section className="friends-view view">{renderTop({title:"The crew",back:true})}<div className="section-heading"><span className="eyebrow">ODD BIRDS. GOOD COMPANY.</span><h1>Meet the<br/>locals.</h1><p>Three penguins. Three different tricks.<br/>Pick your partner for the next run.</p></div><div className="friends-list">{COMPANIONS.map((friend,i)=>{
      const unlocked=profile.unlocked>=friend.unlock||review, active=profile.companion===i;
      return <article className={`friend-card ${active?'chosen':''} ${unlocked?'':'friend-locked'}`} key={friend.name}><Character index={i}/><div className="friend-copy"><span className="eyebrow">{friend.role}</span><h2>{friend.name}</h2><p>{friend.description}</p><button className={active?'chosen-button':'friend-button'} disabled={!unlocked} onClick={()=>{updateProfile(p=>({...p,companion:i}));toast(`${friend.name} is on your team.`);}}>{!unlocked?<><LockKey weight="fill"/>Level {friend.unlock}</>:active?<><Check weight="bold"/>On your team</>:<>Choose {friend.name}<ArrowRight weight="bold"/></>}</button></div><div className="friend-power"><Sparkle weight="fill"/>{friend.power}<span>{friend.charge} {PIECES[friend.type].short}</span></div></article>;
    })}</div>{renderNav()}</section>}

    {screen==='backpack'&&<section className="backpack-view view">{renderTop({title:"Your backpack",back:true})}<div className="section-heading"><span className="eyebrow">EXPEDITION SUPPLIES</span><h1>Pack a<br/>punch.</h1><p>Spend your hard-earned shells.<br/>Get the tools. Break the ice.</p></div><div className="shell-balance"><Sprite index={2}/><span><b>{profile.coins}</b><small>shells collected</small></span><Sparkle size={30} weight="duotone"/></div>{renderSupplies()}<div className="backpack-note"><Heart weight="duotone"/><p>Stuck? Switch tactics. Retries are always free.</p></div>{renderNav()}</section>}

    {screen==='play'&&state&&<section className="game-view view">
      <header className="game-header"><IconButton label="Pause game" disabled={busy} onClick={()=>setDialog('pause')}><Pause weight="fill"/></IconButton><div><span className="eyebrow">{CHAPTERS[current.chapter].name}</span><h1>Level {current.id}</h1></div><IconButton label="How to play" disabled={busy} onClick={()=>setDialog('help')}><Lightbulb weight="duotone"/></IconButton></header>
      <div className="level-caption"><span>{current.name}</span><Difficulty value={current.difficulty}/></div>
      <div className="game-hud"><div className={`moves-badge ${state.moves<=5?'low':''}`}><b>{state.moves}</b><span>MOVES</span></div><div className="objectives"><span className="eyebrow">YOUR GOALS</span>{renderProgress({level:current})}</div></div>
      {current.phaseCount>1&&<div className="stage-indicator"><span>BEACON FINALE</span>{current.phases.map((phase,i)=><i key={i} className={i<=state.phaseIndex?'reached':''}/>)}<b>Stage {state.phaseIndex+1}/{current.phaseCount}</b></div>}
      {current.current&&<div className="current-ticker"><Waves weight="bold"/><span>Tide moves {current.current.direction===1?'right':'left'} in <b>{current.current.every-state.phaseTurn%current.current.every}</b> {current.current.every-state.phaseTurn%current.current.every===1?'move':'moves'}</span></div>}
      <GameBoard level={current} state={state} busy={busy} selected={selected} clearing={clearing} hint={hint} invalid={invalid} booster={booster} combo={combo} focusedCell={focusedCell} setFocusedCell={setFocusedCell} selectCell={selectCell} swap={swap} pointerDown={pointerDown} pointerUp={pointerUp} pointerCancel={()=>{pointer.current=null;}} suppressClick={suppressClick}/>
      <div className="game-companion"><Character index={state.companion}/><div className="companion-status"><div><strong>{COMPANIONS[state.companion].name}’s {COMPANIONS[state.companion].power.toLowerCase()}</strong><span>{state.charge}/{COMPANIONS[state.companion].charge}</span></div><div className="charge-track"><span style={{width:`${state.charge/COMPANIONS[state.companion].charge*100}%`}}/></div><small>Match {PIECES[COMPANIONS[state.companion].type].short} to charge your power</small></div><button className="companion-power" aria-label={`Use ${COMPANIONS[state.companion].name}'s power`} disabled={busy||state.charge<COMPANIONS[state.companion].charge} onClick={()=>animate(engine.current.boost('companion'))}><Sparkle weight="fill"/></button></div>
      <div className="game-tools"><button disabled={busy} className={booster==='hammer'?'tool active':'tool'} onClick={()=>useBooster('hammer')}><Sprite index={11}/><b>{profile.boosters.hammer}</b><span>Hammer</span></button><button disabled={busy} className="tool" onClick={()=>useBooster('shuffle')}><span className="shuffle-art"><ArrowClockwise weight="bold"/></span><b>{profile.boosters.shuffle}</b><span>Shuffle</span></button><button disabled={busy} className="tool" onClick={()=>useBooster('hint')}><span className="hint-art"><Lightbulb weight="fill"/></span><small>FREE</small><span>Hint</span></button><div className="score-readout"><Star weight="fill"/><strong>{state.score.toLocaleString()}</strong><small>SCORE</small></div></div>
      <p className="game-tip">{booster==='hammer'?'Tap a piece to use your hammer.':current.lesson}</p>
    </section>}

    {dialog&&<Modal title={dialog==='phase'?'KEEP THE LIGHT MOVING':dialog==='reward'?'A LITTLE TREASURE!':dialog==='chest'?'STAR CHEST':dialog==='relic'?'FROM THE FIELD NOTES':dialog==='preview'?`Level ${preview?.id}`:dialog==='won'?'CRUSHED IT!':dialog==='lost'?'SO CLOSE.':dialog==='pause'?'ON A BREAK':dialog==='settings'?'SETTINGS':dialog==='supplies'?'GEAR UP':'THE BASICS'} onClose={()=>{if(['won','lost','phase'].includes(dialog))go('journey');else setDialog(null);}}>
      {dialog==='preview'&&preview&&<><div className="preview-scene"><Character index={COMPANIONS[profile.companion].type<previewStage.colors?profile.companion:0}/><BoardPreview level={previewStage}/></div><Difficulty value={preview.difficulty}/><h3 className="preview-name">{preview.name}</h3><p className="preview-topology">{SHAPES[previewStage.shape]} · {previewStage.colors} piece types</p>{preview.phaseCount>1&&<div className="phase-tabs" aria-label="Preview finale stages">{preview.phases.map((p,i)=><button key={i} className={previewPhase===i?'active':''} onClick={()=>setPreviewPhase(i)}>Stage {i+1}</button>)}</div>}<div className="preview-goals">{previewStage.goals.map((g,i)=><div key={i}><GoalIcon goal={g}/><b>{g.target}</b><span>{goalName(g)}</span></div>)}</div><p className="lesson">{previewStage.lesson}</p><div className="move-allotment"><Heart weight="fill"/><b>{previewStage.moves} moves</b><span>{preview.phaseCount>1?'Up to 5 carry into the next stage.':previewStage.design.beat==='Discover'?'Try something new.':'Make every move count.'}</span></div><button className="primary-button" onClick={()=>begin(preview.id)}><Play weight="fill"/>LET’S GO<ArrowRight weight="bold"/></button></>}
      {dialog==='phase'&&current&&<><span className="eyebrow finale-eyebrow">BEACON {current.chapter+1} · STAGE {state.phaseIndex+1} COMPLETE</span><Landmark index={current.chapter} className="phase-landmark"/><h3>{current.phases[state.phaseIndex+1].phaseName}</h3><p className="lesson">A new board, a new part of the mission.<br/>Carry <b>{Math.min(5,state.moves)} saved moves</b> into the next stage.</p><BoardPreview level={activeLevel(current.id,state.phaseIndex+1)}/><div className="preview-goals">{current.phases[state.phaseIndex+1].goals.map((g,i)=><div key={i}><GoalIcon goal={g}/><b>{g.target}</b><span>{goalName(g)}</span></div>)}</div><button className="primary-button" onClick={()=>{setDialog(null);animate(engine.current.advancePhase());}}>On to stage {state.phaseIndex+2}<ArrowRight weight="bold"/></button><button className="text-button" onClick={()=>go('journey')}>Save expedition & return</button></>}
      {dialog==='reward'&&loot&&<><Landmark index={11} className="reward-chest-art"/><span className="eyebrow">WELL EARNED. WELL PACKED.</span><h3>{loot.title}</h3><RewardContents reward={loot.reward}/><button className="primary-button" onClick={()=>setDialog(null)}>Into the backpack<Check weight="bold"/></button></>}
      {dialog==='chest'&&chest&&<><Landmark index={11} className="reward-chest-art"/><h3>{CHAPTERS[chest.chapter].name}</h3><p className="lesson">Collect {CHESTS[chest.tier].target} stars on this island to open this chest. Replay levels to improve your stars.</p><div className="chest-star-count"><Star weight="fill"/><b>{regionStars(profile,chest.chapter)}</b> / {CHESTS[chest.tier].target}</div><RewardContents reward={CHESTS[chest.tier].reward}/><button className="primary-button" disabled={!!profile.claims[`chest:${chest.chapter}:${chest.tier}`]||regionStars(profile,chest.chapter)<CHESTS[chest.tier].target} onClick={collectChest}>{profile.claims[`chest:${chest.chapter}:${chest.tier}`]?'Already collected':regionStars(profile,chest.chapter)>=CHESTS[chest.tier].target?'Open the chest':'Keep collecting stars'}<Star weight="fill"/></button></>}
      {dialog==='relic'&&<><Landmark index={relic} className="relic-detail-art"/><span className="eyebrow">{profile.relics.includes(relic)?'BEACON RESTORED':`ACT ${CHAPTERS[relic].act+1} · ${ACTS[CHAPTERS[relic].act]}`}</span><h3>{CHAPTERS[relic].relic}</h3><p className="lesson">{CHAPTERS[relic].story}</p><div className="relic-requirement"><FlagPennant weight="fill"/>{profile.relics.includes(relic)?'Safely tucked in your field journal.':`Complete the level ${CHAPTERS[relic].end} finale.`}</div><button className="primary-button" onClick={()=>setDialog(null)}>{profile.relics.includes(relic)?'One light closer to home':'Adventure awaits'}<ArrowRight weight="bold"/></button></>}
      {dialog==='won'&&<><div className="celebration-sparks" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{'--i':i}}/>)}</div><Character index={state.companion} className="modal-mascot result-mascot"/><Stars count={engine.current.stars()} size={54}/><p className="result-copy">{current.id===100?'Ten lights in the sky. Everyone made it home.':`${current.name} cleared.`}</p><div className="result-stats"><div><b>{state.score.toLocaleString()}</b><span>points</span></div><div><b>{state.moves}</b><span>moves saved</span></div><div><b>+{reward}</b><span>shells</span></div></div>{current.relic&&<div className="won-relic"><Landmark index={current.chapter}/><span><small>BEACON RESTORED</small><b>{current.relic}</b><em>{reward>=100?'+100 shells · 1 hammer · 1 shuffle':'A light on the way home.'}</em></span></div>}{[10,20].includes(current.id)&&<p className="friend-unlock"><Sparkle weight="fill"/>{COMPANIONS[current.id/10].name} is ready to join your crew!</p>}<button className="primary-button" onClick={()=>current.id<100?begin(current.id+1):go('journey')}>{current.id<100?'Next adventure':'Explore your journey'}<ArrowRight weight="bold"/></button><button className="text-button" onClick={()=>go('journey')}>Back to the islands</button></>}
      {dialog==='lost'&&<><Character index={state.companion} className="modal-mascot result-mascot"/><p className="result-copy">New board. New plan.<br/>You know what to do.</p>{renderProgress({level:current})}<button className="primary-button" onClick={()=>begin(current.id)}><ArrowClockwise weight="bold"/>Try again · free</button><button className="text-button" onClick={()=>go('journey')}>Back to the islands</button></>}
      {dialog==='pause'&&<><Character index={state.companion} className="modal-mascot"/><p className="result-copy">Your board is saved.</p><button className="primary-button" onClick={()=>setDialog(null)}><Play weight="fill"/>Keep playing</button><button className="secondary-button" onClick={()=>begin(current.id)}><ArrowClockwise/>Start a fresh board</button><button className="secondary-button" onClick={()=>setDialog('settings')}><GearSix/>Options</button><button className="text-button" onClick={()=>go('journey')}>Save & return to the islands</button></>}
      {dialog==='settings'&&<><p className="lesson">Set things your way.</p><div className="settings-list"><button role="switch" aria-checked={profile.sound} onClick={()=>updateProfile(p=>({...p,sound:!p.sound}))}>{profile.sound?<SpeakerHigh weight="duotone"/>:<SpeakerSlash weight="duotone"/>}<span>Playful sounds</span><span className={`toggle ${profile.sound?'on':''}`}/></button><button role="switch" aria-checked={profile.motion} onClick={()=>updateProfile(p=>({...p,motion:!p.motion}))}><Sparkle weight="duotone"/><span>Animations</span><span className={`toggle ${profile.motion?'on':''}`}/></button>{globalThis.PenguNative&&<button role="switch" aria-checked={profile.haptics} onClick={()=>{updateProfile(p=>({...p,haptics:!p.haptics}));if(!profile.haptics)globalThis.PenguNative.haptic();}}><Heart weight="duotone"/><span>Haptic feedback</span><span className={`toggle ${profile.haptics?'on':''}`}/></button>}</div><button className="secondary-button" onClick={()=>setDialog('help')}><Lightbulb/>How to play</button><SettingsLinks onOpen={openSettingsPage}/><p className="settings-footnote">Your progress stays on this device.<br/>100 levels. Ten islands. One odd crew.</p></>}
      {dialog==='help'&&<div className="help-list"><p>Swipe a piece into a neighbor, or tap one and then the other. Match 3 or more to clear them.</p>{[[6,'Match 4','A rocket clears a row or column.'],[7,'Make a T or L','A puffer clears a 3 × 3 area.'],[8,'Match 5 in a line','Swap the pearl with a color to clear that color.'],[9,'Break the ice','Match on icy squares. Thick ice takes two hits.'],[10,'Clear the coral','Match next to coral, or hit it with a special.']].map(([index,title,body])=><div key={index}><Sprite index={index}/><span><b>{title}</b><small>{body}</small></span></div>)}<p>Combine two specials for a bigger burst. Tap a special twice to activate it. Rescue chicks by bringing them to the marked exits.</p>{MECHANICS.filter(m=>['lantern','net','current'].includes(m.id)).map(m=><div key={m.id}><MechanicIcon kind={m.id}/><span><b>{m.id==='lantern'?'Light the lanterns':m.id==='net'?'Cut the nets':'Ride the current'}</b><small>{m.description}</small></span></div>)}<p>Gaps split the board into separate falling lanes. Beacon finales have 2 stages; level 100 has 3. Save up to 5 moves for your next stage.</p><p className="keyboard-note">Keyboard: arrow keys move focus; Enter selects. Shift + arrow swaps.</p></div>}
      {dialog==='supplies'&&<><p className="lesson">Spend the shells you’ve earned on your adventure.</p>{renderSupplies()}</>}
    </Modal>}
    <div className={`toast ${message?'visible':''}`} role="status" aria-live="polite">{message}</div>
    <span className="sr-only" aria-live="polite">{busy?'Matching pieces':state&&screen==='play'?`${state.moves} moves remaining`:''}</span>
  </main>;
}

function Modal({title,onClose,children}) {
  const ref=useRef(null);
  useEffect(()=>{
    const before=document.activeElement;
    const el=ref.current;
    el?.focus();
    function key(e) {
      if(e.key==='Escape'){e.preventDefault();onClose();}
      if(e.key==='Tab'){
        const focusable=[...el.querySelectorAll('button:not([disabled]),[tabindex="0"]')];
        const first=focusable[0],last=focusable.at(-1);
        if(e.shiftKey&&(document.activeElement===first||document.activeElement===el)){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    }
    el.addEventListener('keydown',key);
    return()=>{el.removeEventListener('keydown',key);before?.isConnected&&before.focus();};
  },[title]);
  return <div className="modal-scrim" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref} tabIndex={-1}><IconButton label="Close dialog" onClick={onClose}><X weight="bold"/></IconButton><h2 id="modal-title">{title}</h2>{children}</section></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
if('serviceWorker' in navigator && import.meta.env.PROD && !globalThis.PenguNative) addEventListener('load',()=>navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{}));
