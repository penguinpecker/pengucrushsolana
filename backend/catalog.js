export const SCORE_LAMPORTS = 10_000_000;
export const BUNDLES = Object.freeze([
  {id:'pocket',name:'Pocket pack',hammer:3,shuffle:3,lamports:5_000_000},
  {id:'trail',name:'Trail pack',hammer:10,shuffle:10,lamports:15_000_000},
  {id:'expedition',name:'Expedition pack',hammer:25,shuffle:25,lamports:30_000_000},
  {id:'power-duo',name:'Power duo',blast:2,aurora:2,lamports:10_000_000,catalogVersion:2},
  {id:'arctic-arsenal',name:'Arctic arsenal',blast:6,aurora:6,lamports:25_000_000,catalogVersion:2},
]);
export const catalogBundles=version=>BUNDLES.filter(bundle=>(bundle.catalogVersion||1)<=version);
export const uuid = value => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function fail(status,message) { throw Object.assign(new Error(message),{status}); }
