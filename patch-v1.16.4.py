from pathlib import Path

p = Path("V1.html")
h = p.read_text(encoding="utf-8-sig")

h = h.replace("V1.16.3", "V1.16.4", 1)

start = h.find("function parseXpTotal(text)")
end = h.find("function compactNumber(n)", start)

if start < 0 or end < 0:
    raise SystemExit("Could not find the current XP parser.")

new = """function parseXpTotal(text){
  const s=String(text||'').trim();
  if(!s)return 0;

  // Quest Dependency XP strings look like:
  // "2,812.4 Agility XP; 2,812.4 Attack XP; ..."
  // Parse each reward clause independently and sum the leading numeric amount.
  let total=0,matched=false;
  const parts=s.split(/[;\\n|]+/).map(x=>x.trim()).filter(Boolean);

  parts.forEach(part=>{
    if(!/(?:\\bXP\\b|experience)/i.test(part))return;

    const m=part.match(/(?:^|[^0-9])([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]+)?)\\s*([kKmM]?)/);
    if(!m)return;

    let n=Number(String(m[1]).replace(/,/g,''));
    const suffix=String(m[2]||'').toLowerCase();

    if(suffix==='k')n*=1000;
    else if(suffix==='m')n*=1000000;

    if(Number.isFinite(n)){
      total+=n;
      matched=true;
    }
  });

  // Fallback for compact strings such as "10k XP" that are not semicolon-delimited.
  if(!matched){
    const rx=/([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]+)?)\\s*([kKmM]?)\\s*(?:XP|experience)/g;
    let m;
    while((m=rx.exec(s))!==null){
      let n=Number(String(m[1]).replace(/,/g,''));
      const suffix=String(m[2]||'').toLowerCase();
      if(suffix==='k')n*=1000;
      else if(suffix==='m')n*=1000000;
      if(Number.isFinite(n)){total+=n;matched=true;}
    }
  }

  return matched?total:0;
}
"""

h = h[:start] + new + h[end:]

p.write_text(h, encoding="utf-8", newline="\n")

check = p.read_text(encoding="utf-8")
for needle in [
    "function parseXpTotal",
    "split(/[;\\n|]+/)",
    "function compactNumber",
    "rewardSummaryHtml"
]:
    if needle not in check:
        raise SystemExit("V1.16.4 verification failed: " + needle)

print("V1.16.4 XP parser installed and verified.")
