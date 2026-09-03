const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));

export function agilityPyramidCompletionBonus(baseAgility){
  if(!finite(baseAgility)||Number(baseAgility)<1)throw new Error('baseAgility must be a positive finite level.');
  return Math.min(1000,300+Number(baseAgility)*8);
}

export function agilityPyramidLapXp({baseAgility,staticObstacleXp=722}={}){
  if(!finite(staticObstacleXp)||Number(staticObstacleXp)<0)throw new Error('staticObstacleXp must be a non-negative finite value.');
  return Number(staticObstacleXp)+agilityPyramidCompletionBonus(baseAgility);
}
