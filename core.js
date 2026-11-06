/* Original implementation: MSDS Studio, 2026. No code from reference site. */
(function(root){'use strict';
const PICTOS=['폭발성','인화성','산화성','고압가스','부식성','급성독성','유해·자극성','건강 유해성','환경 유해성'];
function blank(){return {id:'p-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)),name:'',signal:'',pictos:[],noPictos:false,hazards:'',precautions:'',supplier:'',phone:'',address:'',raw:'',capacity:'',source:'직접 입력',translations:{}}}
function section(t,n){const lines=t.split('\n');const re=new RegExp('^\\s*(?:제\\s*)?'+n+'\\s*[.．、항)]\\s*');const start=lines.findIndex(x=>re.test(x));if(start<0)return '';let end=lines.findIndex((x,i)=>i>start&&new RegExp('^\\s*(?:제\\s*)?'+(n+1)+'\\s*[.．、항)]\\s*').test(x));return lines.slice(start,end<0?undefined:end).join('\n')}
function parse(raw){const d=blank();d.raw=String(raw);const t=String(raw).replace(/\r/g,'').replace(/[\t\u00a0]+/g,' ');const first=section(t,1)||t;const second=section(t,2)||t;const field=(s,re)=>{const m=s.match(re);return m?m[1].trim():''};
d.name=field(first,/(?:제품\s*명|물질\s*명|Product\s*(?:name|identifier))\s*[:：]\s*([^\n]+)/i);
d.supplier=field(first,/(?:회사\s*명|공급자\s*명|제조자\s*명|제조\s*업체\s*명|Company\s*name)\s*[:：]\s*([^\n]+)/i);
d.address=field(first,/(?:주\s*소|Address)\s*[:：]\s*([^\n]+)/i);
d.phone=field(first,/(?:긴급\s*(?:전화\s*번호|연락처)|전화\s*번호|Emergency\s*(?:telephone|phone)(?:\s*number)?)\s*[:：]\s*([^\n]+)/i);
const sig=second.match(/(?:신호\s*어|Signal\s*word)\s*[:：]?\s*(위험|경고|Danger|Warning)/i);if(sig)d.signal=/위험|danger/i.test(sig[1])?'위험':'경고';
const g=[...second.matchAll(/GHS\s*0?([1-9])\b/gi)].map(x=>Number(x[1]));d.pictos=[...new Set(g)];
const hs=[],ps=[];let dest=null;
for(let line of second.split('\n')){line=line.trim();if(!line)continue;if(/^(?:가|나|다|라|마)[.．]\s/.test(line)||/^(?:유해성[ㆍ· ]|예방조치\s*문구|그림\s*문자|신호\s*어|분류)/.test(line)){dest=null}
const starts=[...line.matchAll(/\b([HP]\s*\d{3}(?:\s*\+\s*[HP]?\s*\d{3})*)\s*[:：]?/g)];
if(starts.length){for(let j=0;j<starts.length;j++){const m=starts[j],part=line.slice(m.index,starts[j+1]?.index).replace(/([HP])\s+(\d)/g,'$1$2');dest=m[1].trim()[0]==='H'?hs:ps;dest.push(part.trim())}}else if(dest&&!/^(?:[가-마][.．]|\d+[.．]|페이지|Page|MSDS|물질안전보건자료|기타\s*유해|분류)/i.test(line)&&!/(?:예방조치\s*문구|유해[ㆍ·]?위험\s*문구|신호\s*어|그림\s*문자|^[○●■□])/i.test(line)){dest[dest.length-1]+=' '+line}
}
d.hazards=[...new Set(hs)].join('\n');d.precautions=[...new Set(ps)].join('\n');d.source='자동 추출 · 원문 대조 필요';return d}
function lines(s){return String(s||'').split('\n').map(x=>x.trim()).filter(Boolean)}
function esc(s){return String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}
function labelHTML(d,qr){return `<h3>${esc(d.name||'제품명을 입력하세요')}</h3><div class="pictorow"><div class="symbols">${(d.pictos||[]).map(n=>`<img src="assets/GHS${String(n).padStart(2,'0')}.svg" alt="${esc(PICTOS[n-1])}">`).join('')}</div><div class="signal">${esc(d.signal==='없음'?'':d.signal)}</div></div><section class="label-section"><h4>${esc(d.headH||'유해·위험 문구')}</h4><ul>${lines(d.hazards).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section class="label-section"><h4>${esc(d.headP||'예방조치 문구')}</h4><ul>${lines(d.precautions).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><div class="sup"><b>${esc(d.headS||'공급자 정보')}</b><br>${esc(d.supplier)}${d.phone?' · '+esc(d.phone):''}${d.address?'<br>'+esc(d.address):''}${qr?`<div class="qrblock"><small>다국어 경고표지<br>Scan for languages<br>베트남어 · 중국어 · 영어 등</small><img src="${qr}" alt="다국어 QR"></div>`:''}</div>`}
function normalize(d){let b=blank();for(const k of ['id','name','signal','hazards','precautions','supplier','phone','address','raw','source','capacity'])if(typeof d[k]==='string')b[k]=d[k].slice(0,k==='raw'?500000:50000);if(!/^[A-Za-z0-9_-]{1,100}$/.test(b.id))b.id=blank().id;b.signal=['','위험','경고','없음'].includes(b.signal)?b.signal:'';b.pictos=Array.isArray(d.pictos)?[...new Set(d.pictos.filter(x=>Number.isInteger(x)&&x>=1&&x<=9))]:[];b.noPictos=d.noPictos===true;for(const l of ['vi','zh','en','ru']){const o=d.translations?.[l];if(!o||typeof o!=='object')continue;b.translations[l]={reviewed:o.reviewed===true};for(const k of ['name','signal','hazards','precautions'])b.translations[l][k]=typeof o[k]==='string'?o[k].slice(0,50000):''}return b}
root.MSDS={PICTOS,blank,parse,lines,esc,labelHTML,normalize};if(typeof module!=='undefined')module.exports=root.MSDS;
})(globalThis);
