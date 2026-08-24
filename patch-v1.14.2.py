from pathlib import Path

p = Path("V1.html")
h = p.read_text(encoding="utf-8-sig")

# Expand Route Prep viewport.
h = h.replace("#routeShopping{max-height:510px;overflow:auto}", "#routeShopping{max-height:1100px;overflow:auto}")
h = h.replace("#routeShopping{max-height:560px;overflow:auto}", "#routeShopping{max-height:1100px;overflow:auto}")
h = h.replace("max-height:520px;overflow-y:auto", "max-height:1100px;overflow-y:auto")
h = h.replace("max-height:540px;overflow-y:auto", "max-height:1100px;overflow-y:auto")

# Remove redundant instructional note.
old = '''  let html=`<div class="shopProgressBar"><div class="shopProgressFill" style="width:${pct}%"></div></div>
    <div class="obtainNote">Bring/Buy items determine readiness. Obtain, create, and recommended items remain in the checklist for quest tracking.</div>`;'''
new = '''  let html=`<div class="shopProgressBar"><div class="shopProgressFill" style="width:${pct}%"></div></div>`;'''
if old in h:
    h = h.replace(old, new, 1)

# Shared classification helper.
marker = 'function routeShoppingHtml(s){'
helper = '''function classifyPrepItemV1142(i){
  const acq=String(i.acquisition||'').toLowerCase();
  const prep=String(i.prepClass||'').toLowerCase();
  const status=String(i.qhStatus||'').toUpperCase();
  const mandatory=i.mandatory===true || String(i.mandatory).toUpperCase()==='TRUE';
  const created=acq.includes('created') || prep.includes('created');
  const obtain=!created && (acq.includes('obtain') || prep.includes('obtain'));
  const recommended=status==='RECOMMENDED' || prep.includes('recommended') || String(i.type||'').toLowerCase()==='recommended';
  const blocksReady=mandatory && !obtain && !created && !recommended;
  return {created,obtain,recommended,blocksReady,mandatory};
}

function prepForQuestV1142(s,quest){
  const q=String(quest||'').toLowerCase();
  return (s.shopping||[]).filter(i=>splitQuests(i.quests).some(x=>x.toLowerCase()===q));
}

'''
if helper not in h:
    if marker not in h: raise SystemExit('Could not find routeShoppingHtml marker.')
    h = h.replace(marker, helper + marker, 1)

# Make Route Prep use shared classifier.
old_block = '''      const acq=String(i.acquisition||'').toLowerCase();
      const prep=String(i.prepClass||'').toLowerCase();
      const status=String(i.qhStatus||'').toUpperCase();
      const mandatory=i.mandatory===true || String(i.mandatory).toUpperCase()==='TRUE';

      const created=acq.includes('created');
      const obtain=!created && acq.includes('obtain');
      const recommended=status==='RECOMMENDED' || prep.includes('recommended') || String(i.type||'').toLowerCase()==='recommended';
      const blocksReady=mandatory && !obtain && !created && !recommended;'''
new_block = '''      const {created,obtain,recommended,blocksReady,mandatory}=classifyPrepItemV1142(i);'''
if old_block in h:
    h = h.replace(old_block, new_block, 1)

# Version bump.
h = h.replace("V1.14.1", "V1.14.2")

p.write_text(h, encoding="utf-8", newline="\n")
print("V1.14.2 QA/UI patch applied.")