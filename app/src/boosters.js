export const BOOSTERS = Object.freeze({
  hammer: {name:'Ice hammer',short:'Hammer',description:'Break one piece or chip one coral block.',shells:60,targeted:true},
  shuffle: {name:'Snow shuffle',short:'Shuffle',description:'Reshuffle the board for fresh matches.',shells:40,targeted:false},
  blast: {name:'Polar Blast',short:'Blast',description:'Clear a 5 × 5 area. Break nets, chip ice and coral, and fire any specials inside.',shells:180,targeted:true,power:true},
  aurora: {name:'Aurora Sweep',short:'Aurora',description:'Choose a colour. Clear every matching piece on the board and fire its specials.',shells:220,targeted:true,power:true},
});
export const BOOSTER_KEYS=Object.keys(BOOSTERS);
// These are the initial targets; special-piece chains can reach farther.
export function boosterTargets(kind,index,state,level) {
  if(!Number.isInteger(index)||index<0||index>=state.board.length||!level.mask[index])return [];
  if(kind==='blast')return level.mask.flatMap((active,i)=>active&&Math.abs(Math.floor(i/level.cols)-Math.floor(index/level.cols))<=2&&Math.abs(i%level.cols-index%level.cols)<=2?[i]:[]);
  if(kind==='aurora') {
    const type=state.board[index]?.type;
    if(!Number.isInteger(type)||type<0||type>=6)return [];
    return state.board.flatMap((tile,i)=>tile?.type===type?[i]:[]);
  }
  return [];
}
export const bundleContents=bundle=>BOOSTER_KEYS.filter(key=>bundle[key]>0).map(key=>`${bundle[key]} ${BOOSTERS[key].name}${bundle[key]===1?'':'s'}`).join(' + ');
