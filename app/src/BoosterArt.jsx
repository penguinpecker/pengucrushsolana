import React from 'react';
import { ArrowClockwise, Snowflake, ShootingStar } from '@phosphor-icons/react';
import { Sprite } from './Art.jsx';

export function BoosterArt({kind}) {
  if(kind==='hammer')return <Sprite index={11}/>;
  if(kind==='shuffle')return <span className="shuffle-art" aria-hidden="true"><ArrowClockwise weight="bold"/></span>;
  const Icon=kind==='blast'?Snowflake:ShootingStar;
  return <span className={`power-art power-${kind}`} aria-hidden="true"><Icon weight="duotone"/></span>;
}
