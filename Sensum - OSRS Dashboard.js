const CONFIG = {
  SPREADSHEET_ID: '1vDSs0OUaL1a6Sp2N8N9pLVFPtJWxXROzgnbTOWUDfuE',
  USERNAME: 'Sensum',
  HISCORES_URL: 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json',
  MASTER_CHECKLIST_DOC_ID: '1lZLW2cPVCknGzYYw0ImvfoH7O6A5rzCSF3xtKvS2b_o',
  SKILL_GUIDE_DOC_ID: '1k7FSkYxNdscly8Ei6k0KYWZVTt3NSODw0KYmWzA7w5g',
  QUEST_SHOPPING_DOC_ID: '1DBJDwZiWX96qJMkkitcMzMbhynmgmwakcUDQDRdVQjc',
  WIKI_API: 'https://oldschool.runescape.wiki/api.php',
  WIKI_USER_AGENT: 'SensumOSRSDashboard/0.8 - private personal account progression tool'
};

function doGet(e) {
  const useV1 = e && e.parameter && String(e.parameter.v || '') === '1';
  const template = useV1 ? 'V1' : 'Index';

  return HtmlService.createTemplateFromFile(template)
    .evaluate()
    .setTitle(useV1 ? 'Sensum OSRS Progression Dashboard' : 'Sensum OSRS Dashboard');
}

function getDashboardState() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const roadmap = buildRoadmapState_(ss);
  const questIntel = buildQuestIntelligenceState_(ss, roadmap);
  const shopping = buildQuestShoppingState_(ss, roadmap, questIntel);
  const shoppingLibrary = buildFullShoppingLibrary_(ss, shopping);
  const levelingLibrary = buildLevelingLibrary_(ss, roadmap, questIntel);
  const today = buildTodayCommand_(ss, roadmap, shopping, questIntel);
  return {
    account: readKV_(ss, 'Account'),
    stats: readTable_(ss, 'Stats'),
    quests: readTable_(ss, 'Quests'),
    wealth: readTable_(ss, 'Wealth'),
    goals: readTable_(ss, 'Goals'),
    moneyMethods: readTable_(ss, 'Money Methods'),
    goldPlan: buildGoldPlan_(ss),
    roadmap: roadmap,
    shopping: shopping,
    shoppingLibrary: shoppingLibrary,
    levelingLibrary: levelingLibrary,
    questIntel: questIntel,
    todayCommand: today,
    dailyPlan: readTable_(ss, 'Daily Plan')
  };
}

function refreshNow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return {ok:false, message:'Refresh already running', sources:{}};
  try { return refreshCore_('manual'); }
  finally { lock.releaseLock(); }
}

function scheduledRefresh() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return {ok:false, message:'Refresh already running', sources:{}};
  try { return refreshCore_('scheduled'); }
  finally { lock.releaseLock(); }
}

function refreshCore_(type) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const result = {
    ok:true,
    refreshType:type,
    updatedAt:new Date().toISOString(),
    sources:{
      stats:{ok:false,message:'Not started'},
      quests:{ok:false,message:'RuneLite quest bridge not connected yet'},
      wealth:{ok:false,message:'RuneLite wealth bridge not connected yet'},
      recommendations:{ok:false,message:'Not started'}
    }
  };

  try {
    const stats = fetchStats_();
    writeStats_(ss, stats);
    result.sources.stats = {ok:true,message:'Stats refreshed from Official OSRS Hiscores.'};
  } catch(e) {
    result.ok = false;
    result.sources.stats = {ok:false,message:String(e.message || e)};
  }

  try {
    const qRows = readTable_(ss, 'Quests');
    const qConnected = qRows.some(r => String(r.Source || '').toLowerCase() === 'runelite');
    result.sources.quests = qConnected
      ? {ok:true,message:'Quest states loaded from the latest RuneLite sync.'}
      : {ok:false,message:'RuneLite quest bridge not connected yet'};
  } catch(e) {
    result.sources.quests = {ok:false,message:String(e.message || e)};
  }

  try {
    const wRows = readTable_(ss, 'Wealth');
    const wConnected = wRows.some(r => String(r.Source || '').toLowerCase() === 'runelite');
    result.sources.wealth = wConnected
      ? {ok:true,message:'Wealth loaded from the latest RuneLite sync.'}
      : {ok:false,message:'RuneLite wealth bridge not connected yet'};
  } catch(e) {
    result.sources.wealth = {ok:false,message:String(e.message || e)};
  }

  try {
    evaluateGoals_(ss);
    ensureMoneyMethods_(ss);
    writeDailyPlan_(ss, generateDailyPlan_(ss));
    result.sources.recommendations = {ok:true,message:"Today's Tasks regenerated."};
  } catch(e) {
    result.ok = false;
    result.sources.recommendations = {ok:false,message:String(e.message || e)};
  }

  const account = ss.getSheetByName('Account');
  upsert_(account,'username',CONFIG.USERNAME);
  upsert_(account,'lastRefresh',result.updatedAt);
  upsert_(account,'lastRefreshType',type);
  upsert_(account,'roadmapSource','Master Progression Checklist + Skill Leveling Guide');
  // Bridge status is updated by RuneLite doPost() syncs.
  logRefresh_(ss,result);
  return result;
}


function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return json_({ok:false,error:'busy'});

  try {
    let payload;
    try {
      payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (err) {
      return json_({ok:false,error:'invalid_json'});
    }

    if (String(payload.token || '') !== CONFIG.BRIDGE_TOKEN) {
      return json_({ok:false,error:'unauthorized'});
    }
    if (String(payload.username || '').toLowerCase() !== CONFIG.USERNAME.toLowerCase()) {
      return json_({ok:false,error:'wrong_username'});
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const now = payload.timestamp || new Date().toISOString();

    writeRuneLiteQuests_(ss, payload.quests || [], now);
    writeRuneLiteWealth_(ss, payload.wealth || {}, now);
    writeRuneLiteItems_(ss, payload.items || [], now);

    const account = ss.getSheetByName('Account');
    upsert_(account, 'lastRuneLiteSync', now);
    upsert_(account, 'questBridgeStatus', 'connected');
    upsert_(account, 'wealthBridgeStatus', 'connected');

    evaluateGoals_(ss);
    ensureMoneyMethods_(ss);
    writeDailyPlan_(ss, generateDailyPlan_(ss));

    return json_({ok:true,receivedAt:new Date().toISOString()});
  } catch (err) {
    return json_({ok:false,error:String(err && err.message ? err.message : err)});
  } finally {
    lock.releaseLock();
  }
}

function writeRuneLiteQuests_(ss, quests, now) {
  const sh = ss.getSheetByName('Quests');
  sh.clearContents();
  sh.getRange(1,1,1,4).setValues([['Quest','Status','Source','Updated At']]);
  const rows = quests
    .filter(q => q && q.name)
    .map(q => [q.name, q.status || 'UNKNOWN', 'RuneLite', now]);
  if (rows.length) sh.getRange(2,1,rows.length,4).setValues(rows);
}

function writeRuneLiteWealth_(ss, wealth, now) {
  const sh = ss.getSheetByName('Wealth');
  sh.clearContents();
  sh.getRange(1,1,1,7).setValues([['Container','GE Value','High Alch Value','Cash GP','Last Seen','Source','Updated At']]);

  const containers = ['bank','inventory','equipment'];
  const rows = containers.map(name => {
    const x = wealth[name] || {};
    return [
      title_(name),
      Number(x.geValue || 0),
      Number(x.highAlchValue || 0),
      name === 'bank' ? Number(wealth.cashGp || 0) : '',
      x.lastSeen || now,
      'RuneLite',
      now
    ];
  });

  rows.push([
    'Total Visible',
    Number(wealth.totalVisibleGe || 0),
    Number(wealth.totalVisibleHighAlch || 0),
    Number(wealth.cashGp || 0),
    now,
    'RuneLite',
    now
  ]);

  sh.getRange(2,1,rows.length,7).setValues(rows);

  const account = ss.getSheetByName('Account');
  upsert_(account,'bankGeValue',Number((wealth.bank || {}).geValue || 0));
  upsert_(account,'inventoryGeValue',Number((wealth.inventory || {}).geValue || 0));
  upsert_(account,'equipmentGeValue',Number((wealth.equipment || {}).geValue || 0));
  upsert_(account,'cashGp',Number(wealth.cashGp || 0));
  upsert_(account,'totalVisibleWealth',Number(wealth.totalVisibleGe || 0));
}

function writeRuneLiteItems_(ss, items, now) {
  let sh = ss.getSheetByName('RuneLite Items');
  if (!sh) sh = ss.insertSheet('RuneLite Items');
  sh.clearContents();
  sh.getRange(1,1,1,8).setValues([['Container','Item ID','Item','Quantity','Unit GE','Total GE','High Alch','Updated At']]);
  const rows = items
    .filter(x => x && Number(x.itemId || 0) > 0 && Number(x.quantity || 0) > 0)
    .map(x => [
      x.container || '',
      Number(x.itemId),
      x.name || '',
      Number(x.quantity),
      Number(x.unitGe || 0),
      Number(x.totalGe || 0),
      Number(x.totalHighAlch || 0),
      now
    ]);
  if (rows.length) sh.getRange(2,1,rows.length,8).setValues(rows);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function createDailyRefreshTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'scheduledRefresh') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('scheduledRefresh').timeBased().everyDays(1).atHour(6).create();
}

function fetchStats_() {
  const url = CONFIG.HISCORES_URL + '?player=' + encodeURIComponent(CONFIG.USERNAME);
  const r = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'Accept': 'application/json,text/plain,*/*',
      'User-Agent': 'Sensum-OSRS-Dashboard/0.1.2'
    }
  });

  const status = r.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('Official OSRS Hiscores request failed: HTTP ' + status);
  }

  let payload;
  try {
    payload = JSON.parse(r.getContentText());
  } catch (e) {
    throw new Error('Official OSRS Hiscores returned an unreadable response.');
  }

  const skills = normalizeHiscoresJson_(payload);
  if (!Object.keys(skills).length) {
    throw new Error('Official OSRS Hiscores returned no skill data for Sensum.');
  }

  return {
    skills: skills,
    combatLevel: calculateCombatLevel_(skills),
    updatedAt: new Date().toISOString()
  };
}

function normalizeHiscoresJson_(payload) {
  const out = {};
  const candidates = [];

  if (Array.isArray(payload)) candidates.push.apply(candidates, payload);
  if (payload && Array.isArray(payload.skills)) candidates.push.apply(candidates, payload.skills);

  candidates.forEach(entry => {
    if (!entry) return;
    const name = String(entry.name || entry.skill || '').trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/\s+/g, '_');
    out[key] = {
      level: Number(entry.level == null ? 1 : entry.level),
      experience: Number(entry.experience == null ? (entry.xp == null ? 0 : entry.xp) : entry.experience),
      rank: entry.rank == null ? '' : entry.rank
    };
  });

  const keyed = payload && (payload.skillValues || payload.skill_values || payload.data);
  if (keyed && typeof keyed === 'object' && !Array.isArray(keyed)) {
    Object.keys(keyed).forEach(name => {
      const entry = keyed[name];
      if (!entry || typeof entry !== 'object') return;
      if (entry.level == null && entry.experience == null && entry.xp == null) return;
      const key = String(name).toLowerCase().replace(/\s+/g, '_');
      out[key] = {
        level: Number(entry.level == null ? 1 : entry.level),
        experience: Number(entry.experience == null ? (entry.xp == null ? 0 : entry.xp) : entry.experience),
        rank: entry.rank == null ? '' : entry.rank
      };
    });
  }

  return out;
}

function calculateCombatLevel_(skills) {
  function lvl(name) {
    return Number((skills[name] && skills[name].level) || 1);
  }

  const defence = lvl('defence');
  const hitpoints = lvl('hitpoints');
  const prayer = lvl('prayer');
  const attack = lvl('attack');
  const strength = lvl('strength');
  const ranged = lvl('ranged');
  const magic = lvl('magic');

  const base = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
  const melee = 0.325 * (attack + strength);
  const range = 0.325 * Math.floor(ranged * 1.5);
  const mage = 0.325 * Math.floor(magic * 1.5);

  return Math.floor(base + Math.max(melee, range, mage));
}

function writeStats_(ss,data) {
  const sh = ss.getSheetByName('Stats');
  sh.clearContents();
  sh.getRange(1,1,1,6).setValues([['Skill','Level','XP','Rank','Source','Updated At']]);
  const rows = Object.keys(data.skills).map(k => {
    const s = data.skills[k] || {};
    return [title_(k), Number(s.level||1), Number(s.experience||0), s.rank==null?'':s.rank, 'Official OSRS Hiscores', data.updatedAt];
  });
  if (rows.length) sh.getRange(2,1,rows.length,6).setValues(rows);
  upsert_(ss.getSheetByName('Account'),'combatLevel',data.combatLevel);
}

function evaluateGoals_(ss) {
  const stats = {};
  readTable_(ss,'Stats').forEach(r => stats[String(r.Skill||'').toLowerCase()] = Number(r.Level||1));

  const quests = {};
  readTable_(ss,'Quests').forEach(r => {
    if (r.Quest) quests[String(r.Quest).toLowerCase()] = String(r.Status || '').toUpperCase();
  });

  const sh = ss.getSheetByName('Goals');
  if (sh.getLastRow() < 2) seedGoals_(sh);

  const v = sh.getDataRange().getValues();
  const h = v[0].map(String);
  const ix = {}; h.forEach((x,i)=>ix[x]=i);

  for (let r=1;r<v.length;r++) {
    const type = String(v[r][ix.Type] || '').toLowerCase();

    if (type === 'skill') {
      const cur = Number(stats[String(v[r][ix.Key]).toLowerCase()] || 1);
      const target = Number(v[r][ix.Target] || 0);
      v[r][ix.Status] = cur >= target ? 'COMPLETE' : 'OPEN';
      v[r][ix.Progress] = cur + '/' + target;
    } else if (type === 'quest') {
      const q = quests[String(v[r][ix.Key]).toLowerCase()] || '';
      const done = q === 'FINISHED' || q === 'COMPLETE';
      v[r][ix.Status] = done ? 'COMPLETE' : 'OPEN';
      v[r][ix.Progress] = done ? 'Complete' : (q === 'IN_PROGRESS' ? 'In progress' : 'Not complete');
    }
  }

  sh.getRange(1,1,v.length,v[0].length).setValues(v);
}

function seedGoals_(sh) {
  const rows = [
    ['Category','Goal','Type','Key','Target','Status','Progress','Priority','Why'],
    ['Fire Cape','43 Prayer','skill','prayer',43,'OPEN','','HIGH','Protection prayers'],
    ['Fire Cape','50 Ranged','skill','ranged',50,'OPEN','','HIGH','Early ranged milestone'],
    ['Fire Cape','61 Ranged','skill','ranged',61,'OPEN','','HIGH','Rune crossbow milestone'],
    ['Combat','65 Attack','skill','attack',65,'OPEN','','MED','Warriors Guild path'],
    ['Combat','65 Strength','skill','strength',65,'OPEN','','MED','Warriors Guild path'],
    ['Fire Cape','70 Ranged','skill','ranged',70,'OPEN','','HIGH','Ranged gear milestone'],
    ['Fire Cape','75 Ranged','skill','ranged',75,'OPEN','','HIGH','Fight Caves target'],
    ['Fire Cape','60 Prayer','skill','prayer',60,'OPEN','','MED','Comfortable Fight Caves target'],
    ['Fire Cape','70 Defence','skill','defence',70,'OPEN','','MED','Comfortable midgame target'],
    ['Fire Cape','Animal Magnetism','quest','Animal Magnetism',1,'OPEN','','HIGH',"Ava's devices"],
    ['Combat','Dragon Defender','manual','dragon_defender',1,'OPEN','','MED','Major melee upgrade'],
    ['Fire Cape','Fire Cape','manual','fire_cape',1,'OPEN','','HIGH','Main campaign finish line']
  ];
  sh.clearContents();
  sh.getRange(1,1,rows.length,rows[0].length).setValues(rows);
}






/* =========================
   QUEST INTELLIGENCE v0.8
   ========================= */

