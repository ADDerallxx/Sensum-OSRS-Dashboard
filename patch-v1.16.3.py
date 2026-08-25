from pathlib import Path

p = Path("V1.html")
h = p.read_text(encoding="utf-8-sig")

# Version bump.
h = h.replace("V1.16.2", "V1.16.3", 1)

# In routeShoppingHtml(), only build checklist groups for quests actually present
# in the currently displayed route. Completed/off-route quests therefore disappear.
old = """  rows.forEach(i=>{
    const quests=splitQuests(i.quests);
    const ordered=(quests.length?quests:['Other']).sort((a,b)=>(steps.get(a.toLowerCase())||999)-(steps.get(b.toLowerCase())||999));
    ordered.forEach(quest=>{
      if(!groups.has(quest))groups.set(quest,[]);
      const c=classifyPrepItemV1142(i);
      const allUses=[...new Set(itemQuestMap.get(normalizedItemName(i.item))||[])];
      const also=allUses.filter(q=>q.toLowerCase()!==quest.toLowerCase());
      groups.get(quest).push({...i,quest,also,...c});
    });
  });"""

new = """  rows.forEach(i=>{
    const quests=splitQuests(i.quests);
    const ordered=quests
      .filter(q=>steps.has(q.toLowerCase()))
      .sort((a,b)=>(steps.get(a.toLowerCase())||999)-(steps.get(b.toLowerCase())||999));

    ordered.forEach(quest=>{
      if(!groups.has(quest))groups.set(quest,[]);
      const c=classifyPrepItemV1142(i);
      const allUses=[...new Set(itemQuestMap.get(normalizedItemName(i.item))||[])];
      const also=allUses.filter(q=>
        q.toLowerCase()!==quest.toLowerCase() &&
        steps.has(q.toLowerCase())
      );
      groups.get(quest).push({...i,quest,also,...c});
    });
  });"""

if old not in h:
    raise SystemExit("Could not find current routeShoppingHtml grouping block.")

h = h.replace(old, new, 1)

p.write_text(h, encoding="utf-8", newline="\n")

check = p.read_text(encoding="utf-8")
if ".filter(q=>steps.has(q.toLowerCase()))" not in check:
    raise SystemExit("V1.16.3 verification failed.")

print("V1.16.3 route-only shopping list installed and verified.")
