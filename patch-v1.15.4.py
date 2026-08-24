from pathlib import Path

p = Path("V1.html")
h = p.read_text(encoding="utf-8-sig")

for v in ("V1.15.3","V1.15.2B","V1.15.2b","V1.15.2A","V1.15.2a","V1.15.2","V1.15.1"):
    if v in h:
        h = h.replace(v, "V1.15.4", 1)
        break

style_marker = ".v115Btn{border:1px solid #8c5b2b;background:#fffaf1;color:#321b0c;border-radius:8px;padding:8px 11px;font-weight:900;cursor:pointer}.v115Btn.primary{background:#5a3217;color:#fff3d4}"
style_add = """.v115Btn{border:1px solid #8c5b2b;background:#fffaf1;color:#321b0c;border-radius:8px;padding:8px 11px;font-weight:900;cursor:pointer}.v115Btn.primary{background:#5a3217;color:#fff3d4}
.v115Busy{position:fixed;inset:0;z-index:10020;background:rgba(16,8,3,.62);display:none;align-items:center;justify-content:center;padding:20px}
.v115Busy.show{display:flex}
.v115BusyBox{min-width:280px;max-width:440px;background:#fff7df;color:#25180e;border:2px solid #d99b29;border-radius:14px;box-shadow:0 16px 45px rgba(0,0,0,.45);padding:18px 20px;text-align:center}
.v115Spinner{width:32px;height:32px;border:4px solid #e5c985;border-top-color:#5a3217;border-radius:50%;margin:0 auto 11px;animation:v115spin .8s linear infinite}
.v115BusyTitle{font-size:15px;font-weight:900;margin-bottom:4px}
.v115BusyText{font-size:11px;color:#6f5b43}
@keyframes v115spin{to{transform:rotate(360deg)}}
.v115Toast{position:fixed;z-index:10030;top:18px;left:50%;transform:translate(-50%,-140%);min-width:300px;max-width:min(620px,calc(100% - 30px));background:#e2efe1;color:#214e28;border:2px solid #4d8154;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.35);padding:12px 16px;font-size:12px;font-weight:800;transition:transform .35s ease}
.v115Toast.show{transform:translate(-50%,0)}
.v115Toast.error{background:#f2dddd;color:#761d17;border-color:#a62a21}
"""
if style_marker not in h:
    raise SystemExit("Could not find V1.15 button style marker.")
h = h.replace(style_marker, style_add, 1)

script_marker = "\n<script>\nlet v115State="
script_pos = h.find(script_marker)
if script_pos < 0:
    raise SystemExit("Could not find V1.15 script marker.")
if 'id="v115Busy"' not in h:
    h = h[:script_pos] + '\n<div id="v115Busy" class="v115Busy" aria-live="polite" aria-busy="true">\n  <div class="v115BusyBox">\n    <div class="v115Spinner"></div>\n    <div id="v115BusyTitle" class="v115BusyTitle">Updating quest progress...</div>\n    <div id="v115BusyText" class="v115BusyText">Saving completion and recalculating the dashboard.</div>\n  </div>\n</div>\n<div id="v115Toast" class="v115Toast" aria-live="polite"></div>\n' + h[script_pos:]

close_fn = "function closeV115QuestModal(){document.getElementById('v115Modal').classList.remove('show')}"
if close_fn not in h:
    raise SystemExit("Could not find closeV115QuestModal.")
h = h.replace(close_fn, "function closeV115QuestModal(){document.getElementById('v115Modal').classList.remove('show')}\nfunction showV115Busy(title,text){\n  const box=document.getElementById('v115Busy');\n  document.getElementById('v115BusyTitle').textContent=title||'Updating quest progress...';\n  document.getElementById('v115BusyText').textContent=text||'Saving completion and recalculating the dashboard.';\n  box.classList.add('show');\n}\nfunction hideV115Busy(){document.getElementById('v115Busy').classList.remove('show')}\nlet v115ToastTimer=null;\nfunction showV115Toast(message,isError){\n  const t=document.getElementById('v115Toast');\n  if(v115ToastTimer)clearTimeout(v115ToastTimer);\n  t.textContent=message;\n  t.className='v115Toast'+(isError?' error':'');\n  requestAnimationFrame(()=>t.classList.add('show'));\n  v115ToastTimer=setTimeout(()=>t.classList.remove('show'),4200);\n}\n", 1)

old_confirm = "function confirmV115Quests(){if(!v115Selected.size)return alert('Select at least one quest.');const names=[...v115Selected];if(!confirm(`Mark these quests complete?\\n\\n${names.join('\\n')}`))return;google.script.run.withFailureHandler(e=>alert('Quest update failed: '+e.message)).withSuccessHandler(r=>{v115LastTx=r.transactionId;v115State=r.state;closeV115QuestModal();hideV115Banner();alert(`${r.changed.length} quest${r.changed.length===1?'':'s'} marked complete.`);location.reload()}).completeV115Quests(names,v115Source)}"
if old_confirm not in h:
    raise SystemExit("Could not find current confirmV115Quests implementation.")
h = h.replace(old_confirm, "function confirmV115Quests(){\n  if(!v115Selected.size)return alert('Select at least one quest.');\n  const names=[...v115Selected];\n  if(!confirm(`Mark these quests complete?\\n\\n${names.join('\\n')}`))return;\n\n  closeV115QuestModal();\n  showV115Busy(\n    names.length===1?'Updating quest progress...':`Updating ${names.length} quests...`,\n    'Saving completion and recalculating goals, route, blockers, and quest prep.'\n  );\n\n  google.script.run\n    .withFailureHandler(e=>{\n      hideV115Busy();\n      const msg=(e&&e.message)?e.message:String(e||'Unknown error');\n      showV115Toast('Quest update failed: '+msg,true);\n    })\n    .withSuccessHandler(r=>{\n      v115LastTx=r.transactionId;\n      v115State=r.state;\n      hideV115Banner();\n\n      google.script.run\n        .withFailureHandler(e=>{\n          hideV115Busy();\n          const count=(r.changed||[]).length;\n          showV115Toast(`${count} quest${count===1?'':'s'} saved, but dashboard refresh failed. Use browser refresh once.`,true);\n        })\n        .withSuccessHandler(fresh=>{\n          render(fresh);\n          window.__sensumState=fresh;\n          hideV115Busy();\n          const changed=r.changed||[];\n          const label=changed.length===1?changed[0]:`${changed.length} quests`;\n          showV115Toast(`${label} marked complete. Dashboard updated.`);\n        })\n        .getV1DashboardState();\n    })\n    .completeV115Quests(names,v115Source);\n}", 1)

p.write_text(h, encoding="utf-8", newline="\n")
print("V1.15.4 completion loading feedback + in-place dashboard refresh applied.")