const QUEST_INTEL_SEED = {
  "waterfall quest": {
    prerequisiteQuests: [],
    requiredItems: ["6 Air runes", "6 Water runes", "6 Earth runes", "Rope"],
    rewardItems: [],
    xpRewards: ["13,750 Attack XP", "13,750 Strength XP"],
    areaUnlocks: [],
    transportUnlocks: [],
    importantRewards: ["13,750 Attack XP", "13,750 Strength XP"],
    notes: "High-value early combat XP quest; the account guide intentionally prioritizes this before early melee grinding."
  },
  "fight arena": {
    prerequisiteQuests: [],
    requiredItems: [],
    rewardItems: [],
    xpRewards: ["12,175 Attack XP"],
    areaUnlocks: [],
    transportUnlocks: [],
    importantRewards: ["12,175 Attack XP"],
    notes: "Efficient early Attack XP shortcut."
  },
  "witch's house": {
    prerequisiteQuests: [],
    requiredItems: ["Cheese", "Leather gloves"],
    rewardItems: [],
    xpRewards: ["6,325 Hitpoints XP"],
    areaUnlocks: [],
    transportUnlocks: [],
    importantRewards: ["6,325 Hitpoints XP"],
    notes: "Efficient early Hitpoints XP before harder combat quest chains."
  },
  "merlin's crystal": {
    prerequisiteQuests: [],
    requiredItems: ["Bread", "Tinderbox", "Bat bones", "Black candle"],
    rewardItems: ["Excalibur"],
    xpRewards: [],
    areaUnlocks: [],
    transportUnlocks: [],
    importantRewards: ["Excalibur", "6 Quest Points"],
    notes: "Excalibur is required for Holy Grail."
  },
  "holy grail": {
    prerequisiteQuests: ["Merlin's Crystal"],
    requiredItems: ["Excalibur"],
    rewardItems: [],
    xpRewards: ["11,000 Prayer XP", "15,300 Defence XP"],
    areaUnlocks: [],
    transportUnlocks: [],
    importantRewards: ["2 Quest Points", "11,000 Prayer XP", "15,300 Defence XP", "Fisher Realm access", "Black Knight Titan in Nightmare Zone"],
    notes: "Hard gate: Merlin's Crystal must be complete AND Excalibur must physically be owned before Holy Grail is recommended."
  },
  "tree gnome village": {
    prerequisiteQuests: [],
    requiredItems: ["6 logs"],
    rewardItems: [],
    xpRewards: ["11,450 Attack XP"],
    areaUnlocks: [],
    transportUnlocks: ["Spirit Trees"],
    importantRewards: ["11,450 Attack XP", "Spirit Tree transportation"],
    notes: "Required for Monkey Madness I."
  },
  "the grand tree": {
    prerequisiteQuests: [],
    requiredItems: [],
    rewardItems: [],
    xpRewards: ["18,400 Attack XP", "7,900 Agility XP", "2,150 Magic XP"],
    areaUnlocks: [],
    transportUnlocks: ["Gnome Gliders"],
    importantRewards: ["Gnome Glider transportation"],
    notes: "Required for Monkey Madness I."
  },
  "lost city": {
    prerequisiteQuests: [],
    requiredItems: [],
    rewardItems: ["Dramen staff"],
    xpRewards: [],
    areaUnlocks: ["Zanaris"],
    transportUnlocks: [],
    importantRewards: ["Access to Zanaris"],
    notes: ""
  },
  "priest in peril": {
    prerequisiteQuests: [],
    requiredItems: ["50 rune essence or pure essence"],
    rewardItems: [],
    xpRewards: [],
    areaUnlocks: ["Morytania"],
    transportUnlocks: [],
    importantRewards: ["Access to Morytania"],
    notes: ""
  },
  "nature spirit": {
    prerequisiteQuests: ["Priest in Peril", "The Restless Ghost"],
    requiredItems: ["Silver sickle"],
    rewardItems: [],
    xpRewards: [],
    areaUnlocks: ["Mort Myre Swamp progression"],
    transportUnlocks: [],
    importantRewards: ["Required for Fairy Ring quest chain"],
    notes: ""
  },
  "fairytale ii - cure a queen": {
    prerequisiteQuests: ["Fairytale I - Growing Pains"],
    requiredItems: ["Dramen staff"],
    rewardItems: [],
    xpRewards: [],
    areaUnlocks: [],
    transportUnlocks: ["Fairy Rings"],
    importantRewards: ["Fairy Ring network access after partial quest progress"],
    notes: "Full completion is not required to unlock the Fairy Ring network."
  },
  "monkey madness i": {
    prerequisiteQuests: ["Tree Gnome Village", "The Grand Tree"],
    requiredItems: [],
    rewardItems: [],
    xpRewards: ["Large selectable combat XP reward"],
    areaUnlocks: ["Ape Atoll progression"],
    transportUnlocks: [],
    importantRewards: ["Dragon scimitar access"],
    notes: ""
  },
  "bone voyage": {
    prerequisiteQuests: ["The Dig Site"],
    requiredItems: [],
    rewardItems: [],
    xpRewards: [],
    areaUnlocks: ["Fossil Island", "Ammonite crabs", "Birdhouse training"],
    transportUnlocks: [],
    importantRewards: ["Fossil Island access", "Ammonite crabs", "Birdhouse runs"],
    notes: "100 Kudos are also required."
  },
  "temple of the eye": {
    prerequisiteQuests: ["Rune Mysteries"],
    requiredItems: [],
    rewardItems: [],
    xpRewards: [],
    areaUnlocks: ["Guardians of the Rift"],
    transportUnlocks: [],
    importantRewards: ["Guardians of the Rift access"],
    notes: ""
  },
  "sins of the father": {
    prerequisiteQuests: [],
    requiredItems: [],
    rewardItems: [],
    xpRewards: [],
    areaUnlocks: ["Darkmeyer", "Hallowed Sepulchre"],
    transportUnlocks: [],
    importantRewards: ["Hallowed Sepulchre access"],
    notes: ""
  },
  "monkey madness ii": {
    prerequisiteQuests: ["Monkey Madness I"],
    requiredItems: [],
    rewardItems: [],
    xpRewards: ["80,000 Slayer XP", "60,000 Agility XP", "50,000 Thieving XP", "50,000 Hunter XP", "Combat XP rewards"],
    areaUnlocks: ["Kruk's Dungeon", "Maniacal monkeys"],
    transportUnlocks: [],
    importantRewards: ["Maniacal monkey training area"],
    notes: "Maniacal monkeys become available during/after the relevant quest progression."
  },
  "fishing contest": {
    prerequisiteQuests: [],
    requiredItems: ["Garlic", "Spade"],
    rewardItems: [],
    xpRewards: ["2,437 Fishing XP"],
    areaUnlocks: ["White Wolf Mountain underground passage"],
    transportUnlocks: ["White Wolf Mountain passage"],
    importantRewards: ["White Wolf Mountain passage"],
    notes: ""
  }
};

const TRAINING_ACCESS_RULES = {
  "sand crabs": {
    location:"Hosidius / Crabclaw area",
    questRequirements:[],
    skillRequirements:{},
    accessNote:"No quest prerequisite."
  },
  "ammonite crabs": {
    location:"Fossil Island",
    questRequirements:["Bone Voyage"],
    skillRequirements:{},
    accessNote:"Requires Fossil Island access."
  },
  "maniacal monkeys": {
    location:"Kruk's Dungeon, Ape Atoll",
    questRequirements:["Monkey Madness II"],
    skillRequirements:{"prayer":43},
    accessNote:"Requires access to Kruk's Dungeon through Monkey Madness II progression."
  },
  "hallowed sepulchre": {
    location:"Darkmeyer",
    questRequirements:["Sins of the Father"],
    skillRequirements:{"agility":52},
    accessNote:"Entering the Sepulchre requires Sins of the Father."
  },
  "guardians of the rift": {
    location:"Wizards' Tower",
    questRequirements:["Temple of the Eye"],
    skillRequirements:{"runecraft":27},
    accessNote:"Requires Temple of the Eye."
  },
  "birdhouse": {
    location:"Fossil Island",
    questRequirements:["Bone Voyage"],
    skillRequirements:{},
    accessNote:"Birdhouse training requires Fossil Island access."
  },
  "wintertodt": {
    location:"Wintertodt Camp, Great Kourend",
    questRequirements:[],
    skillRequirements:{"firemaking":50},
    accessNote:"No quest prerequisite; 50 Firemaking is required."
  },
  "giants' foundry": {
    location:"Giants' Foundry, Al Kharid",
    questRequirements:["Sleeping Giants"],
    skillRequirements:{"smithing":15},
    accessNote:"The activity is unlocked through Sleeping Giants."
  },
  "nightmare zone": {
    location:"Yanille",
    questRequirements:[],
    skillRequirements:{},
    accessNote:"Requires at least five qualifying quest bosses to be available; evaluated as conditional."
  }
};

function buildQuestIntelligenceState_(ss, roadmap) {
  ensureQuestIntelSheets_(ss);

  let catalogError='';
  let initialCatalog=readTable_(ss,'Quest Catalog');
  try {
    if(!initialCatalog.length) checkForNewQuests_(ss);
    else maybeCheckQuestCatalog_(ss);
  } catch(e) {
    catalogError=String(e&&e.message?e.message:e);
  }

  const questRows = readTable_(ss,'Quests');
  const questStatus = {};
  questRows.forEach(r => {
    if (r.Quest) questStatus[normalizeName_(r.Quest)] = String(r.Status||'').toUpperCase();
  });
  const stats={};
  readTable_(ss,'Stats').forEach(r=>stats[String(r.Skill||'').toLowerCase()]=Number(r.Level||1));

  const knowledgeRows = readTable_(ss,'Quest Knowledge');
  const knowledge = {};
  knowledgeRows.forEach(r => {
    const key=normalizeName_(r.Quest);
    if(!key)return;
    knowledge[key]={
      quest:r.Quest,
      prerequisiteQuests:safeJsonArray_(r['Prerequisite Quests']),
      requiredItems:safeJsonArray_(r['Required Items']),
      rewardItems:safeJsonArray_(r['Reward Items']),
      xpRewards:safeJsonArray_(r['XP Rewards']),
      areaUnlocks:safeJsonArray_(r['Area Unlocks']),
      transportUnlocks:safeJsonArray_(r['Transport Unlocks']),
      importantRewards:safeJsonArray_(r['Important Rewards']),
      rawRewards:String(r['Raw Rewards']||''),
      wikiUrl:String(r['Wiki URL']||''),
      lastChecked:String(r['Last Checked']||''),
      source:String(r.Source||'')
    };
  });

  Object.keys(QUEST_INTEL_SEED).forEach(k => {
    knowledge[k]=Object.assign({quest:titleFromKey_(k),source:'Verified seed'}, knowledge[k]||{}, QUEST_INTEL_SEED[k]);
  });

  // Use the same efficiency priority as Today's command card, not merely the next raw quest line.
  const efficientQuest=pickEfficientQuest_(questStatus,stats);
  const currentQuest=efficientQuest ? efficientQuest.name : findCurrentQuestName_(roadmap);
  const currentIntel=currentQuest ? getQuestIntelForName_(currentQuest,knowledge,questStatus) : null;

  const catalog=readTable_(ss,'Quest Catalog');
  const newQuests=catalog.filter(r=>String(r.Status||'').toUpperCase()==='NEW');

  return {
    currentQuest:currentIntel,
    currentQuestName:currentQuest,
    knowledge:knowledge,
    catalogCount:catalog.length,
    newQuestCount:newQuests.length,
    newQuests:newQuests.slice(0,8),
    catalogError:catalogError,
    lastCatalogCheck:PropertiesService.getScriptProperties().getProperty('QUEST_CATALOG_LAST_CHECK')||''
  };
}

function findCurrentQuestName_(roadmap) {
  if(roadmap.current && roadmap.current.type==='quest'){
    return String(roadmap.current.task||'').replace(/^Complete\s+/i,'').trim();
  }
  const open=(roadmap.next||[]).find(x=>x.type==='quest');
  return open ? String(open.task||'').replace(/^Complete\s+/i,'').trim() : '';
}

function getQuestIntelForName_(questName, knowledge, questStatus) {
  const key=normalizeName_(questName);
  const rec=knowledge[key]||QUEST_INTEL_SEED[key];
  if(!rec)return null;
  const prereqs=(rec.prerequisiteQuests||[]).map(q=>{
    const st=questStatus[normalizeName_(q)]||'NOT_STARTED';
    return {quest:q,status:st,complete:(st==='FINISHED'||st==='COMPLETE')};
  });
  return {
    quest:questName,
    prerequisiteQuests:prereqs,
    requiredItems:rec.requiredItems||[],
    rewardItems:rec.rewardItems||[],
    xpRewards:rec.xpRewards||[],
    areaUnlocks:rec.areaUnlocks||[],
    transportUnlocks:rec.transportUnlocks||[],
    importantRewards:rec.importantRewards||[],
    rewards:{
      items:rec.rewardItems||[],
      xp:rec.xpRewards||[],
      areas:rec.areaUnlocks||[],
      transport:rec.transportUnlocks||[],
      other:(rec.importantRewards||[]).filter(x=>
        !(rec.rewardItems||[]).includes(x) &&
        !(rec.xpRewards||[]).includes(x) &&
        !(rec.areaUnlocks||[]).includes(x) &&
        !(rec.transportUnlocks||[]).includes(x))
    },
    notes:rec.notes||'',
    wikiUrl:rec.wikiUrl||''
  };
}

function ensureQuestIntelSheets_(ss) {
  let catalog=ss.getSheetByName('Quest Catalog');
  if(!catalog){
    catalog=ss.insertSheet('Quest Catalog');
    catalog.getRange(1,1,1,7).setValues([['Quest','Quest Number','Release Date','Status','First Seen','Last Seen','Wiki URL']]);
  }
  let knowledge=ss.getSheetByName('Quest Knowledge');
  if(!knowledge){
    knowledge=ss.insertSheet('Quest Knowledge');
    knowledge.getRange(1,1,1,12).setValues([[
      'Quest','Prerequisite Quests','Required Items','Reward Items','XP Rewards',
      'Area Unlocks','Transport Unlocks','Important Rewards','Raw Rewards',
      'Wiki URL','Last Checked','Source'
    ]]);
  }

  // Seed verified high-value dependencies if they are absent.
  const existing={};
  readTable_(ss,'Quest Knowledge').forEach(r=>existing[normalizeName_(r.Quest)]=true);
  const rows=[];
  Object.keys(QUEST_INTEL_SEED).forEach(k=>{
    if(existing[k])return;
    const v=QUEST_INTEL_SEED[k];
    rows.push([
      titleFromKey_(k),
      JSON.stringify(v.prerequisiteQuests||[]),
      JSON.stringify(v.requiredItems||[]),
      JSON.stringify(v.rewardItems||[]),
      JSON.stringify(v.xpRewards||[]),
      JSON.stringify(v.areaUnlocks||[]),
      JSON.stringify(v.transportUnlocks||[]),
      JSON.stringify(v.importantRewards||[]),
      '',
      wikiPageUrl_(titleFromKey_(k)),
      new Date().toISOString(),
      'Verified seed'
    ]);
  });
  if(rows.length){
    knowledge.getRange(knowledge.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
  }
}

function titleFromKey_(k) {
  return String(k||'').split(' ').map(w=>w ? w.charAt(0).toUpperCase()+w.slice(1) : w).join(' ')
    .replace("Merlin'S","Merlin's");
}

function safeJsonArray_(v) {
  if(Array.isArray(v))return v;
  try {
    const a=JSON.parse(String(v||'[]'));
    return Array.isArray(a)?a:[];
  } catch(e){ return []; }
}

function wikiPageUrl_(name) {
  return 'https://oldschool.runescape.wiki/w/'+encodeURIComponent(String(name||'').replace(/ /g,'_'));
}

function wikiFetchJson_(params) {
  const qs=Object.keys(params).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(params[k])).join('&');
  const resp=UrlFetchApp.fetch(CONFIG.WIKI_API+'?'+qs,{
    headers:{'User-Agent':CONFIG.WIKI_USER_AGENT},
    muteHttpExceptions:true
  });
  if(resp.getResponseCode()!==200)throw new Error('OSRS Wiki API '+resp.getResponseCode());
  return JSON.parse(resp.getContentText());
}

function maybeCheckQuestCatalog_(ss) {
  const props=PropertiesService.getScriptProperties();
  const last=props.getProperty('QUEST_CATALOG_LAST_CHECK');
  if(last && (Date.now()-new Date(last).getTime()) < 20*60*60*1000)return;
  checkForNewQuests_();
}

function checkForNewQuests() {
  const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return checkForNewQuests_(ss);
}

function checkForNewQuests_(ss) {
  ensureQuestIntelSheets_(ss);
  const found=fetchWikiQuestCatalog_();
  const sh=ss.getSheetByName('Quest Catalog');
  const current=readTable_(ss,'Quest Catalog');
  const existing={};
  current.forEach((r,i)=>existing[normalizeName_(r.Quest)]={row:i+2,data:r});

  const now=new Date().toISOString();
  const newNames=[];
  found.forEach(q=>{
    const key=normalizeName_(q.name);
    if(!existing[key]){
      sh.appendRow([q.name,q.number,q.releaseDate,'NEW',now,now,wikiPageUrl_(q.name)]);
      newNames.push(q.name);
    }else{
      sh.getRange(existing[key].row,6).setValue(now);
    }
  });

  PropertiesService.getScriptProperties().setProperty('QUEST_CATALOG_LAST_CHECK',now);

  // Immediately ingest new quests so a release never sits as a bare name.
  newNames.slice(0,6).forEach(name=>{
    try { ingestQuestKnowledge_(ss,name); } catch(e) {}
  });

  return {ok:true,total:found.length,newQuests:newNames,checkedAt:now};
}

