from pathlib import Path

p = Path("QuestHelperSync.js")
s = p.read_text(encoding="utf-8-sig")

old = '''  const treeInfo = qhGetTree_();
  const commit = treeInfo.sha || '';
  const paths = treeInfo.paths || [];
  const now = new Date();'''

new = '''  // Apps Script receives HTTP 403 from api.github.com in this environment.
  // Bypass the GitHub REST API entirely and fetch known quest source files
  // directly from raw.githubusercontent.com.
  const commit = 'master-direct';
  const now = new Date();'''

if old not in s:
    raise SystemExit("Could not find GitHub tree setup block.")
s = s.replace(old, new, 1)

old2 = '''    const resolved = qhResolveQuestSource_(quest, paths);'''
new2 = '''    const resolved = qhDirectQuestPath_(quest);'''
if old2 not in s:
    raise SystemExit("Could not find quest source resolver call.")
s = s.replace(old2, new2, 1)

insert_before = "function qhGetTree_() {"
helper = '''function qhDirectQuestPath_(quest) {
  const overrides = {
    'plaguecity': 'src/main/java/com/questhelper/helpers/quests/plaguecity/PlagueCity.java',
    'biohazard': 'src/main/java/com/questhelper/helpers/quests/biohazard/Biohazard.java',
    'undergroundpass': 'src/main/java/com/questhelper/helpers/quests/undergroundpass/UndergroundPass.java',
    'junglepotion': 'src/main/java/com/questhelper/helpers/quests/junglepotion/JunglePotion.java',
    'shilovillage': 'src/main/java/com/questhelper/helpers/quests/shilovillage/ShiloVillage.java',
    'thefremenniktrials': 'src/main/java/com/questhelper/helpers/quests/thefremenniktrials/TheFremennikTrials.java',
    'clientofkourend': 'src/main/java/com/questhelper/helpers/quests/clientofkourend/ClientOfKourend.java',
    'childrenofthesun': 'src/main/java/com/questhelper/helpers/quests/childrenofthesun/ChildrenOfTheSun.java',
    'deathplateau': 'src/main/java/com/questhelper/helpers/quests/deathplateau/DeathPlateau.java',
    'trollstronghold': 'src/main/java/com/questhelper/helpers/quests/trollstronghold/TrollStronghold.java'
  };

  const slug = qhNorm_(quest);
  if (overrides[slug]) return overrides[slug];

  const className = String(quest || '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  return 'src/main/java/com/questhelper/helpers/quests/' + slug + '/' + className + '.java';
}

'''

if helper not in s:
    if insert_before not in s:
        raise SystemExit("Could not find qhGetTree_ insertion marker.")
    s = s.replace(insert_before, helper + insert_before, 1)

p.write_text(s, encoding="utf-8")
print("Quest Helper GitHub 403 bypass installed.")
