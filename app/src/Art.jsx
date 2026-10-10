import React from 'react';
import { Star, Crown, Snowflake, Sparkle, Lamp, Fish, Waves, Check } from '@phosphor-icons/react';
import { ATLAS } from './atlas.js';
import { DIFFICULTIES } from './campaign.js';
export const art=name=>new URL(`${import.meta.env.BASE_URL}art/v2/${name}.webp`,document.baseURI).href;
export const mapArt=name=>new URL(`${import.meta.env.BASE_URL}art/v3/${name}.webp`,document.baseURI).href;
export function Sprite({index=0,className='',...props}){
 const r=ATLAS.rects[index],scale=90/Math.max(r.w,r.h),w=r.w*scale,h=r.h*scale;
 return <svg {...props} aria-hidden="true" className={`sprite sprite-${index} ${className}`} viewBox="0 0 100 100"><svg x={(100-w)/2} y={(100-h)/2} width={w} height={h} viewBox={`${r.x} ${r.y} ${r.w} ${r.h}`} overflow="hidden"><image href={art('pieces')} width={ATLAS.width} height={ATLAS.height}/></svg></svg>;
}
export const Character=({index=0,className=''})=><span aria-hidden="true" className={`character character-${index} ${className}`} style={{backgroundImage:`url("${art(['kip','rook','juno','chick'][index])}")`}}/>;
export const Stars=({count=0,size=20})=><span className="stars" aria-label={`${count} of 3 stars`}>{[1,2,3].map(n=><Star key={n} size={size} weight="fill" className={n<=count?'earned':''}/>)}</span>;
export const Difficulty=({value})=><span className={`difficulty difficulty-${value}`} style={{'--tier':DIFFICULTIES[value].color}}>{value==='legendary'?<Crown weight="fill"/>:value==='gentle'?<Snowflake weight="bold"/>:<Sparkle weight="fill"/>}{DIFFICULTIES[value].name}</span>;
export const IconButton=({label,children,...props})=><button className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;
// Measured source regions: generated rows have slightly different heights.
// Isolating each region prevents the next island bleeding into a landmark.
const MAP_RECTS=[[0,0,513,501],[520,0,504,502],[0,502,514,460],[521,502,503,459],[0,963,512,573],[514,963,510,573],[0,0,512,511],[513,0,511,511],[0,513,512,515],[513,510,511,520],[0,1032,512,504],[513,1032,511,504]];
export function Landmark({index=0,className='',...props}){
 const [x,y,rw,rh]=MAP_RECTS[index],scale=100/Math.max(rw,rh),w=rw*scale,h=rh*scale,atlas=index<6?'a':'b';
 return <svg {...props} className={`landmark ${className}`} viewBox="0 0 100 100" aria-hidden="true"><svg x={(100-w)/2} y={(100-h)/2} width={w} height={h} viewBox={`${x} ${y} ${rw} ${rh}`} overflow="hidden"><image href={mapArt(`landmarks-${atlas}`)} width="1024" height="1536"/></svg></svg>;
}
export function MechanicIcon({kind,className=''}){
 if(kind==='lantern')return <svg aria-hidden="true" className={`mechanic-icon ${className}`} viewBox="0 0 48 48"><path d="M18 12V8a6 6 0 0 1 12 0v4" fill="none" stroke="#172d3e" strokeWidth="3"/><path d="m15 12-4 26 6 6h14l6-6-4-26Z" fill="#efa549" stroke="#172d3e" strokeWidth="2.5"/><path d="m18 17-3 19 9 5 9-5-3-19Z" fill="#fff1a4" stroke="#172d3e" strokeWidth="2"/><path d="M24 18v22M14 14h20M13 37h22" fill="none" stroke="#172d3e" strokeWidth="2"/><path d="m23 26-4 7h9Z" fill="#ef6047"/></svg>;
 if(kind==='net')return <svg aria-hidden="true" className={`mechanic-icon ${className}`} viewBox="0 0 48 48"><path d="m7 10 33-3-2 33-30 1Z" fill="#e7d5ac" fillOpacity=".6" stroke="#172d3e" strokeWidth="3"/><path d="m9 11 28 28M8 23l16 17M22 8l17 17M37 9 9 37M24 9 9 24M39 23 23 40" fill="none" stroke="#b27846" strokeWidth="3"/><path d="m9 11 28 28M37 9 9 37" fill="none" stroke="#fff2cf" strokeWidth="1.5"/></svg>;
 if(kind==='current')return <Waves className={`mechanic-icon ${className}`} weight="bold"/>;
 return <Sprite index={kind==='ice'?9:kind==='coral'?10:kind==='special'?6:0} className={className}/>;
}
export function GoalIcon({goal}){
 if(goal.kind==='rescue')return <Character index={3}/>;
 if(['lantern','net','current'].includes(goal.kind))return <MechanicIcon kind={goal.kind}/>;
 return <Sprite index={goal.kind==='collect'?goal.piece:goal.kind==='ice'?9:goal.kind==='coral'?10:6}/>;
}
export function BoardPreview({level}){
 return <div className="preview-board-wrap"><div className="preview-board" aria-label={`${level.cols} columns, ${level.rows} rows, ${level.shape} board`} style={{gridTemplateColumns:`repeat(${level.cols},1fr)`,aspectRatio:`${level.cols}/${level.rows}`}}>{level.mask.map((active,i)=><i key={i} className={!active?'void':level.coral[i]?'has-coral':level.nets[i]?'has-net':level.ice[i]?'has-ice':Object.hasOwn(level.lanterns,i)?'has-lantern':level.current?.path.includes(i)?'has-current':''}/>)}</div><span>{level.cols} × {level.rows}<small>{level.design.activeCells} spaces</small></span></div>;
}
