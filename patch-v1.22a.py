from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
trust_path = ROOT / "QuestRequirementsTrust.js"
html_path = ROOT / "V1.html"
deploy_path = ROOT / "deploy.ps1"

for p in (trust_path, html_path, deploy_path):
    if not p.exists():
        raise SystemExit(f"Missing required project file: {p.name}")

def read(p):
    return p.read_text(encoding="utf-8-sig")

def write(p, s):
    p.write_text(s, encoding="utf-8", newline="\n")

# ------------------------------------------------------------
# 1) Fairytale II parser exception.
# Quest Helper defines the 3 SkillRequirement objects in
# setupRequirements() and references variables in getGeneralRequirements(),
# so the direct-constructor parser misses them.
# ------------------------------------------------------------
trust = read(trust_path)

if "slug==='fairytaleiicureaqueen'" not in trust:
    fn_start = trust.find("function qhV122Policy_(")
    fn_end = trust.find("function qhV122RfdFallback_", fn_start)
    if fn_start < 0 or fn_end < 0:
        raise SystemExit("Could not locate qhV122Policy_ in QuestRequirementsTrust.js.")

    block = trust[fn_start:fn_end]
    marker = "\n  return {\n"
    pos = block.rfind(marker)
    if pos < 0:
        raise SystemExit("Could not locate qhV122Policy_ return block.")

    fairytale = r'''
  else if(slug==='fairytaleiicureaqueen'){
    qs='40 THIEVING; 49 FARMING; 57 HERBLORE';
    status=qhV118SkillSet_(dataset)===qhV118SkillSet_(qs)?'VERIFIED':'REVIEW';
    reason=status==='VERIFIED'
      ?'OSRS Wiki and Quest Helper confirm 40 Thieving, 49 Farming, and 57 Herblore. Quest Helper stores the skill requirements as variables, so the generic direct-constructor parser cannot discover them.'
      :'Dataset differs from the verified Fairytale II skill requirements.';
  }
'''
    block = block[:pos] + fairytale + block[pos:]
    trust = trust[:fn_start] + block + trust[fn_end:]

if "function qhInstallV122a()" not in trust:
    trust = trust.rstrip() + r'''

function qhInstallV122a() {
  return qhInstallV122();
}
''' + "\n"

write(trust_path, trust)

# ------------------------------------------------------------
# 2) Visible version label.
# ------------------------------------------------------------
html = read(html_path)
html = html.replace("V1.22 · Know What Is Optional", "V1.22a · Know What Is Optional")
write(html_path, html)

# ------------------------------------------------------------
# 3) Permanently upgrade deploy.ps1:
#    - push Apps Script source
#    - automatically redeploy the live dashboard URL(s)
#    - pick the named Sensum deployment plus the newest numeric deployment
#      from clasp list-deployments
# ------------------------------------------------------------
deploy = read(deploy_path)

if "V122A_AUTO_WEBAPP_REDEPLOY" not in deploy:
    marker = '''  Write-Host ""
  Write-Host "==========================================" -ForegroundColor Green
'''
    if marker not in deploy:
        raise SystemExit("Could not locate deploy.ps1 success banner.")

    redeploy_block = r'''
  # V122A_AUTO_WEBAPP_REDEPLOY
  Step "Redeploying live Apps Script web app"

  $deploymentOutput = @(& clasp list-deployments)
  if ($LASTEXITCODE -ne 0) {
    Fail "Could not list Apps Script deployments."
  }

  $parsedDeployments = @()
  foreach ($line in $deploymentOutput) {
    if ($line -match '^\-\s+(AKfy\S+)\s+@(\d+)(?:\s+\-\s+(.+))?$') {
      $parsedDeployments += [PSCustomObject]@{
        Id = $Matches[1]
        Version = [int]$Matches[2]
        Description = [string]$Matches[3]
      }
    }
  }

  if ($parsedDeployments.Count -eq 0) {
    Fail "No versioned Apps Script deployments were found."
  }

  $targets = @()

  $named = @($parsedDeployments | Where-Object {
    $_.Description -match 'Sensum\s*-\s*OSRS\s*Dashboard'
  })
  if ($named.Count -gt 0) {
    $targets += $named
  }

  $newest = $parsedDeployments | Sort-Object Version -Descending | Select-Object -First 1
  if ($newest) {
    $targets += $newest
  }

  $targets = @($targets | Group-Object Id | ForEach-Object { $_.Group[0] })

  $claspHelp = (& clasp --help 2>&1 | Out-String)
  foreach ($target in $targets) {
    Write-Host ("Redeploying " + $target.Id + " (currently @" + $target.Version + ")") -ForegroundColor DarkCyan

    if ($claspHelp -match 'update-deployment') {
      & clasp update-deployment $target.Id --description $Message
    } else {
      & clasp deploy -i $target.Id -d $Message
    }

    if ($LASTEXITCODE -ne 0) {
      Fail ("Apps Script live redeployment failed for " + $target.Id)
    }
  }

  Write-Host ""
  Write-Host ("Live deployment(s) updated: " + (($targets | ForEach-Object { $_.Id }) -join ", ")) -ForegroundColor Green

'''
    deploy = deploy.replace(marker, redeploy_block + marker, 1)

deploy = deploy.replace(
    '  Write-Host " Live web app: NOT redeployed" -ForegroundColor Yellow',
    '  Write-Host " Live web app: redeployed automatically" -ForegroundColor Green'
)

write(deploy_path, deploy)

print("V1.22a patch applied successfully.")
