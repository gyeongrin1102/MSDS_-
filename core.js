/* Original implementation: MSDS Studio, 2026. No code from reference site. */
(function(root){'use strict';
const PICTOS=['폭발성','인화성','산화성','고압가스','부식성','급성독성','유해·자극성','건강 유해성','환경 유해성'];
function blank(){return {id:'p-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)),name:'',signal:'',pictos:[],noPictos:false,hazards:'',precautions:'',supplier:'',phone:'',address:'',raw:'',capacity:'',source:'직접 입력',translations:{}}}
// PDF streams do not have to follow reading order. Sort glyph runs by visual baseline, then x.
function orderedText(items){
 const rows=[];const runs=items.filter(x=>typeof x.str==='string'&&x.str.trim()).map(x=>({...x,y:x.transform[5],x:x.transform[4],size:Math.abs(x.transform[3])||10})).sort((a,b)=>b.y-a.y||a.x-b.x);
 for(const i of runs){let r=rows.find(r=>Math.abs(r.y-i.y)<=Math.min(2.2,i.size*.22));if(!r){r={y:i.y,items:[]};rows.push(r)}r.items.push(i)}
 return rows.sort((a,b)=>b.y-a.y).map(r=>{let text='',end=null;for(const i of r.items.sort((a,b)=>a.x-b.x)){const gap=end===null?0:i.x-end;const need=text&&!/\s$/.test(text)&&!/^\s/.test(i.str)&&gap>i.size*.12;text+=(need?' ':'')+i.str;end=i.x+(i.width||0)}return text.replace(/[\t  ]+/g,' ').trim()}).filter(Boolean).join('\n');
}
// v1.3: also accept "SECTION 2", "[2]", and "2 유해성…" headings without a dot.
const SECT_KW={1:'화학\\s*제품|제품\\s*및|Identification',2:'유해\\s*성|Hazard',3:'구성\\s*성분|성분|Composition'};
function section(t,n){const rows=t.split('\n'),head=k=>new RegExp('^\\s*(?:(?:제\\s*)?'+k+'\\s*[.．、항]|SECTION\\s*'+k+'\\b|[\\[【]\\s*'+k+'\\s*[\\]】]|'+k+'\\s+(?='+(SECT_KW[k]||'$^')+'))\\s*','i');const a=rows.findIndex(x=>head(n).test(x));if(a<0)return '';const b=rows.findIndex((x,i)=>i>a&&head(n+1).test(x));return rows.slice(a,b<0?undefined:b).join('\n')}
// Running headers/footers (product name, revision, page no.) repeat at page edges and were appended to H/P statements.
function cleanPages(pages){if(pages.length<2)return pages.join('\n');const key=x=>x.replace(/\d+/g,'#').replace(/\s+/g,''),edge=p=>{const r=p.split('\n');return new Set([...r.slice(0,3),...r.slice(-3)].map(key))},count=new Map();for(const st of pages.map(edge))for(const k of st)count.set(k,(count.get(k)||0)+1);const rep=k=>k&&count.get(k)>=2&&!/^[HP]#/.test(k)&&!/^(?:제)?#[.．、항]/.test(k)&&!/^SECTION#/i.test(k);return pages.map((p,pi)=>{const r=p.split('\n');return r.filter((x,i)=>!(((i<3&&pi>0)||i>=r.length-3)&&rep(key(x)))).join('\n')}).join('\n')}
// 원문 그림문자 줄의 한글 명칭 → GHS 번호 (원 위의 불꽃을 불꽃보다 먼저 검사)
const PICTO_WORDS=[[3,/원\s*위의?\s*불꽃|산화성/],[1,/폭발성|폭탄/],[2,/불꽃|인화성/],[4,/가스\s*실린더|고압\s*가스/],[5,/부식성/],[6,/해골|급성\s*독성/],[7,/감탄\s*부호|느낌표/],[8,/건강\s*유해|건강유해/],[9,/환경|수생/]];
const NOT_VALUE=/^(?:[가-마]\.|○|●|※|\*|그림|신호|유해|예방|\d+[.)]|해당\s*없음|자료\s*없음|없음$|N\/?A$|-+$|\(?\s*(?:입력|기재|작성))/i;
function parse(raw){
 const d=blank();d.raw=String(raw);const t=String(raw).replace(/\r/g,'').replace(/\f/g,'\n').replace(/[\t  ]+/g,' ').replace(/^\s*\d+\s*\/\s*\d+\s*$/gm,'').replace(/^\s*(?:page|페이지)?\s*\d+\s*(?:of|\/)\s*\d+\s*(?:page|페이지|쪽)?\s*$/gim,'').replace(/^\s*([가-힣])\s*\.\s*/gm,'$1. ');
 const first=section(t,1)||t,second=section(t,2);const get=(src,pattern)=>{const rows=src.split('\n');const re=new RegExp('^(?:[-•○●]\\s*)?(?:[가-마]\\.\\s*)?(?:'+pattern+')\\s*(?:[:：]\\s*)?(.*)$','i');for(let i=0;i<rows.length;i++){const m=rows[i].trim().match(re);if(!m)continue;let v=m[1].trim();if(!v){v=(rows.slice(i+1).find(x=>x.trim())||'').trim()}v=v.replace(/^[-•]\s*/,'').trim();if(NOT_VALUE.test(v)||v.length>150)return '';return v}return ''};
 d.name=get(first,'제품\\s*명|물질\\s*명|Product\\s*(?:name|identifier)');
 d.supplier=get(first,'회사\\s*명|공급자\\s*명|제조자\\s*명|제조\\s*업체\\s*명|Company\\s*name');
 d.address=get(first,'주\\s*소|Address');
 d.phone=get(first,'긴급\\s*(?:전화\\s*번호|연락처)|전화\\s*번호|Emergency\\s*(?:telephone|phone)(?:\\s*number)?').replace(/^(?:TEL|전화)\s*[:：]\s*/i,'').split(/[,;]?\s*FAX\s*[:：]/i)[0].replace(/[,;]\s*$/,'').trim();
 const sig=get(second,'신호\\s*어|Signal\\s*word'),hasD=/(?:^|[^가-힣A-Za-z])(?:위험|Danger)(?![가-힣A-Za-z])/i.test(' '+sig),hasW=/(?:^|[^가-힣A-Za-z])(?:경고|Warning)(?![가-힣A-Za-z])/i.test(' '+sig);
 if(hasD)d.signal='위험';else if(hasW)d.signal='경고';else if(/^(?:없음|해당\s*없음|None)/i.test(sig))d.signal='';
 // 원문 텍스트의 그림문자: GHS 코드 + 그림문자 줄의 한글 명칭
 const tp=new Set([...second.matchAll(/GHS\s*0?([1-9])\b/gi)].map(x=>Number(x[1])));
 const srows=second.split('\n');for(let i=0;i<srows.length;i++){if(!/그림\s*문자|Pictogram/i.test(srows[i]))continue;for(let k=i;k<Math.min(srows.length,i+3);k++){let s=k===i?srows[k].replace(/^.*?(?:그림\s*문자|Pictogram)/i,''):srows[k];if(k>i&&/신호|유해|예방|^[가-마]\./.test(s))break;for(const [n,re] of PICTO_WORDS)if(re.test(s)){tp.add(n);s=s.replace(new RegExp(re.source,'g'),' ')}}break}
 d.pictos=[...tp].sort((a,b)=>a-b);
 const hs=[],ps=[];let dest=null;
 for(let line of second.split('\n')){
  line=line.trim().replace(/^[-•]\s*/,'');if(!line||/^\d+\s*\/\s*\d+$/.test(line))continue;
  if(/^(?:[가-마]\.\s*|[○●■□]|\d+[)]|MSDS|물질안전보건자료)/i.test(line)){dest=null;continue}
  const matches=[...line.matchAll(/\b[HP]\s*\d{3}(?:\s*\+\s*[HP]?\s*\d{3})*/g)];
  if(matches.length){for(let j=0;j<matches.length;j++){const m=matches[j];let part=line.slice(m.index,matches[j+1]?.index).trim().replace(/^([HP])\s+(\d)/,'$1$2').replace(/\s*\+\s*/g,'+').replace(/\s+([,.])/g,'$1');part=part.replace(/\+(\d)/g,'+'+part[0]+'$1');dest=part[0]==='H'?hs:ps;dest.push(part)}}
  else if(dest&&!/^(?:분류|그림|신호|유해|예방|대응|저장|폐기|NFPA|보건\s*[:：])/.test(line)){dest[dest.length-1]+=' '+line}
 }
 d.hazards=[...new Set(hs)].join('\n');d.precautions=[...new Set(ps)].join('\n');d.source='자동 추출 · 원문 대조 필요';
 d.extracted={hazards:lines(d.hazards),precautions:lines(d.precautions),pictosText:[...d.pictos],pictosImage:[],pictosUncertain:[],signal:d.signal,signalRaw:sig.slice(0,80),fields:{name:!!d.name,supplier:!!d.supplier,phone:!!d.phone,address:!!d.address,signal:!!d.signal}};
 return d;
}
function lines(s){return String(s||'').split('\n').map(x=>x.trim()).filter(Boolean)}
function esc(s){return String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}
const PCATS={1:'일반',2:'예방',3:'대응',4:'저장',5:'폐기'};
// Memoized: called many times per keystroke from the selection UI and label renderer.
let pMemo={k:null},rMemo={k:null};
function pRows(d){const k=String(d.precautions||'');if(pMemo.k!==k)pMemo={k,v:pRowsRaw(d)};return pMemo.v}
function recommendedP(d){const k=String(d.precautions||'')+'\u0000'+String(d.hazards||'');if(rMemo.k!==k)rMemo={k,v:recommendedRaw(d)};return rMemo.v&&[...rMemo.v]}
// 복합 코드(P301+P310)는 한 문구 단위. sub: 다른 행에 코드가 모두 포함되는 행(중복 후보)의 상위 행 번호.
function pRowsRaw(d){const rows=lines(d.precautions).map((text,i)=>{const code=(text.match(/^P\s*\d{3}(?:\s*\+\s*P?\s*\d{3})*/i)?.[0]||'').replace(/\s+/g,'').toUpperCase().replace(/\+(\d)/g,'+P$1');const cat=code?Math.floor(Number(code.slice(1,4))/100):0;return {i,text,code,body:code?text.slice(text.match(/^P\s*\d{3}(?:\s*\+\s*P?\s*\d{3})*/i)[0].length).trim():text,cat:PCATS[cat]?cat:0,sub:null}});
 const sets=rows.map(r=>new Set(r.code.match(/P\d{3}/g)||[]));rows.forEach((r,i)=>{if(!sets[i].size)return;for(let j=0;j<rows.length;j++){if(i===j||!sets[j].size)continue;if([...sets[i]].every(c=>sets[j].has(c))&&(sets[j].size>sets[i].size||j<i)){r.sub=j;return}}});return rows}
const COMPACT_MIN=7; // 고시 제6조의2제5항제2호: 7개 이상일 때만 6개 표시 가능
// 프로그램 추천 기준(법정 우선순위 아님): 범주별 1개 → 점수순으로 6개까지. 다른 행에 포함되는 문구는 제외.
function recommendedRaw(d){const rows=pRows(d);if(rows.length<COMPACT_MIN)return rows.map(r=>r.i);if(rows.some(r=>!r.cat))return null;const cand=rows.filter(r=>r.sub===null);
 const hs=d.hazards||'',fire=/H(?:22[0-9]|24[0-2])/i.test(hs),cmr=/H(?:34[01]|35[01]|36[012]|37[012])/i.test(hs),gas=/H28[01]/.test(hs),corrosive=/H(?:314|318)/.test(hs);
 const score=r=>{let n=0;const c=r.code;if(/^P210(?:\+|$)/.test(c))n+=fire?110:55;if(/^P280(?:\+|$)/.test(c))n+=100;if(/^P20[12](?:\+|$)/.test(c))n+=cmr?85:20;if(/^P26[01](?:\+|$)/.test(c))n+=70;if(/^P308\+P313/.test(c))n+=cmr?110:55;if(/^P305\+P351\+P338/.test(c))n+=corrosive?125:65;if(/^P304\+P340/.test(c))n+=85;if(/^P301\+P310/.test(c))n+=95;if(/^P370/.test(c))n+=fire?75:25;if(/^P410\+P403/.test(c))n+=gas?120:55;if(/^P403\+P235/.test(c))n+=fire?105:65;if(/^P403\+P233/.test(c))n+=80;if(/^P405/.test(c))n+=cmr?70:30;if(/^P501/.test(c))n+=100;return n};
 const selected=[];for(const cat of [2,3,4,5]){const list=cand.filter(r=>r.cat===cat).sort((a,b)=>score(b)-score(a)||a.i-b.i);if(list.length)selected.push(list[0].i)}
 const ranked=[...cand].sort((a,b)=>score(b)-score(a)||a.i-b.i),n=c=>selected.filter(i=>rows[i].cat===c).length;
 // 범주별 최대 2개로 먼저 채우고, 6개에 못 미칠 때만 제한 없이 채움
 for(const cap of [2,9])for(const r of [...ranked.filter(r=>r.cat===2||r.cat===3),...ranked]){if(selected.length>=6)break;if(!selected.includes(r.i)&&n(r.cat)<cap)selected.push(r.i)}return selected.sort((a,b)=>a-b)
}
function compactActive(d){return d.pMode!=='all'&&pRows(d).length>=COMPACT_MIN&&recommendedP(d)!==null}
function selectedP(d){const rows=pRows(d);if(!compactActive(d))return rows;const ids=Array.isArray(d.pSelection)?d.pSelection:recommendedP(d);return rows.filter(r=>ids.includes(r.i))}
function pSelectionErrors(d){if(!compactActive(d))return [];const rows=pRows(d),shown=selectedP(d),ids=new Set(shown.map(r=>r.i)),errors=[];
 const allNonDup=rows.every(r=>ids.has(r.i)||(r.sub!==null&&ids.has(r.sub)));
 if(shown.length!==6&&!allNonDup)errors.push('7개 이상일 때는 6개를 표시하거나 전체를 표시해야 합니다(현재 '+shown.length+'개 선택).');
 for(const c of [2,3,4,5])if(rows.some(r=>r.cat===c)&&!shown.some(r=>r.cat===c))errors.push(PCATS[c]+' 문구가 원문에 있으므로 1개 이상 포함하세요.');return errors}
function noCode(s){return s.replace(/^[HP]\d{3}(?:\+[HP]?\d{3})*\s*[:：]?\s*/,'')}
// 표 양식 경고표지(고시 별표 3 제1호 순서: 명칭 → 그림문자·신호어 → 유해·위험 문구 → 예방조치 문구 → 공급자 정보).
// opt.type: standard | small(제6조②) | semi(제6조③), opt.pictoMM: 그림문자 한 변(mm)
function labelHTML(d,qr,opt){opt=opt||{};const type=opt.type||'standard',pm=opt.pictoMM,show=s=>esc(d.showCodes===true?s:noCode(s));
 const imgs=(d.pictos||[]).map(n=>`<img src="assets/GHS${String(n).padStart(2,'0')}.svg" alt="${esc(PICTOS[n-1])}"${pm?` style="width:${pm}mm;height:${pm}mm"`:''}>`).join(''),sig=esc(d.signal==='없음'?'':d.signal);
 let h=`<table class="lt"><tbody><tr><td colspan="2" class="lt-name"><div class="name-flex"><div class="name-text">${esc(d.name||'제품명을 입력하세요')}</div>${qr?`<div class="qrblock"><img src="${qr}" alt="다국어 QR"><small>다국어 표지<br>Languages</small></div>`:''}</div></td></tr>`;
 if(imgs||sig)h+=`<tr><td colspan="2" class="lt-pic"><div class="pictorow">${imgs?`<div class="symbols"${pm?` style="max-width:min(${(4*pm+4.6).toFixed(1)}mm,100%)"`:''}>${imgs}</div>`:''}${sig?`<div class="signal">${sig}</div>`:''}</div></td></tr>`;
 if(type==='standard'){const ps=selectedP(d),omitted=pRows(d).length>ps.length;
  h+=`<tr><th>${esc(d.headH||'유해·위험 문구')}</th><td><ul>${lines(d.hazards).map(x=>`<li>${show(x)}</li>`).join('')}</ul></td></tr>`;
  const groups=[2,3,4,5,1,0].map(c=>{const list=ps.filter(r=>r.cat===c);return list.length?`<div class="p-group"><b>${esc(PCATS[c]||'기타')}</b><ul>${list.map(r=>`<li>${show(r.text)}</li>`).join('')}</ul></div>`:''}).join('');
  h+=`<tr><th>${esc(d.headP||'예방조치 문구')}</th><td>${groups}</td></tr>`;
  if(type==='standard'&&omitted)opt.ref=true;}
 if(type!=='semi')h+=`<tr><th>${esc(d.headS||'공급자 정보')}</th><td class="lt-sup"><div class="sup-flex"><div class="sup-text">${esc(d.supplier)}${d.address?'<br>'+esc(d.address):''}${d.phone?'<br>전화 '+esc(d.phone):''}</div></div></td></tr>`;
 if(opt.ref)h+='<tr><td colspan="2" class="lt-ref">※ 표시하지 않은 예방조치 문구는 물질안전보건자료(MSDS)를 참고하시오.</td></tr>';
 return h+'</tbody></table>';
}
const UNITS=['mL','L','g','kg'];
function normalize(d){let b=blank();for(const k of ['id','name','signal','hazards','precautions','supplier','phone','address','raw','source','capacity','analysisInfo'])if(typeof d[k]==='string')b[k]=d[k].slice(0,k==='raw'?500000:50000);if(!/^[A-Za-z0-9_-]{1,100}$/.test(b.id))b.id=blank().id;b.signal=['','위험','경고','없음'].includes(b.signal)?b.signal:'';b.pictos=Array.isArray(d.pictos)?[...new Set(d.pictos.filter(x=>Number.isInteger(x)&&x>=1&&x<=9))]:[];b.pMode=d.pMode==='all'?'all':'compact';b.showCodes=d.showCodes===true;if(Array.isArray(d.pSelection))b.pSelection=d.pSelection.filter(x=>Number.isInteger(x)&&x>=0&&x<300);b.noPictos=d.noPictos===true;for(const l of ['vi','zh','en','ru']){const o=d.translations?.[l];if(!o||typeof o!=='object')continue;b.translations[l]={reviewed:o.reviewed===true};for(const k of ['name','signal','hazards','precautions'])b.translations[l][k]=typeof o[k]==='string'?o[k].slice(0,50000):''}
 // v1.4 fields (모두 선택 사항: 이전 저장 데이터는 기본값으로 동작)
 const num=(x,lo,hi)=>{const n=Number(x);return isFinite(n)&&n>=lo&&n<=hi?n:null};
 if(d.capValue!==undefined&&d.capValue!==null&&String(d.capValue).trim()!==''&&num(d.capValue,0,1e9)!==null)b.capValue=String(d.capValue).slice(0,20);
 b.capUnit=UNITS.includes(d.capUnit)?d.capUnit:'L';const sa=num(d.sideArea,0,1e6);if(sa)b.sideArea=sa;
 b.labelType=['standard','small','semi'].includes(d.labelType)?d.labelType:'standard';b.semiConfirmed=d.semiConfirmed===true;b.pictosManual=d.pictosManual===true;
 if(d.size&&typeof d.size==='object'){const w=num(d.size.w,20,600),h=num(d.size.h,20,600),f=num(d.size.f,6,36);if(w&&h&&f)b.size={w,h,f}}
 const pm=num(d.pictoMM,5,200);if(pm)b.pictoMM=pm;
 const e=d.extracted;if(e&&typeof e==='object'){const strs=a=>Array.isArray(a)?a.filter(x=>typeof x==='string').map(x=>x.slice(0,2000)).slice(0,300):[],ints=a=>Array.isArray(a)?[...new Set(a.filter(x=>Number.isInteger(x)&&x>=1&&x<=9))]:[];b.extracted={hazards:strs(e.hazards),precautions:strs(e.precautions),pictosText:ints(e.pictosText),pictosImage:ints(e.pictosImage),pictosUncertain:ints(e.pictosUncertain),signal:['위험','경고'].includes(e.signal)?e.signal:'',signalRaw:typeof e.signalRaw==='string'?e.signalRaw.slice(0,80):'',scan:e.scan===true,fields:e.fields&&typeof e.fields==='object'?Object.fromEntries(['name','supplier','phone','address','signal'].map(k=>[k,e.fields[k]===true])):{}}}
 return b}
root.MSDS={PICTOS,blank,parse,cleanPages,orderedText,lines,esc,labelHTML,normalize,pRows,recommendedP,selectedP,compactActive,pSelectionErrors,PCATS,COMPACT_MIN};if(typeof module!=='undefined')module.exports=root.MSDS;
})(globalThis);
