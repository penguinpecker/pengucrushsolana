import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Bell,BellRinging,Check,EnvelopeSimple,ShieldCheck,Trash,FileText,BookOpenText} from '@phosphor-icons/react';
import publisher from '../../store/publisher.json';
import {policies} from '../../store/policies.js';
import {getNotificationStatus,nativeNotifications,testSession,externalLink} from './notifications.js';
import './settings.css';

const pages=policies(publisher);
export function SettingsLinks({onOpen}){
  return <div className="settings-links"><button onClick={()=>onOpen('notifications')}><Bell weight="duotone"/><span>Notifications<small>A little nudge from your crew</small></span><ArrowRight/></button><button onClick={()=>onOpen('privacy')}><ShieldCheck weight="duotone"/><span>Privacy & play<small>Policies, your data and support</small></span><ArrowRight/></button></div>;
}
function Row({title,description,checked,disabled,onChange}){
  return <button className="notification-row" role="switch" aria-checked={!!checked} disabled={disabled} onClick={onChange}><span><b>{title}</b><small>{description}</small></span><span className={`toggle ${checked?'on':''}`}/></button>;
}
export function NotificationSettings({onBack,onPrivacy}){
  const [status,setStatus]=useState(getNotificationStatus),[consent,setConsent]=useState(null),[feedback,setFeedback]=useState('');
  useEffect(()=>{
    const refresh=()=>setStatus(getNotificationStatus());
    const message=e=>setFeedback(e.detail);
    const timer=setInterval(refresh,2000);
    addEventListener('pengu:notifications',refresh);addEventListener('pengu:notification-message',message);
    return()=>{clearInterval(timer);removeEventListener('pengu:notifications',refresh);removeEventListener('pengu:notification-message',message);};
  },[]);
  const set=(key,value)=>{globalThis.PenguNative?.notificationPreferences(JSON.stringify({[key]:value}));setStatus(s=>({...s,[key]:value}));};
  const cloud=(key)=>status[key]?set(key,false):setConsent(key);
  const cloudState={unconfigured:'Cloud announcements are unavailable in this version. Local reminders still work.',off:'Off — your installation is not registered.',connecting:'Connecting to your announcement channels…',connected:'Connected to the categories you chose.',waiting:'Waiting for a connection. The game is still ready to play.',removing:'Delivery stopped. Deletion will finish when connected.'}[status.cloudStatus];
  return <section className="settings-center"><button className="settings-back" onClick={onBack}><ArrowLeft/>Settings</button>
    <div className="settings-hero"><span className="settings-emblem"><BellRinging weight="duotone"/></span><span className="eyebrow">POSTCARDS FROM THE CREW</span><h1>A little<br/>heads-up.</h1><p>Choose what reaches you.<br/>Your expedition. Your pace.</p></div>
    {!status.native?<div className="permission-note">Device notifications are available in the Android app.</div>:!status.permission?<div className="permission-note"><b>Notifications are off</b><p>Allow notifications to choose reminders. You can keep playing with every reminder turned off.</p><button className="primary-button" onClick={()=>globalThis.PenguNative.requestNotifications()}>Allow notifications <Bell/></button>{status.asked&&<button className="text-button" onClick={()=>globalThis.PenguNative.openNotificationSettings()}>Open Android settings</button>}</div>:<div className="permission-enabled"><Check weight="bold"/>Android permission enabled<button onClick={()=>globalThis.PenguNative.openNotificationSettings()}>Manage</button></div>}
    <div className="settings-group"><span className="eyebrow">ON YOUR DEVICE</span>
      <Row title="Daily quests" description="A fresh page in your journal, next morning." checked={status.daily} disabled={!status.permission} onChange={()=>set('daily',!status.daily)}/>
      <Row title="Ready rewards" description="A reminder an hour after leaving treasure unclaimed." checked={status.rewards} disabled={!status.permission} onChange={()=>set('rewards',!status.rewards)}/>
      <Row title="Continue the expedition" description="Your unfinished level, a day after you leave." checked={status.resume} disabled={!status.permission} onChange={()=>set('resume',!status.resume)}/>
    </div>
    <div className="settings-group"><span className="eyebrow">FROM THE PENGUCRUSH TEAM</span>
      <Row title="Expedition announcements" description="Messages about quests, islands and adventures." checked={status.events} disabled={!status.permission||!status.configured||status.deletionPending} onChange={()=>cloud('events')}/>
      <Row title="Game news" description="New releases and notes from the crew." checked={status.news} disabled={!status.permission||!status.configured||status.deletionPending} onChange={()=>cloud('news')}/>
      <p className="notification-status" role="status">{cloudState}</p>
      {consent&&<div className="cloud-consent" role="region" aria-label="Cloud notification consent"><b>Connect to the crew?</b><p>Firebase will process an installation ID, a notification token, app details and connection information to deliver this category.</p><button className="text-button" onClick={onPrivacy}>Read the Privacy Policy</button><div><button className="secondary-button" onClick={()=>setConsent(null)}>Not now</button><button className="primary-button" onClick={()=>{set(consent,true);setConsent(null);}}>Enable</button></div></div>}
    </div>
    <p className="quiet-note">Quiet from <b>10pm to 9am</b> in your time zone.<br/>At most two automatic messages a day, four hours apart. Android may delay delivery to save battery.</p>
    {status.permission&&<button className="secondary-button" onClick={()=>{globalThis.PenguNative.previewNotification();setFeedback('Preview sent. Swipe down from the top to see it.');}}>Send me a preview <Bell/></button>}
    {status.configured&&status.cloudStatus==='connected'&&<details className="push-device"><summary>Test device for support</summary><p>Copy this installation’s private messaging code to send a test from your team’s console.</p><button className="text-button" onClick={()=>globalThis.PenguNative.copyPushToken()}>Copy device code</button></details>}
    {feedback&&<p className="settings-feedback" role="status">{feedback}</p>}
  </section>;
}
// Shown once ever, after the first level-1 win: marked when shown, whether or not it is answered.
// Opening its Privacy Policy link unmarks it so the result dialog can show it again on return. A denied Android permission is never re-asked.
const PROMPTED='pengucrush_push_prompted_v1';
export function PushPrompt({onPrivacy}){
  const [show,setShow]=useState(()=>{try{if(localStorage.getItem(PROMPTED))return false;}catch{return false;}const s=getNotificationStatus();return !testSession()&&nativeNotifications()&&s.configured&&!s.deletionPending&&!s.events&&!s.news;});
  const pending=useRef(false);
  const enable=()=>globalThis.PenguNative.notificationPreferences(JSON.stringify({events:true,news:true}));
  useEffect(()=>{
    if(show)try{localStorage.setItem(PROMPTED,'1');}catch{}
    const result=()=>{if(!pending.current)return;pending.current=false;if(getNotificationStatus().permission)enable();setShow(false);};
    addEventListener('pengu:notifications',result);return()=>removeEventListener('pengu:notifications',result);
  },[]);
  const answer=yes=>{
    if(!yes||getNotificationStatus().permission){if(yes)enable();setShow(false);return;}
    pending.current=true;globalThis.PenguNative.requestNotifications();
  };
  const privacy=()=>{try{localStorage.removeItem(PROMPTED);}catch{}onPrivacy();};
  return show&&<div className="cloud-consent push-prompt" role="region" aria-label="Notification invitation"><b>Get news from the crew?</b><p>New islands, events and rewards — max 2 a day.</p><p className="push-consent">Delivered with Google Firebase. <button className="text-button" onClick={privacy}>Privacy Policy</button></p><div><button className="secondary-button" onClick={()=>answer(false)}>Not now</button><button className="primary-button" onClick={()=>answer(true)}>Enable</button></div></div>;
}
export function PrivacyCenter({page,onNavigate,onBack,onDelete}){
  const [confirm,setConfirm]=useState(false);
  const [notices,setNotices]=useState(null),[noticeError,setNoticeError]=useState(false);
  useEffect(()=>{
    if(page!=='licenses')return;
    let active=true;
    fetch('./legal/licenses.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(rows=>{if(active)setNotices(rows);}).catch(()=>{if(active)setNoticeError(true);});
    return()=>{active=false;};
  },[page]);
  const doc=pages[page];
  const draft=!publisher.publisherName||!publisher.supportEmail;
  if(page==='licenses')return <section className="settings-center policy-document"><button className="settings-back" onClick={()=>onNavigate('privacy')}><ArrowLeft/>Privacy & play</button><h1>Third-party<br/>licenses.</h1><p>The libraries and fonts behind your expedition. Their authors retain their respective rights.</p>{noticeError?<p>Notices could not load. Reopen this screen to retry.</p>:!notices?<p role="status">Loading notices…</p>:notices.map(n=><details className="license-notice" key={n.name}><summary>{n.name} · {n.version}</summary><pre>{n.text}</pre></details>)}</section>;
  if(doc)return <section className="settings-center policy-document"><button className="settings-back" onClick={()=>onNavigate('privacy')}><ArrowLeft/>Privacy & play</button><span className="eyebrow">PENGUCRUSH · VERSION {publisher.policyVersion}</span><h1>{doc.title}</h1><p className="policy-date">Updated {publisher.effectiveDate}</p>{draft&&<p className="policy-draft">Preview edition · publisher contact details are pending before public release.</p>}<p>{doc.intro}</p>{doc.sections.map(([title,body])=><section key={title}><h2>{title}</h2><p>{body}</p></section>)}{doc.links?.map(([label,url])=><button className="policy-link" key={url} onClick={()=>externalLink(url)}>{label}<ArrowRight/></button>)}{page==='support'&&publisher.supportEmail&&<button className="primary-button" onClick={()=>externalLink(`mailto:${publisher.supportEmail}?subject=PenguCrush%20support`)}><EnvelopeSimple/>Email support</button>}</section>;
  return <section className="settings-center"><button className="settings-back" onClick={onBack}><ArrowLeft/>Settings</button><div className="settings-hero"><span className="settings-emblem"><ShieldCheck weight="duotone"/></span><span className="eyebrow">GOOD COMPANY. CLEAR RULES.</span><h1>Privacy<br/>& play.</h1><p>Your save belongs to your expedition.<br/>Here’s how we look after it.</p></div>
    <div className="privacy-facts"><span><Check/>No account needed</span><span><Check/>No advertising</span><span><Check/>Progress saved on this device</span></div>
    <div className="settings-links">{[['privacy-policy','Privacy Policy','Your information and choices',ShieldCheck],['terms','Terms of Service','The rules for playing',FileText],['deletion','Delete your data','What is saved, and how to remove it',Trash],['support','Help & support','Get your expedition moving',EnvelopeSimple]].map(([id,title,description,Icon])=><button key={id} onClick={()=>onNavigate(id)}><Icon weight="duotone"/><span>{title}<small>{description}</small></span><ArrowRight/></button>)}<button onClick={()=>onNavigate('licenses')}><BookOpenText/><span>Open-source licenses<small>The tools behind the expedition</small></span><ArrowRight/></button></div>
    <div className="delete-save"><h2>A fresh start</h2><p>Delete all progress, stars, shells, boosters and quests on this device. All notification categories will turn off. To remove online scores, use Pack → Delete my leaderboard data.</p>{confirm?<div role="region" aria-label="Confirm delete save"><b>Your whole expedition will be erased.</b><p>This cannot be undone, including unused purchased boosters. Receipt IDs are kept to avoid crediting purchases twice. Cloud registration deletion will be queued if needed.</p><button className="danger-button" onClick={onDelete}>Yes, delete my save</button><button className="text-button" onClick={()=>setConfirm(false)}>Keep my expedition</button></div>:<button className="danger-button" onClick={()=>setConfirm(true)}><Trash/>Delete my save</button>}</div><p className="settings-version">PenguCrush · Beyond the Horizon · 0.6.2</p>
  </section>;
}
export const isPolicyPage=page=>['privacy','privacy-policy','terms','deletion','support','licenses'].includes(page);
export function policyKey(page){return page==='privacy-policy'?'privacy':page==='privacy'?'center':page;}
