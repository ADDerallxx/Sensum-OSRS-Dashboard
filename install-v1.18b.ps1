$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$path = Join-Path $root 'QuestRequirementsTrust.js'

if (!(Test-Path $path)) {
    throw "QuestRequirementsTrust.js was not found in $root"
}

$backup = Join-Path $root 'QuestRequirementsTrust.v1.18a.bak.js'
Copy-Item $path $backup -Force

$content = [IO.File]::ReadAllText($path)

$anchor = "function qhV118Norm_(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim();}"

if (-not $content.Contains('function qhV118SkillSet_(')) {
$helpers = @'
function qhV118Norm_(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim();}
function qhV118SkillSet_(s){
  const out=[],re=/\b(?:([a-z]+)\s+(\d+)|(\d+)\s+([a-z]+))\b/g; let m;
  s=String(s||'').toLowerCase().replace(/\*/g,' ');
  while((m=re.exec(s))!==null){
    const skill=m[1]||m[4],level=m[2]||m[3];
    out.push(skill+':'+level);
  }
  return out.sort().join('|');
}
function qhV118Path_(quest){
  const overrides={
    'merlinscrystal':'src/main/java/com/questhelper/helpers/quests/merlinscrystal/MerlinsCrystal.java',
    'dragonslayeri':'src/main/java/com/questhelper/helpers/quests/dragonslayer/DragonSlayer.java',
    'enakhraslament':'src/main/java/com/questhelper/helpers/quests/enakhraslament/EnakhrasLament.java'
  };
  return overrides[qhV118Norm_(quest)]||qhDirectQuestPath_(quest);
}
'@

    if (-not $content.Contains($anchor)) {
        throw "Could not find the V1.18 normalization anchor. No changes were written."
    }
    $content = $content.Replace($anchor, $helpers.TrimEnd())
}

$content = $content.Replace(
    "path=qhDirectQuestPath_(quest);",
    "path=qhV118Path_(quest);"
)

$content = $content.Replace(
    "status=norm(dataset)===norm(qs)?'VERIFIED':'REVIEW';",
    "status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';"
)

$content = $content.Replace(
    "if(slug==='thefremenniktrials'){alt=",
    "if(slug==='thefremenniktrials'){qs='None';alt="
)

[IO.File]::WriteAllText($path, $content, (New-Object Text.UTF8Encoding($false)))

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    & node --check $path
    if ($LASTEXITCODE -ne 0) {
        Copy-Item $backup $path -Force
        throw "JavaScript syntax check failed. The original V1.18 file was restored."
    }
}

Write-Host ""
Write-Host "V1.18b audit cleanup is installed locally." -ForegroundColor Green
Write-Host "Fixed:"
Write-Host " - skill comparisons are order/format insensitive"
Write-Host " - Merlin's Crystal Quest Helper path"
Write-Host " - Dragon Slayer I Quest Helper path"
Write-Host " - Enakhra's Lament Quest Helper path"
Write-Host " - Fremennik Trials QH mandatory skills display"
Write-Host ""
Write-Host 'Next: .\deploy.ps1 -Message "V1.18b audit normalization and path fixes"'
