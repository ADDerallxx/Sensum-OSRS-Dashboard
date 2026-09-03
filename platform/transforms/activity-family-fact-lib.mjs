const number=value=>Number(String(value||'').replace(/,/g,''));

export function parseSimpleLapClaims(text){
  const source=String(text||''),claims=[];
  let match=source.match(/\b(?:a\s+)?lap\s+(?:will\s+take|takes)\s+(?:a\s+)?(minimum|average)\s+(?:of\s+)?([\d.]+)\s+seconds?\s+to\s+complete/i);
  if(match)claims.push({kind:'lap_seconds',factClass:'mechanical',value:{seconds:number(match[2]),timing_kind:match[1].toLowerCase()},match});
  match=source.match(/\bplayers?\s+gain\s+([\d,.]+)\s+(?:\[\[experience\]\]|experience)(?:\s+points?)?\s+for\s+a\s+complete\s+(?:circuit|lap)/i);
  if(match)claims.push({kind:'xp_per_success',factClass:'mechanical',value:{xp:number(match[1]),unit:'lap'},match});
  match=source.match(/\baverage\s+(?:\[\[experience\]\]|experience)\s+per\s+hour\s+(?:will\s+be|is)\s+(?:around|approximately|about)\s+([\d,.]+)/i);
  if(match)claims.push({kind:'observed_xp_per_hour',factClass:'observational',value:{minimum:number(match[1]),maximum:number(match[1]),observation_kind:'practical_average',approximate:true},match});
  return claims;
}
