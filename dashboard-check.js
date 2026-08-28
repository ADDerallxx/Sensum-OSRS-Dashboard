if (typeof require === 'function' && typeof process !== 'undefined') {
const fs = require('fs');
const vm = require('vm');

const file = process.argv[2] || 'V1.html';
const html = fs.readFileSync(file, 'utf8');
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
const ignoredCalls = new Set(['if', 'for', 'while', 'switch', 'encodeURIComponent', 'decodeURIComponent', 'preventDefault', 'stopPropagation']);
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
check(/function\s+v132ItemImage[\s\S]{0,400}v264WikiAsset/.test(html), 'Boss equipment icons do not use the shared asset resolver.');
check(/function\s+initV265PageWorkspaces\s*\(/.test(html), 'Distinct non-Overview page workspace initialization is missing.');
check(/initV263Workspaces\(\);initV265PageWorkspaces\(\);restoreV258HeroTab\(\)/.test(html), 'Page workspaces must initialize after Overview isolation and before tab restoration.');
check(/if\(context\)context\.hidden=name==='overview'/.test(html), 'Account context must be hidden on Overview and retained on the other tabs.');

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
