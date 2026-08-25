param()
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$trust = Join-Path $root "QuestRequirementsTrust.js"
$qh = Join-Path $root "QuestHelperSync.js"
$v1 = Join-Path $root "V1.html"
$deploy = Join-Path $root "deploy.ps1"

foreach ($f in @($trust,$qh,$v1,$deploy)) {
    if (!(Test-Path -LiteralPath $f)) {
        throw "Missing required project file: $f. Extract this ZIP into the Sensum-OSRS-Dashboard folder."
    }
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$backupDir = Join-Path $env:TEMP ("Sensum-V120-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $backupDir | Out-Null
Copy-Item $trust (Join-Path $backupDir "QuestRequirementsTrust.bak") -Force
Copy-Item $qh (Join-Path $backupDir "QuestHelperSync.bak") -Force
Copy-Item $v1 (Join-Path $backupDir "V1.bak") -Force

try {
    # ------------------------------------------------------------
    # 1) Harden Quest Helper source-path resolution.
    # ------------------------------------------------------------
    $qhText = [IO.File]::ReadAllText($qh)

    if ($qhText -notmatch "'blackknightsfortress'") {
        $marker = "  const overrides = {"
        if (-not $qhText.Contains($marker)) {
            throw "Could not locate qhDirectQuestPath_ overrides map."
        }

        $extraOverrides = @"
  const overrides = {
    'blackknightsfortress': 'src/main/java/com/questhelper/helpers/quests/blackknightfortress/BlackKnightFortress.java',
    'ragandbonemani': 'src/main/java/com/questhelper/helpers/quests/ragandboneman/RagAndBoneManI.java',
    'ragandbonemanii': 'src/main/java/com/questhelper/helpers/quests/ragandboneman/RagAndBoneManII.java',
    'romeojuliet': 'src/main/java/com/questhelper/helpers/quests/romeoandjuliet/RomeoAndJuliet.java',
    'shieldofarrav': 'src/main/java/com/questhelper/helpers/quests/shieldofarrav/ShieldOfArravPhoenixGang.java',
    'fairytaleigrowingpains': 'src/main/java/com/questhelper/helpers/quests/fairytalei/FairytaleI.java',
    'deserttreasurei': 'src/main/java/com/questhelper/helpers/quests/deserttreasure/DesertTreasure.java',
"@
        $qhText = $qhText.Replace($marker, $extraOverrides.TrimEnd())
    }

    $oldClassLine = "    .replace(/[^A-Za-z0-9]+/g, ' ')"
    $newClassLines = "    .replace(/['\u2019]/g, '')`r`n    .replace(/[^A-Za-z0-9]+/g, ' ')"
    if ($qhText.Contains($oldClassLine) -and $qhText -notmatch "\\u2019") {
        $qhText = $qhText.Replace($oldClassLine, $newClassLines)
    }

    [IO.File]::WriteAllText($qh, $qhText, $utf8)

    # ------------------------------------------------------------
    # 2) Add V1.20 dataset policy + resilient whole-dataset audit.
    # ------------------------------------------------------------
    $trustText = [IO.File]::ReadAllText($trust)

    if ($trustText -notmatch "function qhInstallV120\(\)") {
        $v120 = @'

// V1.20 Whole-Dataset Requirements Trust
function qhV120FindQuestRow_(sh, quest) {
  const v=sh.getDataRange().getDisplayValues();
  let hr=-1,h=[];
  for(let i=0;i<Math.min(v.length,15);i++){
    const r=v[i].map(String);
    if(r.some(x=>/^quest name$/i.test(x.trim()))){hr=i;h=r;break}
  }
  if(hr<0) throw new Error('Quest Dependency header not found');
  const q=qhV118Header_(h,[/^quest name$/i]);
  let row=-1;
  for(let i=hr+1;i<v.length;i++){
    if(qhV118Norm_(v[i][q])===qhV118Norm_(quest)){row=i+1;break}
  }
  return {row:row,headerRow:hr+1,headers:h};
}

function qhV120FixDataset_() {
  const ss=SpreadsheetApp.openById(QH_TRACKER_ID);
  const sh=ss.getSheetByName('Quest Dependency');
  if(!sh) throw new Error('Quest Dependency sheet not found');

  const first=qhV120FindQuestRow_(sh,'Watchtower');
  const h=first.headers;
  const sk=qhV118Header_(h,[/^skill level requirements?$/i,/^skill requirements?$/i]);
  let alt=qhV118Header_(h,[/^conditional \/ alternative requirements$/i]);
  if(alt<0){
    alt=h.length;
    sh.getRange(first.headerRow,alt+1).setValue('Conditional / Alternative Requirements');
  }

  function setQuest(quest,skills,conditional){
    const x=qhV120FindQuestRow_(sh,quest);
    if(x.row<0) throw new Error(quest+' not found in Quest Dependency');
    if(sk>=0 && skills!=null) sh.getRange(x.row,sk+1).setValue(skills);
    if(conditional!=null) sh.getRange(x.row,alt+1).setValue(conditional);
  }

  setQuest('Watchtower',
    'Agility 25, Herblore 14, Magic 15, Mining 40, Thieving 15',
    '');

  setQuest('The Fremennik Isles',
    'Construction 20',
    '40 Agility is optional/recommended for Central Fremennik Isles mine access. 56 Woodcutting and 46 Crafting are alternative item-making paths and can be avoided by obtaining the required items.');

  setQuest('What Lies Below',
    'Runecraft 35',
    '42 Mining is recommended/optional for the Tunnel of Chaos route that avoids the Wilderness; it is not a hard quest requirement.');

  setQuest('Prying Times',
    'Sailing 12, Smithing 30',
    '');

  setQuest('Tai Bwo Wannai Trio',
    'Agility 15, Cooking 30, Fishing 5',
    '30 Firemaking is recommended only; burnt jogre bones can be made at a furnace instead.');

  setQuest('Learning the Ropes','None','');

  SpreadsheetApp.flush();
  return {ok:true};
}

function qhV120Source_(quest) {
  const path=qhV118Path_(quest);
  const src=qhFetchText_('https://raw.githubusercontent.com/'+QH_REPO+'/'+QH_BRANCH+'/'+path);
  return {path:path,src:src};
}

function qhV120Policy_(quest,dataset,qs,combat,path) {
  const slug=qhV118Norm_(quest);
  let alt='',status='',reason='';

  if(slug==='thefremenniktrials'){
    qs='None';
    alt='25 Fletching; 40 Woodcutting; 40 Crafting — optional lyre-making path only.';
    combat='Defeat Draugen (level 69); Koschei trial';
    status='VERIFIED';
    reason='Hard skills are none; lyre-making skills are conditional, not mandatory.';
  }
  else if(slug==='thefremennikisles'){
    qs='20 CONSTRUCTION';
    alt='40 Agility optional/recommended; 56 Woodcutting and 46 Crafting are avoidable item-making paths.';
    status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';
    reason=status==='VERIFIED'
      ?'OSRS Wiki route policy: only 20 Construction is a hard skill requirement.'
      :'Dataset differs from the OSRS Wiki hard-requirement interpretation.';
  }
  else if(slug==='whatliesbelow'){
    qs='35 RUNECRAFT';
    alt='42 Mining — recommended/optional for the Tunnel of Chaos route.';
    status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';
    reason=status==='VERIFIED'
      ?'OSRS Wiki lists 35 Runecraft as hard; 42 Mining is recommended, not mandatory.'
      :'Dataset differs from the OSRS Wiki hard-requirement interpretation.';
  }
  else if(slug==='pryingtimes'){
    qs='12 SAILING; 30 SMITHING';
    status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';
    reason=status==='VERIFIED'
      ?'OSRS Wiki fallback confirms current hard requirements; Quest Helper parser does not expose them.'
      :'Dataset differs from current OSRS Wiki requirements.';
  }
  else if(slug==='taibwowannaitrio'){
    qs='15 AGILITY; 30 COOKING; 5 FISHING';
    alt='30 Firemaking — recommended only; a furnace can be used instead.';
    status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';
    reason=status==='VERIFIED'
      ?'OSRS Wiki confirms 30 Firemaking is recommended, not a hard requirement.'
      :'Dataset differs from the OSRS Wiki hard-requirement interpretation.';
  }

  return {qs:qs,alt:alt,combat:combat,path:path,status:status,reason:reason};
}

function qhV120AuditBatch_(start,size) {
  start=Number(start||0);
  size=Math.min(25,Number(size||20));

  const ss=SpreadsheetApp.openById(QH_TRACKER_ID);
  const dep=ss.getSheetByName('Quest Dependency');
  const v=dep.getDataRange().getDisplayValues();

  let hr=-1,h=[];
  for(let i=0;i<Math.min(v.length,15);i++){
    const r=v[i].map(String);
    if(r.some(x=>/^quest name$/i.test(x.trim()))){hr=i;h=r;break}
  }

  const q=qhV118Header_(h,[/^quest name$/i]);
  const sk=qhV118Header_(h,[/^skill level requirements?$/i,/^skill requirements?$/i]);
  const rows=v.slice(hr+1).filter(r=>String(r[q]||'').trim());
  const sh=ss.getSheetByName('Quest Data Audit')||ss.insertSheet('Quest Data Audit');

  if(start===0){
    sh.clearContents();
    sh.getRange(1,1,1,9).setValues([[
      'Quest','Dataset Mandatory Skills','QH Mandatory Skills',
      'Conditional / Alternative Skills','Combat / Capability Requirements',
      'Status','Reason','QH Source','Checked At'
    ]]);
    sh.setFrozenRows(1);
  }

  const out=[];
  const end=Math.min(rows.length,start+size);

  for(let i=start;i<end;i++){
    const quest=String(rows[i][q]||'').trim();
    const dataset=sk>=0?String(rows[i][sk]||'').trim():'';
    const slug=qhV118Norm_(quest);

    let path='',qs='',alt='',combat='',status='REVIEW',reason='';

    try{
      const source=qhV120Source_(quest);
      path=source.path;
      qs=qhV118Skills_(source.src);
      combat=qhV118Combat_(source.src);

      const policy=qhV120Policy_(quest,dataset,qs,combat,path);
      qs=policy.qs; alt=policy.alt; combat=policy.combat; path=policy.path;

      if(policy.status){
        status=policy.status;
        reason=policy.reason;
      }else{
        status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';
        reason=status==='VERIFIED'
          ?'Dataset agrees with Quest Helper hard requirements.'
          :'Dataset and Quest Helper hard requirements differ.';
      }
    }catch(e){
      if(slug==='learningtheropes'){
        path='OSRS Wiki fallback';
        qs='None';
        combat='2 Giant rats (level 3)';
        status=qhV118SkillSet_(dataset)===''?'VERIFIED':'REVIEW';
        reason=status==='VERIFIED'
          ?'OSRS Wiki confirms Learning the Ropes has no skill requirements; Quest Helper has no matching helper source.'
          :'Dataset differs from OSRS Wiki fallback.';
      }else{
        status='NO SOURCE';
        reason=String(e&&e.message?e.message:e);
      }
    }

    out.push([quest,dataset,qs,alt,combat,status,reason,path,new Date()]);
  }

  if(out.length) sh.getRange(sh.getLastRow()+1,1,out.length,9).setValues(out);
  sh.autoResizeColumns(1,9);

  const next=end>=rows.length?0:end;
  PropertiesService.getScriptProperties().setProperty('QH_V120_AUDIT_CURSOR',String(next));

  return {ok:true,start:start,end:end,total:rows.length,next:next,complete:end>=rows.length};
}

function qhV120ContinueAudit_() {
  const ss=SpreadsheetApp.openById(QH_TRACKER_ID);
  const sh=ss.getSheetByName('Quest Data Audit');
  let cursor=sh?Math.max(0,sh.getLastRow()-1):0;

  if(cursor===0){
    const seed=qhV120AuditBatch_(0,20);
    cursor=Number(seed.next||0);
    if(cursor===0) return {ok:true,complete:true,next:0,auditedRows:seed.end};
  }

  const started=Date.now();
  let batches=0,result=null;

  while(cursor!==0 && batches<8 && (Date.now()-started)<260000){
    result=qhV120AuditBatch_(cursor,20);
    cursor=Number(result.next||0);
    batches++;
  }

  return {
    ok:true,
    batchesProcessed:batches,
    next:cursor,
    complete:cursor===0,
    auditedRows:(ss.getSheetByName('Quest Data Audit').getLastRow()-1),
    lastResult:result
  };
}

function qhV120ContinueAudit() {
  return qhV120ContinueAudit_();
}

function qhInstallV120() {
  qhV120FixDataset_();
  qhV118FixFremennik_();

  const first=qhV120AuditBatch_(0,20);
  let cursor=Number(first.next||0);
  const started=Date.now();
  let batches=0,result=first;

  while(cursor!==0 && batches<8 && (Date.now()-started)<260000){
    result=qhV120AuditBatch_(cursor,20);
    cursor=Number(result.next||0);
    batches++;
  }

  return {
    ok:true,
    version:'V1.20',
    first:first,
    additionalBatches:batches,
    next:cursor,
    complete:cursor===0,
    auditedRows:SpreadsheetApp.openById(QH_TRACKER_ID).getSheetByName('Quest Data Audit').getLastRow()-1,
    lastResult:result
  };
}
'@
        $trustText = $trustText.TrimEnd() + "`r`n" + $v120 + "`r`n"
        [IO.File]::WriteAllText($trust, $trustText, $utf8)
    }

    # ------------------------------------------------------------
    # 3) Bump the visible dashboard version.
    # ------------------------------------------------------------
    $v1Text = [IO.File]::ReadAllText($v1)
    $v1Text = [regex]::Replace($v1Text, 'V1\.19', 'V1.20')
    [IO.File]::WriteAllText($v1, $v1Text, $utf8)

    # ------------------------------------------------------------
    # 4) Syntax-check and deploy.
    # ------------------------------------------------------------
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        foreach ($js in @($trust,$qh)) {
            & node --check $js
            if ($LASTEXITCODE -ne 0) {
                throw "JavaScript syntax check failed for $js"
            }
        }
    }

    Write-Host ""
    Write-Host "V1.20 whole-dataset trust patch installed locally." -ForegroundColor Green
    Write-Host "Deploying to GitHub and Apps Script..." -ForegroundColor Cyan
    Write-Host ""

    & $deploy -Message "V1.20 whole-dataset requirements trust and source resolver"
    if ($LASTEXITCODE -ne 0) {
        throw "deploy.ps1 reported a failure."
    }

    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host " V1.20 DEPLOYED" -ForegroundColor Green
    Write-Host " Apps Script function to run: qhInstallV120" -ForegroundColor Yellow
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""

    if (Get-Command clasp -ErrorAction SilentlyContinue) {
        & clasp open-script
    }
}
catch {
    Copy-Item (Join-Path $backupDir "QuestRequirementsTrust.bak") $trust -Force
    Copy-Item (Join-Path $backupDir "QuestHelperSync.bak") $qh -Force
    Copy-Item (Join-Path $backupDir "V1.bak") $v1 -Force
    throw
}
finally {
    Remove-Item $backupDir -Recurse -Force -ErrorAction SilentlyContinue
}
