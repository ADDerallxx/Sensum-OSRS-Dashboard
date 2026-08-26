const V133_TIMELINE_KEY='V133_TIMELINE';

function v133ReadTimeline_(){try{return JSON.parse(PropertiesService.getUserProperties().getProperty(V133_TIMELINE_KEY)||'[]')}catch(e){return []}}
function v133WriteTimeline_(events){PropertiesService.getUserProperties().setProperty(V133_TIMELINE_KEY,JSON.stringify(events.slice(-500)))}
function v133EventId_(){return Utilities.getUuid()}

function addV133ManualAchievement(title,note){
  title=String(title||'').trim();note=String(note||'').trim();
  if(!title)throw new Error('Enter an achievement title.');
  if(title.length>90||note.length>300)throw new Error('Achievement text is too long.');
  const events=v133ReadTimeline_();events.push({id:v133EventId_(),kind:'manual',category:'Personal',title:title,detail:note,date:new Date().toISOString(),observed:false});v133WriteTimeline_(events);
  return getV1DashboardState({allowQuestHelperSync:false});
}

function removeV133ManualAchievement(id){
  const events=v133ReadTimeline_(),target=events.find(x=>x.id===String(id||''));
  if(!target||target.kind!=='manual')throw new Error('Only manual achievements can be removed here.');
  v133WriteTimeline_(events.filter(x=>x.id!==target.id));return getV1DashboardState({allowQuestHelperSync:false});
}

function readV133Achievements_(ss,statsRows,account,allGoals,bosses,bossProgress){
  const completed=new Set();
  try{const t=v115QuestTable_(ss);t.vals.slice(t.headerRow+1).forEach(r=>{if(/^(yes|true|complete|completed)$/i.test(String(r[t.cCol]||'')))completed.add(String(r[t.qCol]||'').trim().toLowerCase())})}catch(e){}
  const stats={};(statsRows||[]).forEach(r=>stats[String(r[0]||'').trim().toLowerCase()]=Number(r[1]||0));
  const levels=Object.values(stats).filter(x=>x>0),totalLevel=levels.reduce((a,b)=>a+b,0),combat=Number(account['Combat Level']||0),qp=Number(account['Quest Points']||0);
  const A=(id,category,title,detail,current,target,link)=>({id:id,category:category,title:title,detail:detail,current:current,target:target,percent:Math.max(0,Math.min(100,Math.round((target?current/target:1)*100))),unlocked:current>=target,link:link||'overview'});
  const achievements=[];
  [25,50,100,150,200].forEach(n=>achievements.push(A('quests-'+n,'Quests',n+' quests complete','Account quest-completion milestone',completed.size,n,'overview')));
  [50,75,90,100,110].forEach(n=>achievements.push(A('combat-'+n,'Combat','Combat level '+n,'Combat progression milestone',combat,n,'stats')));
  [50,100,150,200,250].forEach(n=>achievements.push(A('qp-'+n,'Quests',n+' Quest Points','Quest-point milestone',qp,n,'overview')));
  [750,1000,1250,1500,1750,2000].forEach(n=>achievements.push(A('total-'+n,'Skills',n+' total level','Combined base-level milestone',totalLevel,n,'stats')));
  [40,50,60,70,80,90].forEach(n=>{const count=levels.filter(x=>x>=n).length;achievements.push(A('skills-'+n,'Skills','All skills at '+n,'Base levels only · '+count+' of '+levels.length+' skills',count,levels.length||1,'stats'))});
  (allGoals||[]).filter(g=>g.name!=='Balanced').forEach(g=>achievements.push(A('goal-'+String(g.name).toLowerCase().replace(/[^a-z0-9]+/g,'-'),'Goals',g.name+' accomplished','Progression goal completed',/^accomplished$/i.test(g.status||'')?1:0,1,'overview')));
  (bosses||[]).forEach(b=>{
    const guide=v132BossGuides_().find(x=>x.name===b.name),p=(bossProgress||{})[b.name]||{},mechanics=guide?guide.mechanics:[],values=mechanics.map(x=>p['mechanic:'+String(x).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)]||'not_started');
    const started=values.filter(x=>x!=='not_started').length,consistent=values.filter(x=>x==='consistent').length;
    achievements.push(A('boss-first-'+b.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),'Bosses',b.name+' first-kill ready','Access, recommended stats, and core mechanics started',(b.accessReady&&b.statsReady&&started>=Math.ceil(mechanics.length/2))?1:0,1,'bosses'));
    achievements.push(A('boss-farm-'+b.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),'Bosses',b.name+' mechanics mastered','All tracked mechanics marked consistent',mechanics.length?consistent:0,mechanics.length||1,'bosses'));
  });
  let timeline=v133ReadTimeline_(),known=new Set(timeline.filter(x=>x.achievementId).map(x=>x.achievementId)),changed=false;
  achievements.filter(x=>x.unlocked&&!known.has(x.id)).forEach(x=>{timeline.push({id:v133EventId_(),achievementId:x.id,kind:'automatic',category:x.category,title:x.title,detail:x.detail,date:new Date().toISOString(),observed:true});known.add(x.id);changed=true});
  if(changed)v133WriteTimeline_(timeline);
  const unlocked=achievements.filter(x=>x.unlocked),upcoming=achievements.filter(x=>!x.unlocked).sort((a,b)=>b.percent-a.percent||a.title.localeCompare(b.title)).slice(0,8);
  return {summary:{unlocked:unlocked.length,total:achievements.length,quests:completed.size,totalLevel:totalLevel},achievements:achievements,timeline:timeline.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,100),upcoming:upcoming};
}
