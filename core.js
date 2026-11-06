/* Original implementation: MSDS Studio, 2026. No code from reference site. */
(function(root){'use strict';
const PICTOS=['폭발성','인화성','산화성','고압가스','부식성','급성독성','유해·자극성','건강 유해성','환경 유해성'];
function blank(){return {id:'p-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)),name:'',signal:'',pictos:[],noPictos:false,hazards:'',precautions:'',supplier:'',phone:'',address:'',raw:'',capacity:'',source:'직접 입력',translations:{}}}
// PDF streams do not have to follow reading order. Sort glyph runs by visual baseline, then x.
function orderedText(items){
 const rows=[];const runs=items.filter(x=>typeof x.str==='string'&&x.str.trim()).map(x=>({...x,y:x.transform[5],x:x.transform[4],size:Math.abs(x.transform[3])||10})).sort((a,b)=>b.y-a.y||a.x-b.x);
 for(const i of runs){let r=rows.find(r=>Math.abs(r.y-i.y)<=Math.min(2.2,i.size*.22));if(!r){r={y:i.y,items:[]};rows.push(r)}r.items.push(i)}
 return rows.sort((a,b)=>b.y-a.y).map(r=>{let text='',end=null;for(const i of r.items.sort((a,b)=>a.x-b.x)){const gap=end===null?0:i.x-end;const need=text&&!/\s$/.test(text)&&!/^\s/.test(i.str)&&gap>i.size*.12;text+=(need?' ':'')+i.str;end=i.x+(i.width||0)}return text.replace(/[\t\u00a0 ]+/g,' ').trim()}).filter(Boolean).join('\n');
}
function section(t,n){const rows=t.split('\n'),head=k=>new RegExp('^\\s*(?:제\\s*)?'+k+'\\s*[.．、항]\\s*');const a=rows.findIndex(x=>head(n).test(x));if(a<0)return '';const b=rows.findIndex((x,i)=>i>a&&head(n+1).test(x));return rows.slice(a,b<0?undefined:b).join('\n')}
function parse(raw){
 const d=blank();d.raw=String(raw);const t=String(raw).replace(/\r/g,'').replace(/\f/g,'\n').replace(/[\t\u00a0 ]+/g,' ').replace(/^\s*\d+\s*\/\s*\d+\s*$/gm,'').replace(/^\s*([가-힣])\s*\.\s*/gm,'$1. ');
 const first=section(t,1)||t,second=section(t,2);const get=(src,pattern)=>{const rows=src.split('\n');const re=new RegExp('^(?:[-•○●]\\s*)?(?:[가-마]\\.\\s*)?(?:'+pattern+')\\s*(?:[:：]\\s*)?(.*)$','i');for(let i=0;i<rows.length;i++){const m=rows[i].trim().match(re);if(!m)continue;let v=m[1].trim();if(!v){v=(rows.slice(i+1).find(x=>x.trim())||'').trim()}v=v.replace(/^[-•]\s*/,'').trim();if(/^(?:[가-마]\\.|○|그림|신호|유해|예방|\\d+[.])/.test(v))return '';return v}return ''};
 d.name=get(first,'제품\\s*명|물질\\s*명|Product\\s*(?:name|identifier)');
 d.supplier=get(first,'회사\\s*명|공급자\\s*명|제조자\\s*명|제조\\s*업체\\s*명|Company\\s*name');
 d.address=get(first,'주\\s*소|Address');
 d.phone=get(first,'긴급\\s*(?:전화\\s*번호|연락처)|전화\\s*번호|Emergency\\s*(?:telephone|phone)(?:\\s*number)?').replace(/^(?:TEL|전화)\s*[:：]\s*/i,'').split(/[,;]?\s*FAX\s*[:：]/i)[0].replace(/[,;]\s*$/,'').trim();
 const sig=get(second,'신호\\s*어|Signal\\s*word');if(/^(?:위험|Danger)(?:\s|$)/i.test(sig))d.signal='위험';else if(/^(?:경고|Warning)(?:\s|$)/i.test(sig))d.signal='경고';
 d.pictos=[...new Set([...second.matchAll(/GHS\s*0?([1-9])\b/gi)].map(x=>Number(x[1])))];
 const hs=[],ps=[];let dest=null;
 for(let line of second.split('\n')){
  line=line.trim().replace(/^[-•]\s*/,'');if(!line||/^\d+\s*\/\s*\d+$/.test(line))continue;
  if(/^(?:[가-마]\.\s*|[○●■□]|\d+[)]|MSDS|물질안전보건자료)/i.test(line)){dest=null;continue}
  const matches=[...line.matchAll(/\b[HP]\s*\d{3}(?:\s*\+\s*[HP]?\s*\d{3})*/g)];
  if(matches.length){for(let j=0;j<matches.length;j++){const m=matches[j];let part=line.slice(m.index,matches[j+1]?.index).trim().replace(/^([HP])\s+(\d)/,'$1$2').replace(/\s*\+\s*/g,'+').replace(/\s+([,.])/g,'$1');dest=part[0]==='H'?hs:ps;dest.push(part)}}
  else if(dest&&!/^(?:분류|그림|신호|유해|예방|대응|저장|폐기|NFPA|보건\s*[:：])/.test(line)){dest[dest.length-1]+=' '+line}
 }
 d.hazards=[...new Set(hs)].join('\n');d.precautions=[...new Set(ps)].join('\n');d.source='자동 추출 · 원문 대조 필요';return d;
}
function lines(s){return String(s||'').split('\n').map(x=>x.trim()).filter(Boolean)}
function esc(s){return String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}
const PCATS={2:'예방',3:'대응',4:'저장',5:'폐기'};
function pRows(d){return lines(d.precautions).map((text,i)=>{const code=text.match(/^P(\d{3})(?:\+P?\d{3})*/i)?.[0]||'';const cat=code?Math.floor(Number(code.slice(1,4))/100):0;return {i,text,code,cat:PCATS[cat]?cat:0}})}
function recommendedP(d){const rows=pRows(d);if(rows.length<=6)return rows.map(r=>r.i);if(rows.some(r=>!r.cat))return null;
 const hs=d.hazards||'',fire=/H(?:22[0-9]|24[0-2])/i.test(hs),cmr=/H(?:34[01]|35[01]|36[012]|37[012])/i.test(hs),gas=/H28[01]/.test(hs),corrosive=/H(?:314|318)/.test(hs);
 const score=r=>{let n=0;const c=r.code;if(/^P210(?:\+|$)/.test(c))n+=fire?110:55;if(/^P280(?:\+|$)/.test(c))n+=100;if(/^P20[12](?:\+|$)/.test(c))n+=cmr?85:20;if(/^P26[01](?:\+|$)/.test(c))n+=70;if(/^P308\+P313/.test(c))n+=cmr?110:55;if(/^P305\+P351\+P338/.test(c))n+=corrosive?125:65;if(/^P304\+P340/.test(c))n+=85;if(/^P301\+P310/.test(c))n+=95;if(/^P370/.test(c))n+=fire?75:25;if(/^P410\+P403/.test(c))n+=gas?120:55;if(/^P403\+P235/.test(c))n+=fire?105:65;if(/^P403\+P233/.test(c))n+=80;if(/^P405/.test(c))n+=cmr?70:30;if(/^P501/.test(c))n+=100;return n};
 const selected=[];for(const cat of [2,3,4,5]){const list=rows.filter(r=>r.cat===cat).sort((a,b)=>score(b)-score(a)||a.i-b.i);if(list.length)selected.push(list[0].i)}
 const ranked=[...rows].sort((a,b)=>score(b)-score(a)||a.i-b.i);for(const r of [...ranked.filter(r=>r.cat===2||r.cat===3),...ranked]){if(selected.length>=6)break;if(!selected.includes(r.i))selected.push(r.i)}return selected.sort((a,b)=>a-b)
}
function selectedP(d){const rows=pRows(d);if(d.pMode==='all'||rows.length<=6)return rows;const auto=recommendedP(d);if(auto===null)return rows;const ids=Array.isArray(d.pSelection)?d.pSelection:auto;return rows.filter(r=>ids.includes(r.i))}
function pSelectionErrors(d){const rows=pRows(d),shown=selectedP(d);if(d.pMode==='all'||rows.length<=6||recommendedP(d)===null)return [];const errors=[];if(shown.length!==6)errors.push('간단 표지는 예방조치 문구를 6개 선택하세요.');for(const c of [2,3,4,5])if(rows.some(r=>r.cat===c)&&!shown.some(r=>r.cat===c))errors.push(PCATS[c]+' 문구를 1개 이상 포함하세요.');return errors}
function noCode(s){return s.replace(/^[HP]\d{3}(?:\+[HP]?\d{3})*\s*[:：]?\s*/,'')}
function labelHTML(d,qr){const ps=selectedP(d),omitted=lines(d.precautions).length>ps.length,show=s=>esc(d.showCodes===true?s:noCode(s));const pbody=d.pMode==='all'?`<ul>${ps.map(r=>`<li>${show(r.text)}</li>`).join('')}</ul>`:[2,3,4,5,0].map(c=>{const list=ps.filter(r=>r.cat===c);return list.length?`<div class="p-group"><b>${esc(PCATS[c]||'기타')}</b><ul>${list.map(r=>`<li>${show(r.text)}</li>`).join('')}</ul></div>`:''}).join('');
 return `<h3>${esc(d.name||'제품명을 입력하세요')}</h3><div class="pictorow"><div class="symbols">${(d.pictos||[]).map(n=>`<img src="assets/GHS${String(n).padStart(2,'0')}.svg" alt="${esc(PICTOS[n-1])}">`).join('')}</div><div class="signal">${esc(d.signal==='없음'?'':d.signal)}</div></div><section class="label-section"><h4>${esc(d.headH||'유해·위험 문구')}</h4><ul>${lines(d.hazards).map(x=>`<li>${show(x)}</li>`).join('')}</ul></section><section class="label-section"><h4>${esc(d.headP||'예방조치 문구')}</h4>${pbody}${omitted?'<p class="msds-ref">※ 이 외의 예방조치 문구는 물질안전보건자료(MSDS)를 참고하시오.</p>':''}</section><div class="sup"><b>${esc(d.headS||'공급자 정보')}</b><br>${esc(d.supplier)}${d.phone?' · '+esc(d.phone):''}${d.address?'<br>'+esc(d.address):''}${qr?`<div class="qrblock"><small>다국어 경고표지<br>Scan for languages</small><img src="${qr}" alt="다국어 QR"></div>`:''}</div>`
}
function normalize(d){let b=blank();for(const k of ['id','name','signal','hazards','precautions','supplier','phone','address','raw','source','capacity','analysisInfo'])if(typeof d[k]==='string')b[k]=d[k].slice(0,k==='raw'?500000:50000);if(!/^[A-Za-z0-9_-]{1,100}$/.test(b.id))b.id=blank().id;b.signal=['','위험','경고','없음'].includes(b.signal)?b.signal:'';b.pictos=Array.isArray(d.pictos)?[...new Set(d.pictos.filter(x=>Number.isInteger(x)&&x>=1&&x<=9))]:[];b.pMode=d.pMode==='all'?'all':'compact';b.showCodes=d.showCodes===true;if(Array.isArray(d.pSelection))b.pSelection=d.pSelection.filter(x=>Number.isInteger(x)&&x>=0&&x<300);b.noPictos=d.noPictos===true;for(const l of ['vi','zh','en','ru']){const o=d.translations?.[l];if(!o||typeof o!=='object')continue;b.translations[l]={reviewed:o.reviewed===true};for(const k of ['name','signal','hazards','precautions'])b.translations[l][k]=typeof o[k]==='string'?o[k].slice(0,50000):''}return b}
root.MSDS={PICTOS,blank,parse,orderedText,lines,esc,labelHTML,normalize,pRows,recommendedP,selectedP,pSelectionErrors,PCATS};if(typeof module!=='undefined')module.exports=root.MSDS;
})(globalThis);
