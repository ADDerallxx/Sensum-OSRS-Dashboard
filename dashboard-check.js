if (typeof require === 'function' && typeof process !== 'undefined') {
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const file = process.argv[2] || 'V1.html';
const html = fs.readFileSync(file, 'utf8');
const dashboardSource = fs.existsSync('DashboardV1.js') ? fs.readFileSync('DashboardV1.js', 'utf8') : '';
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
check(/V2\.72 · Audited Goals/.test(html) && /Finish line:/.test(html) && /Average measurable progress/.test(html), 'Audited goal cards must expose finish lines and exclude non-measurable roadmap modes from averages.');
check(/'balanced':\{type:'ROADMAP_MODE'/.test(dashboardSource) && /'quest cape':\{type:'ALL_CURRENT_QUESTS'/.test(dashboardSource), 'Balanced must be an ongoing roadmap and Quest Cape must use the all-current-quests model.');
check(/percent=Math\.round\(trackedCompleted\/totalQuests\*100\)/.test(dashboardSource) && !/completed\.size\/totalQuests\*100,weight:70/.test(dashboardSource), 'Quest Cape must use the direct completed/total fraction without route-readiness weighting.');
check(/toggleAttribute\('autofocus',fresh\)[\s\S]{0,300}output\.focus\(\)/.test(html), 'A fresh custom processing batch must make the output field the modal focus target.');
check(/function\s+v132ItemImage[\s\S]{0,400}v264WikiAsset/.test(html), 'Boss equipment icons do not use the shared asset resolver.');
check(/function\s+initV265PageWorkspaces\s*\(/.test(html), 'Distinct non-Overview page workspace initialization is missing.');
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
