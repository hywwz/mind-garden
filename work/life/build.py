from pathlib import Path
import re
root=Path(__file__).resolve().parent
target=root.parents[1]/'outputs/mind_garden.html'
target.parent.mkdir(exist_ok=True)
html=(root/'base.html').read_text(encoding='utf-8')
html=html.replace("setTimeout(()=>$('#dialogFields input, #dialogFields textarea')?.focus(),30)","$('#dialogFields input:not([hidden]), #dialogFields textarea')?.focus({preventScroll:true})")
html=html.replace('Math.sin(t*.00075+p.phase)*7','0').replace('Math.cos(t*.0009+p.phase)*10','0')
html=html.replace("const el=e.target.closest('[data-map-id]');pointers.set","const el=lifeNearestMapNode(e)||e.target.closest('[data-map-id]');pointers.set")
html=html.replace("length:Math.max(100,Math.hypot(dx,dy))","length:Math.max(a.dot||b.dot?16:100,Math.hypot(dx,dy))")
html=html.replace("ra=a.depthRole==='background'?28:","ra=a.dot?8:a.depthRole==='background'?28:").replace("rb=b.depthRole==='background'?28:","rb=b.dot?8:b.depthRole==='background'?28:")
html=html.replace("1100000/(d*d+2400)","(a.dot||b.dot?40000:1100000)/(d*d+2400)")
html=html.replace("const a=points[i],b=points[j];let dx","const a=points[i],b=points[j];if((a.dot||b.dot)&&(Math.abs(a.x-b.x)>180||Math.abs(a.y-b.y)>180))continue;let dx")
html=html.replace("const ay=a.ry-","const ay=a.dot?a.ry:a.ry-").replace("by=b.ry-","by=b.dot?b.ry:b.ry-")
html=html.replace("p.depthRole==='background'?'blur(.8px)'","p.depthRole==='background'&&!p.dot?'blur(.8px)'")
html=re.sub(r"p.depthRole==='focus'\|\|p.depthRole==='child'(?:\|\|\(lifeFocus\(\)==='root'&&p.dot\))*","p.depthRole==='focus'||p.depthRole==='child'||(lifeFocus()==='root'&&p.dot)",html)

html=re.sub(r'/\* LIFE_STYLE_START \*/.*?/\* LIFE_STYLE_END \*/','',html,flags=re.S)
html=html.replace('</style>','/* LIFE_STYLE_START */\n'+(root/'style.css').read_text(encoding='utf-8')+'\n'+(root/'simple.css').read_text(encoding='utf-8')+'\n'+(root/'gestures.css').read_text(encoding='utf-8')+'\n'+(root/'branching.css').read_text(encoding='utf-8')+'\n'+(root/'input-ideas.css').read_text(encoding='utf-8')+'\n'+(root/'network.css').read_text(encoding='utf-8')+'\n'+(root/'browse.css').read_text(encoding='utf-8')+'\n'+(root/'tree.css').read_text(encoding='utf-8')+'\n/* LIFE_STYLE_END */\n</style>',1)
html=re.sub(r'// LIFE_FEATURE_START\n.*?// LIFE_FEATURE_END\n','',html,flags=re.S)
code='// LIFE_FEATURE_START\n'+(root/'model.js').read_text(encoding='utf-8')+'\n'+(root/'ui.js').read_text(encoding='utf-8')+'\n'+(root/'depth.js').read_text(encoding='utf-8')+'\n'+(root/'semantic.js').read_text(encoding='utf-8')+'\n'+(root/'readability.js').read_text(encoding='utf-8')+'\n'+(root/'simple.js').read_text(encoding='utf-8')+'\n'+(root/'gestures.js').read_text(encoding='utf-8')+'\n'+(root/'branching.js').read_text(encoding='utf-8')+'\n'+(root/'force.js').read_text(encoding='utf-8')+'\n'+(root/'input-ideas.js').read_text(encoding='utf-8')+'\n'+(root/'network-import.js').read_text(encoding='utf-8')+'\n'+(root/'network-ui.js').read_text(encoding='utf-8')+'\n'+(root/'network-focus.js').read_text(encoding='utf-8')+'\n'+(root/'browse.js').read_text(encoding='utf-8')+'\n'+(root/'tree.js').read_text(encoding='utf-8')+'\n// LIFE_FEATURE_END\n'
assert 'initApp();\ninitMap();' in html
html=html.replace('initApp();\ninitMap();',code+'initApp();\ninitMap();')
target.write_text(html,encoding='utf-8')
print('Life graph feature embedded in standalone HTML')
