if (typeof require === 'function' && typeof process !== 'undefined') {
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const file = process.argv[2] || 'V1.html';
const html = fs.readFileSync(file, 'utf8');
const dashboardSource = fs.existsSync('DashboardV1.js') ? fs.readFileSync('DashboardV1.js', 'utf8') : '';
const gameDataSource = fs.existsSync('GameDataPlatformV285.js') ? fs.readFileSync('GameDataPlatformV285.js', 'utf8') : '';
const trainingSource = fs.existsSync('TrainingIntelligenceV281.js') ? fs.readFileSync('TrainingIntelligenceV281.js', 'utf8') : '';
const failures = [];
const warnings = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());

scripts.forEach((source, index) => {
  try {
    new vm.Script(source, { filename: `${file}#script${index + 1}` });
  } catch (error) {
    failures.push(`JavaScript syntax error: ${error.message}`);
  }
});

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
check(!duplicateIds.length, `Duplicate HTML IDs: ${duplicateIds.join(', ')}`);

const idSet = new Set(ids);
const tabs = [...html.matchAll(/id=["']heroTab([A-Za-z0-9_-]+)["']/g)].map(match => match[1]);
tabs.forEach(name => check(idSet.has(`heroPanel${name}`), `Tab heroTab${name} has no heroPanel${name}.`));

const handlers = [...html.matchAll(/\bon(?:click|input|change|keydown)=["']([^"']+)["']/gi)]
  .map(match => match[1]);
const declared = new Set([
  ...scripts.flatMap(source => [...source.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match => match[1])),
  ...scripts.flatMap(source => [...source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g)].map(match => match[1]))
]);
const ignoredCalls = new Set(['if', 'for', 'while', 'switch', 'Number', 'encodeURIComponent', 'decodeURIComponent', 'preventDefault', 'stopPropagation']);
const missingHandlers = new Set();
handlers.forEach(handler => {
  for (const match of handler.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = match[1];
    if (!ignoredCalls.has(name) && !declared.has(name)) missingHandlers.add(name);
  }
});
check(!missingHandlers.size, `Inline handlers reference missing functions: ${[...missingHandlers].join(', ')}`);

check(!html.includes('[object Object]'), 'Literal [object Object] placeholder found.');
const closingHtml = html.toLowerCase().lastIndexOf('</html>');
check(closingHtml >= 0 && !html.slice(closingHtml + 7).trim(), 'Unexpected content found after the closing </html> tag.');
check(/function\s+v264WikiAsset\s*\(/.test(html), 'Shared OSRS Wiki asset resolver is missing.');
check(/function\s+v264AssetError\s*\(/.test(html), 'Shared image retry/fallback handler is missing.');
check(/function\s+v125SkillIcon[\s\S]{0,400}v264WikiAsset/.test(html), 'Skill icons do not use the shared asset resolver.');
check(/function\s+v240Icon[\s\S]{0,300}v264WikiAsset/.test(html), 'Money and processing item icons do not use the shared asset resolver.');
check(/Checking the OSRS Wiki for a verified creation recipe/.test(html), 'Universal Wiki recipe resolver status is missing.');
const recipeSource = fs.readFileSync(path.join(path.dirname(file), 'RecipeResolverV270.js'), 'utf8');
check(/quantityCell=row\.length>=3\?row\[row\.length-2\]/.test(recipeSource), 'Recipe quantities must come from the Wiki quantity column, not numbers in item names.');
check(/Goal Progress &amp; Switching/.test(html) && /switchV271Goal/.test(html), 'Goal progress window must support active-goal switching.');
check(/Early-game/.test(html) && /Mid-game/.test(html) && /End-game/.test(html), 'Goal stage pills and filters are incomplete.');
check(/Expected Purchase Profit/.test(html) && /Expected Processing Profit/.test(html) && /Total Expected Profit/.test(html) && /combinedPotential=marketPotential\+processingPotential/.test(html), 'Purchase, processing, and total expected profit must remain visibly separated and retain negative projections.');
check(/V3\.02c · Resilient Planning/.test(html) && /Finish line:/.test(html) && /Average path readiness/.test(html), 'Audited goal cards must expose finish lines and path-readiness summaries.');
check(/Path readiness/.test(html) && /pathReadinessPercent/.test(html) && /questChain/.test(dashboardSource) && /skillPath/.test(dashboardSource), 'Every goal must keep completion separate from transitive quest-and-skill path readiness.');
check(/'balanced':\{type:'ROADMAP_MODE'/.test(dashboardSource) && /'quest cape':\{type:'ALL_CURRENT_QUESTS'/.test(dashboardSource), 'Balanced must be an ongoing roadmap and Quest Cape must use the all-current-quests model.');
check(/percent=Math\.round\(trackedCompleted\/totalQuests\*100\)/.test(dashboardSource) && !/completed\.size\/totalQuests\*100,weight:70/.test(dashboardSource), 'Quest Cape must use the direct completed/total fraction without route-readiness weighting.');
check(/targetCombat:126/.test(dashboardSource) && /CHECKLIST_FIRE_CAPE/.test(dashboardSource) && /CHECKLIST_INFERNO/.test(dashboardSource), 'Combat Growth and both cape goals must retain their audited phased definitions.');
check(/v273CombatMilestone/.test(html) && /Next combat milestone/.test(html) && /milestone=\{current:current,next:next/.test(dashboardSource), 'Combat Growth must emphasize its next milestone with the expanded milestone ladder.');
check(/v274ClosestCompare/.test(html) && /Closest to ready/.test(html) && /Furthest from ready/.test(html) && /Goal completion/.test(html), 'Goal sorting must use the permanent readiness contract and expose clear sort modes.');
check(/remainingQuestSteps/.test(dashboardSource) && /unmetSkillTargets/.test(dashboardSource) && /needsConfirmation/.test(dashboardSource) && /dataConfidence/.test(dashboardSource), 'Every goal must publish the complete Goal Ranking Contract metadata.');
check(/v274CanonicalGoalName_/.test(dashboardSource) && /Core Transportation Network/.test(dashboardSource) && /Core Transportation Network/.test(html), 'Transportation must use its canonical Core Transportation Network name with legacy compatibility.');
check(/questActionPlan/.test(dashboardSource) && /actionPlan:actionPlan/.test(dashboardSource) && /v275ActionPlan/.test(html), 'Every finite goal must publish and render a dependency-ordered action plan.');
check(/Make active goal/.test(html) && /Plan tonight/.test(html) && /planV275Tonight/.test(html), 'Goal action plans must connect directly to active-goal switching and Tonight Mode.');
check(/v276SessionStyle/.test(html) && /Fastest progress/.test(html) && /Quest-focused/.test(html) && /Low-attention/.test(html) && /Mixed session/.test(html), 'Tonight Mode must expose all four goal-specific session styles.');
check(/function renderV130Tonight\(\)[\s\S]{0,1800}progress\.actionPlan/.test(html) && /v276TrainingMinutes/.test(html) && /After tonight:/.test(html), 'Tonight Mode must schedule from the active goal action plan and show remaining work.');
check(/goalDependencyMap/.test(dashboardSource) && /dependencyMap:dependencyMap/.test(dashboardSource) && /v277MapModal/.test(html), 'Finite goals must publish and render a dependency graph.');
check(/getV277GoalDependencyMap/.test(dashboardSource) && /Building the verified dependency map/.test(html), 'Dependency graphs must load on demand instead of slowing every dashboard refresh.');
check(/Full dependency map/.test(html) && /Critical path only/.test(html) && /Quest steps only/.test(html) && /Skill requirements only/.test(html), 'The dependency map must expose all four required views.');
check(/v277DrawMap/.test(html) && /Plan tonight from here/.test(html) && /v277Node.*completed/.test(html), 'The dependency map must draw connections, expose node states, and connect the next node to Tonight Mode.');
check(/v279DecantFour/.test(html) && /getV279DecantToFourRecipe/.test(dashboardSource) && /quantity:4\/sourceDose/.test(dashboardSource), 'Four-dose potion decanting must preserve doses and use a tracked GE output.');
check(/recipe\.mode==='DECANT_4'/.test(html) && /current GE price/.test(html), 'The processing modal must replace the selected source with its live-priced four-dose output.');
check(/Commit four-dose conversion\?/.test(html) && /v279RestoreOriginal/.test(html) && /totalDoses=count\*dose/.test(html), 'Four-dose conversion must preview counts, require confirmation, preserve leftovers, and remain reversible.');
check(/Comparing potion values/.test(html) && /Keep original dose:/.test(html) && /Convert to four-dose:/.test(html) && /Profit difference:/.test(html), 'Four-dose confirmation must compare both after-tax profit outcomes before committing.');
check(/scale=sourceCount\/outputs/.test(html) && /Original ingredient cost basis and total XP are preserved/.test(html), 'Confirmed decanting must preserve the original batch cost basis and total XP.');
check(/function v279SyncAvailability/.test(html) && /sourcePotion=recognized/.test(html) && /label\.hidden=!.sourcePotion\|\|activeConversion./.test(html), 'The four-dose control must only appear for recognized dose-bearing potion processes.');
check(/activeConversion=box\.checked&&\/Decant to 4-dose\/i/.test(html), 'An active four-dose conversion must keep its checkbox visible so it can be reversed before saving.');
check(/processedDoses=processed\*dose/.test(html) && /processedOutputs=Math\.floor\(processedDoses\/4\)/.test(html) && /v279ApplyDecant\(recipe,outputs,count,processedOutputs\)/.test(html), 'Four-dose conversion must proportionally convert potions already recorded as processed.');
check(/if\(sold>0\)/.test(html) && /after original-dose potions have been recorded as sold/.test(html) && /\$\('v243Processed'\)\.value=processedOutputs/.test(html), 'Processed potions must remain convertible while recorded sales block dose conversion.');
check(/function saveV280ProcessingSale/.test(dashboardSource) && /Sales JSON/.test(dashboardSource) && /unitPrice/.test(dashboardSource), 'Processing sales must use an itemized quantity, date, and actual-price ledger.');
check(/function deleteV280ProcessingSale/.test(dashboardSource) && /Reopen \/ correct/.test(html) && /Completed \(\$\{complete\}\)/.test(html), 'Completed processing batches must be reviewable and correctable.');
check(/v280LeftoverDoses/.test(html) && /Leftover Doses/.test(dashboardSource) && /sourceCount\*dose%4/.test(html), 'Potion decant leftovers must be explicitly retained with the processing batch.');
check(/function readV281GoalScopedBlockers_/.test(dashboardSource) && /goalBlockerScope\.blockers/.test(dashboardSource) && /goalBlockerScope\.questKeys/.test(dashboardSource), 'Quest blockers, skill targets, and training detours must share the selected goal dependency scope.');
check(/'fairy rings':'Fairytale II - Cure a Queen'/.test(dashboardSource) && /prereqs:names\.filter/.test(dashboardSource), 'Fairy Rings must resolve to the complete Fairytale II prerequisite ancestry even for legacy goal rows.');
check(/function readV281ActionPlanBlockers_/.test(dashboardSource) && /step\.kind===['"]TRAIN['"]&&step\.quest/.test(dashboardSource) && /goalBlockerScope\.scoped&&!orderedBlockedQuests\.length/.test(dashboardSource), 'Partial-quest goals must retain skill-gated anchor blockers when no full-quest blocker row survives scoping.');
check(/refreshV285ItemDatabase/.test(gameDataSource) && /refreshV285RecipeDatabase/.test(gameDataSource) && /refreshV285EquipmentDatabase/.test(gameDataSource) && /refreshV285MonsterDatabase/.test(gameDataSource), 'The background game-data platform must retain all four authoritative data domains.');
check(/v285Replace_/.test(gameDataSource) && /staged only/.test(gameDataSource) && /verified data was preserved/.test(gameDataSource), 'Game-data refreshes must validate staged record counts before replacing verified tables.');
check(/installV285GameDataPlatform/.test(gameDataSource) && /everyHours\(1\)/.test(gameDataSource) && /everyDays\(1\)/.test(gameDataSource), 'Game-data price and factual refresh schedules are incomplete.');
check(/v281tAccuracy_/.test(trainingSource) && /v281tMaxHit_/.test(trainingSource) && /v281tNextMaxHit_/.test(trainingSource), 'Training intelligence must retain verified accuracy, maximum-hit, and breakpoint calculations.');
check(/budget/.test(trainingSource) && /practical/.test(trainingSource) && /premium/.test(trainingSource) && /ownedEquipment:false/.test(trainingSource), 'Training intelligence must retain three generated loadout tiers without bank assumptions.');
check(/V281T_FORMULAS/.test(trainingSource) && /source:/.test(trainingSource) && /confidence/.test(trainingSource), 'Training intelligence must retain formula sources and confidence labels.');
const accuracySource = fs.readFileSync(path.join(path.dirname(file), 'TrainingAccuracyV286.js'), 'utf8');
check(/v286AssessTrainingScenario_/.test(accuracySource) && /Fail closed/.test(accuracySource), 'Training recommendations must fail closed when required facts or effects are unverified.');
check(/Sulphur blades outrank rune scimitar/.test(accuracySource) && /runV286AccuracyRegressionTests/.test(accuracySource), 'Known-matchup training regression tests are missing.');
check(/scenario\.verification\.eligible/.test(trainingSource), 'Training scenarios must pass the accuracy gate before ranking.');
const equipmentKnowledgeSource = fs.readFileSync(path.join(path.dirname(file), 'EquipmentKnowledgeV287.js'), 'utf8');
check(/refreshV287EquipmentKnowledgeBatch/.test(equipmentKnowledgeSource) && /REVIEW_REQUIRED/.test(equipmentKnowledgeSource), 'The equipment knowledge collector and effect review queue are missing.');
check(/weapon&&weapon\.twoHanded&&item\.slot==='shield'/.test(trainingSource), 'Two-handed loadouts must reject shield-slot combinations.');
const optimizerSource = fs.readFileSync(path.join(path.dirname(file), 'LoadoutOptimizerV288.js'), 'utf8');
check(/v288ArmourFrontier_/.test(optimizerSource) && /v288Prune_/.test(optimizerSource), 'The full-catalog Pareto loadout optimizer is missing.');
check(/absolute:unresolved\.length===0/.test(optimizerSource), 'The optimizer must not claim an absolute best while candidates remain unresolved.');
const effectSource = fs.readFileSync(path.join(path.dirname(file), 'CombatEffectsV289.js'), 'utf8');
check(/dragon hunter lance/.test(effectSource) && /accuracyReroll/.test(effectSource) && /flatSize/.test(effectSource), 'Verified target-aware melee effects are missing.');
check(/v289ApplyWeaponEffect_/.test(optimizerSource), 'The loadout optimizer must apply verified weapon effects.');
const setEffectSource = fs.readFileSync(path.join(path.dirname(file), 'SetEffectsV290.js'), 'utf8');
check(/obsidian/.test(setEffectSource) && /void_melee/.test(setEffectSource) && /inquisitor/.test(setEffectSource), 'Verified melee set-effect rules are missing.');
check(/setTags/.test(optimizerSource) && /v290SetModifiers_/.test(optimizerSource), 'Pareto optimization must preserve and apply set-effect candidates.');
const pricingSource = fs.readFileSync(path.join(path.dirname(file), 'EquipmentPricingV292.js'), 'utf8');
check(/avgHighPrice/.test(pricingSource) && /highPriceVolume/.test(pricingSource) && /1h Avg High/.test(trainingSource), 'Equipment costs must use volume-backed one-hour acquisition prices.');
check(/ordered\.filter\(item=>item\.blockedBy!==['"]Ready now['"]\)\.slice\(0,20\)/.test(dashboardSource), 'Ready-now quests must be excluded and the Blocked Quests working set must remain capped at 20.');
check(/Object\.values\(byName\)[\s\S]{0,900}slice\(0,20\)/.test(dashboardSource), 'The blocker list must refill from the complete dependency dataset after ready-now rows are removed.');
check(/readyCol = column\(\/\^ready now/.test(dashboardSource) && /readyCol>=0\?!rec\.ready/.test(dashboardSource), 'Blocker eligibility must use the dependency table Ready Now field when available.');
check(/toggleAttribute\('autofocus',fresh\)[\s\S]{0,300}output\.focus\(\)/.test(html), 'A fresh custom processing batch must make the output field the modal focus target.');
check(/function\s+v132ItemImage[\s\S]{0,400}v264WikiAsset/.test(html), 'Boss equipment icons do not use the shared asset resolver.');
check(/function\s+initV265PageWorkspaces\s*\(/.test(html), 'Distinct non-Overview page workspace initialization is missing.');
check(/v278PageLead/.test(html) && /const labels=\{tonight:'Play'/.test(html) && /v278Eyebrow/.test(html), 'V2.78 shared page-banner hierarchy is incomplete.');
check(/\.v115Head\{align-items:center;min-height:50px/.test(html) && /\.v240Empty,.v271GoalEmpty,.v134Empty,.v263WorkspaceEmpty/.test(html), 'V2.78 modal and empty-state cohesion rules are incomplete.');
check(/initV263Workspaces\(\);initV265PageWorkspaces\(\);(?:initV266MoneyWorkspace\(\);)?restoreV258HeroTab\(\)/.test(html), 'Page workspaces must initialize after Overview isolation and before tab restoration.');
check(/if\(context\)context\.hidden=name==='overview'/.test(html), 'Account context must be hidden on Overview and retained on the other tabs.');
check(/function\s+initV266MoneyWorkspace\s*\(/.test(html), 'Focused Money workspace initialization is missing.');
check((html.match(/data-view="(?:overview|alch|merch|purchases|processing|profit)"/g) || []).length === 6, 'Money workspace must expose exactly six focused views.');
check(/initV265PageWorkspaces\(\);initV266MoneyWorkspace\(\);restoreV258HeroTab\(\)/.test(html), 'Money workspace must initialize after page workspaces and before tab restoration.');
check(/className='v267ProfitDock'/.test(html), 'Money workspace must keep the profit snapshot visible across sub-tabs.');
check(/#v240AlchPractical,#v240AlchHighest,#v240MerchPractical\{max-height:238px\}/.test(html), 'Alch and merch scanners must use the compact five-row viewport.');
check(/function\s+renderV268AlchBatches\s*\(/.test(html), 'Active High Alch batch management is missing.');
check(/nodes:\[alchCost,\$\('v241PlannerSection'\),alchBatches,\$\('v240AlchPanel'\)\]/.test(html), 'High Alch planner and active batches must appear before opportunity tables.');
check(/function\s+renderV269GoalProgress\s*\(/.test(html), 'All-goal percentage menu is missing.');
check(idSet.has('v269GoalModal') && idSet.has('v269GoalList'), 'All-goal percentage modal structure is incomplete.');

const definedTokens = new Set([...html.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)].map(match => match[1]));
const usedTokens = new Set([...html.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map(match => match[1]));
const missingTokens = [...usedTokens].filter(token => !definedTokens.has(token));
check(!missingTokens.length, `Undefined CSS design tokens: ${missingTokens.join(', ')}`);

const modalIds = [...html.matchAll(/<div\s+id=["']([^"']+)["'][^>]*class=["'][^"']*\bv115Modal\b[^"']*["']/gi)]
  .map(match => match[1]);
modalIds.forEach(id => {
  const start = html.indexOf(`id="${id}"`);
  const sample = html.slice(start, start + 5000);
  if (!/(?:close|Cancel|Close)/i.test(sample)) warnings.push(`Modal ${id} may not expose an obvious close control.`);
});

if (warnings.length) warnings.forEach(message => console.warn(`WARNING: ${message}`));
if (failures.length) {
  failures.forEach(message => console.error(`FAILED: ${message}`));
  process.exit(1);
}

console.log(`Dashboard checks passed: ${scripts.length} script block(s), ${ids.length} IDs, ${tabs.length} tabs, ${handlers.length} inline handlers, ${definedTokens.size} design tokens.`);
}