function fetchWikiQuestCatalog_() {
  const out=[];
  const seen={};

  const addCategory=(category)=>{
    let cont='';
    let guard=0;
    do {
      const params={
        action:'query',
        list:'categorymembers',
        cmtitle:'Category:'+category,
        cmnamespace:'0',
        cmtype:'page',
        cmlimit:'max',
        format:'json',
        formatversion:'2',
        origin:'*'
      };
      if(cont) params.cmcontinue=cont;
      const data=wikiFetchJson_(params);
      const members=(data.query&&data.query.categorymembers)||[];
      members.forEach(m=>{
        const name=String(m.title||'').trim();
        const key=normalizeName_(name);
        if(!name || seen[key])return;
        if(/^Quests?(\/|$)/i.test(name) || /^List of/i.test(name))return;
        seen[key]=true;
        out.push({number:'',name:name,releaseDate:''});
      });
      cont=(data.continue&&data.continue.cmcontinue)||'';
      guard++;
    } while(cont && guard<10);
  };

  // Categories are substantially less brittle than parsing the rendered quest table.
  addCategory('Quests');
  addCategory('Miniquests');

  // Fallback to the master list table if category membership unexpectedly returns nothing.
  if(!out.length){
    const data=wikiFetchJson_({action:'parse',page:'Quests/List',prop:'text',format:'json',formatversion:'2',origin:'*'});
    const html=(data.parse&&data.parse.text)||'';
    const links=html.match(/href="\/w\/([^"#?]+)"/gi)||[];
    links.forEach(raw=>{
      const m=raw.match(/href="\/w\/([^"#?]+)"/i);
      if(!m)return;
      const name=decodeURIComponent(m[1]).replace(/_/g,' ');
      const key=normalizeName_(name);
      if(!name || seen[key] || /^(Quests|Miniquests|Quest points|Quest experience rewards|Optimal quest guide)/i.test(name))return;
      seen[key]=true;
      out.push({number:'',name:name,releaseDate:''});
    });
  }

  return out.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
}

function stripHtml_(s) {
  return String(s||'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ')
    .replace(/&amp;/g,'&')
    .replace(/&#39;/g,"'")
    .replace(/&quot;/g,'"')
    .replace(/\s+/g,' ')
    .trim();
}

function refreshQuestKnowledgeBatch() {
  const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureQuestIntelSheets_(ss);
  const catalog=readTable_(ss,'Quest Catalog');
  const knowledge={};
  readTable_(ss,'Quest Knowledge').forEach(r=>knowledge[normalizeName_(r.Quest)]=true);
  const pending=catalog.map(r=>r.Quest).filter(q=>q && !knowledge[normalizeName_(q)]).slice(0,8);
  const done=[];
  pending.forEach(q=>{
    try{ ingestQuestKnowledge_(ss,q); done.push(q); }catch(e){}
  });
  return {ok:true,ingested:done,remaining:Math.max(0,catalog.length-Object.keys(knowledge).length-done.length)};
}

function ingestQuestKnowledge_(ss, questName) {
  const page=wikiFetchJson_({
    action:'parse',
    page:questName,
    prop:'wikitext',
    format:'json',
    formatversion:'2',
    origin:'*'
  });
  const wt=(page.parse&&page.parse.wikitext)||'';

  const rewards=extractWikiSection_(wt,'Rewards');
  const reqRendered=renderWikiTemplate_('{{Questreq|'+questName+'|quests}}');
  const skillRendered=renderWikiTemplate_('{{Questreq|'+questName+'|skills}}');

  const catalogNames=readTable_(ss,'Quest Catalog').map(r=>String(r.Quest||'')).filter(Boolean);
  const prereqs=catalogNames.filter(q=>q!==questName && new RegExp(escapeRegex_(q),'i').test(reqRendered));

  const requiredItems=extractQuestDetailsItems_(wt);
  const rewardItems=extractRewardItemsHeuristic_(rewards);
  const xpRewards=extractXpRewardsHeuristic_(rewards);
  const areaUnlocks=extractUnlocksHeuristic_(rewards,'area');
  const transportUnlocks=extractUnlocksHeuristic_(rewards,'transport');
  const important=[].concat(rewardItems,xpRewards,areaUnlocks,transportUnlocks).slice(0,12);

  upsertQuestKnowledgeRow_(ss,[
    questName,
    JSON.stringify(prereqs),
    JSON.stringify(requiredItems),
    JSON.stringify(rewardItems),
    JSON.stringify(xpRewards),
    JSON.stringify(areaUnlocks),
    JSON.stringify(transportUnlocks),
    JSON.stringify(important),
    cleanWikiText_(rewards).slice(0,8000),
    wikiPageUrl_(questName),
    new Date().toISOString(),
    'OSRS Wiki parser'
  ]);

  // If it was marked NEW, consider it integrated.
  const cat=ss.getSheetByName('Quest Catalog');
  const rows=readTable_(ss,'Quest Catalog');
  rows.forEach((r,i)=>{
    if(normalizeName_(r.Quest)===normalizeName_(questName))cat.getRange(i+2,4).setValue('KNOWN');
  });
}

function renderWikiTemplate_(text) {
  const data=wikiFetchJson_({
    action:'parse',
    text:text,
    contentmodel:'wikitext',
    prop:'text',
    format:'json',
    formatversion:'2',
    origin:'*'
  });
  return stripHtml_((data.parse&&data.parse.text)||'');
}

function extractWikiSection_(wt, heading) {
  const re=new RegExp('==\\s*'+escapeRegex_(heading)+'\\s*==([\\s\\S]*?)(?=\\n==[^=]|$)','i');
  const m=String(wt||'').match(re);
  return m?m[1].trim():'';
}

function extractQuestDetailsItems_(wt) {
  const block=String(wt||'').match(/\{\{Quest details([\s\S]*?)\n\}\}/i);
  if(!block)return [];
  const m=block[1].match(/\|\s*items\s*=\s*([\s\S]*?)(?=\n\|\s*\w+\s*=|$)/i);
  if(!m)return [];
  return extractWikiLinks_(m[1]).filter(x=>!/^File:/i.test(x)).slice(0,30);
}

function extractWikiLinks_(s) {
  const out=[],seen={};
  const re=/\[\[([^|\]#]+)(?:\|[^\]]*)?\]\]/g;
  let m;
  while((m=re.exec(String(s||'')))!==null){
    const v=m[1].trim();
    const k=normalizeName_(v);
    if(v && !seen[k]){seen[k]=true;out.push(v);}
  }
  return out;
}

function extractRewardItemsHeuristic_(s) {
  const links=extractWikiLinks_(s);
  return links.filter(x=>!/experience|quest point|quest|skill|access|music|kudos/i.test(x)).slice(0,12);
}

function extractXpRewardsHeuristic_(s) {
  const clean=cleanWikiText_(s);
  const matches=clean.match(/[\d,]+\s+(?:Attack|Strength|Defence|Ranged|Prayer|Magic|Hitpoints|Slayer|Agility|Construction|Cooking|Crafting|Farming|Firemaking|Fishing|Fletching|Herblore|Hunter|Mining|Runecraft|Sailing|Smithing|Thieving|Woodcutting)\s+(?:experience|XP)/gi)||[];
  return Array.from(new Set(matches)).slice(0,12);
}

function extractUnlocksHeuristic_(s, type) {
  const clean=cleanWikiText_(s);
  const bits=clean.split(/[\n.;]/).map(x=>x.trim()).filter(Boolean);
  if(type==='area')return bits.filter(x=>/access to|unlock(?:s|ed)? access|new area|city of|island|realm/i.test(x)).slice(0,8);
  return bits.filter(x=>/teleport|transport|fairy ring|spirit tree|glider|passage|shortcut/i.test(x)).slice(0,8);
}

function cleanWikiText_(s) {
  return String(s||'')
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/\{\{[^{}]*\}\}/g,' ')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g,'$2')
    .replace(/\[\[([^\]]+)\]\]/g,'$1')
    .replace(/'{2,}/g,'')
    .replace(/<[^>]+>/g,' ')
    .replace(/[ \t]+/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

function escapeRegex_(s){return String(s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

function upsertQuestKnowledgeRow_(ss,row) {
  const sh=ss.getSheetByName('Quest Knowledge');
  const rows=readTable_(ss,'Quest Knowledge');
  for(let i=0;i<rows.length;i++){
    if(normalizeName_(rows[i].Quest)===normalizeName_(row[0])){
      sh.getRange(i+2,1,1,row.length).setValues([row]);
      return;
    }
  }
  sh.appendRow(row);
}

function setupQuestCatalogWatcher() {
  ScriptApp.getProjectTriggers().forEach(t=>{
    if(t.getHandlerFunction()==='questCatalogWatcher')ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('questCatalogWatcher').timeBased().everyDays(1).atHour(6).create();
  return {ok:true,message:'Daily OSRS Wiki quest catalog watcher enabled.'};
}

function questCatalogWatcher() {
  const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  checkForNewQuests_(ss);
  refreshQuestKnowledgeBatch();
}

function buildQuestRewardItemSources_(questIntel) {
  const knowledge=(questIntel&&questIntel.knowledge)||{};
  const out={};
  Object.keys(knowledge).forEach(k=>{
    const rec=knowledge[k]||{};
    (rec.rewardItems||[]).forEach(item=>{
      const ik=normalizeItemName_(item);
      if(ik && !out[ik]) out[ik]={quest:rec.quest||titleFromKey_(k),item:item};
    });
  });
  Object.keys(QUEST_INTEL_SEED).forEach(k=>{
    const rec=QUEST_INTEL_SEED[k]||{};
    (rec.rewardItems||[]).forEach(item=>{
      const ik=normalizeItemName_(item);
      if(ik && !out[ik]) out[ik]={quest:titleFromKey_(k),item:item};
    });
  });
  return out;
}

function resolveQuestBlocker_(questName, questIntel, questStatus, owned) {
  const knowledge=(questIntel&&questIntel.knowledge)||{};
  const rec=knowledge[normalizeName_(questName)]||QUEST_INTEL_SEED[normalizeName_(questName)];
  if(!rec)return null;

  // Hard gate 1: prerequisite quests.
  const prereqs=rec.prerequisiteQuests||[];
  for(let i=0;i<prereqs.length;i++){
    const st=questStatus[normalizeName_(prereqs[i])]||'';
    if(!(st==='FINISHED'||st==='COMPLETE')){
      return {
        type:'QUEST',
        quest:prereqs[i],
        blocks:questName,
        reason:prereqs[i]+' must be completed before '+questName+'.'
      };
    }
  }

  // Hard gate 2: physical quest-reward items required by this quest.
  // Buyable/general supplies remain Shopping List concerns rather than roadmap blockers.
  const rewardSources=buildQuestRewardItemSources_(questIntel);
  const required=rec.requiredItems||[];
  for(let i=0;i<required.length;i++){
    const item=required[i];
    const source=rewardSources[normalizeItemName_(item)];
    if(!source)continue;

    const qty=findOwnedQty_(owned||{},item,[]);
    if(qty>0)continue;

    const sourceStatus=questStatus[normalizeName_(source.quest)]||'';
    if(!(sourceStatus==='FINISHED'||sourceStatus==='COMPLETE')){
      return {
        type:'QUEST',
        quest:source.quest,
        item:item,
        blocks:questName,
        reason:questName+' requires '+item+', which is obtained from '+source.quest+'.'
      };
    }

    return {
      type:'ITEM',
      item:item,
      sourceQuest:source.quest,
      blocks:questName,
      reason:item+' is required for '+questName+' but RuneLite cannot find it in your bank, inventory, or equipment.',
      action:itemRecoveryInstruction_(item,source.quest)
    };
  }

  return null;
}

function itemRecoveryInstruction_(item, sourceQuest) {
  const k=normalizeItemName_(item);
  if(k==='excalibur'){
    return 'Recover Excalibur from the Lady of the Lake south-east of Taverley before starting Holy Grail. Lost Excaliburs can be re-obtained for 500 GP.';
  }
  return 'Re-obtain '+item+' from its quest source ('+sourceQuest+') before continuing.';
}

function resolveQuestDependency_(questName, questIntel, questStatus) {
  const blocker=resolveQuestBlocker_(questName,questIntel,questStatus,{});
  return blocker&&blocker.type==='QUEST'?blocker.quest:null;
}

function evaluateTrainingAccess_(methodName, stats, questStatus) {
  const lower=String(methodName||'').toLowerCase();
  let rule=null, key='';
  Object.keys(TRAINING_ACCESS_RULES).some(k=>{
    if(lower.includes(k)){rule=TRAINING_ACCESS_RULES[k];key=k;return true;}
    return false;
  });
  if(!rule)return {status:'AVAILABLE',label:'Accessible',location:'See method',missing:[],note:'No known quest-gated area requirement.'};

  const missing=[];
  (rule.questRequirements||[]).forEach(q=>{
    const st=questStatus[normalizeName_(q)]||'';
    if(!(st==='FINISHED'||st==='COMPLETE'))missing.push(q);
  });
  Object.keys(rule.skillRequirements||{}).forEach(skill=>{
    const need=Number(rule.skillRequirements[skill]);
    if(Number(stats[skill]||1)<need)missing.push(title_(skill)+' '+need);
  });

  const conditional=key==='nightmare zone';
  return {
    status:missing.length?'LOCKED':(conditional?'CONDITIONAL':'AVAILABLE'),
    label:missing.length?'Locked':(conditional?'Check unlock':'Accessible'),
    location:rule.location,
    missing:missing,
    note:rule.accessNote
  };
}

function osrsXpForLevel_(level) {
  level=Math.max(1,Math.min(99,Number(level||1)));
  let points=0;
  for(let lvl=1;lvl<level;lvl++)points += Math.floor(lvl + 300*Math.pow(2,lvl/7));
  return Math.floor(points/4);
}

function parseXpRateRange_(s) {
  const text=String(s||'').toLowerCase().replace(/,/g,'');
  const nums=[];
  const re=/(\d+(?:\.\d+)?)\s*(k|m)?/g;
  let m;
  while((m=re.exec(text))!==null){
    let v=Number(m[1]);
    if(m[2]==='k')v*=1000;
    if(m[2]==='m')v*=1000000;
    if(v>=1000)nums.push(v);
  }
  if(!nums.length)return null;
  return {low:Math.min.apply(null,nums),high:Math.max.apply(null,nums)};
}

function calculateMethodHours_(current,target,xpHr) {
  if(!target || target<=current)return '';
  const rate=parseXpRateRange_(xpHr);
  if(!rate)return '';
  const xp=Math.max(0,osrsXpForLevel_(target)-osrsXpForLevel_(current));
  const fast=xp/rate.high, slow=xp/rate.low;
  if(!isFinite(fast)||!isFinite(slow))return '';
  if(Math.abs(slow-fast)<0.15)return '~'+slow.toFixed(1)+'h';
  return '~'+fast.toFixed(1)+'â€“'+slow.toFixed(1)+'h';
}

function methodTitleFromDescription_(description,label,skill,current,target) {
  const d=String(description||'').toLowerCase();
  if(d.includes('sand crab'))return 'Sand Crabs';
  if(d.includes('ammonite crab'))return 'Ammonite Crabs';
  if(d.includes('maniacal monkey')||d.includes('chinchompa'))return 'Chinchompas / Maniacal Monkeys';
  if(d.includes('chaos altar'))return 'Chaos Altar';
  if(d.includes('gilded altar'))return 'Gilded Altar';
  if(d.includes('ensouled'))return 'Ensouled Heads / Bone Shards';
  if(d.includes("giants' foundry"))return "Giants' Foundry";
  if(d.includes('motherlode'))return 'Motherlode Mine';
  if(d.includes('shooting star'))return 'Shooting Stars';
  if(d.includes('wintertodt'))return 'Wintertodt';
  if(d.includes('guardians of the rift'))return 'Guardians of the Rift';
  if(d.includes('lava rune'))return 'Lava Runes';
  if(d.includes('birdhouse'))return 'Birdhouse Runs';
  if(d.includes('hallowed sepulchre'))return 'Hallowed Sepulchre';
  if(d.includes('mahogany homes'))return 'Mahogany Homes';
  if(d.includes('barbarian fishing'))return 'Barbarian Fishing';
  if(d.includes('tempoross'))return 'Tempoross';
  if(d.includes('blackjack'))return 'Blackjacking';
  if(d.includes('slayer'))return title_(skill)+' through Slayer';
  if(d.includes('crabs'))return 'Crab Training';
  if(d.includes('high level alchemy')||d.includes('high alch'))return 'High Level Alchemy';
  if(d.includes('burst')||d.includes('barrage'))return 'Burst / Barrage';
  return String(label||'Training Method').replace(/^.*?\s/,'').replace(' / ',' / ');
}

function actionableInstructions_(skill, methodTitle, description, current, target, access) {
  const m=String(methodTitle||'').toLowerCase();
  const defaults={
    goTo:access.location||'Training location in the method description',
    bring:'Your best appropriate gear plus the supplies described below.',
    doThis:String(description||'Follow the training method.'),
    stopAt:target ? title_(skill)+' '+target : 'the next roadmap checkpoint'
  };

  if(m.includes('sand crab')){
    return {goTo:'Sand Crabs in Hosidius / Crabclaw area',
      bring:'Your best fast Ranged weapon, cheap ammunition, and Avaâ€™s device once unlocked.',
      doThis:'Use Rapid. Find a 2â€“3 crab spot, turn Auto Retaliate on, and let the crabs attack you. When they stop being aggressive, run far enough away to reset aggression and return.',
      stopAt:'Ranged '+target};
  }
  if(m.includes('chaos altar')){
    return {goTo:'Chaos Temple in level 38 Wilderness',
      bring:'Small inventories of bones only. Bring nothing you are unwilling to lose.',
      doThis:'Use each bone on the altar. The altar can preserve bones, giving much better GP/XP. Bank/regear in small trips because PK deaths are possible.',
      stopAt:'Prayer '+target};
  }
  if(m.includes('gilded altar')){
    return {goTo:'A hosted player-owned house with a lit gilded altar',
      bring:'Your chosen bones and teleports for fast banking.',
      doThis:'Use bones on the lit altar continuously, bank, and repeat. This is the straightforward high-cost option with no Wilderness risk.',
      stopAt:'Prayer '+target};
  }
  if(m.includes('slayer')){
    return {goTo:'Your current Slayer assignment',
      bring:'Best gear for the combat style you are training, food, and sensible potions.',
      doThis:'Train this skill on Slayer tasks instead of a separate grind. Use cannon/bursting only when the task makes the time savings worthwhile.',
      stopAt:title_(skill)+' '+target};
  }
  if(m.includes('crab training')){
    return {goTo:'Sand Crabs now; Ammonite Crabs after Fossil Island is unlocked',
      bring:'Best inexpensive DPS setup with enough supplies for a long AFK session.',
      doThis:'Use Auto Retaliate on low-defence crabs. Reset aggression when needed. Do not pay for expensive consumables just to AFK.',
      stopAt:title_(skill)+' '+target};
  }
  if(m.includes("giants' foundry")){
    return {goTo:"Giants' Foundry in Al Kharid",
      bring:'Metal bars/items for your chosen alloy. Use the best moulds you have unlocked.',
      doThis:'Complete sword commissions by following the temperature and tool prompts. Prioritize good alloy value rather than expensive bars for tiny XP gains.',
      stopAt:'Smithing '+target};
  }
  if(m.includes('motherlode')){
    return {goTo:'Motherlode Mine',
      bring:'Your best pickaxe; Prospector pieces as you unlock them.',
      doThis:'Mine pay-dirt, clean it through the hopper, collect ore, and spend nuggets on useful unlocks. Switch to faster active mining only if a quest level is immediately blocking you.',
      stopAt:'Mining '+target};
  }
  if(m.includes('shooting star')){
    return {goTo:'A currently active Shooting Star',
      bring:'Your best pickaxe.',
      doThis:'Mine the star until it depletes, then move to another callout. This is intentionally the low-attention choice.',
      stopAt:'Mining '+target};
  }
  if(m.includes('wintertodt')){
    return {goTo:'Wintertodt Camp',
      bring:'Warm clothing, food, tinderbox, axe, and knife if fletching roots.',
      doThis:'Join a mass world or solo setup, chop bruma roots, optionally fletch, and feed the brazier while keeping your health safe.',
      stopAt:'Firemaking '+target};
  }
  if(m.includes('guardians')){
    return {goTo:"Guardians of the Rift portal in the Wizards' Tower",
      bring:'Pickaxe, chisel, and your best essence pouches/outfit as unlocked.',
      doThis:'Mine essence, craft guardian essence, enter active altars, and power the Great Guardian. Spend rewards progressively instead of waiting until the end.',
      stopAt:'Runecraft '+target};
  }
  if(m.includes('birdhouse')){
    return {goTo:'Fossil Island birdhouse spots',
      bring:'Four clockworks/birdhouses, appropriate logs, and seeds.',
      doThis:'Complete a birdhouse circuit whenever the houses are ready. Replace each house immediately. Do this between normal goals rather than as one continuous grind.',
      stopAt:'Hunter '+target};
  }
  if(m.includes('hallowed')){
    return {goTo:'Hallowed Sepulchre in Darkmeyer',
      bring:'Graceful/light gear, stamina support as needed, and optional coffin tools.',
      doThis:'Run the highest floor you can access. Focus on clean obstacle completion first; loot only when it does not destroy the XP rate you want.',
      stopAt:'Agility '+target};
  }
  if(m.includes('high level alchemy')){
    return {goTo:'Anywhere you can safely multitask',
      bring:'Nature runes, fire source, and items with a checked profitable/low-loss alch margin.',
      doThis:'Cast High Level Alchemy while doing compatible low-click activities. Check margins before buying a large stack.',
      stopAt:'Magic '+target};
  }

  return defaults;
}
function buildFullShoppingLibrary_(ss, shoppingState) {
  const parsed = getParsedQuestShopping_();
  const owned = buildOwnedItemIndex_(ss);
  const questRows = readTable_(ss,'Quests');
  const questStatus = {};
  questRows.forEach(r => {
    if (r.Quest) questStatus[normalizeName_(r.Quest)] = String(r.Status||'').toUpperCase();
  });

  const wanted = {};
  parsed.quests.forEach(q => {
    q.items.forEach(it => {
      const req = parseShoppingRequirement_(it.raw);
      if (req.trackable && req.name) wanted[normalizeItemName_(req.name)] = req.name;
    });
  });

  const prices = getLiveQuestPriceIndex_(Object.keys(wanted));
  let totalMissingCost = 0;
  let exactLines = 0;
  let readyLines = 0;

  const quests = parsed.quests.map(q => {
    const qkey = normalizeName_(q.quest);
    const st = questStatus[qkey] || '';
    const completed = st === 'FINISHED' || st === 'COMPLETE';
    let questMissingCost = 0;
    let questExact = 0;
    let questReady = 0;

    const items = q.items.map(it => {
      const req = parseShoppingRequirement_(it.raw);
      if (!req.trackable) {
        return {
          raw:it.raw, name:req.name, required:req.required,
          owned:null, missing:null, status:'VARIABLE',
          trackable:false, unitPrice:null, missingCost:null
        };
      }

      questExact++;
      exactLines++;
      const ownQty = findOwnedQty_(owned, req.name, req.aliases);
      const missing = Math.max(0, req.required - ownQty);
      if (missing === 0) {
        questReady++;
        readyLines++;
      }

      const pk = normalizeItemName_(req.name);
      const priceObj = prices[pk] || null;
      const unitPrice = priceObj ? Number(priceObj.buy || priceObj.sell || 0) : 0;
      const missingCost = missing > 0 && unitPrice > 0 ? missing * unitPrice : 0;
      questMissingCost += missingCost;
      totalMissingCost += missingCost;

      return {
        raw:it.raw,
        name:req.name,
        required:req.required,
        owned:ownQty,
        missing:missing,
        status:missing===0?'OWNED':'MISSING',
        trackable:true,
        itemId:priceObj ? priceObj.id : null,
        unitPrice:unitPrice || null,
        sellPrice:priceObj ? Number(priceObj.sell||0) : null,
        missingCost:missingCost || null,
        priceTime:priceObj ? priceObj.time : null
      };
    });

    return {
      quest:q.quest,
      completed:completed,
      questStatus:st || 'NOT_STARTED',
      subtotal:q.subtotal,
      items:items,
      exactReady:questReady,
      exactTotal:questExact,
      variableCount:items.filter(x=>!x.trackable).length,
      missingCount:items.filter(x=>x.trackable && x.missing>0).length,
      liveMissingCost:questMissingCost,
      readiness:questExact ? Math.round(questReady/questExact*100) : 0
    };
  });

  return {
    source:'Sensum - OSRS Quest Shopping List',
    priceSource:'RuneScape Wiki / RuneLite real-time prices',
    priceUpdatedAt:new Date().toISOString(),
    totalQuests:quests.length,
    exactReady:readyLines,
    exactTotal:exactLines,
    totalMissingCost:totalMissingCost,
    quests:quests
  };
}

function getLiveQuestPriceIndex_(wantedNames) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'questLivePricesV1';
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      const obj=JSON.parse(cached);
      let hasAny=false;
      (wantedNames||[]).forEach(n=>{ if(obj[n]) hasAny=true; });
      if (hasAny) return obj;
    } catch(e) {}
  }

  const headers = {
    'User-Agent':'SensumOSRSDashboard/0.7 - private personal OSRS account dashboard'
  };

  try {
    const responses = UrlFetchApp.fetchAll([
      {url:'https://prices.runescape.wiki/api/v1/osrs/mapping', method:'get', headers:headers, muteHttpExceptions:true},
      {url:'https://prices.runescape.wiki/api/v1/osrs/latest', method:'get', headers:headers, muteHttpExceptions:true}
    ]);

    if (responses[0].getResponseCode() !== 200 || responses[1].getResponseCode() !== 200) return {};

    const mapping = JSON.parse(responses[0].getContentText());
    const latest = JSON.parse(responses[1].getContentText()).data || {};
    const wanted = {};
    (wantedNames||[]).forEach(n=>wanted[normalizeItemName_(n)]=true);

    const out = {};
    mapping.forEach(entry => {
      const nk=normalizeItemName_(entry.name);
      if (!wanted[nk]) return;
      const p=latest[String(entry.id)] || latest[entry.id] || {};
      out[nk]={
        id:Number(entry.id),
        name:entry.name,
        buy:p.high == null ? null : Number(p.high),
        sell:p.low == null ? null : Number(p.low),
        time:p.highTime || p.lowTime || null
      };
    });

    // Keep cache safely below Apps Script per-key limit.
    const serialized=JSON.stringify(out);
    if (serialized.length < 95000) cache.put(cacheKey,serialized,300);
    return out;
  } catch(e) {
    return {};
  }
}


/* ============================
   VERIFIED TRAINING PROFILES
   ============================ */

function verifiedTrainingProfile_(skill,current,target,stats,questStatus) {
  target = Number(target || defaultVerifiedTarget_(skill,current));
  const qdone = q => {
    const s=questStatus[normalizeName_(q)]||'';
    return s==='FINISHED'||s==='COMPLETE';
  };
  const access = (location, quests, note, extraMissing) => {
    const missing=(quests||[]).filter(q=>!qdone(q)).concat(extraMissing||[]);
    return {
      status:missing.length?'LOCKED':'AVAILABLE',
      location:location,
      missing:missing,
      note:note||''
    };
  };
  const M = (title, category, xpHr, gpHr, from, to, acc, goTo, bring, doThis, stopAt, sourceNote) => ({
    methodTitle:title,
    category:category,
    verified:true,
    appliesFrom:from,
    appliesTo:to,
    xpHr:xpHr,
    gpHr:gpHr,
    accountHours:(typeof xpHr==='string' && /\d/.test(xpHr)) ? calculateMethodHours_(current,Math.min(target,to||target),xpHr) : 'Varies',
    access:acc,
    instructions:{goTo:goTo,bring:bring,doThis:doThis,stopAt:stopAt||title_(skill)+' '+target},
    sourceNote:sourceNote||'Current OSRS Wiki training guidance; rates intentionally omitted where they are not stable.'
  });

  let p=null;

  if(skill==='ranged'){
    const cannon=qdone('Dwarf Cannon');
    const mm2=qdone('Monkey Madness II');
    const prayer=Number(stats.prayer||1);
    p={
      fastest:M('Dwarf multicannon + fast Ranged weapon','FASTEST / HIGH-COST',
        'Placement/gear dependent','High cannonball cost',current,Math.min(target,45),
        access('Cannonable multi-combat training spot',cannon?[]:['Dwarf Cannon'],'Sand Crabs cannot be cannoned.'),
        'Use a proven cannonable location such as caged ogres, rock crabs, or another legal cannon spot.',
        'Dwarf multicannon, cannonballs, and your best fast Ranged weapon.',
        'Attack normally while the cannon adds extra damage and Ranged XP. Move to a better method when your next weapon/training unlock arrives.',
        target>45?'Ranged 45, then reassess the fastest 45+ method':'Ranged '+target,
        'OSRS Wiki: multicannon is fastest early Ranged training up to about 45; exact XP/hr depends heavily on placement.'),
      recommended:M('Sand Crabs â€” fast weapon progression','RECOMMENDED',
        'DPS/gear dependent','Lowâ€“moderate ammo cost',current,target,
        access('Sand Crabs, Hosidius / Crabclaw area',[],'No quest prerequisite.'),
        'Sand Crabs in Hosidius / Crabclaw area.',
        'Adamant darts are usable at 30 Ranged. At 40, rune darts and yew shortbow + rune arrows become available. Avaâ€™s device is strongly useful after Animal Magnetism.',
        'Use Rapid and Auto Retaliate. Hold a 2â€“3 crab spot and reset aggression when needed. Upgrade your fast weapon at level 40.',
        'Ranged '+target,
        'OSRS Wiki: fast weapons and low-defence crabs are reliable ordinary Ranged training; weapon unlocks are level-gated.'),
      lowCost:M('Dorgeshuun crossbow + bone bolts','LOW-COST / EFFICIENT',
        'Lower than fast darts/shortbows','Very low ammo cost',current,target,
        access('Sand Crabs or another low-defence target',[],'Crossbow requires 28 Ranged; no Lost Tribe completion is required to equip a traded crossbow.'),
        'Use Sand Crabs or another low-defence AFK target.',
        'Dorgeshuun crossbow and a large stack of bone bolts.',
        'Use Rapid and train continuously. This sacrifices speed for extremely cheap ammunition.',
        'Ranged '+target,
        'OSRS Wiki: Dorgeshuun crossbow is a popular low-cost Ranged training weapon.')
    };
    p.futureUnlocks=[
      {level:40,text:'Rune darts and yew shortbow + rune arrows unlock.'},
      {level:45,text:'Chinchompas become wieldable. Maniacal-monkey chinning additionally needs Monkey Madness II/Krukâ€™s Dungeon progression and 43 Prayer.',locked:!(mm2&&prayer>=43),missing:[].concat(mm2?[]:['Monkey Madness II progression'],prayer>=43?[]:['Prayer 43'])},
      {level:50,text:'Magic shortbow / magic shortbow (i) becomes available.'}
    ];
  }

  if(skill==='prayer'){
    p={
      fastest:M('Gilded altar + best affordable bones','FASTEST / HIGH-COST',
        'Up to ~642k/hr with dragon bones at 2,550 bones/hr','High; bone-price dependent',current,target,
        access('Hosted player-owned house gilded altar',[],'You do not need 75 Construction if using another playerâ€™s hosted altar.'),
        'Use a hosted POH world and enter a house with a lit gilded altar.',
        'The best bones you are comfortable paying for plus a fast bank/house route.',
        'Manually use bones on the altar for maximum speed. Both incense burners must be lit for 350% bone XP.',
        'Prayer '+target,
        'OSRS Wiki: gilded altar is the fastest standard Prayer method; the Wiki comparison assumes 2,550 bones/hour.'),
      recommended:M('Chaos altar + dragon bones','RECOMMENDED',
        'Up to ~504k/hr offering 2,000 bones/hr','About half the bone cost per XP; Wilderness risk',current,target,
        access('Chaos Temple, level 38 Wilderness',[],'Wilderness PvP risk; bring small inventories if you want to minimise losses.'),
        'Chaos Temple in the Wilderness.',
        'Small bone inventories, a Wilderness teleport route, and nothing you are unwilling to lose.',
        'Offer bones manually. The altar has a 50% chance not to consume each bone, effectively doubling XP per bone over time.',
        'Prayer '+target,
        'OSRS Wiki: Chaos altar is only slightly slower than a gilded altar and effectively doubles experience per bone.'),
      lowCost:M('Quest XP first, then Ectofuntus / passive Prayer','LOW-COST / EFFICIENT',
        'Slow; quest/passive method','Low',current,target,
        access('Quest route / Ectofuntus',[],'Holy Grail is particularly valuable after Merlinâ€™s Crystal because it awards 11,000 Prayer XP.'),
        'Complete efficient Prayer-XP quests before buying a large bone stack.',
        'Quest shopping supplies; use Ectofuntus/passive bonecrusher methods only if saving GP matters more than time.',
        'Take free quest XP first. Finish the remaining gap with a low-cost bone method.',
        'Prayer '+target,
        'OSRS Wiki: early Prayer can be skipped substantially with The Restless Ghost, Priest in Peril, Recruitment Drive, and Holy Grail.')
    };
  }

  if(skill==='attack' || skill==='strength' || skill==='defence'){
    const gemstoneMissing=qdone('Children of the Sun')?[]:['Children of the Sun'];
    const statName=title_(skill);
    p={
      fastest:M('Quest XP â†’ highest-DPS crab / Gemstone Crab','FASTEST / HIGH-COST',
        'DPS-dependent','Lowâ€“moderate supply cost',current,target,
        access('Crab training; Gemstone Crab in Tlati when unlocked',[], 'Waterfall Quest is the key early Attack/Strength skip.',[]),
        current<30?'Complete high-value combat XP quests first.':'Use a high-HP, low-defence crab target.',
        'Best weapon for your Attack level, strength-boosting gear, and optional combat potions.',
        (skill==='defence'?'Use the defensive melee style only when Defence is the specific target. ':'Use the style that trains '+statName+'. ')+'Prioritise damage output.',
        statName+' '+target,
        'OSRS Wiki: Waterfall Quest skips early Attack/Strength; levels 30â€“50 are commonly trained on crabs.'),
      recommended:M('Crabs now â†’ Slayer/NMZ later','RECOMMENDED',
        'DPS-dependent','Low',current,target,
        access('Sand Crabs now; Ammonite Crabs after Bone Voyage',[],'Ammonite Crabs require Bone Voyage.'),
        'Use Sand Crabs until a better account-efficient combat activity is unlocked.',
        'Best current melee weapon and strength gear.',
        'Train consistently on low-defence targets. Shift more combat training into Slayer as Slayer becomes important to the roadmap.',
        statName+' '+target,
        'OSRS Wiki: crabs are efficient low-level melee training; Slayer combines combat progress with Slayer progress.'),
      lowCost:M('Combat through Slayer','LOW-COST / EFFICIENT',
        'Task-dependent','Often low/net profitable',current,target,
        access('Current Slayer assignment',[],'Use your best available Slayer master.'),
        'Your current Slayer task.',
        'Normal melee setup; avoid expensive cannon/potions unless the time saved is worth it.',
        'Train '+statName+' while completing Slayer tasks so one session advances two account goals.',
        statName+' '+target,
        'OSRS Wiki: Slayer tasks are an effective way to train combat while gaining Slayer experience/profit.')
    };
  }

  if(skill==='hitpoints'){
    p={
      fastest:M('Train through your fastest combat style','FASTEST / HIGH-COST',
        '1.33 Hitpoints XP per direct damage','Depends on combat method',current,target,
        access('Any high-DPS combat training area',[],'Hitpoints is normally not trained alone.'),
        'Use the best currently available Ranged, Magic, or melee training method.',
        'The gear/supplies for that combat method.',
        'Deal damage normally; each direct damage point yields Hitpoints XP.',
        'Hitpoints '+target,
        'OSRS Wiki: Hitpoints is rarely trained independently; direct damage grants 1.33 Hitpoints XP per damage.'),
      recommended:M('Let Hitpoints rise passively with combat goals','RECOMMENDED',
        'Passive with combat','No extra cost',current,target,
        access('Current combat objective',[],'Recommended unless a quest has a hard Hitpoints requirement.'),
        'Do your current Ranged/melee/Magic objective.',
        'Normal combat supplies.',
        'Do not create a separate Hitpoints grind unless a requirement forces it.',
        'Hitpoints '+target,
        'OSRS Wiki: ordinary combat naturally trains Hitpoints.'),
      lowCost:M('Slayer combat','LOW-COST / EFFICIENT',
        'Task-dependent','Often low/net profitable',current,target,
        access('Current Slayer assignment',[],'Combines Slayer + combat + Hitpoints.'),
        'Current Slayer task.',
        'Budget combat gear.',
        'Complete tasks using a direct-damage combat style.',
        'Hitpoints '+target,
        'Macro-efficient account progression.')
    };
  }

  if(skill==='magic'){
    p={
      fastest:M(current<55?'Elemental weakness / jewellery enchanting':'Burst or barrage multi-target monsters','FASTEST / HIGH-COST',
        current<55?'~50kâ€“200k+/hr depending spell/enchant':'High; target/gear dependent','High rune cost',current,target,
        access(current<55?'Appropriate weakness target / GE enchanting':'Multi-target burst/barrage area',[],current<55?'Elemental weaknesses can greatly increase cheap spell damage.':'Ancient Magicks requires Desert Treasure I for burst/barrage spells.'),
        current<55?'Use an accessible monster with a strong elemental weakness or enchant jewellery at your current spell tier.':'Use a legal stacked multi-target location after unlocking Ancient Magicks.',
        'Runes and a staff matching your chosen spell.',
        'Cast continuously. Do not buy a large jewellery stack without checking current margins.',
        'Magic '+target,
        'OSRS Wiki: early Magic can use enchanting/weaknesses; higher-level active training uses multi-target burst/barrage.'),
      recommended:M(current<55?'Combat spells on crabs / elemental weakness':'High Level Alchemy + active combat','RECOMMENDED',
        current<55?'Spell/target dependent':'78k/hr for continuous High Alchemy; active combat can be faster','Low to moderate',current,target,
        access('Accessible crab or weakness target',[],'High Level Alchemy unlocks at 55 Magic.'),
        current<55?'Use crabs for low attention or a monster with an elemental weakness for better damage.':'Alch while doing compatible activities; use combat when actively training.',
        'Best elemental staff/runes you can afford.',
        current<55?'Use your best sensible combat spell; Fire Strike remains a budget choice.':'High Alch noted items with checked margins or train actively with combat spells.',
        'Magic '+target,
        'OSRS Wiki: High Level Alchemy gives 65 XP every 5 ticks from 55+ and can often be profitable.'),
      lowCost:M(current<55?'Fire Strike / profitable enchanting':'Profitable High Alchemy','LOW-COST / EFFICIENT',
        'Lower/market-dependent','Low or profitable',current,target,
        access('Anywhere / accessible target',[],'Check GE margins before bulk buying.'),
        'Use a safe target or stand at a bank/GE for enchanting/alching.',
        'Low-cost runes and only items with checked margins.',
        'Optimise GP first, accepting a lower XP rate.',
        'Magic '+target,
        'OSRS Wiki provides profitable enchanting/alchemy routes but margins change with the GE.')
    };
  }

  if(skill==='slayer'){
    p={
      fastest:M('Highest suitable Slayer master + cannon/burst when appropriate','FASTEST / HIGH-COST',
        'Task-dependent','Potentially high',current,target,
        access('Assigned Slayer locations',[],'Cannon/burst only on tasks where they materially improve the rate.'),
        'Take tasks from the highest master you meet and can complete efficiently.',
        'Task-specific gear, optional cannon/runes/potions.',
        'Skip/block poor tasks only when your points allow. Cannon multi-target tasks and burst/barrage stackable tasks when unlocked.',
        'Slayer '+target,
        'Slayer XP/hr has no single correct universal value because it depends on task mix and unlocks.'),
      recommended:M('Efficient task streaks with your best available master','RECOMMENDED',
        'Task-dependent','Usually sustainable',current,target,
        access('Current Slayer master',[],'For your account, combat stats and available masters determine the route.'),
        'Use the best Slayer master currently available.',
        'Normal task gear; Slayer helm/black mask when unlocked.',
        'Complete efficient tasks, preserve points, and upgrade your task list over time.',
        'Slayer '+target,
        'Current OSRS training guidance: Slayer is task-mix dependent; avoid pretending one XP/hr fits all accounts.'),
      lowCost:M('No-cannon / budget task completion','LOW-COST / EFFICIENT',
        'Slower; task-dependent','Low/net profitable',current,target,
        access('Current Slayer assignments',[],'No special access beyond the assigned monster.'),
        'Complete normal assignments.',
        'Budget food and normal combat equipment.',
        'Avoid cannonballs and expensive potions; bank valuable drops.',
        'Slayer '+target,
        'Budget route trades speed for lower operating cost.')
    };
  }

  if(skill==='agility'){
    p={
      fastest:M(current<30?'Quest XP + early courses':'Best unlocked high-XP Agility course','FASTEST / HIGH-COST',
        'Course/level dependent','Near-zero',current,target,
        access(current<10?'Gnome Stronghold Agility Course':'Best unlocked course',[],'Agility training is mostly access/level gated rather than GP gated.'),
        current<10?'Start at Gnome Stronghold; use quest XP where it saves substantial early laps.':'Use the highest effective course for your current bracket.',
        'Weight-reducing gear and stamina support if useful.',
        'Run laps cleanly; move courses when the next course materially improves XP/hr.',
        'Agility '+target,
        'Current OSRS Agility progression is course-bracket based; exact rates depend on failures and course.'),
      recommended:M(current<10?'Gnome Stronghold â†’ Draynor Rooftop':'Rooftop courses for Marks of grace','RECOMMENDED',
        'Course/level dependent','Near-zero',current,target,
        access(current<10?'Gnome Stronghold':'Current rooftop course',[],'Draynor rooftop unlocks at 10 Agility.'),
        current<10?'Gnome Stronghold until 10, then Draynor rooftop.':'Use your best sensible rooftop course.',
        'Light gear; food only if the course can damage you.',
        'Run rooftop laps and collect Marks of grace for Graceful.',
        'Agility '+target,
        'Rooftops provide useful Marks of grace while training.'),
      lowCost:M('Rooftop / low-input course','LOW-COST / EFFICIENT',
        'Lowerâ€“moderate','~0 GP',current,target,
        access('Best easy course for your level',[],'Choose consistency over tick-perfect methods.'),
        'Your easiest unlocked rooftop/course.',
        'Minimal equipment.',
        'Run laps at a sustainable pace.',
        'Agility '+target,
        'No need to spend GP to train ordinary Agility.')
    };
  }

  if(skill==='construction'){
    const daddy=qdone("Daddy's Home");
    p={
      fastest:M(current<33?'Quest/Daddyâ€™s Home â†’ best furniture':'Oak larders / higher-tier furniture','FASTEST / HIGH-COST',
        'Furniture-dependent','High plank cost',current,target,
        access('Player-owned house',[],'Buy a house from an estate agent; Daddyâ€™s Home is valuable early Construction XP.'),
        'Your POH in building mode.',
        'Planks, nails when needed, hammer/saw; use a servant at higher levels for faster banking.',
        'Build and remove the highest practical fast furniture repeatedly.',
        'Construction '+target,
        'Fast Construction is plank-intensive and expensive; exact rate depends on furniture/servant/click speed.'),
      recommended:M('Mahogany Homes','RECOMMENDED',
        'Contract/level dependent','Much lower GP/XP than spam-building',current,target,
        access('Mahogany Homes contract locations',[],'Contracts scale with Construction level.'),
        'Speak to Amy in Falador and take the appropriate contract tier.',
        'Required planks, steel bars when needed, hammer, saw, teleports.',
        'Complete contracts, repair/build the marked furniture, then take the next contract.',
        'Construction '+target,
        'Mahogany Homes is the standard cost-effective Construction alternative.'),
      lowCost:M('Daddyâ€™s Home / Mahogany Homes with cheaper planks','LOW-COST / EFFICIENT',
        'Lower','Lowâ€“moderate',current,target,
        access('Varrock / Mahogany Homes',[],daddy?'Daddyâ€™s Home already complete or available as prior XP.':'Daddyâ€™s Home provides early Construction XP and should be completed.'),
        current<10?'Complete Daddyâ€™s Home, then transition to cheap contracts.':'Use lower-cost Mahogany Homes contracts.',
        'Cheap planks and quest/contract supplies.',
        'Prioritise XP-per-GP rather than maximum clicks/hour.',
        'Construction '+target,
        'Correctness-first route; exact GP/hr follows current plank prices.')
    };
  }

  if(skill==='crafting'){
    p={
      fastest:M('Cut gems / highest practical fast Crafting item','FASTEST / HIGH-COST',
        'Item/level dependent','Usually high loss',current,target,
        access('Grand Exchange / bank',[],'Gem and material prices fluctuate.'),
        'Bank or Grand Exchange.',
        'The fastest item you can currently make after checking live GP/XP.',
        'Process items continuously and sell outputs.',
        'Crafting '+target,
        'Crafting fastest methods change by level and GE price; do not lock a stale universal GP/hr.'),
      recommended:M('Molten glass â†’ glassblowing progression','RECOMMENDED',
        'Product/level dependent','Lowâ€“moderate',current,target,
        access('Bank',[],'Glassblowing is available from low levels and scales through multiple products.'),
        'Any bank.',
        'Molten glass and a glassblowing pipe.',
        'Blow the highest sensible glass product for your current level.',
        'Crafting '+target,
        'Stable cost-effective Crafting path; exact rates vary by product.'),
      lowCost:M('Profit-aware jewellery / glass','LOW-COST / EFFICIENT',
        'Market-dependent','Low or potentially profitable',current,target,
        access('Furnace/bank',[],'Check current GE margins before buying a large batch.'),
        'Use a furnace or bank depending on the chosen product.',
        'Only materials with an acceptable live margin.',
        'Choose the cheapest GP/XP item that still meets your target timeline.',
        'Crafting '+target,
        'GE-sensitive method intentionally avoids a fake fixed GP/hr.')
    };
  }

  if(skill==='herblore'){
    const ritual=qdone('Druidic Ritual');
    p={
      fastest:M('Highest fast potion unlocked','FASTEST / HIGH-COST',
        'Potion/level dependent','Often high loss',Math.max(current,3),target,
        access('Bank',ritual?[]:['Druidic Ritual'],'Herblore cannot be trained normally before Druidic Ritual.'),
        'A bank with fast preset-style withdrawing.',
        'Clean herbs, secondary ingredients, and vials for the best fast potion at your level.',
        'Make the highest fast potion with acceptable supply. Re-check GP/XP before bulk buying.',
        'Herblore '+target,
        'Herblore is GE-sensitive; current potion margins determine the correct expensive method.'),
      recommended:M('Cost-effective potions using live GP/XP','RECOMMENDED',
        'Potion/level dependent','Moderate',Math.max(current,3),target,
        access('Bank',ritual?[]:['Druidic Ritual'],'Use a live price check to choose the potion, not a frozen list.'),
        'Bank.',
        'Ingredients for a potion with a good current balance of XP/hr and GP/XP.',
        'Mix potions in bulk and periodically re-check margins.',
        'Herblore '+target,
        'The correct potion changes with GE prices; the dashboard should not freeze one stale potion as universally best.'),
      lowCost:M('Clean herbs / low-loss potion processing','LOW-COST / EFFICIENT',
        'Slow','Low or profitable',Math.max(current,3),target,
        access('Grand Exchange / bank',ritual?[]:['Druidic Ritual'],'Cleaning herbs is slow but can be low-cost/profitable.'),
        'Grand Exchange or bank.',
        'Herbs/potions with a checked positive or low-loss margin.',
        'Accept a low XP rate to preserve cash.',
        'Herblore '+target,
        'Verified Herblore gate: Druidic Ritual; live GE margins determine the actual cheapest method.')
    };
  }

  if(skill==='mining'){
    p={
      fastest:M(current<37?'Quest XP + power-mine iron':'Power-mining / tick-efficient granite','FASTEST / HIGH-COST',
        current<37?'Questing can skip to ~37; iron rate varies':'High, skill-dependent','~0',current,target,
        access(current<37?'Mining quest route / iron rocks':'Granite mine / best fast method',[],'Early Mining quests can skip a large amount of slow training.'),
        current<37?'Do valuable Mining XP quests first, then power-mine iron for any remaining gap.':'Use the fastest active mining method your level supports.',
        'Best pickaxe available.',
        'Drop ores instead of banking when pure XP is the goal.',
        'Mining '+target,
        'OSRS Wiki: Doricâ€™s Quest, Dig Site, Plague City, Giant Dwarf, Lost Tribe and Another Slice can bring a new account to ~37; power-mining is fastest active style.'),
      recommended:M(current<30?'Iron ore â†’ Motherlode Mine at 30':'Motherlode Mine / useful unlock progression','RECOMMENDED',
        'Level-dependent','Can profit',current,target,
        access(current<30?'Iron rocks':'Motherlode Mine',[],'Motherlode Mine unlocks at 30 Mining.'),
        current<30?'Power-mine iron until 30.':'Motherlode Mine.',
        'Best pickaxe.',
        current<30?'Mine and drop iron quickly.':'Mine pay-dirt, clean it, bank ore, and spend nuggets on useful unlocks.',
        'Mining '+target,
        'Balanced route values ores/unlocks rather than maximum XP only.'),
      lowCost:M('Shooting Stars / relaxed mining','LOW-COST / EFFICIENT',
        'Lowâ€“moderate','~0 / some rewards',current,target,
        access('Active Shooting Star',[],'Very low attention compared with power-mining.'),
        'Find an active Shooting Star.',
        'Best pickaxe.',
        'Mine the star until depleted and move to another.',
        'Mining '+target,
        'Low-attention route; exact XP/hr varies with star tier and level.')
    };
  }

  if(skill==='smithing'){
    const gf=qdone('Sleeping Giants');
    p={
      fastest:M(current<40?'Best platebody / fast anvil item â†’ Blast Furnace gold at 40':'Blast Furnace gold bars','FASTEST / HIGH-COST',
        current<40?'Anvil/item dependent':'Very high; level/efficiency dependent','High gold ore cost',current,target,
        access(current<40?'Anvil':'Blast Furnace, Keldagrim',current<40?[]:[],'Goldsmith gauntlets require Family Crest; Keldagrim access comes from starting The Giant Dwarf.'),
        current<40?'Use an anvil near a bank until 40.':'Blast Furnace in Keldagrim.',
        current<40?'Bars for the largest fast item you can smith.':'Gold ore, Goldsmith gauntlets, stamina support, and ice gloves when available.',
        current<40?'Smith larger multi-bar items for faster XP.':'Smelt gold bars continuously using Goldsmith gauntlets.',
        'Smithing '+target,
        'OSRS Wiki: Blast Furnace gold becomes the fastest viable method at 40.'),
      recommended:M("Giants' Foundry",'RECOMMENDED',
        'Commission/level dependent','Often cost-effective',current,target,
        access("Giants' Foundry, Al Kharid",gf?[]:['Sleeping Giants'],'Requires Sleeping Giants.'),
        "Giants' Foundry.",
        'Appropriate metal bars/items for an efficient alloy.',
        'Complete sword commissions by following temperature/tool prompts.',
        'Smithing '+target,
        "Giants' Foundry is a cost-efficient active Smithing method."),
      lowCost:M('Blast Furnace bars / profitable smithing','LOW-COST / EFFICIENT',
        'Lower','Can profit',current,target,
        access('Blast Furnace / anvil',[],'Check bar/product margins live.'),
        'Use Blast Furnace or an anvil depending on margins.',
        'Materials with a checked profitable/low-loss spread.',
        'Choose profit/GP efficiency over raw XP/hr.',
        'Smithing '+target,
        'Market-sensitive; live prices are required for a truthful low-cost recommendation.')
    };
  }

  if(skill==='fishing'){
    p={
      fastest:M(current<24?'Sea Slug / Fishing Contest quest XP':'Fast active fishing for current level','FASTEST / HIGH-COST',
        current<24?'Questing is faster than low-level catches':'Level/method dependent','Low',current,target,
        access(current<24?'Quest route':'Best unlocked fast fishing spot',[],'Early quest XP is specifically recommended by the Wiki.'),
        current<24?'Complete Sea Slug first; add Fishing Contest and other efficient fishing-XP quests as available.':'Use the fastest current-level fishing method.',
        'Quest supplies or the correct fishing tool/bait.',
        current<24?'Take the large free XP rewards instead of catching low-level fish.':'Fish actively and drop/bank based on the method.',
        'Fishing '+target,
        'OSRS Wiki: Sea Slug alone takes level 1 to 24; several early quests reach ~27/33.'),
      recommended:M(current<48?'Quest XP â†’ fly/Barbarian fishing':'Barbarian Fishing / appropriate fast method','RECOMMENDED',
        'Level-dependent','Very low',current,target,
        access('River fishing / Barbarian Training when unlocked',[],'Barbarian Fishing also gives passive Agility/Strength XP.'),
        current<20?'Take quest XP, then use fly fishing once available.':'Use Barbarian Fishing when requirements are met.',
        'Fly fishing rod/feathers or barbarian rod.',
        'Prioritise account-wide efficiency over fish profit.',
        'Fishing '+target,
        'Wiki recommends considering Barbarian Fishing when passive Agility/Strength XP is valuable.'),
      lowCost:M('Tempoross / bank useful fish','LOW-COST / EFFICIENT',
        'Activity/level dependent','Low; reward pool',current,target,
        access('Tempoross Cove',[],'Tempoross is accessible from 35 Fishing.'),
        current<35?'Use normal fishing until 35.':'Tempoross.',
        'Harpoon/bare-hand setup as appropriate; food is not used in the encounter.',
        current<35?'Use cheap normal fishing.':'Participate in Tempoross for Fishing XP and reward permits.',
        'Fishing '+target,
        'Lower cash cost and useful rewards; not necessarily maximum XP.')
    };
  }

  if(skill==='thieving'){
    p={
      fastest:M(current<5?'Men/women â†’ cake stalls':'Best active pickpocket/stall bracket','FASTEST / HIGH-COST',
        'Level-dependent','~0; food may cost',current,target,
        access(current<5?'Lumbridge/any city':'Current best Thieving target',[],'Blackjacking becomes a later high-click option after relevant quest access.'),
        current<5?'Pickpocket men/women until 5, then move to cake stalls.':'Use the best fast active target for your level.',
        'Food if pickpocketing can stun/damage you.',
        'Click continuously and change method at major unlocks.',
        'Thieving '+target,
        'Thieving is strongly level-bracketed; early stalls avoid unnecessary cost.'),
      recommended:M(current<25?'Cake stalls â†’ fruit stalls at 25':'Low-risk stall/pickpocket progression','RECOMMENDED',
        'Level-dependent','Low / some profit',current,target,
        access(current<25?'Ardougne bakery stall':'Best accessible stall/pickpocket',[],'Fruit stalls unlock at 25 Thieving.'),
        current<25?'Use cake stalls until 25.':'Use a low-risk method appropriate to the bracket.',
        'Empty inventory space; food if needed.',
        'Train consistently with lower failure/stun downtime.',
        'Thieving '+target,
        'Balanced route prioritises consistency.'),
      lowCost:M('Stalls / low-risk pickpocketing','LOW-COST / EFFICIENT',
        'Lower','~0 / profitable',current,target,
        access('Accessible town',[],'No expensive consumables required.'),
        'Choose a safe stall or low-damage NPC.',
        'Minimal supplies.',
        'Bank useful loot and accept slower XP.',
        'Thieving '+target,
        'Low-cost Thieving is naturally available through stalls/pickpocketing.')
    };
  }

  if(skill==='firemaking'){
    const shades=qdone("Shades of Mort'ton");
    p={
      fastest:M(current<30?'Pyre logs if Shades of Mortâ€™ton is unlocked; otherwise highest logs':'Highest-tier fast log burning','FASTEST / HIGH-COST',
        'Log/tick dependent','Log-price dependent',current,target,
        access(shades?'Any suitable bank/fire line':'Normal firemaking route',[],'Pyre-log fastest early method requires Shades of Mortâ€™ton.'),
        'Grand Exchange/Varrock fire line or another long clear path.',
        'Tinderbox and highest-tier efficient logs.',
        'Light logs continuously; upgrade log tier as levels permit.',
        'Firemaking '+target,
        'OSRS Wiki: pyre logs are fastest 1â€“30 if quest-unlocked; ordinary fastest training burns the highest practical log.'),
      recommended:M(current<50?'Normal logs progression â†’ Wintertodt at 50':'Wintertodt','RECOMMENDED',
        'Level/activity dependent','Low / rewards',current,target,
        access(current<50?'Normal fire line':'Wintertodt Camp',[],current<50?'Wintertodt requires 50 Firemaking.':'50 Firemaking required.'),
        current<50?'Burn the highest sensible logs until 50.':'Wintertodt Camp.',
        current<50?'Tinderbox and logs.':'Warm clothing, food, tinderbox, axe, knife if fletching roots.',
        current<50?'Burn logs in a line.':'Chop bruma roots, optionally fletch, and feed the brazier.',
        'Firemaking '+target,
        'Wintertodt is a practical reward-bearing route after 50.'),
      lowCost:M('Cheap logs / Wintertodt rewards','LOW-COST / EFFICIENT',
        'Lowerâ€“moderate','Low',current,target,
        access(current<50?'Normal fire line':'Wintertodt Camp',[],'Choose cheaper logs before 50.'),
        current<50?'Varrock/GE fire line.':'Wintertodt.',
        'Cheap logs or Wintertodt supplies.',
        'Trade speed for lower cost.',
        'Firemaking '+target,
        'No reason to attach a stale fixed GP/hr because log prices move.')
    };
  }

  if(skill==='fletching'){
    p={
      fastest:M(current<10?'Arrow shafts/headless arrows â†’ fast bows/darts':'Fast darts / high-XP fletching item','FASTEST / HIGH-COST',
        'Item/level dependent','Can be high',current,target,
        access('Bank/Grand Exchange',[],'Fletching methods are heavily GE-sensitive.'),
        'Grand Exchange or bank.',
        'Materials for the fastest currently unlocked item.',
        'Fletch continuously and move to the next major unlock.',
        'Fletching '+target,
        'Current fastest item depends on level and GE supply; avoid frozen GP/hr.'),
      recommended:M('Shortbows/longbows progression','RECOMMENDED',
        'Level/log dependent','Moderate / may recover value',current,target,
        access('Bank',[],'Simple, stable progression.'),
        'Any bank.',
        'Logs and knife; add bowstrings if stringing is worthwhile.',
        'Cut the highest sensible bow and optionally string it.',
        'Fletching '+target,
        'Reliable and easy-to-follow Fletching progression.'),
      lowCost:M('Profit-aware bow stringing / arrow processing','LOW-COST / EFFICIENT',
        'Market-dependent','Low or profitable',current,target,
        access('Grand Exchange / bank',[],'Check margins before bulk purchases.'),
        'Bank/GE.',
        'Only materials with acceptable live margins.',
        'Choose a product that preserves GP rather than maximising XP.',
        'Fletching '+target,
        'Live GE check required for truthful profit/cost claims.')
    };
  }

  if(skill==='farming'){
    p={
      fastest:M(current<15?'Quest XP / allotments until trees':'Tree + fruit-tree runs','FASTEST / HIGH-COST',
        'Run-based; not meaningful as continuous XP/hr','Seed-dependent',current,target,
        access('Farming patches',[],'Tree runs begin at 15 Farming; fruit trees at 27.'),
        current<15?'Use early Farming XP quests/allotments until trees unlock.':'Run all useful tree/fruit-tree patches on growth timers.',
        'Best tree seeds you can afford, payments/compost, and teleports.',
        'Plant, protect/compost, return when grown, check health, replant.',
        'Farming '+target,
        'Farming is timer-based; one continuous XP/hr number is misleading.'),
      recommended:M(current<15?'Allotments + quest XP â†’ tree runs':'Tree runs + herb runs','RECOMMENDED',
        'Run-based','Herbs can offset tree cost',current,target,
        access('Farming patches',[],'Herb runs add profit while trees provide large XP drops.'),
        'Use an efficient patch circuit.',
        'Tree seeds + herb seeds + compost + teleports.',
        'Do tree runs for XP and herb runs between them for cash/value.',
        'Farming '+target,
        'Macro-efficient Farming balances timed XP with profitable herb runs.'),
      lowCost:M('Herbs, allotments, inexpensive trees','LOW-COST / EFFICIENT',
        'Run-based','Low / can profit',current,target,
        access('Accessible Farming patches',[],'Avoid expensive tree seeds when cash efficiency matters.'),
        'Use nearby/teleportable patches.',
        'Cheap seeds and ultracompost when worthwhile.',
        'Keep plots growing while doing other goals.',
        'Farming '+target,
        'Farming should be measured per run/day rather than a fake constant XP/hr.')
    };
  }

  if(skill==='hunter'){
    const bone=qdone('Bone Voyage');
    const eagles=qdone("Eagles' Peak");
    p={
      fastest:M(current<25?'Kebbit tracking':'Best active creature bracket','FASTEST / HIGH-COST',
        'Level/trap dependent','~0',current,target,
        access(current<25?'Kebbit tracking areas':'Current active Hunter area',[],'Trap count increases at levels 20/40/60/80.'),
        current<25?'Track kebbits from level 9 upward.':'Use the fastest current active Hunter creature.',
        'Required trap/noose/butterfly equipment.',
        'Keep all available traps active and move at bracket unlocks.',
        'Hunter '+target,
        'OSRS Wiki: Natural History Quiz gets 1â†’9, then active route begins with kebbits at 9.'),
      recommended:M('Birdhouse runs + active Hunter between runs','RECOMMENDED',
        'Run-based + active method','Low / profitable',current,target,
        access('Fossil Island',bone?[]:['Bone Voyage'],'Birdhouse trapping starts at 9 Hunter and each house matures after 50 minutes.'),
        'Fossil Island birdhouse circuit.',
        'Four birdhouses/clockworks, logs, and seeds.',
        'Do a birdhouse circuit whenever ready; train actively elsewhere between runs if you need levels quickly.',
        'Hunter '+target,
        'OSRS Wiki: birdhouses are recommended from level 9 onward but require Bone Voyage/Fossil Island.'),
      lowCost:M(current<25?'Kebbits':'Birdhouses / ordinary traps','LOW-COST / EFFICIENT',
        'Level dependent','Low / profitable',current,target,
        access(current<25?'Kebbit areas':(bone?'Fossil Island':'Ordinary Hunter areas'),[],bone?'Birdhouses available.':'Birdhouses stay locked until Bone Voyage.'),
        current<25?'Track kebbits.':(bone?'Do birdhouses':'Use ordinary traps until Fossil Island is unlocked.'),
        'Basic Hunter tools.',
        'Avoid consumable-heavy/high-risk methods.',
        'Hunter '+target,
        'Low-cost route avoids unnecessary consumables.')
    };
  }

  if(skill==='runecraft'){
    const eye=qdone('Temple of the Eye');
    p={
      fastest:M(current<50?'Talisman tiaras':'Lava runes','FASTEST / HIGH-COST',
        current<50?'~36kâ€“58k/hr depending tiara':'High; setup dependent','Can be very high',current,target,
        access(current<50?'Elemental altar + bank route':'Fire Altar',[],'Lava runes are effective earlier but tiaras are listed as fastest up to 50 in current Wiki guidance.'),
        current<50?'Use the elemental altar with the best practical tiara route.':'Craft lava runes at the Fire Altar.',
        current<50?'Tiaras, talismans, fast teleports.':'Pure essence, earth runes/talismans or Magic Imbue, binding necklaces, pouches as unlocked.',
        current<50?'Make tiaras continuously.':'Craft lava runes; repair pouches as needed.',
        'Runecraft '+target,
        'OSRS Wiki: talisman tiaras are among the fastest up to 50; lava runes dominate high-speed training later.'),
      recommended:M(current<27?'Quest XP / ordinary runes â†’ Guardians of the Rift at 27':'Guardians of the Rift','RECOMMENDED',
        'Activity/level dependent','Low / rewards',current,target,
        access(current<27?'Normal altars':'Guardians of the Rift',current<27?[]:(eye?[]:['Temple of the Eye']),current<27?'Temple of the Eye/GotR becomes relevant at 27.':'Requires Temple of the Eye.'),
        current<27?'Use quests/normal runes until 27.':'Guardians of the Rift.',
        'Pickaxe, chisel, pouches/outfit as unlocked.',
        current<27?'Train cheaply until GotR unlocks.':'Mine essence, craft guardian essence, use active altars, power the Great Guardian.',
        'Runecraft '+target,
        'OSRS Wiki recommends GotR as the lower-effort alternative to tiaras/lavas.'),
      lowCost:M('Guardians of the Rift / profitable rune crafting','LOW-COST / EFFICIENT',
        'Activity/level dependent','Low / potentially profitable',current,target,
        access(eye?'Guardians of the Rift':'Normal rune altars',eye?[]:['Temple of the Eye'],eye?'Raiments increase rune yield, not XP.':'GotR unavailable until quest completion.'),
        eye?'Guardians of the Rift.':'Use ordinary rune crafting until Temple of the Eye is complete.',
        'Basic Runecraft supplies.',
        'Prioritise rewards/rune output rather than maximum XP.',
        'Runecraft '+target,
        'No fixed GP/hr because rune prices and level-based multipliers change.')
    };
  }

  if(skill==='woodcutting'){
    const bone=qdone('Bone Voyage');
    p={
      fastest:M(current<35?'Best tree bracket':'Tick-manipulated teak trees','FASTEST / HIGH-COST',
        current>=35?'~93k/hr at 35 scaling much higher with level/technique':'Level-dependent','~0',current,target,
        access(current>=35?'Teak tree location':'Best unlocked trees',[],'Tick manipulation is click-intensive.'),
        current>=35?'Use a teak location suitable for 1.5t/2t technique.':'Use the fastest tree for the current bracket.',
        'Best axe available; foresterâ€™s rations/felling axe when appropriate.',
        current>=35?'Perform tick-manipulated teak cutting and drop logs.':'Cut and drop logs.',
        'Woodcutting '+target,
        'OSRS Wiki: teaks are fastest from 35 with tick manipulation; rates scale strongly with level/axe.'),
      recommended:M(current<65?'Non-tick teaks + Forestry events':'Sulliusceps / Forestry-aware route','RECOMMENDED',
        current<65?'~34kâ€“65k+/hr depending level/axe':'Level-dependent','Low',current,target,
        access(current<65?'Teak trees':'Fossil Island sulliuscep area',current<65?[]:(bone?[]:['Bone Voyage']),current<65?'Forestry events can add meaningful XP.':'Sulliusceps require Fossil Island access.'),
        current<65?'Cut teaks normally and participate in useful Forestry events.':'Cut sulliusceps on Fossil Island.',
        'Best axe, Forestry kit if participating in Forestry.',
        'Cut continuously without tick manipulation.',
        'Woodcutting '+target,
        'OSRS Wiki: non-tick teaks are recommended up to roughly 65; Forestry events can increase rates.'),
      lowCost:M(current>=60?'Yew trees / Forestry':'Bank logs / relaxed Forestry','LOW-COST / EFFICIENT',
        'Lower','~0 / log profit',current,target,
        access('Accessible tree/Forestry world',[],'Profit-focused woodcutting is slower.'),
        current>=60?'Cut yews at a convenient bank/Forestry location.':'Cut a convenient tree and bank logs.',
        'Best axe.',
        'Bank logs and participate in Forestry when convenient.',
        'Woodcutting '+target,
        'Woodcutting profit methods trade substantial XP/hr for value.')
    };
  }

  if(skill==='cooking'){
    const tai=qdone('Tai Bwo Wannai Trio');
    p={
      fastest:M('1-tick karambwan','FASTEST / HIGH-COST',
        current>=70?'~742k/hr around level 70 (Wiki table)':'Level-dependent','Usually low loss/profit varies',current,target,
        access('Roguesâ€™ Den / other bank-adjacent fire',[],'Poison karambwan can be used for early 1-tick training; normal cooked karambwan has quest context.'),
        'Use a bank-adjacent fire/range suited to 1-ticking.',
        'Raw karambwan and banking supplies.',
        'Use raw karambwan on the fire/range with 1-tick timing.',
        'Cooking '+target,
        'OSRS Wiki: 1-tick karambwan is the fastest standard Cooking route; around level 70 the table lists ~742k XP/hr.'),
      recommended:M('AFK karambwan at Hosidius kitchen','RECOMMENDED',
        current>=70?'~218k/hr around level 70 (Wiki table)':'Level-dependent','Can profit',current,target,
        access('Hosidius kitchen',[],'Lower burn rate makes Hosidius strong for non-tick cooking up to high levels.'),
        'Hosidius kitchen.',
        'Raw karambwan.',
        'Cook full inventories normally and bank.',
        'Cooking '+target,
        'OSRS Wiki: non-tick karambwan at Hosidius is the preferred lower-effort route up to high levels.'),
      lowCost:M('Cook profitable fish / food','LOW-COST / EFFICIENT',
        'Item-dependent','Profit/low loss',current,target,
        access('Bank-adjacent range',[],'Check raw/cooked spread before bulk buying.'),
        'Hosidius or another range near a bank.',
        'Only food with a checked profitable/low-loss margin.',
        'Cook normally and sell outputs.',
        'Cooking '+target,
        'Live GE margins determine the correct low-cost food.')
    };
  }

  if(skill==='sailing'){
    const pand=qdone('Pandemonium');
    p={
      fastest:M('Port Tasks / best currently unlocked active Sailing method','FASTEST / HIGH-COST',
        'Update-sensitive â€” do not freeze a rate','Activity-dependent',current,target,
        access('Port Sarim / unlocked ports',pand?[]:['Pandemonium'],'Pandemonium is required to begin training Sailing.'),
        'Start at Port Sarim after Pandemonium.',
        'Your current boat plus repair/route supplies appropriate to unlocked content.',
        'Use Port Tasks early, then switch to the highest-value active Sailing activity unlocked by your current level and the live Wiki.',
        'Sailing '+target,
        'Sailing released in 2025 and is actively changing; the Wiki itself warns parts of its training guide can become outdated.'),
      recommended:M('Port Tasks + Sea Charting / Salvaging as unlocked','RECOMMENDED',
        'Update-sensitive','Lowâ€“moderate',current,target,
        access('Unlocked Sailing ports/sea',pand?[]:['Pandemonium'],'Port Tasks are the stable early-game foundation.'),
        'Use the notice boards at unlocked ports.',
        'Current boat and task/salvage facilities.',
        'Stack efficient routes, complete port tasks, and add charting/salvaging as the level unlocks them.',
        'Sailing '+target,
        'OSRS Wiki: core methods include Port Tasks, Shipwreck Salvaging, Sea Charting, and Barracuda Trials.'),
      lowCost:M('Port Tasks','LOW-COST / EFFICIENT',
        'Task/route dependent','Low',current,target,
        access('Port Sarim',pand?[]:['Pandemonium'],'At level 7 two tasks can be held; at 10 Musa Point tasks expand.'),
        'Port Sarim notice board.',
        'Basic boat setup.',
        'Complete courier/bounty tasks with efficient routing.',
        'Sailing '+target,
        'Stable early method; no fabricated XP/hr while the skill continues receiving balance updates.')
    };
    p.futureUnlocks=[
      {level:7,text:'Two Port Tasks can be held at once.'},
      {level:10,text:'Courier task coverage expands to Musa Point.'}
    ];
  }

  if(!p) return null;
  p.verified=true;
  p.verificationNote='Verified baseline: level gates, quest/access requirements, and method role checked against current OSRS Wiki guidance. Dynamic rates/costs are deliberately shown as variable when no stable universal value exists.';
  p.skill=skill;p.current=current;p.target=target;
  return p;
}

function defaultVerifiedTarget_(skill,current){
  const caps={
    attack:[50,60,65,70,75,80,99],strength:[50,60,65,70,75,80,99],defence:[50,60,70,75,80,99],
    hitpoints:[50,60,70,80,99],ranged:[40,50,61,70,75,80,99],prayer:[43,50,60,70,77,99],magic:[55,60,70,75,80,94,99],
    slayer:[30,40,50,60,70,80,85,90,95,99],agility:[10,20,30,40,50,60,70,80,90,99],
    construction:[10,20,30,40,50,60,70,83,99],crafting:[20,30,40,50,61,70,80,99],
    herblore:[3,20,30,40,50,60,70,78,90,99],mining:[30,40,50,60,70,80,85,99],
    smithing:[30,40,50,60,70,80,90,99],fishing:[20,35,48,60,70,80,99],thieving:[5,25,45,55,70,80,99],
    firemaking:[15,30,50,60,70,80,99],fletching:[10,20,30,40,50,60,70,80,99],farming:[15,27,35,45,55,65,75,85,99],
    hunter:[20,40,50,60,70,80,99],runecraft:[27,40,50,60,70,77,85,99],woodcutting:[65,70,75,80,90,99],
    sailing:[7,10,20,30,40,50,60,70,80,90,99],cooking:[75,80,85,90,99]
  };
  const arr=caps[skill]||[current+10];
  for(let i=0;i<arr.length;i++) if(arr[i]>current)return arr[i];
  return 99;
}
function validateGuideMethodForBracket_(m,current,target) {
  if(!m) return null;
  const range=parseLevelRangeNumbers_(m.levelRange);
  if(!range){
    return Object.assign({},m,{
      verified:false,
      verificationWarning:'This source method does not contain a clean level range. Treat it as reference-only until verified.'
    });
  }

  const overlaps=current < range.high && target > range.low;
  const covers=current>=range.low && target<=range.high;

  return Object.assign({},m,{
    verified:covers,
    verificationWarning:covers ? '' :
      (overlaps
        ? 'This method only applies to part of your current target range ('+range.low+' â†’ '+range.high+').'
        : 'This method does not apply to your current target range.')
  });
}

function parseLevelRangeNumbers_(s) {
  const text=String(s||'').replace(/[â€“â€”]/g,'â†’');
  let m=text.match(/(\d+)\s*â†’\s*(\d+)/);
  if(!m) m=text.match(/(\d+)\s*-\s*(\d+)/);
  if(!m) return null;
  return {low:Number(m[1]),high:Number(m[2])};
}
function buildLevelingLibrary_(ss, roadmap, questIntel) {
  const docs=getSourceDocs_();
  const stats={};
  readTable_(ss,'Stats').forEach(r=>stats[String(r.Skill||'').toLowerCase()]=Number(r.Level||1));
  const questStatus={};
  readTable_(ss,'Quests').forEach(r=>{if(r.Quest)questStatus[normalizeName_(r.Quest)]=String(r.Status||'').toUpperCase();});

  const skills=[
    'ranged','prayer','attack','strength','defence','magic','slayer','hitpoints',
    'agility','construction','crafting','herblore','mining','smithing','fishing',
    'thieving','firemaking','fletching','farming','hunter','runecraft','woodcutting',
    'sailing','cooking'
  ];

  const roadmapTargets={};
  (roadmap.milestones||[]).forEach(m=>{
    if(m.type==='skill' && m.key && m.status!=='COMPLETE'){
      if(roadmapTargets[m.key]==null || Number(m.target)<roadmapTargets[m.key]) roadmapTargets[m.key]=Number(m.target);
    }
  });

  const rows=skills.map(skill=>{
    const current=Number(stats[skill]||1);
    const methods=trainingMethodsForSkill_(docs.skills,skill);
    const bracket=scanBracketForSkill_(docs.skills,skill,current);
    const nextTarget=roadmapTargets[skill] || inferGuideTarget_(docs.skills,skill,current);
    const verifiedProfile=verifiedTrainingProfile_(skill,current,nextTarget,stats,questStatus);
    const enhance=(m,label)=>{
      if(!m)return null;
      const title=methodTitleFromDescription_(m.description,label,skill,current,nextTarget);
      const access=evaluateTrainingAccess_(title+' '+String(m.description||''),stats,questStatus);
      const instructions=actionableInstructions_(skill,title,m.description,current,nextTarget,access);
      return Object.assign({},m,{
        methodTitle:title,
        access:access,
        instructions:instructions,
        accountHours:calculateMethodHours_(current,nextTarget,m.xpHr),
        accountStart:current,
        accountTarget:nextTarget,
        accountRange:(nextTarget && nextTarget>current) ? (current+' â†’ '+nextTarget) : ''
      });
    };
    if(verifiedProfile){
      return {
        skill:skill,
        display:title_(skill),
        current:current,
        nextTarget:nextTarget,
        bracket:'',
        isCurrentRoadmap:roadmap.current && roadmap.current.type==='skill' && roadmap.current.key===skill,
        verified:true,
        verificationNote:verifiedProfile.verificationNote,
        futureUnlocks:verifiedProfile.futureUnlocks||[],
        fastest:verifiedProfile.fastest,
        recommended:verifiedProfile.recommended,
        lowCost:verifiedProfile.lowCost
      };
    }

    return {
      skill:skill,
      display:title_(skill),
      current:current,
      nextTarget:nextTarget,
      bracket:'',
      isCurrentRoadmap:roadmap.current && roadmap.current.type==='skill' && roadmap.current.key===skill,
      verified:false,
      verificationNote:'No verified baseline profile is loaded for this skill yet. No training recommendation will be shown as authoritative.',
      futureUnlocks:[],
      fastest:null,
      recommended:null,
      lowCost:null
    };
  });

  return {
    source:'Sensum - OSRS Skill Leveling Guide',
    skills:rows
  };
}

function inferGuideTarget_(text, skill, current) {
  const heading=title_(skill).toUpperCase();
  let start=text.indexOf(heading+' â€”');
  if(start<0) start=text.indexOf(heading+'\n');
  if(start<0) return null;
  const chunk=text.substring(start,Math.min(text.length,start+2200));
  const nums=[];
  const re=/(\d+)\s*[â†’-]\s*(\d+)/g;
  let m;
  while((m=re.exec(chunk))!==null){
    const hi=Number(m[2]);
    if(hi>current) nums.push(hi);
  }
  return nums.length?Math.min.apply(null,nums):null;
}

function buildQuestShoppingState_(ss, roadmap, questIntel) {
  const parsed = getParsedQuestShopping_();
  const owned = buildOwnedItemIndex_(ss);
  const questRows = readTable_(ss,'Quests');
  const questStatus = {};
  questRows.forEach(r => {
    if (r.Quest) questStatus[normalizeName_(r.Quest)] = String(r.Status||'').toUpperCase();
  });

  const byQuest = {};
  parsed.quests.forEach(q => {
    const qkey = normalizeName_(q.quest);
    const st = questStatus[qkey] || '';
    const questDone = st === 'FINISHED' || st === 'COMPLETE';

    let exactTotal = 0, exactReady = 0, exactMissingQty = 0;
    const items = q.items.map(it => {
      const req = parseShoppingRequirement_(it.raw);
      if (!req.trackable) {
        return {
          raw:it.raw,
          name:req.name,
          required:req.required,
          owned:null,
          missing:null,
          status:'VARIABLE',
          trackable:false
        };
      }

      exactTotal++;
      const ownQty = findOwnedQty_(owned, req.name, req.aliases);
      const missing = Math.max(0, req.required - ownQty);
      if (missing === 0) exactReady++;
      exactMissingQty += missing;

      return {
        raw:it.raw,
        name:req.name,
        required:req.required,
        owned:ownQty,
        missing:missing,
        status:missing===0?'OWNED':'MISSING',
        trackable:true
      };
    });

    const blocker=questDone ? null : resolveQuestBlocker_(q.quest,questIntel,questStatus,owned);
    const state = {
      quest:q.quest,
      completed:questDone,
      blocked:!!blocker,
      blocker:blocker,
      subtotal:q.subtotal,
      exactReady:exactReady,
      exactTotal:exactTotal,
      variableCount:items.filter(x=>!x.trackable).length,
      missingCount:items.filter(x=>x.trackable && x.missing>0).length,
      items:items,
      readiness:questDone ? 100 : (exactTotal ? Math.round(exactReady/exactTotal*100) : 0)
    };
    byQuest[qkey] = state;
  });

  const nextQuestNames = [];
  (roadmap.next||[]).forEach(x => {
    if (x.type === 'quest') nextQuestNames.push(String(x.task||'').replace(/^Complete\s+/i,'').trim());
  });

  // Include quest-efficiency candidates at the front if present in the shopping doc.
  const efficientOrder = ['Waterfall Quest','Fight Arena','Tree Gnome Village','The Grand Tree',"Witch's House","Merlin's Crystal",'Holy Grail'];
  // Reverse loop + unshift preserves the intended order (Waterfall first, Holy Grail last).
  for(let i=efficientOrder.length-1;i>=0;i--){
    const q=efficientOrder[i];
    const qs=questStatus[normalizeName_(q)] || '';
    const state=byQuest[normalizeName_(q)];
    if (!(qs==='FINISHED'||qs==='COMPLETE') && state && !state.blocked && !nextQuestNames.includes(q)) nextQuestNames.unshift(q);
  }

  const upcoming = [];
  const seen = {};
  nextQuestNames.forEach(name => {
    const key=normalizeName_(name);
    if (!seen[key] && byQuest[key] && !byQuest[key].completed && !byQuest[key].blocked) {
      upcoming.push(byQuest[key]);
      seen[key]=true;
    }
  });

  // Fill with remaining incomplete shopping-list quests so the tab is always useful.
  parsed.quests.forEach(q => {
    const key=normalizeName_(q.quest);
    if (upcoming.length < 8 && byQuest[key] && !byQuest[key].completed && !byQuest[key].blocked && !seen[key]) {
      upcoming.push(byQuest[key]);
      seen[key]=true;
    }
  });

  return {
    updatedAt:new Date().toISOString(),
    questCount:parsed.quests.length,
    upcoming:upcoming.slice(0,8),
    byQuest:byQuest,
    sharedKit:evaluateSharedKit_(parsed.sharedKit, owned),
    sourceTitle:'Sensum - OSRS Quest Shopping List'
  };
}

function getParsedQuestShopping_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('parsedQuestShoppingV2');
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }

  const text = DocumentApp.openById(CONFIG.QUEST_SHOPPING_DOC_ID).getBody().getText();
  const lines = text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const quests = [];
  const sharedKit = [];
  let current = null;
  let inBuy = false;
  let inShared = false;

  const structural = /^(SENSUM|Purpose:|RECOMMENDED SHARED|EARLY ACCOUNT|BARROWS GLOVES|PIETY \/|DRAGON SLAYER|MONKEY MADNESS II|DESERT TREASURE II PATH|SAILING QUESTS|TOTAL BUDGET PLAN|MASTER SHOPPING CHECKLIST|={10,})/i;

  for (let i=0;i<lines.length;i++) {
    const line=lines[i];

    if (/^RECOMMENDED SHARED QUESTING KIT$/i.test(line)) {
      inShared=true; inBuy=false; current=null; continue;
    }
    if (inShared) {
      if (/^Estimated shared-kit/i.test(line) || /^={10,}/.test(line)) {
        inShared=false;
      } else if (/^-\s*/.test(line)) {
        sharedKit.push(line.replace(/^-\s*/,'').trim());
      }
      continue;
    }

    if (line === 'BUY:') {
      inBuy=true;
      continue;
    }
    if (/^(QUEST-OBTAINED|REUSABLE|REUSABLE\/OWNED|Most |All herbs|Estimated|Shopping done|Budget reserve|Recommended RFD|Because RFD)/i.test(line)) {
      if (/^Estimated/i.test(line) && current) current.subtotal=line;
      inBuy=false;
      continue;
    }
    if (/^={10,}/.test(line) || structural.test(line)) {
      inBuy=false;
      continue;
    }

    if (inBuy && current && /^-\s*/.test(line)) {
      current.items.push({raw:line.replace(/^-\s*/,'').trim()});
      continue;
    }

    // Quest headings are plain standalone lines immediately followed by BUY:, or reserve-only quest headings.
    const next = lines[i+1] || '';
    if (next === 'BUY:' || /^Budget reserve for required/i.test(next)) {
      current={quest:line,items:[],subtotal:''};
      quests.push(current);
      inBuy=false;
      continue;
    }
  }

  const result={quests:quests,sharedKit:sharedKit};
  try { cache.put('parsedQuestShoppingV2',JSON.stringify(result),900); } catch(e) {}
  return result;
}

function buildOwnedItemIndex_(ss) {
  const rows = readTable_(ss,'RuneLite Items');
  const out = {};
  rows.forEach(r => {
    const name = normalizeItemName_(r.Item);
    if (!name) return;
    const qty = Number(r.Quantity||0);
    out[name] = (out[name]||0) + qty;
  });
  return out;
}

function normalizeItemName_(s) {
  return String(s||'')
    .toLowerCase()
    .replace(/\(\d+\)$/,'')          // potion doses, jewelry charge counts
    .replace(/\s+/g,' ')
    .trim();
}

function findOwnedQty_(owned, name, aliases) {
  const keys = [name].concat(aliases||[]).map(normalizeItemName_);
  let total=0;
  keys.forEach(k => { total += Number(owned[k]||0); });
  if (total>0) return total;

  // Safe equivalence classes for common quest utility items.
  const n=normalizeItemName_(name);
  const groups = {
    'pickaxe':['bronze pickaxe','iron pickaxe','steel pickaxe','black pickaxe','mithril pickaxe','adamant pickaxe','rune pickaxe','dragon pickaxe','crystal pickaxe','gilded pickaxe'],
    'axe':['bronze axe','iron axe','steel axe','black axe','mithril axe','adamant axe','rune axe','dragon axe','crystal axe','3rd age axe'],
    'knife':['knife'],
    'spade':['spade'],
    'hammer':['hammer'],
    'tinderbox':['tinderbox'],
    'chisel':['chisel'],
    'rope':['rope']
  };
  if (groups[n]) {
    return groups[n].reduce((sum,k)=>sum+Number(owned[normalizeItemName_(k)]||0),0);
  }
  return 0;
}

function parseShoppingRequirement_(raw) {
  let s=String(raw||'').trim();

  // Explicitly variable/non-item requirements should not be falsely auto-checked.
  if (/(food|combat supplies|teleport|reserve|optional|as desired|as needed|depending|workaround|random assigned|utility|prayer potion|potions|stamina|energy|antipoison|ammunition|runes\/weapon|combat runes|light source|waterskins|shantay passes|clothing pieces|disguise|cash|coins for|fee\/items|materials|supplies)/i.test(s)) {
    return {trackable:false,name:s,required:0,aliases:[]};
  }

  // Alternatives are variable unless we can safely collapse a trivial tool alias.
  if (/\bOR\b/i.test(s) || /\bor\b/i.test(s)) {
    return {trackable:false,name:s,required:0,aliases:[]};
  }

  let qty=1, name=s;
  let m=s.match(/^(\d+)\s+(.+)$/);
  if (m) { qty=Number(m[1]); name=m[2]; }
  m=s.match(/^(.+?)\s+x(\d+)(?:\b|$)/i);
  if (m) { name=m[1].trim(); qty=Number(m[2]); }

  name=name
    .replace(/\s*\([^)]*\)\s*$/,'')
    .replace(/\s+if .*$/i,'')
    .replace(/\s+to enter .*$/i,'')
    .replace(/\s+obtainable .*$/i,'')
    .trim();

  // Singularize only simple plurals used by the bank names.
  const singularMap = {
    'air runes':'air rune','water runes':'water rune','earth runes':'earth rune',
    'iron bars':'iron bar','gold bars':'gold bar','oak logs':'oak log','normal logs':'logs',
    'ropes':'rope','planks':'plank','steel nails':'steel nails','mithril ores':'mithril ore',
    'tin ores':'tin ore','law runes':'law rune','soft clay':'soft clay',
    'candles':'candle','bones':'bones','buckets':'bucket','pots':'pot'
  };
  const nlow=name.toLowerCase();
  if (singularMap[nlow]) name=singularMap[nlow];

  return {trackable:true,name:name,required:qty,aliases:[]};
}

function evaluateSharedKit_(items, owned) {
  return (items||[]).map(raw => {
    const req=parseShoppingRequirement_(raw);
    if(!req.trackable) return {raw:raw,status:'VARIABLE',owned:null,required:req.required};
    const own=findOwnedQty_(owned,req.name,req.aliases);
    return {raw:raw,name:req.name,required:req.required,owned:own,status:own>=req.required?'OWNED':'MISSING',missing:Math.max(0,req.required-own)};
  });
}

function getSourceDocs_() {
  const cache = CacheService.getScriptCache();
  let master = cache.get('masterChecklistText');
  let skills = cache.get('skillGuideText');

  if (!master) {
    master = DocumentApp.openById(CONFIG.MASTER_CHECKLIST_DOC_ID).getBody().getText();
    cache.put('masterChecklistText', master, 900);
  }
  if (!skills) {
    skills = DocumentApp.openById(CONFIG.SKILL_GUIDE_DOC_ID).getBody().getText();
    cache.put('skillGuideText', skills, 900);
  }

  return {master:master, skills:skills};
}

function buildRoadmapState_(ss) {
  const docs = getSourceDocs_();
  const stats = {};
  readTable_(ss,'Stats').forEach(r => stats[String(r.Skill||'').toLowerCase()] = Number(r.Level||1));

  const quests = {};
  readTable_(ss,'Quests').forEach(r => {
    if (r.Quest) quests[normalizeName_(r.Quest)] = String(r.Status||'').toUpperCase();
  });

  const lines = docs.master.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const milestones = [];
  let phase = '';

  lines.forEach(line => {
    if (/^PHASE \d+ â€” /i.test(line)) {
      phase = line;
      return;
    }
    const m = line.match(/^(\d+)\.\s+(.+)$/);
    if (!m) return;

    const order = Number(m[1]);
    const task = m[2].trim();
    const ev = evaluateRoadmapTask_(task, stats, quests);
    milestones.push({
      order:order,
      phase:phase,
      task:task,
      status:ev.status,
      progress:ev.progress,
      type:ev.type,
      key:ev.key,
      target:ev.target
    });
  });

  const complete = milestones.filter(x=>x.status==='COMPLETE').length;
  const current = milestones.find(x=>x.status!=='COMPLETE') || null;
  const currentPhase = current ? current.phase : 'ALL PHASES COMPLETE';
  const phaseItems = milestones.filter(x=>x.phase===currentPhase);
  const phaseComplete = phaseItems.filter(x=>x.status==='COMPLETE').length;

  const fireCapeItems = milestones.filter(x => /PHASE [1-4] â€” /i.test(x.phase));
  const fireCapeAuto = fireCapeItems.filter(x=>x.status==='COMPLETE').length;

  return {
    total:milestones.length,
    complete:complete,
    percent: milestones.length ? Math.round((complete/milestones.length)*100) : 0,
    current:current,
    currentPhase:currentPhase,
    currentPhaseComplete:phaseComplete,
    currentPhaseTotal:phaseItems.length,
    fireCapeComplete:fireCapeAuto,
    fireCapeTotal:fireCapeItems.length,
    fireCapePercent:fireCapeItems.length ? Math.round((fireCapeAuto/fireCapeItems.length)*100) : 0,
    next: current ? milestones.filter(x=>x.order>=current.order && x.status!=='COMPLETE').slice(0,6) : [],
    milestones:milestones
  };
}

function evaluateRoadmapTask_(task, stats, quests) {
  let m = task.match(/^(?:Get|Reach)\s+(\d+)\+?\s+([A-Za-z ]+)/i);
  if (m) {
    const target = Number(m[1]);
    const skill = normalizeSkillName_(m[2]);
    if (skill && stats[skill] != null) {
      const cur = Number(stats[skill]||1);
      return {type:'skill',key:skill,target:target,status:cur>=target?'COMPLETE':'OPEN',progress:cur+'/'+target};
    }
  }

  m = task.match(/^Complete\s+(.+?)(?:\s+â€”.*)?$/i);
  if (m) {
    const q = normalizeName_(m[1].replace(/[â­ðŸ”¥ðŸ†]/g,'').trim());
    const st = quests[q] || '';
    const done = st === 'FINISHED' || st === 'COMPLETE';
    return {type:'quest',key:q,target:1,status:done?'COMPLETE':'OPEN',progress:done?'Complete':(st==='IN_PROGRESS'?'In progress':'Not complete')};
  }

  return {type:'manual',key:'',target:0,status:'OPEN',progress:'Manual milestone'};
}

function normalizeName_(s) {
  return String(s||'')
    .toLowerCase()
    .replace(/[â€™']/g,"'")
    .replace(/\s+/g,' ')
    .trim();
}

function normalizeSkillName_(s) {
  const x = String(s||'').toLowerCase().trim()
    .replace(/\s+(for|before|and|or|toward|towards).*$/,'')
    .replace(/\+$/,'');
  const aliases = {
    'attack':'attack','strength':'strength','defence':'defence','defense':'defence',
    'ranged':'ranged','prayer':'prayer','magic':'magic','hitpoints':'hitpoints',
    'slayer':'slayer','agility':'agility','construction':'construction','cooking':'cooking',
    'crafting':'crafting','farming':'farming','firemaking':'firemaking','fishing':'fishing',
    'fletching':'fletching','herblore':'herblore','hunter':'hunter','mining':'mining',
    'runecraft':'runecraft','runecrafting':'runecraft','smithing':'smithing',
    'thieving':'thieving','woodcutting':'woodcutting','sailing':'sailing'
  };
  return aliases[x] || '';
}

function buildTodayCommand_(ss, roadmap, shopping, questIntel) {
  const stats = {};
  readTable_(ss,'Stats').forEach(r => stats[String(r.Skill||'').toLowerCase()] = Number(r.Level||1));
  const quests = {};
  readTable_(ss,'Quests').forEach(r => {
    if(r.Quest) quests[normalizeName_(r.Quest)] = String(r.Status||'').toUpperCase();
  });
  const ownedItems=buildOwnedItemIndex_(ss);

  const docs = getSourceDocs_();
  const current = roadmap.current;
  let primary = null;

  // Respect the sequential master checklist, but apply the explicit quest-efficiency rules
  // before recommending wasteful early melee grinding.
  const efficientQuest = pickEfficientQuest_(quests, stats);
  if (current && current.type === 'skill' && ['attack','strength','defence','prayer','hitpoints','magic'].includes(current.key) && efficientQuest) {
    primary = {
      kind:'quest',
      title:efficientQuest.name,
      eyebrow:'DO THIS BEFORE GRINDING',
      reason:efficientQuest.reason,
      progress:'Quest XP shortcut',
      source:'Master Checklist â€” Quest Efficiency Rules'
    };
  } else if (current) {
    primary = roadmapTaskCard_(current, docs.skills, stats);
  }


  // A quest is recommendable only when both prerequisite quests AND required
  // quest-reward items are satisfied.
  if(primary && primary.kind==='quest'){
    const originalTitle=primary.title;
    const blocker=resolveQuestBlocker_(originalTitle,questIntel,quests,ownedItems);
    if(blocker && blocker.type==='QUEST'){
      primary={
        kind:'quest',
        title:blocker.quest,
        eyebrow:'PREREQUISITE FIRST',
        reason:blocker.reason,
        progress:'Required before '+originalTitle,
        source:'OSRS Wiki quest dependency'
      };
    } else if(blocker && blocker.type==='ITEM'){
      primary={
        kind:'item',
        title:'Recover '+blocker.item,
        eyebrow:'REQUIRED ITEM FIRST',
        reason:blocker.reason,
        progress:'Blocks '+originalTitle,
        instructions:blocker.action,
        source:'OSRS Wiki quest reward dependency',
        blockedQuest:originalTitle
      };
    }
  }

  const secondary = [];
  roadmap.next.forEach(item => {
    if (!primary || item.task !== primary.title) {
      const card = roadmapTaskCard_(item, docs.skills, stats);
      if (card && secondary.length < 3) secondary.push(card);
    }
  });

  // Always expose one useful quest candidate when it is not the primary.
  if (efficientQuest && (!primary || primary.title !== efficientQuest.name) && secondary.length < 3) {
    const b=resolveQuestBlocker_(efficientQuest.name,questIntel,quests,ownedItems);
    if(!b){
      secondary.push({
        kind:'quest',
        title:efficientQuest.name,
        eyebrow:'QUEST EFFICIENCY',
        reason:efficientQuest.reason,
        progress:'Free/efficient XP',
        source:'Master Checklist'
      });
    }
  }

  if (primary && shopping && shopping.byQuest) {
    const prep = shopping.byQuest[normalizeName_(primary.title)] || shopping.byQuest[normalizeName_(String(primary.rawTask||'').replace(/^Complete\s+/i,''))];
    if (prep) primary.shopping = prep;
  }
  if(primary && primary.kind==='quest' && questIntel){
    const qs={};
    readTable_(ss,'Quests').forEach(r=>{if(r.Quest)qs[normalizeName_(r.Quest)]=String(r.Status||'').toUpperCase();});
    const qi=getQuestIntelForName_(primary.title,questIntel.knowledge||{},qs);
    if(qi)primary.questIntel=qi;
  }

  return {
    primary:primary,
    secondary:secondary.slice(0,3),
    fireCapePercent:roadmap.fireCapePercent,
    fireCapeComplete:roadmap.fireCapeComplete,
    fireCapeTotal:roadmap.fireCapeTotal,
    currentPhase:roadmap.currentPhase,
    currentPhaseComplete:roadmap.currentPhaseComplete,
    currentPhaseTotal:roadmap.currentPhaseTotal
  };
}

function roadmapTaskCard_(item, skillText, stats) {
  if (!item) return null;

  if (item.type === 'skill') {
    const skill = item.key;
    const cur = Number(stats[skill]||1);
    const methods = trainingMethodsForSkill_(skillText, skill);
    const bracket = scanBracketForSkill_(skillText, skill, cur);
    return {
      kind:'skill',
      title:title_(skill)+' '+cur+' â†’ '+item.target,
      rawTask:item.task,
      eyebrow:'TRAINING',
      progress:item.progress,
      reason:bracket || 'Advance the next master-roadmap skill checkpoint.',
      recommended:methods.recommended,
      fastest:methods.fastest,
      lowCost:methods.lowCost,
      source:'Skill Leveling Guide'
    };
  }

  if (item.type === 'quest') {
    return {
      kind:'quest',
      title:item.task.replace(/^Complete\s+/i,''),
      rawTask:item.task,
      eyebrow:item.progress==='In progress'?'QUEST â€” IN PROGRESS':'QUEST',
      progress:item.progress,
      reason:'Next quest in the sequential Master Progression Checklist.',
      source:'Master Progression Checklist'
    };
  }

  return {
    kind:'milestone',
    title:item.task,
    rawTask:item.task,
    eyebrow:'ACCOUNT MILESTONE',
    progress:item.progress,
    reason:'Next manual milestone in the Master Progression Checklist.',
    source:'Master Progression Checklist'
  };
}

function pickEfficientQuest_(quests, stats) {
  const list = [
    {name:'Waterfall Quest', reason:'13,750 Attack + 13,750 Strength XP. The master guide says to do this before manually grinding early melee.'},
    {name:'Fight Arena', reason:'12,175 Attack XP and an excellent early Attack shortcut.'},
    {name:'Tree Gnome Village', reason:'11,450 Attack XP plus Spirit Trees; also required for Monkey Madness I.'},
    {name:"The Grand Tree", reason:'18,400 Attack + 7,900 Agility + 2,150 Magic XP, Gnome Gliders, and Monkey Madness I progression.'},
    {name:"Witch's House", reason:'6,325 Hitpoints XP before harder combat quest chains.'},
    {name:"Merlin's Crystal", reason:'Unlocks Holy Grail and the later Piety chain.'},
    {name:'Holy Grail', reason:'11,000 Prayer + 15,300 Defence XP; one of the best efficiency quests on the Fire Cape/Piety route.'}
  ];

  for (let i=0;i<list.length;i++) {
    const st = quests[normalizeName_(list[i].name)] || '';
    if (!(st==='FINISHED' || st==='COMPLETE')) return list[i];
  }
  return null;
}

function scanBracketForSkill_(text, skill, current) {
  const heading = title_(skill).toUpperCase();
  const start = text.indexOf(heading + ' â€”');
  if (start < 0) return '';
  const chunk = text.substring(start, Math.min(text.length, start+1800));
  const lines = chunk.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);

  for (let i=0;i<lines.length;i++) {
    const m = lines[i].match(/^(\d+)\s*[â†’-]\s*(\d+)[^:]*:\s*(.+)$/);
    if (m) {
      const lo=Number(m[1]), hi=Number(m[2]);
      if (current>=lo && current<hi) return m[3];
    }
    const m2 = lines[i].match(/^Current\s*[â†’-]\s*(\d+):\s*(.+)$/i);
    if (m2 && current<Number(m2[1])) return m2[2];
  }
  return '';
}

function trainingMethodsForSkill_(text, skill) {
  const numbered = {
    ranged:'1. RANGED', prayer:'2. PRAYER', attack:'3. ATTACK', strength:'4. STRENGTH',
    defence:'5. DEFENCE', magic:'6. MAGIC', slayer:'7. SLAYER', hitpoints:'8. HITPOINTS',
    agility:'9. AGILITY', construction:'10. CONSTRUCTION', crafting:'11. CRAFTING',
    herblore:'12. HERBLORE', mining:'13. MINING', smithing:'14. SMITHING',
    fishing:'15. FISHING', thieving:'16. THIEVING', firemaking:'17. FIREMAKING',
    fletching:'18. FLETCHING', farming:'19. FARMING', hunter:'20. HUNTER',
    runecraft:'21. RUNECRAFT', woodcutting:'22. WOODCUTTING', sailing:'23. SAILING',
    cooking:'24. COOKING'
  };
  const h = numbered[skill];
  if (!h) return {fastest:null,recommended:null,lowCost:null};
  const start=text.indexOf(h);
  if(start<0) return {fastest:null,recommended:null,lowCost:null};
  const next=text.indexOf('============================================================',start);
  const chunk=text.substring(start,next>start?next:Math.min(text.length,start+7000));
  return {
    fastest:extractMethod_(chunk,'FASTEST / HIGH-COST'),
    recommended:extractMethod_(chunk,'BALANCED / COST-EFFECTIVE - RECOMMENDED'),
    lowCost:extractMethod_(chunk,'LOW-COST / EFFICIENT')
  };
}

function extractMethod_(chunk,label) {
  const at=chunk.indexOf(label);
  if(at<0) return null;
  const before=chunk.substring(0,at).split(/\r?\n/).filter(Boolean);
  const meta=before.length ? before[before.length-1].trim() : '';
  const after=chunk.substring(at+label.length).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const desc=after.length ? after[0] : '';
  const metaParsed=parseMethodMeta_(meta);
  return {
    label:label,
    levelRange:metaParsed.levelRange,
    xpHr:metaParsed.xpHr,
    hours:metaParsed.hours,
    gpHr:metaParsed.gpHr,
    description:desc
  };
}

function parseMethodMeta_(s) {
  const text=String(s||'').replace(/\s+/g,' ').trim();

  // Source guide rows sometimes use pipes inconsistently. Parse each labeled
  // field by stopping at the NEXT known label instead of depending on "|".
  function grab(label, nextLabels) {
    const stop=(nextLabels||[]).map(x=>escapeRegex_(x)+'\\s*:').join('|');
    const re=new RegExp(
      escapeRegex_(label)+'\\s*:\\s*(.*?)'+
      (stop ? '(?=\\s*(?:\\|\\s*)?(?:'+stop+'))' : '$'),
      'i'
    );
    const m=text.match(re);
    return m ? m[1].replace(/\s*\|\s*$/,'').trim() : '';
  }

  const levelRange=grab('LEVEL RANGE',['EXPECTED XP/HR','EXPECTED HOURS','EXPECTED GP/HR']);
  const xpHr=grab('EXPECTED XP/HR',['EXPECTED HOURS','EXPECTED GP/HR']);
  const hours=grab('EXPECTED HOURS',['EXPECTED GP/HR']);
  const gpHr=grab('EXPECTED GP/HR',[]);

  return {
    levelRange:cleanMethodField_(levelRange),
    xpHr:cleanMethodField_(xpHr),
    hours:cleanMethodField_(hours),
    gpHr:cleanMethodField_(gpHr)
  };
}

function cleanMethodField_(v) {
  return String(v||'')
    .replace(/\s*\|\s*/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function ensureMoneyMethods_(ss) {
  const sh = ss.getSheetByName('Money Methods');
  if (sh.getLastRow() >= 2) return;

  const rows = [
    ['Method','GP/HR','Category','Attention','Risk','Min Cash','Skill','Level','Quest','Account Value','Market Sensitive','Notes','Source'],
    ['Cut yews + Forestry',350000,'Skilling','Low','Low',0,'Woodcutting',60,'',4,false,'Very relaxed; also progresses Woodcutting. Forestry bark/rewards materially improve profit.','OSRS Wiki'],
    ['Tan cowhides',480000,'Processing','Low','Low',200000,'',0,'',1,true,'Easy and accessible, but margins move. Test a small batch before committing cash.','OSRS Wiki'],
    ['Herb run',212000,'Recurring','Low','Low',150000,'Farming',38,'',5,true,'Roughly 6 minutes of active work per run; 212k is profit per run, not per clock hour. Excellent between other activities.','OSRS Wiki'],
    ['Collect Mort myre fungi',490000,'Collecting','Medium','Low',100000,'',0,'Nature Spirit',2,false,'Requires access to Morytania and Nature Spirit progress. Higher Prayer and fairy rings improve the route.','OSRS Wiki'],
    ['High Alch profitable items',299000,'Skilling','Low','Low',500000,'Magic',55,'',4,true,'Can train Magic while making modest profit. Always check margins before buying a large stack.','OSRS Wiki'],
    ['Barrows',800000,'Combat','Medium','Low',500000,'Prayer',43,'Priest in Peril',4,false,'Midgame PvM milestone. 50+ Magic strongly recommended; actual rate depends heavily on run speed.','OSRS Wiki'],
    ['Create crystal keys',2285000,'Processing','High','Low',5000000,'',0,'',0,true,'High headline profit but strongly market-sensitive. Only use after testing current GE margins with a small batch.','OSRS Wiki']
  ];

  sh.clearContents();
  sh.getRange(1,1,rows.length,rows[0].length).setValues(rows);
}

function buildGoldPlan_(ss) {
  ensureMoneyMethods_(ss);

  const stats = {};
  readTable_(ss,'Stats').forEach(r => stats[String(r.Skill||'').toLowerCase()] = Number(r.Level||1));

  const quests = {};
  readTable_(ss,'Quests').forEach(r => {
    if (r.Quest) quests[String(r.Quest).toLowerCase()] = String(r.Status||'').toUpperCase();
  });

  const account = readKV_(ss,'Account');
  const totalWealth = Number(account.totalVisibleWealth || 0);
  const liquidGp = Number(account.cashGp || 0);
  const nextGoal = nextBankGoal_(totalWealth);
  const remaining = Math.max(0, nextGoal - totalWealth);

  const methods = readTable_(ss,'Money Methods').map(m => {
    const skill = String(m.Skill || '').trim().toLowerCase();
    const levelReq = Number(m.Level || 0);
    const quest = String(m.Quest || '').trim();
    const minCash = Number(m['Min Cash'] || 0);
    const gpHr = Number(m['GP/HR'] || 0);

    let eligible = true;
    const missing = [];

    if (skill && Number(stats[skill] || 1) < levelReq) {
      eligible = false;
      missing.push(title_(skill) + ' ' + levelReq);
    }
    if (quest) {
      const qs = quests[quest.toLowerCase()] || '';
      if (!(qs === 'FINISHED' || qs === 'COMPLETE')) {
        eligible = false;
        missing.push(quest);
      }
    }
    if (liquidGp < minCash) {
      eligible = false;
      missing.push(fmtGpServer_(minCash) + ' starting cash');
    }

    const accountValue = Number(m['Account Value'] || 0);
    const marketSensitive = String(m['Market Sensitive']).toLowerCase() === 'true';
    const riskPenalty = String(m.Risk||'').toLowerCase() === 'high' ? 3 : (String(m.Risk||'').toLowerCase() === 'medium' ? 1 : 0);
    const marketPenalty = marketSensitive ? 1 : 0;
    const score = eligible ? (Math.log10(Math.max(gpHr,1)) * 10 + accountValue * 3 - riskPenalty - marketPenalty) : -999;

    return {
      method:m.Method,
      gpHr:gpHr,
      category:m.Category,
      attention:m.Attention,
      risk:m.Risk,
      minCash:minCash,
      accountValue:accountValue,
      marketSensitive:marketSensitive,
      notes:m.Notes,
      eligible:eligible,
      missing:missing,
      hoursToGoal:gpHr > 0 ? remaining / gpHr : null,
      score:score
    };
  });

  const available = methods.filter(m => m.eligible);
  const byGp = available.slice().sort((a,b)=>b.gpHr-a.gpHr);
  const byRecommended = available.slice().sort((a,b)=>b.score-a.score);
  const lowAttention = available.filter(m=>String(m.attention).toLowerCase()==='low').sort((a,b)=>b.score-a.score);

  const safest = available
    .filter(m => !m.marketSensitive)
    .sort((a,b)=>b.score-a.score);

  return {
    totalWealth:totalWealth,
    liquidGp:liquidGp,
    nextBankGoal:nextGoal,
    remaining:remaining,
    recommended:byRecommended[0] || null,
    pureGp:byGp[0] || null,
    lowAttention:lowAttention[0] || null,
    stable:safest[0] || byRecommended[0] || null,
    available:byRecommended.slice(0,6),
    locked:methods.filter(m=>!m.eligible).slice(0,5)
  };
}

function nextBankGoal_(wealth) {
  const goals = [1000000,5000000,10000000,25000000,50000000,100000000,250000000,500000000,1000000000];
  for (let i=0;i<goals.length;i++) if (wealth < goals[i]) return goals[i];
  return 1000000000;
}

function fmtGpServer_(v) {
  const n = Number(v||0);
  if (n >= 1e9) return (n/1e9).toFixed(2)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(2)+'M';
  if (n >= 1e3) return Math.round(n/1e3)+'K';
  return String(Math.round(n));
}

function generateDailyPlan_(ss) {
  const statRows = readTable_(ss,'Stats');
  if (!statRows.length) {
    return [[
      'Main Goals',
      'Stats unavailable â€” retry Refresh Now',
      'No successful stat snapshot yet',
      'The dashboard will not guess your levels.',
      'HIGH'
    ]];
  }

  const goals = readTable_(ss,'Goals').filter(g => String(g.Status).toUpperCase() !== 'COMPLETE');
  const score = {HIGH:3,MED:2,LOW:1};
  goals.sort((a,b)=>(score[String(b.Priority).toUpperCase()]||0)-(score[String(a.Priority).toUpperCase()]||0));
  return goals.slice(0,5).map(g=>['Main Goals',g.Goal,g.Progress||'',g.Why||'',g.Priority||'MED']);
}

function writeDailyPlan_(ss,rows) {
  const sh = ss.getSheetByName('Daily Plan');
  sh.clearContents();
  sh.getRange(1,1,1,5).setValues([['Tab','Task','Progress','Why','Priority']]);
  if (rows.length) sh.getRange(2,1,rows.length,5).setValues(rows);
}

function logRefresh_(ss,r) {
  let sh = ss.getSheetByName('Refresh Log');
  if (!sh) sh = ss.insertSheet('Refresh Log');
  if (sh.getLastRow() === 0)
    sh.getRange(1,1,1,7).setValues([['Timestamp','Refresh Type','Overall OK','Stats','Quests','Wealth','Recommendations']]);
  sh.appendRow([new Date(),r.refreshType,r.ok,r.sources.stats.message,r.sources.quests.message,r.sources.wealth.message,r.sources.recommendations.message]);
}

function readTable_(ss,name) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const vals = sh.getDataRange().getValues();
  const headers = vals.shift().map(String);
  return vals.filter(row=>row.some(x=>x!=='')).map(row=>{
    const o={}; headers.forEach((h,i)=>o[h]=row[i]); return o;
  });
}

function readKV_(ss,name) {
  const sh = ss.getSheetByName(name);
  const o={};
  if (!sh) return o;
  sh.getDataRange().getValues().forEach(r=>{ if(r[0]) o[String(r[0])] = r[1]; });
  return o;
}

function upsert_(sh,key,val) {
  const vals = sh.getDataRange().getValues();
  for(let i=0;i<vals.length;i++){
    if(String(vals[i][0])===key){ sh.getRange(i+1,2).setValue(val); return; }
  }
  sh.appendRow([key,val]);
}

function title_(s) {
  return String(s).replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

