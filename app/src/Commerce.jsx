import React,{useEffect,useState} from 'react';
import { Trophy, Wallet, ArrowClockwise, Check, ArrowUpRight, Hammer, Shuffle, X } from '@phosphor-icons/react';
import { api, shortWallet, sol } from './commerce.js';
import { BOOSTERS, bundleContents } from './boosters.js';
import { BoosterArt } from './BoosterArt.jsx';
import { scoreProof } from './recorded-game.js';

function Status({commerce}) {
  return <>{commerce.notice&&<p className="commerce-status" role="status">{commerce.notice}</p>}{commerce.error&&<p className="commerce-error" role="alert">{commerce.error}</p>}</>;
}
function WalletBar({commerce}) {
  return <div className="wallet-bar"><Wallet size={23} weight="duotone"/><div><b>{commerce.session?shortWallet(commerce.session.wallet):'Your Seeker wallet'}</b><small>{commerce.catalog.cluster==='devnet'?'Devnet · test SOL':'Solana mainnet'}</small></div><button className="text-button" disabled={commerce.busy} onClick={commerce.session?commerce.disconnect:commerce.connect}>{commerce.session?'Disconnect':'Connect'}</button></div>;
}
export function SubmitScore({snapshot,commerce,onLeaderboard}) {
  const proof=scoreProof(snapshot),order=commerce.orders.find(o=>o.kind==='score'&&o.payload.runId===proof?.runId);
  const confirmed=order?.status==='confirmed';
  return <section className="score-submit" aria-label="Optional leaderboard submission"><div><Trophy weight="duotone" size={26}/><span><b>Put your run on the board.</b><small>Optional · your adventure is already saved</small></span></div>
    <button className="secondary-button" disabled={commerce.busy||(!confirmed&&(!proof||!commerce.catalog.paymentsEnabled))} onClick={()=>confirmed?onLeaderboard():order?commerce.retry(order):commerce.purchase({kind:'score',proof})}>{confirmed?<><Check weight="bold"/>Score submitted · View board</>:commerce.busy?'Waiting for wallet / confirmation…':<>Submit score · 0.01 SOL<ArrowUpRight weight="bold"/></>}</button>
    <p>Plus the Solana network fee. Best score per level counts. No prizes or payouts.</p>
    {!proof&&<p>Start a new run to submit a score from this update.</p>}
    {proof&&!commerce.catalog.loading&&!commerce.catalog.paymentsEnabled&&<p>Score payments are coming online. Keep playing for free.</p>}
    <Status commerce={commerce}/>
    {order?.status==='pending'&&<button className="text-button" disabled={commerce.busy} onClick={commerce.check}>Already approved? Check payment status</button>}
  </section>;
}
export function BoosterShop({commerce}) {
  const [selected,setSelected]=useState(null),[deletePrompt,setDeletePrompt]=useState(false);
  const pending=commerce.orders.filter(o=>o.status==='pending'),recent=commerce.orders.filter(o=>o.status==='confirmed').slice(0,5);
  return <section className="sol-shop" aria-labelledby="shop-title"><div className="shop-heading"><h2 id="shop-title">Small pack. Big powers.</h2><p>Start with one of each power on us. Both save your moves. Choose more when you need them.</p></div><div className="power-intro">{['blast','aurora'].map(kind=><div key={kind}><BoosterArt kind={kind}/><div><h3>{BOOSTERS[kind].name}</h3><p>{BOOSTERS[kind].description}</p></div></div>)}</div>
    <WalletBar commerce={commerce}/><p className="pack-fee">Pack prices in SOL. Network fee is extra.</p>
    <div className="bundle-list">{([...commerce.catalog.bundles].sort((a,b)=>(b.catalogVersion||1)-(a.catalogVersion||1))).map((bundle,index)=><article key={bundle.id} className={`bundle-row bundle-${index}`}><div className="bundle-art" aria-hidden="true">{bundle.blast?<><BoosterArt kind="blast"/><BoosterArt kind="aurora"/></>:<><Hammer weight="duotone"/><Shuffle weight="bold"/></>}</div><div className="bundle-copy"><h3>{bundle.name}</h3><p>{bundleContents(bundle)}</p></div><button disabled={commerce.busy||!commerce.catalog.paymentsEnabled} aria-label={`Choose ${bundle.name} for ${sol(bundle.lamports)} SOL`} onClick={()=>{setSelected(bundle);requestAnimationFrame(()=>document.querySelector('.purchase-review')?.scrollIntoView({block:'nearest',behavior:'smooth'}));}}>{sol(bundle.lamports)}<small>SOL</small></button></article>)}</div>
    {!commerce.catalog.loading&&!commerce.catalog.paymentsEnabled&&<p className="commerce-status">SOL purchases are not open yet. You can still get boosters with shells above.</p>}
    {selected&&<div className="purchase-review"><button className="purchase-close" aria-label="Close purchase details" disabled={commerce.busy} onClick={()=>setSelected(null)}><X/></button><h3>{selected.name}</h3><p>{bundleContents(selected)} for <b>{sol(selected.lamports)} SOL</b>, plus the network fee shown by your wallet.</p><p>Consumables stay on this installation. Clearing app storage, uninstalling, or deleting your save removes unused supplies.</p><button className="primary-button" disabled={commerce.busy} onClick={()=>commerce.purchase({kind:'boosters',bundleId:selected.id})}><Wallet weight="duotone"/>{commerce.busy?'Waiting for wallet / confirmation…':`Buy · ${sol(selected.lamports)} SOL`}</button></div>}
    <Status commerce={commerce}/>
    <p className="shop-footnote">Prices exclude the network fee. Every pack has the items shown. Buying is optional. Retries and all 100 levels stay free.</p>
    {commerce.session&&<div className="purchase-history"><div className="history-heading"><h3>Your payments</h3><button className="text-button" disabled={commerce.busy} onClick={commerce.check}><ArrowClockwise/>Check status</button></div>
      {!pending.length&&!recent.length&&<p>No purchases yet. Your confirmed receipts will appear here.</p>}
      {pending.slice(0,8).map(order=><div className="receipt-row" key={order.id}><span><b>{order.kind==='score'?`Level ${order.payload.level} score`:order.payload.name}</b><small>{sol(order.lamports)} SOL · awaiting approval or confirmation</small></span><button className="text-button" disabled={commerce.busy} onClick={()=>commerce.retry(order)}>Continue</button></div>)}
      {recent.map(order=><div className="receipt-row" key={order.id}><Check weight="bold"/><span><b>{order.kind==='score'?`Level ${order.payload.level} score`:order.payload.name}</b><small>{sol(order.lamports)} SOL · confirmed</small></span><button className="receipt-link" aria-label="View transaction on Solana Explorer" onClick={()=>{const url=`https://explorer.solana.com/tx/${order.signature}${commerce.catalog.cluster==='devnet'?'?cluster=devnet':''}`;globalThis.PenguNative?.openExternal?PenguNative.openExternal(url):window.open(url,'_blank','noopener');}}><ArrowUpRight/></button></div>)}
      <button className="text-button delete-ranking" disabled={commerce.busy} onClick={()=>setDeletePrompt(!deletePrompt)}>Delete my leaderboard data</button>
      {deletePrompt&&<div className="delete-ranking-confirm"><p>This removes your public scores and signs you out. Payment receipts and public Solana transactions remain.</p><button className="secondary-button" disabled={commerce.busy} onClick={()=>{commerce.deleteLeaderboard();setDeletePrompt(false);}}>Delete leaderboard data</button><button className="text-button" onClick={()=>setDeletePrompt(false)}>Keep my scores</button></div>}
    </div>}
  </section>;
}
export function Leaderboard({commerce}) {
  const [level,setLevel]=useState('all'),[data,setData]=useState(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  useEffect(()=>{let live=true;setData(null);setError('');api(`/leaderboard?level=${level}`).then(value=>{if(live)setData(value);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[level,refresh]);
  return <div className="leaderboard-content"><div className="section-heading"><span className="eyebrow">THE EXPEDITION HONOUR ROLL</span><h1>Big scores.<br/>Good company.</h1><p>Your best submitted score on each level adds up to your overall total.</p></div><WalletBar commerce={commerce}/><Status commerce={commerce}/>
    <div className="ranking-controls"><label htmlFor="ranking-level">Show rankings<select id="ranking-level" value={level} onChange={e=>setLevel(e.target.value)}><option value="all">Overall expedition</option>{Array.from({length:100},(_,i)=><option key={i+1} value={i+1}>Level {i+1}</option>)}</select></label><button className="ranking-refresh" aria-label="Refresh leaderboard" onClick={()=>setRefresh(n=>n+1)}><ArrowClockwise weight="bold"/></button></div>
    {error?<div className="ranking-empty"><Trophy size={48}/><h2>The board is taking a breather.</h2><p role="alert">{error}</p><button className="secondary-button" onClick={()=>setRefresh(n=>n+1)}>Try again</button></div>:!data?<p className="ranking-loading" role="status">Fetching the latest adventures…</p>:!data.entries.length?<div className="ranking-empty"><Trophy size={60} weight="duotone"/><h2>First footprints welcome.</h2><p>Finish a level, then choose “Submit score” to join the board for 0.01 SOL plus the network fee.</p><small>Submitting is optional. There are no prizes or payouts.</small></div>:<ol className="ranking-list">{data.entries.map(entry=><li key={entry.wallet} className={entry.wallet===commerce.session?.wallet?'is-you':''}><span className={`rank rank-${entry.rank}`}>{entry.rank===1?<Trophy weight="fill"/>:entry.rank}</span><span className="ranking-player"><b title={entry.wallet}>{shortWallet(entry.wallet)}{entry.wallet===commerce.session?.wallet&&<em>You</em>}</b><small>{level==='all'?`${entry.levels} ${entry.levels===1?'level':'levels'} submitted`:`${entry.stars} stars`}{entry.assisted?' · boosters used':''}</small></span><strong>{entry.score.toLocaleString()}<small>points</small></strong></li>)}</ol>}
    <p className="ranking-note">Top 100 wallets. Ties go to the earlier total or score. Runs are checked by replaying their moves; offline booster balances are stored on the device.</p>
  </div>;
}
