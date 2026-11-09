'use strict';
/* v1.4 · 표지 편집 화면. 기준 데이터: standards-data.js / 판정: standards.js / 추출·표지 HTML: core.js */
const $=id=>document.getElementById(id),M=MSDS,STD=MSDSStd,KEY='field-msds-studio-v1';
const sourceDocs=new Map(),sourceFiles=new Map();let visionTemplates;
let docs=[],current='',saveTimer,qrURL='',qrImage='',busy=false,toastTimer,lastEval=[],lastPlan=null;
const fields=['name','signal','hazards','precautions','supplier','phone','address'];
const settings={layoutMode:'a4p',margin:5,gap:4,pictoBasis:'square'};
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500)}
function active(){return docs.find(x=>x.id===current)}
function save(){try{localStorage.setItem(KEY,JSON.stringify({docs,base:$('baseUrl').value,settings}))}catch(e){toast('브라우저 저장 공간이 부족합니다. 작업 백업을 다운로드하세요.')}}
function debouncedSave(){clearTimeout(saveTimer);saveTimer=setTimeout(save,500)}
function unapprove(){$('approved').checked=false}
function setProgress(s){const p=$('progress');p.textContent=s||'';p.hidden=!s}
function queue(){const q=$('queue');q.replaceChildren();for(const d of docs){const row=document.createElement('div');row.className='queue-row'+(d.id===current?' active':'');const b=document.createElement('button');b.textContent=d.name||d.source||'이름 없는 제품';b.onclick=()=>load(d.id);const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label','이 제품 삭제');del.onclick=()=>{if(!confirm('이 제품을 작업 목록에서 삭제할까요? 게시된 products.json은 바뀌지 않습니다.'))return;sourceDocs.get(d.id)?.pdf.destroy();sourceDocs.delete(d.id);dropPages(d.id);const u=sourceFiles.get(d.id);if(u){URL.revokeObjectURL(u);sourceFiles.delete(d.id)}docs=docs.filter(x=>x.id!==d.id);if(!docs.length)docs.push(M.blank());load(docs[0].id);save()};row.append(b,del);q.append(row)}}
function readTranslation(){const t=active().translations[$('lang').value]||{};for(const [id,k] of [['trName','name'],['trSignal','signal'],['trHazards','hazards'],['trPrecautions','precautions']])$(id).value=t[k]||'';$('trReviewed').checked=t.reviewed===true}
function load(id){current=id;const d=active();fields.forEach(k=>$(k).value=d[k]);$('capacity').value=d.capacity||'';$('capValue').value=d.capValue||'';$('capUnit').value=d.capUnit||'L';$('sideArea').value=d.sideArea||'';
 const s=d.size||{w:150,h:210,f:11};$('width').value=s.w;$('height').value=s.h;$('fontSize').value=s.f;$('pictoMM').value=d.pictoMM||'';
 document.querySelectorAll('input[name=ltype]').forEach(r=>r.checked=r.value===(d.labelType||'standard'));$('semiConfirmed').checked=d.semiConfirmed===true;
 $('compact').checked=d.pMode!=='all';$('showCodes').checked=d.showCodes===true;$('noPictos').checked=d.noPictos;$('raw').value=d.raw;$('productId').value=d.id;$('source-badge').textContent=d.source;$('openSource').hidden=!sourceFiles.has(d.id);
 unapprove();readTranslation();queue();paintPTable();render();$('analysisInfo').textContent=d.analysisInfo||''}
// 입력할 때 목록 전체를 다시 만들지 않고, 표지는 프레임당 1회만 갱신한다.
let pTableTimer;
function edit(e){const d=active(),pChanged=d.precautions!==$('precautions').value,nameChanged=d.name!==$('name').value;if(pChanged)delete d.pSelection;fields.forEach(k=>d[k]=$(k).value);if(e?.target?.id==='noPictos')d.pictosManual=true;d.noPictos=$('noPictos').checked;unapprove();if(nameChanged){const b=$('queue').querySelector('.queue-row.active button');if(b)b.textContent=d.name||d.source||'이름 없는 제품'}if(pChanged){clearTimeout(pTableTimer);pTableTimer=setTimeout(paintPTable,250)}render();debouncedSave()}
function trEdit(e){const t={};for(const [id,k] of [['trName','name'],['trSignal','signal'],['trHazards','hazards'],['trPrecautions','precautions']])t[k]=$(id).value;t.reviewed=e.target.id==='trReviewed'?$('trReviewed').checked:false;$('trReviewed').checked=t.reviewed;active().translations[$('lang').value]=t;render();debouncedSave()}
function getBase(){const u=new URL($('baseUrl').value);if(!/^https?:$/.test(u.protocol)||u.username||u.password)throw Error('HTTPS 사이트 주소를 입력하세요.');u.search='';u.hash='';if(!u.pathname.endsWith('/'))u.pathname+='/';return u}
// 번역이 하나라도 등록되면 다국어 QR을 자동으로 넣음(체크하면 번역 없이도 넣음)
function hasTranslation(d){return Object.values(d.translations||{}).some(t=>['name','signal','hazards','precautions'].some(k=>t?.[k]?.trim()))}
function wantQr(){return $('includeQr').checked||hasTranslation(active())}
function qr(){if(!wantQr())return '';try{const u=new URL('viewer.html',getBase());u.searchParams.set('id',active().id);if(qrURL===u.href)return qrImage;const q=qrcode(0,'M');q.addData(u.href);q.make();qrURL=u.href;qrImage=q.createDataURL(5,4);return qrImage}catch(e){return ''}}
function dimensions(){return {w:Math.min(400,Math.max(20,Number($('width').value)||150)),h:Math.min(400,Math.max(20,Number($('height').value)||210)),f:Math.min(24,Math.max(6,Number($('fontSize').value)||11))}}
// 실제 표지 종류: 조건을 확인하지 못한 특례는 적용하지 않음(필수 항목 유지).
function effectiveType(d){const cap=STD.parseCapacity(d.capValue,d.capUnit);if(d.labelType==='small'&&STD.smallEligible(cap))return 'small';if(d.labelType==='semi'&&d.semiConfirmed)return 'semi';return 'standard'}
// 그림문자 한 변(mm): 사용자 지정 > 별표 3 나목 최소 면적을 만족하는 자동 크기(0.5mm 단위 올림)
function pictoSide(d,size){if(d.pictoMM)return d.pictoMM;const min=STD.pictoMin(size.w*size.h/100),cm=settings.pictoBasis==='diamond'?Math.sqrt(min*2):Math.sqrt(min);return Math.min(Math.max(8,Math.ceil(cm*10*2)/2+0.5),Math.max(8,(size.w-14)*.6))}

/* ---------- 예방조치 문구 표 ---------- */
function pLines(d){return M.lines(d.precautions)}
function setPLines(d,arr){d.precautions=arr.join('\n');$('precautions').value=d.precautions}
function selectedIds(d){return new Set(M.selectedP(d).map(r=>r.i))}
function paintPTable(){clearTimeout(pTableTimer);const d=active(),rows=M.pRows(d),frag=document.createDocumentFragment();
 for(const r of rows){const row=document.createElement('div');row.className='p-row';row.dataset.i=r.i;row.setAttribute('role','listitem');
  row.innerHTML='<input type="checkbox" class="p-sel" aria-label="표지에 표시"><span class="p-cat"></span><input class="p-code" aria-label="P 코드"><textarea class="p-text" rows="1" aria-label="예방조치 문구"></textarea><span class="p-flag"></span><button class="p-del" aria-label="문구 삭제">×</button>';
  row.querySelector('.p-code').value=r.code||'';row.querySelector('.p-text').value=r.code?r.body:r.text;frag.append(row)}
 $('pTable').replaceChildren(frag);updatePRows()}
// 선택·추천·포함 상태만 갱신(행을 다시 만들지 않음)
function updatePRows(){const d=active(),rows=M.pRows(d),sel=selectedIds(d),rec=new Set(M.recommendedP(d)||[]),compact=M.compactActive(d),els=$('pTable').children;
 for(let k=0;k<els.length&&k<rows.length;k++){const r=rows[k],el=els[k],on=sel.has(r.i),box=el.querySelector('.p-sel');box.checked=on;box.disabled=!compact;el.classList.toggle('off',!on);el.querySelector('.p-cat').textContent=M.PCATS[r.cat]||'미분류';el.querySelector('.p-cat').dataset.cat=r.cat;
  const flags=[];if(compact&&rec.has(r.i))flags.push('추천');if(r.sub!==null)flags.push('포함됨');el.querySelector('.p-flag').textContent=flags.join(' · ');el.title=r.sub!==null?'다른 문구('+rows[r.sub].code+')에 코드가 모두 포함됩니다.':''}
 const shown=M.selectedP(d).length;$('pCount').textContent=shown+'/'+rows.length+'개 표시';
 const errs=M.pSelectionErrors(d),rc=M.recommendedP(d);$('pSummary').innerHTML=!rows.length?'추출된 예방조치 문구가 없습니다. <b>확인 필요</b>':(rows.length<M.COMPACT_MIN?'원문 '+rows.length+'개 — 7개 미만이므로 모두 표시합니다.':rc===null?'코드가 없는 문구가 있어 범주를 판단할 수 없으므로 모두 표시합니다.':!compact?'전체 '+rows.length+'개를 표시합니다.':'원문 '+rows.length+'개 중 '+shown+'개 표시 · 나머지는 ‘MSDS 참고’ 문구로 안내')+(errs.length?'<br><span class="bad">'+errs.map(M.esc).join('<br>')+'</span>':'')}
$('pTable').addEventListener('change',e=>{if(!e.target.classList.contains('p-sel'))return;const d=active(),i=Number(e.target.closest('.p-row').dataset.i),ids=selectedIds(d);e.target.checked?ids.add(i):ids.delete(i);d.pSelection=[...ids].sort((a,b)=>a-b);unapprove();updatePRows();render();debouncedSave()});
$('pTable').addEventListener('input',e=>{const row=e.target.closest('.p-row');if(!row||e.target.classList.contains('p-sel'))return;const d=active(),i=Number(row.dataset.i),arr=pLines(d),code=row.querySelector('.p-code').value.trim().toUpperCase(),text=row.querySelector('.p-text').value.replace(/\s*\n\s*/g,' ').trim();arr[i]=((code?code+' ':'')+text).trim()||'P';setPLines(d,arr);unapprove();updatePRows();render();debouncedSave()});
$('pTable').addEventListener('click',e=>{if(!e.target.classList.contains('p-del'))return;const d=active(),i=Number(e.target.closest('.p-row').dataset.i),arr=pLines(d);if(!confirm('이 문구를 원문 목록에서 삭제할까요? (표지에서 빼려면 체크만 해제하세요)'))return;arr.splice(i,1);if(Array.isArray(d.pSelection))d.pSelection=d.pSelection.filter(x=>x!==i).map(x=>x>i?x-1:x);setPLines(d,arr);unapprove();paintPTable();render();debouncedSave()});
$('pAdd').onclick=()=>{const d=active(),arr=pLines(d);arr.push('P');setPLines(d,arr);paintPTable();render();debouncedSave();const last=$('pTable').lastElementChild;last?.querySelector('.p-code').focus()};
$('pStd').onclick=()=>{const d=active(),arr=pLines(d),dict=globalThis.MSDSPhrases||{};let n=0;const next=M.pRows(d).map(r=>{if(r.code&&dict[r.code]&&r.body!==dict[r.code]){n++;return r.code+' '+dict[r.code]}return arr[r.i]});if(!n){toast('바꿀 문구가 없습니다(사전에 없는 코드는 그대로 둡니다).');return}if(!confirm(n+'개 문구를 고시 별표 2 표준 문구로 바꿀까요? 추출 원문은 별도로 보관됩니다. “…” 부분은 원문에 맞게 채워야 합니다.'))return;setPLines(d,next);unapprove();paintPTable();render();debouncedSave();toast(n+'개 문구를 표준 문구로 바꿨습니다. “…”·(주) 표시를 확인하세요.')};
$('recommendP').onclick=()=>{delete active().pSelection;unapprove();updatePRows();render();debouncedSave()};
$('compact').onchange=()=>{active().pMode=$('compact').checked?'compact':'all';unapprove();updatePRows();render();debouncedSave()};
$('showCodes').onchange=()=>{active().showCodes=$('showCodes').checked;unapprove();render();debouncedSave()};

/* ---------- 자동 선택 근거(그림문자·신호어) ---------- */
const PN=STD.PNAME,pn=a=>a.map(n=>PN[n-1]).join(', ');
function autoInfoHTML(d){const r=STD.pictoReport(d),sg=STD.inferSignal(r.hs),e=d.extracted,out=[];
 if(e?.scan)out.push('<b>스캔 PDF</b> — 글자를 읽지 못해 원문 기반 자동 선택을 하지 않았습니다.');
 out.push('원문 텍스트: '+(r.text.length?pn(r.text):'<i>확인 못함</i>'));
 out.push('원문 이미지 인식: '+(r.image.length?pn(r.image):'<i>'+(e?'없음':'—')+'</i>')+(r.uncertain.length?' · 불확실: '+pn(r.uncertain):''));
 const inf=Object.entries(r.inferred);out.push('H 코드 기준 추정 <small>(프로그램 추정·자동 선택 안 함)</small>: '+(inf.length?inf.map(([n,c])=>PN[n-1]+'('+c.join('·')+')').join(', '):'<i>없음</i>')+(r.inferredMissing.length?' '+r.inferredMissing.map(n=>'<button class="small" data-add="'+n+'">'+PN[n-1]+' 추가</button>').join(' '):''));
 if(r.excl)out.push((r.excl.removable?'<span class="bad">':'')+'감탄부호: '+M.esc(r.excl.msg)+(r.excl.rule?' ('+r.excl.rule+')':'')+(r.excl.removable?'</span> <button class="small" data-remove="7">감탄부호 제외</button>':''));
 if(r.many)out.push('그림문자 5개 이상: 4개만 표시할 수 있습니다(제6조의2②4, 선택 사항).');
 out.push('신호어 — 원문: '+(e?.signalRaw?M.esc(e.signalRaw):'<i>확인 못함</i>')+' · H 코드 추정: '+(sg.signal||'<i>판단 불가</i>')+(sg.danger.length&&sg.warning.length?' · 위험·경고 모두 해당 → “위험”만 표시(제6조의2③)':''));
 if(d.pictosManual)out.push('<small>직접 바꾼 그림문자 선택은 이후 자동 분석이 덮어쓰지 않습니다.</small>');
 return out.map(x=>'<div>'+x+'</div>').join('')}
$('autoInfo').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=active();if(b.dataset.add){const n=Number(b.dataset.add);if(!d.pictos.includes(n))d.pictos=[...d.pictos,n].sort((a,b)=>a-b);d.noPictos=false;$('noPictos').checked=false}if(b.dataset.remove)d.pictos=d.pictos.filter(x=>x!==Number(b.dataset.remove));d.pictosManual=true;unapprove();render();debouncedSave()});
function hCompareText(d){const e=d.extracted;const now=M.lines(d.hazards).length;if(!e||!e.hazards.length)return '표지에 '+now+'개 모두 표시합니다 (6개 제한 없음).';const exH=STD.hCodes(e.hazards.join('\n')),cur=STD.hCodes(d.hazards),miss=[...exH].filter(h=>!cur.has(h)),add=[...cur].filter(h=>!exH.has(h));return '원문 추출 '+e.hazards.length+'개 → 표지 '+now+'개 모두 표시'+(miss.length?' · 원문에서 빠진 코드: '+miss.join(', '):'')+(add.length?' · 원문에 없던 코드: '+add.join(', '):'')}

/* ---------- 미리보기 + 점검 ---------- */
let renderQueued=0,lastHTML=null,lastInfo='',lastChecks='';
function render(){if(!renderQueued)renderQueued=requestAnimationFrame(renderNow)}
function renderNow(){if(renderQueued){cancelAnimationFrame(renderQueued);renderQueued=0}const d=active(),el=$('label'),size=dimensions(),type=effectiveType(d),pm=pictoSide(d,size);
 const html=M.labelHTML(d,type==='semi'?'':qr(),{type,pictoMM:pm});if(html!==lastHTML||!el.firstChild){el.innerHTML=html;lastHTML=html}
 el.style.width=size.w+'mm';el.style.height=size.h+'mm';el.style.fontSize=size.f+'pt';const pxW=size.w*96/25.4,pxH=size.h*96/25.4,width=Math.max(100,document.querySelector('.mat').getBoundingClientRect().width-24),scale=Math.min(1.6,width/pxW,matchMedia('(min-width:1151px)').matches?innerHeight*.6/pxH:9);el.style.transform=`scale(${scale})`;$('scaled').style.width=pxW*scale+'px';$('scaled').style.height=pxH*scale+'px';
 document.querySelectorAll('.pic-btn').forEach((b,i)=>{b.classList.toggle('selected',d.pictos.includes(i+1));b.setAttribute('aria-pressed',String(d.pictos.includes(i+1)))});
 // 측정(표지 원래 크기 기준)
 const overflow=el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1,lr=el.getBoundingClientRect(),toMM=px=>px/scale*25.4/96;
 const pictoSides=[...el.querySelectorAll('.symbols img')].map(i=>Math.round(toMM(i.getBoundingClientRect().width)*10)/10);
 let qrOverlap=false;const qi=el.querySelector('.qrblock img');if(qi){const q=qi.getBoundingClientRect(),t=el.querySelector('.name-text')?.getBoundingClientRect();qrOverlap=q.right>lr.right+1||q.bottom>lr.bottom+1||(t&&t.right>q.left+1&&t.bottom>q.top&&t.top<q.bottom)}
 lastEval=STD.evaluate(d,{w:size.w,h:size.h,f:size.f,pictoSides,overflow,qrOverlap},{M,approved:$('approved').checked});
 if(wantQr()&&!qr())lastEval.push({key:'qr',title:'다국어 QR',status:'확인 필요',value:'게시 사이트 주소가 올바르지 않아 QR을 넣지 않았습니다.',basis:'-',kind:'auto'});
 paintChecks();
 $('fitInfo').textContent='실제 크기 '+size.w+'×'+size.h+'mm · '+(size.w*size.h/100)+'㎠ · 본문 '+size.f+'pt · 그림문자 '+(pictoSides[0]||pm)+'mm'+(d.pictoMM?'':' (자동)')+' · 화면 '+Math.round(scale*100)+'%'+(()=>{const w4=width4(d,size);return w4?' · 그림문자 '+Math.min(4,d.pictos.length)+'개를 한 줄에 두려면 가로 '+w4+'mm 이상':''})();
 const info=autoInfoHTML(d);if(info!==lastInfo){$('autoInfo').innerHTML=info;lastInfo=info}
 $('hCompare').textContent=hCompareText(d);
 for(const f of ['name','signal','hazards','precautions','supplier','phone'])document.querySelector('[data-f="'+f+'"]')?.classList.toggle('need',!String(d[f]||'').trim());
 document.querySelector('[data-f="address"]')?.classList.toggle('need',!d.address.trim());
 $('semiRow').hidden=d.labelType!=='semi';updateSizeInfo(d,size);updateLayoutInfo(size);updatePRows()}
const ST_CLASS={'충족':'ok','미충족':'bad','확인 필요':'need','해당 없음':'na'},KIND={auto:'자동 계산',human:'사람 대조',mixed:'자동+대조'};
function paintChecks(){const c=STD.summary(lastEval);const html=lastEval.map(i=>`<div class="ck ${ST_CLASS[i.status]}"><span class="ck-st">${i.status}</span><div><b>${M.esc(i.title)}</b> <span class="ck-kind">${KIND[i.kind]||''}</span><br><span>${M.esc(i.value)}</span><br><small>${M.esc(i.basis)}</small></div></div>`).join('');
 const sum=`<span class="ok">충족 ${c['충족']||0}</span><span class="bad">미충족 ${c['미충족']||0}</span><span class="need">확인 필요 ${c['확인 필요']||0}</span><span class="na">해당 없음 ${c['해당 없음']||0}</span><small>‘충족’은 프로그램 계산 또는 사용자 확인 결과이며 법적 적합성 보장이 아닙니다.</small>`;
 if(html+sum!==lastChecks){$('checks').innerHTML=html;$('checkSummary').innerHTML=sum;lastChecks=html+sum}}
function updateSizeInfo(d,size){const cap=STD.parseCapacity(d.capValue,d.capUnit),sr=STD.sizeRule(cap,d.sideArea),under5=cap&&cap.kind==='volume'&&cap.mL<5000;$('sideRow').hidden=!under5;
 const area=size.w*size.h/100;$('sizeInfo').innerHTML=(cap?'<b>'+M.esc(cap.text)+'</b> · ':'')+M.esc(sr.msg)+(sr.min?(area>=sr.min?' · <span class="ok">현재 '+area+'㎠ 충족</span>':' · <span class="bad">현재 '+area+'㎠ 미달</span>'):'')+(d.labelType==='small'&&!STD.smallEligible(cap)?'<br><span class="bad">소용량 표지는 내용량 100mL·100g 이하일 때만 적용됩니다. 지금은 표준 표지로 표시합니다.</span>':'');
 const recs=STD.recommendSizes(sr.min),key=recs.map(r=>r.w+'x'+r.h).join();if($('sizeRecs').dataset.k!==key){$('sizeRecs').dataset.k=key;$('sizeRecs').innerHTML=recs.length?'<span class="hint">프로그램 추천 크기(법정 비율 아님):</span> '+recs.map(r=>`<button class="small" data-w="${r.w}" data-h="${r.h}">${r.name} ${r.w}×${r.h}mm (${r.area}㎠)</button>`).join(' '):''}}
$('sizeRecs').addEventListener('click',e=>{const b=e.target.closest('button[data-w]');if(!b)return;$('width').value=b.dataset.w;$('height').value=b.dataset.h;sizeChanged();renderNow();if(layoutOverflow())toast('추천 크기는 최소 면적 기준입니다. 내용이 넘치면 ‘내용에 맞게 표지 키우기’를 누르세요.')});
// PDF 배치: 표지는 축소하지 않음. 용지에 들어가지 않으면 안내.
function layoutPlan(size){const mode=settings.layoutMode,m=settings.margin,g=settings.gap;if(mode==='label')return {ok:true,mode,pageW:size.w,pageH:size.h,cols:1,rows:1,per:1,x0:0,y0:0,g:0,msg:'표지 크기('+size.w+'×'+size.h+'mm) 용지에 1장씩'};
 const [pw,ph]=mode==='a4l'?[297,210]:[210,297],uw=pw-2*m,uh=ph-2*m,cols=Math.floor((uw+g)/(size.w+g)),rows=Math.floor((uh+g)/(size.h+g));
 if(cols<1||rows<1)return {ok:false,mode,msg:'표지('+size.w+'×'+size.h+'mm)가 A4'+(mode==='a4l'?' 가로':' 세로')+' 인쇄 영역('+uw+'×'+uh+'mm)보다 큽니다. 축소하지 않으므로 ‘표지 크기 용지’나 A4 방향 변경, 여백 축소를 선택하세요.'};
 const bw=cols*size.w+(cols-1)*g,bh=rows*size.h+(rows-1)*g;return {ok:true,mode,pageW:pw,pageH:ph,cols,rows,per:cols*rows,x0:(pw-bw)/2,y0:m+(uh-bh)/2,g,msg:'A4 '+(mode==='a4l'?'가로':'세로')+' 1장에 '+cols+'×'+rows+'='+cols*rows+'개 (실제 크기, 축소 없음)'}}
function updateLayoutInfo(size){lastPlan=layoutPlan(size);const n=copies();$('layoutInfo').innerHTML=lastPlan.ok?M.esc(lastPlan.msg)+' · '+n+'장 → '+Math.ceil(n/lastPlan.per)+'쪽':'<span class="bad">'+M.esc(lastPlan.msg)+'</span>'}
function copies(){return Math.min(60,Math.max(1,Number($('copies').value)||1))}
function blockers(){return lastEval.filter(i=>i.status==='미충족')}
function validate(){renderNow();const b=blockers();if(b.length){toast('미충족: '+b.map(i=>i.title).join(', ')+' — 수정하거나 ‘검토 전 초안 PDF’로 저장하세요.');return false}if(!$('approved').checked){toast('MSDS 원문 대조 확인란에 체크해주세요.');return false}return true}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
const safeName=()=>active().name.replace(/[\\/:*?"<>|]/g,'_').slice(0,80)||'경고표지';
const svgPngCache=new Map();
function svgPng(src){if(!svgPngCache.has(src))svgPngCache.set(src,(async()=>{const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=384;c.height=384;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,384,384);ctx.drawImage(i,0,0,384,384);return c.toDataURL('image/png')})().catch(e=>{svgPngCache.delete(src);throw e}));return svgPngCache.get(src)}
// Always rasterize the label as currently shown (flush a pending repaint first) so preview and saved file match.
async function raster(){renderNow();const host=document.createElement('div');host.style.cssText='position:absolute;left:-10000px;top:0;background:white';const el=$('label').cloneNode(true);el.removeAttribute('id');el.style.transform='none';el.style.position='relative';host.append(el);document.body.append(host);try{await Promise.all([...el.querySelectorAll('img')].map(async i=>{if(/\.svg(?:$|\?)/.test(i.src))i.src=await svgPng(i.src);await i.decode()}));if(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)throw Error('문구가 표지 밖으로 넘칩니다. 표지를 키우세요.');return await html2canvas(el,{scale:300/96,backgroundColor:'#ffffff',logging:false})}finally{host.remove()}}
function setExport(s){$('exportStatus').textContent=s||''}
async function exporting(fn,{draft=false,label='출력'}={}){if(busy){toast('다른 작업이 진행 중입니다. 잠시 후 다시 누르세요.');return}if(!draft&&!validate())return;renderNow();if(!lastPlan.ok&&label.includes('PDF')){toast(lastPlan.msg);return}busy=true;document.querySelectorAll('.export button').forEach(b=>b.disabled=true);setExport(label+' 준비 중… (300dpi 변환)');try{await fn();setExport(label+' 저장 완료 · '+new Date().toLocaleTimeString())}catch(e){setExport('');toast(label+' 실패: '+e.message)}finally{busy=false;document.querySelectorAll('.export button').forEach(b=>b.disabled=false)}}
function watermark(c){const ctx=c.getContext('2d');ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.translate(c.width/2,c.height/2);ctx.rotate(-Math.PI/5);ctx.font='bold '+Math.round(c.width/15)+'px sans-serif';ctx.textAlign='center';ctx.fillStyle='rgba(190,0,0,.34)';ctx.fillText('검토 전 초안 · 현장 부착 금지',0,0);ctx.restore()}
$('png').onclick=()=>exporting(async()=>{const c=await raster();const b=await new Promise(r=>c.toBlob(r,'image/png'));download(b,safeName()+'.png')},{label:'PNG'});
async function makePdf(draft=false){const c=await raster();if(draft)watermark(c);const size=dimensions(),plan=layoutPlan(size);if(!plan.ok)throw Error(plan.msg);const n=copies(),pdf=new jspdf.jsPDF({compress:true,unit:'mm',format:[plan.pageW,plan.pageH],orientation:plan.pageW>plan.pageH?'landscape':'portrait'}),img=c.toDataURL('image/jpeg',0.95);
 for(let i=0;i<n;i++){if(i&&i%plan.per===0)pdf.addPage([plan.pageW,plan.pageH],plan.pageW>plan.pageH?'landscape':'portrait');const k=i%plan.per,x=plan.x0+(k%plan.cols)*(size.w+plan.g),y=plan.y0+Math.floor(k/plan.cols)*(size.h+plan.g);pdf.addImage(img,'JPEG',x,y,size.w,size.h,'label')}
 download(pdf.output('blob'),safeName()+(draft?'_검토전초안':'')+'.pdf')}
$('pdf').onclick=()=>exporting(()=>makePdf(false),{label:'PDF'});
$('draftPdf').onclick=()=>exporting(()=>makePdf(true),{draft:true,label:'초안 PDF'});
$('print').onclick=()=>{if(!validate())return;document.getElementById('printHost')?.remove();const size=dimensions(),plan=layoutPlan(size);if(!plan.ok||plan.mode!=='a4p'){toast('브라우저 인쇄는 A4 세로 배치만 지원합니다. PDF 저장 후 인쇄하세요.');return}const host=document.createElement('div');host.id='printHost';host.hidden=true;let page;for(let i=0;i<copies();i++){if(i%plan.per===0){page=document.createElement('div');page.className='print-page';page.style.gap=plan.g+'mm';host.append(page)}const el=$('label').cloneNode(true);el.removeAttribute('id');el.style.transform='none';page.append(el)}document.getElementById('printPage')?.remove();const st=document.createElement('style');st.id='printPage';st.textContent='body{background:#fff!important}@page{size:A4;margin:'+settings.margin+'mm}#printHost .print-page{width:'+(210-2*settings.margin)+'mm;min-height:'+(297-2*settings.margin)+'mm}';document.head.append(st);document.body.append(host);Promise.all([...host.querySelectorAll('img')].map(i=>i.decode())).then(()=>window.print()).catch(()=>toast('그림문자를 불러오지 못했습니다.'))};
$('excel').onclick=()=>exporting(async()=>{const d=active(),wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('경고표지');ws.columns=[{width:22},{width:90}];const shown=M.selectedP(d).map(r=>r.text).join('\n'),size=dimensions();const data=[['제품명',d.name],['신호어',d.signal],['그림문자',d.pictos.map(n=>'GHS'+String(n).padStart(2,'0')+' '+M.PICTOS[n-1]).join('\n')],['유해·위험 문구',d.hazards],['예방조치 문구(표지 표시)',shown],['예방조치 문구(원문 전체)',d.precautions],['공급자명',d.supplier],['주소',d.address],['전화번호',d.phone],['용기 용량',(d.capValue||'')+' '+(d.capValue?d.capUnit:'')],['표지 크기',size.w+'×'+size.h+'mm']];data.forEach(r=>{const row=ws.addRow(r);row.alignment={vertical:'top',wrapText:true};row.height=Math.max(28,(M.lines(r[1]).length+Math.ceil(String(r[1]).length/60))*16);row.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF0FA'}};row.getCell(1).font={bold:true};row.eachCell(c=>c.border={bottom:{style:'thin',color:{argb:'FFDCE3ED'}}})});ws.addRow(['안내','편집용 데이터입니다. 인쇄 표지와 동일한 레이아웃이 아닙니다.']);download(new Blob([await wb.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),safeName()+'.xlsx')},{label:'엑셀'});

/* ---------- PDF 분석 (텍스트 우선 → 그림문자 Worker) ---------- */
async function imageTemplates(){if(!visionTemplates)visionTemplates=MSDSVision.templates((w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c},async src=>{const im=new Image();im.src=src;await im.decode();return im});visionTemplates.catch(()=>visionTemplates=null);return visionTemplates}
async function renderPage(pdf,pageNo,canvas,scale=1.6){const page=await pdf.getPage(pageNo),viewport=page.getViewport({scale});canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;return page}
// 그림문자 분석용 페이지 렌더링 캐시(같은 페이지를 두 번 렌더링하지 않음). 분석이 끝나면 비운다.
const pageCache=new Map(),PAGE_CACHE_MAX=6;
function pageCanvas(id,info,pageNo){const key=id+':'+pageNo;let p=pageCache.get(key);if(p){pageCache.delete(key);pageCache.set(key,p);return p}p=(async()=>{const c=document.createElement('canvas');await renderPage(info.pdf,pageNo,c,1.6);return c})();p.catch(()=>pageCache.delete(key));pageCache.set(key,p);while(pageCache.size>PAGE_CACHE_MAX)pageCache.delete(pageCache.keys().next().value);return p}
function dropPages(id){for(const k of [...pageCache.keys()])if(k.startsWith(id+':'))pageCache.delete(k)}
// Pictogram matching runs in a Web Worker (falls back to the main thread, e.g. on file://).
let visionWorker=null,visionSeq=0;const visionWaits=new Map();
function workerVision(img,tmpl){if(visionWorker===false||typeof Worker==='undefined')return null;try{if(!visionWorker){visionWorker=new Worker('vision.js?v=1.5');visionWorker.onmessage=e=>{const w=visionWaits.get(e.data.id);if(!w)return;visionWaits.delete(e.data.id);e.data.error?w.reject(Error(e.data.error)):w.resolve(e.data.found)};visionWorker.onerror=e=>{e.preventDefault?.();for(const w of visionWaits.values())w.reject(Error('worker'));visionWaits.clear();visionWorker.terminate();visionWorker=false};visionWorker.postMessage({tmpl})}}catch(e){visionWorker=false;return null}const id=++visionSeq;return new Promise((resolve,reject)=>{visionWaits.set(id,{resolve,reject});visionWorker.postMessage({id,img:{data:img.data,width:img.width,height:img.height}},[img.data.buffer])})}
async function identifyAsync(canvas){const tmpl=await imageTemplates(),img=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height),p=workerVision(img,tmpl);if(p){try{return await p}catch(e){}}await new Promise(r=>setTimeout(r,0));return MSDSVision.identify(canvas,tmpl)}
function layoutOverflow(){const el=$('label');return el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1}
// 글자를 줄이지 않고 표지를 키운다(세로 → 가로). 최대 400×400mm.
function autoFit(silent){renderNow();const el=$('label'),f=dimensions().f;let {w,h}=dimensions();const start=w+'×'+h;for(let k=0;k<200&&layoutOverflow();k++){if(h<400)h=Math.min(400,h+5);else if(w<400)w=Math.min(400,w+5);else break;$('width').value=w;$('height').value=h;renderNow()}if(start!==w+'×'+h&&h<400)h=Math.min(400,h+5); // 브라우저 인쇄 줄바꿈 차이 대비 여유
 $('width').value=w;$('height').value=h;sizeChanged();renderNow();
 if(layoutOverflow())toast('400×400mm에서도 넘칩니다. 표시 문구·글자 크기(현재 '+f+'pt)를 검토하세요.');else if(!silent)toast(start===w+'×'+h?'현재 크기에 내용이 모두 들어갑니다.':'표지를 '+w+'×'+h+'mm로 키웠습니다(글자 크기 유지).')}
// 용지 폭에 맞추기: 표지 가로를 용지 인쇄 폭(용지-여백×2)으로, 세로는 내용과 법정 최소 면적에 맞춤(축소 아님)
function fitPaper(){const m=settings.margin,pw=settings.layoutMode==='a4l'?297:210,ph=settings.layoutMode==='a4l'?210:297,w=pw-2*m;$('width').value=w;$('height').value=20;sizeChanged();autoFit(true);
 const d=active(),sr=STD.sizeRule(STD.parseCapacity(d.capValue,d.capUnit),d.sideArea);let h=dimensions().h;if(sr.min)h=Math.max(h,Math.ceil(sr.min*100/w/5)*5);$('height').value=h;sizeChanged();renderNow();
 toast(h<=ph-2*m?'표지를 용지 폭('+w+'mm)에 맞췄습니다: '+w+'×'+h+'mm':'용지 폭에 맞췄지만 세로 '+h+'mm가 용지보다 깁니다. ‘표지 크기 용지’로 저장하세요.')}
$('fitPaper').onclick=fitPaper;
// 그림문자 4개를 한 줄에 놓는 데 필요한 표지 가로(법정 최소 크기 유지)
function width4(d,size){const n=Math.min(4,d.pictos.length);if(n<2||d.pictoMM)return 0;for(let w=size.w;w<=400;w+=5){const s=pictoSide(d,{...size,w});if(n*s+(n-1)*1.5<=w-10)return w===size.w?0:w}return 400}
$('autoFit').onclick=()=>autoFit(false);
async function pdfText(file){
 if(!globalThis.pdfjsLib)throw Error('PDF 라이브러리 파일을 확인하세요.');pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';
 const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:'vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'vendor/standard_fonts/'}).promise;
 // 텍스트만 먼저(빠름). 페이지 렌더링·그림문자 분석은 이후 analyzePictos()에서.
 try{const pages=[];let readPages=0,chars=0;const max=Math.min(pdf.numPages,12);for(let n=1;n<=max;n++){
 setProgress(file.name+' · '+n+'/'+max+'쪽 글자 읽는 중…');const page=await pdf.getPage(n),content=await page.getTextContent(),text=M.orderedText(content.items);pages.push(text);readPages=n;chars+=text.replace(/\s/g,'').length;
 if(/(?:^|\n)\s*(?:3\s*[.．]|SECTION\s*3\b)\s*(?:구성|성분|Composition)/i.test(text))break;
 }return {text:M.cleanPages(pages)+'\n',pdf,truncated:readPages<pdf.numPages,readPages,chars,scan:chars<Math.max(40,readPages*15)};}catch(e){await pdf.destroy();throw e}
}
const ms=t=>Math.round(performance.now()-t);
function summaryInfo(d,r){if(r.scan)return '텍스트가 거의 없는 PDF(스캔·이미지로 판단) · '+r.readPages+'쪽 확인\nOCR을 지원하지 않아 내용을 읽지 않았습니다. ‘원본 파일 열기’로 원문을 보며 직접 입력하세요.';const f=d.extracted?.fields||{},miss=[['name','제품명'],['supplier','공급자명'],['phone','전화번호'],['address','주소'],['signal','신호어']].filter(([k])=>!f[k]).map(x=>x[1]);if(!M.lines(d.hazards).length)miss.push('H 문구');if(!M.lines(d.precautions).length)miss.push('P 문구');return '좌표순 텍스트 분석 · '+r.readPages+'쪽 확인\n유해·위험 문구 '+M.lines(d.hazards).length+'개 / 예방조치 문구 '+M.lines(d.precautions).length+'개 / 원문 그림문자 '+d.pictos.length+'종'+(miss.length?'\n확인 필요(추출 못함): '+miss.join(', '):'')}
async function analyzePictos(d,r){const info=sourceDocs.get(d.id),visual=[],errors=[],pages=Math.min(3,r.readPages);let tr=0,tv=0;
 try{for(let n=1;n<=pages;n++){if(!sourceDocs.has(d.id))return;if(d.id===current)setProgress('그림문자 이미지 분석 중… '+n+'/'+pages+'쪽 (입력은 계속할 수 있습니다)');try{let s=performance.now();const c=await pageCanvas(d.id,info,n);tr+=performance.now()-s;s=performance.now();const found=await identifyAsync(c);tv+=performance.now()-s;visual.push(...found.map(x=>({...x,page:n})))}catch(e){errors.push(e.message)}}}
 finally{dropPages(d.id);if(sourceDocs.has(d.id)){sourceDocs.get(d.id).pdf.destroy();sourceDocs.delete(d.id)}if(d.id===current)setProgress('')}
 if(!docs.includes(d))return;const before=d.pictos.join(),accepted=[...new Set(visual.filter(x=>x.accepted).map(x=>x.n))],uncertain=[...new Set(visual.filter(x=>!x.accepted&&x.score>=.3).map(x=>x.n))].filter(n=>!accepted.includes(n));
 d.extracted=d.extracted||{hazards:[],precautions:[],pictosText:[],signal:'',fields:{}};d.extracted.pictosImage=accepted;d.extracted.pictosUncertain=uncertain;
 // 원문 이미지에서 확실히 인식한 것만 추가. 사용자가 직접 바꾼 선택·스캔 PDF는 덮어쓰지 않음.
 if(!d.pictosManual&&!r.scan){d.pictos=[...new Set([...d.pictos,...accepted])].sort((a,b)=>a-b);if(d.pictos.length)d.noPictos=false}
 d.analysisInfo=summaryInfo(d,r)+(r.scan?'':'\n그림문자 이미지 인식: '+(accepted.length?pn(accepted):'없음')+(uncertain.length?' · 불확실(자동 선택 안 함): '+pn(uncertain):''))+(d.pictosManual&&accepted.some(n=>!d.pictos.includes(n))?'\n직접 선택한 그림문자를 유지했습니다.':'')+(errors.length?'\n그림문자 이미지 분석 실패. 원문을 보고 직접 선택하세요.':'');save();
 console.info('[MSDS 시간] '+d.source+' · 페이지 렌더링 '+Math.round(tr)+'ms · 그림문자 분석 '+Math.round(tv)+'ms');
 if(d.id!==current)return;$('analysisInfo').textContent=d.analysisInfo;$('noPictos').checked=d.noPictos;if(d.pictos.join()!==before){unapprove();renderNow();if(layoutOverflow())autoFit(true)}else render()}
async function upload(files){if(busy){toast('현재 작업이 끝난 뒤 업로드해주세요.');return}busy=true;try{for(const f of files){if(!/\.pdf$/i.test(f.name)||f.size>30*1024*1024){toast(f.name+': PDF 30MB 이하만 지원합니다.');continue}$('status').textContent=f.name+' 읽는 중…';try{
 let t=performance.now();const r=await pdfText(f),tText=ms(t);t=performance.now();
 const d=r.scan?Object.assign(M.blank(),{raw:r.text,extracted:{hazards:[],precautions:[],pictosText:[],pictosImage:[],pictosUncertain:[],signal:'',signalRaw:'',scan:true,fields:{}}}):M.parse(r.text);
 d.source=f.name;const prev=active();if(prev?.size)d.size={...prev.size};d.analysisInfo=summaryInfo(d,r)+'\n그림문자 이미지 분석 대기 중… (텍스트 결과를 먼저 표시)';sourceDocs.set(d.id,{pdf:r.pdf});sourceFiles.set(d.id,URL.createObjectURL(f));docs.push(d);load(d.id);
 if(r.scan)$('status').textContent=f.name+': 글자를 읽을 수 없는 PDF입니다(스캔·이미지). OCR이 없어 내용을 추출하지 않았습니다. 원본 파일을 열어 직접 입력하세요.';
 else{const miss=summaryInfo(d,r).split('확인 필요(추출 못함): ')[1];$('status').textContent='추출 완료 · '+(d.name||f.name)+(miss?' · 확인 필요: '+miss:'')+' · 모든 값은 원문과 대조하세요.';renderNow();if(layoutOverflow())autoFit(true)}save();
 console.info('[MSDS 시간] '+f.name+' · 글자 추출 '+tText+'ms · 분석·미리보기 '+ms(t)+'ms');analyzePictos(d,r).catch(e=>console.warn(e));
 }catch(e){setProgress('');$('status').textContent=f.name+' 처리 실패: '+e.message}}}finally{busy=false;$('files').value=''}}
$('openSource').onclick=()=>{const u=sourceFiles.get(current);if(u)window.open(u,'_blank','noopener');else toast('이 세션에서 올린 파일만 열 수 있습니다.')};

/* ---------- 입력 연결 ---------- */
function sizeChanged(){const d=active();d.size=dimensions();unapprove();render();debouncedSave()}
$('capacity').oninput=()=>{active().capacity=$('capacity').value;debouncedSave()};
for(const id of ['capValue','capUnit','sideArea'])$(id).oninput=$(id).onchange=()=>{const d=active();d.capValue=$('capValue').value.trim();d.capUnit=$('capUnit').value;d.sideArea=Number($('sideArea').value)||undefined;unapprove();render();debouncedSave()};
document.querySelectorAll('input[name=ltype]').forEach(r=>r.onchange=()=>{active().labelType=r.value;unapprove();render();debouncedSave()});
$('semiConfirmed').onchange=()=>{active().semiConfirmed=$('semiConfirmed').checked;unapprove();render();debouncedSave()};
$('approved').onchange=()=>render();
$('pictoMM').oninput=()=>{const v=Number($('pictoMM').value);active().pictoMM=v>=5?v:undefined;unapprove();render();debouncedSave()};
$('pictoBasis').onchange=()=>{settings.pictoBasis=$('pictoBasis').value;unapprove();render();debouncedSave()};
for(const id of ['layoutMode','margin','gap'])$(id).oninput=$(id).onchange=()=>{settings.layoutMode=$('layoutMode').value;settings.margin=Math.min(30,Math.max(0,Number($('margin').value)||0));settings.gap=Math.min(30,Math.max(0,Number($('gap').value)||0));render();debouncedSave()};
$('copies').oninput=()=>render();
$('files').onchange=e=>upload([...e.target.files]);$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('over')};$('drop').ondragleave=()=>$('drop').classList.remove('over');$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('over');upload([...e.dataTransfer.files])};
$('new').onclick=()=>{const d=M.blank();docs.push(d);load(d.id);save()};
$('sample').onclick=()=>{const d=M.blank();Object.assign(d,{name:'산소 (연습용 예시)',signal:'위험',pictos:[3,4],hazards:'H270 화재를 일으키거나 강렬하게 함: 산화제\nH280 고압가스: 가열하면 폭발할 수 있음',precautions:'P220 의류 및 가연성 물질로부터 멀리하시오.\nP244 밸브 및 부속품은 오일과 그리스가 묻지 않도록 하시오.\nP370+P376 화재 시: 안전하게 처리하는 것이 가능하면 누출을 막으시오.\nP403 환기가 잘 되는 곳에 보관하시오.\nP410+P403 직사광선을 피하시오. 환기가 잘 되는 곳에 보관하시오.',supplier:'연습용 공급자',phone:'000-0000-0000',address:'실제 MSDS 주소로 바꿔주세요.',capValue:'40',capUnit:'L',source:'연습용 예시 · 실제 제품에 부착 금지'});docs.push(d);load(d.id);save();toast('예시는 작동 확인용입니다. 실제 제품의 MSDS로 바꿔주세요.')};
$('parse').onclick=()=>{if(!confirm('현재 제품의 추출 필드를 원문 분석 결과로 바꿀까요?'))return;const d=M.parse($('raw').value),old=active();Object.assign(old,d,{id:old.id,translations:old.translations,source:old.source});delete old.pSelection;old.pictosManual=false;load(old.id);save()};
$('backup').onclick=()=>download(new Blob([JSON.stringify({version:1,products:docs},null,2)],{type:'application/json'}),'msds-work-backup.json');
$('restore').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>20e6)throw Error('파일이 너무 큽니다.');const json=JSON.parse(await f.text());if(!Array.isArray(json.products)||json.products.length>300)throw Error('제품 데이터 형식이 아닙니다.');if(!confirm('백업 제품을 현재 목록에 병합할까요? 같은 ID는 백업 내용으로 바뀝니다.'))return;for(const p of json.products){const d=M.normalize(p),i=docs.findIndex(x=>x.id===d.id);if(i<0)docs.push(d);else docs[i]=d}load(docs[0].id);save();toast('복원 완료')}catch(e){toast('복원 실패: '+e.message)}finally{e.target.value=''}};
// 게시용 제품 목록: 원문 추출 텍스트·출처 등은 빼고 공개
function publicProducts(){const products=docs.filter(d=>d.name.trim()).map(d=>{const p={...d};delete p.raw;delete p.source;delete p.analysisInfo;delete p.extracted;return p});if(!products.length)throw Error('제품을 먼저 등록하세요.');return products}
/* GitHub 직접 저장: 저장소의 products.json을 GitHub API로 갱신(같은 ID는 덮어쓰고 다른 제품은 유지). 토큰은 api.github.com에만 보냄 */
const GH_KEY='field-msds-gh-token';
function ghRepo(){const r=$('ghRepo').value.trim();if(!/^[\w.-]+\/[\w.-]+$/.test(r))throw Error('저장소를 “아이디/저장소이름” 형식으로 입력하세요.');return r}
const b64enc=str=>{const b=new TextEncoder().encode(str);let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s)};
const b64dec=b=>new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g,'')),c=>c.charCodeAt(0)));
function mergeProducts(remote,local){const byId=new Map((Array.isArray(remote)?remote:[]).filter(p=>p&&typeof p.id==='string').map(p=>[p.id,p]));for(const p of local)byId.set(p.id,p);return [...byId.values()]}
async function ghSave(){const st=$('ghStatus'),token=$('ghToken').value.trim();try{getBase();const repo=ghRepo();if(!token)throw Error('GitHub 토큰을 입력하세요.');const local=publicProducts();
 if($('ghRemember').checked)try{localStorage.setItem(GH_KEY,token)}catch(e){}else try{localStorage.removeItem(GH_KEY)}catch(e){}
 const api='https://api.github.com/repos/'+repo+'/contents/products.json',h={Authorization:'Bearer '+token,Accept:'application/vnd.github+json'};
 for(let attempt=0;attempt<2;attempt++){st.textContent='GitHub에 저장 중…';
  const g=await fetch(api+'?t='+Date.now(),{headers:h,cache:'no-store'});if(g.status===401)throw Error('토큰이 올바르지 않거나 만료되었습니다.');if(g.status===403)throw Error('토큰에 이 저장소의 쓰기(Contents) 권한이 없습니다.');if(!g.ok&&g.status!==404)throw Error('저장소를 읽지 못했습니다('+g.status+').');
  let sha,remote=[];if(g.ok){const j=await g.json();sha=j.sha;try{remote=JSON.parse(b64dec(j.content||'')).products}catch(e){remote=[]}}
  const products=mergeProducts(remote,local),body={message:'경고표지 다국어 데이터 갱신 ('+local.length+'개 제품)',content:b64enc(JSON.stringify({version:1,updatedAt:new Date().toISOString(),products},null,2))};if(sha)body.sha=sha;
  const r=await fetch(api,{method:'PUT',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(r.status===409||r.status===422&&sha&&attempt===0)continue; // 그 사이 다른 저장이 있었으면 다시 읽고 한 번 재시도
  if(r.status===404)throw Error('저장소를 찾을 수 없거나 토큰 권한이 없습니다.');if(r.status===401||r.status===403)throw Error('토큰 권한(Contents 쓰기)을 확인하세요.');if(!r.ok)throw Error('저장 실패('+r.status+').');
  st.textContent='저장 완료 · 제품 '+products.length+'개 게시 · 약 1~2분 뒤 QR에서 번역이 보입니다.';toast('GitHub에 저장했습니다. 잠시 후 QR로 확인하세요.');return}
 throw Error('다른 곳에서 동시에 저장되어 실패했습니다. 다시 누르세요.')}catch(e){st.textContent='저장 실패: '+e.message;toast('GitHub 저장 실패: '+e.message)}}
$('ghSave').onclick=()=>ghSave();
try{const t=localStorage.getItem(GH_KEY);if(t){$('ghToken').value=t;$('ghRemember').checked=true}}catch(e){}
if(!$('ghRepo').value&&location.hostname.endsWith('.github.io'))$('ghRepo').value=location.hostname.split('.')[0]+'/'+(location.pathname.split('/')[1]||'');
$('publish').onclick=()=>{try{getBase();const products=publicProducts();download(new Blob([JSON.stringify({version:1,updatedAt:new Date().toISOString(),products},null,2)],{type:'application/json'}),'products.json');toast('products.json을 GitHub의 index.html과 같은 위치에 올리세요.');save()}catch(e){toast(e.message)}};
fields.forEach(k=>$(k).oninput=edit);$('noPictos').onchange=edit;$('raw').oninput=()=>{active().raw=$('raw').value;debouncedSave()};$('lang').onchange=readTranslation;['trName','trSignal','trHazards','trPrecautions','trReviewed'].forEach(k=>$(k).oninput=trEdit);
for(let n=1;n<=9;n++){const b=document.createElement('button');b.type='button';b.className='pic-btn';b.setAttribute('aria-label',M.PICTOS[n-1]);b.innerHTML=`<img src="assets/GHS${String(n).padStart(2,'0')}.svg" alt="">${STD.PNAME[n-1]}`;b.onclick=()=>{const d=active();d.pictosManual=true;d.pictos=d.pictos.includes(n)?d.pictos.filter(x=>x!==n):[...d.pictos,n].sort((a,b)=>a-b);if(d.pictos.length){d.noPictos=false;$('noPictos').checked=false}unapprove();render();debouncedSave()};$('pictos').append(b)}
for(const id of ['width','height','fontSize'])$(id).oninput=sizeChanged;for(const id of ['includeQr','baseUrl'])$(id).oninput=()=>{unapprove();render();debouncedSave()};window.addEventListener('resize',render);

/* ---------- 작성 근거 패널 ---------- */
function paintBasis(){const D=MSDSStdData;$('basis').innerHTML='<p class="hint">법적 의무(법률·시행규칙·위임 고시)와 권고(KOSHA 기술지침)를 구분합니다. ‘근거 확인 필요’ 자료는 판정에 사용하지 않습니다. 확인일 이후 개정 여부는 국가법령정보센터에서 다시 확인하세요.</p><div class="basis-table">'+D.SOURCES.map(s=>`<div class="basis-row ${s.status==='확인'?'':'unv'}"><div><b>${M.esc(s.name)}</b><br><small>${M.esc(s.kind)} · ${M.esc(s.duty)}</small></div><div>${M.esc(s.version)}<br><small>${M.esc(s.date)}</small></div><div>${M.esc(s.articles)}</div><div><span class="st">${M.esc(s.status)}</span><br><small>확인일 ${s.checked}</small></div><div><a href="${s.url}" target="_blank" rel="noopener">공식 링크 ↗</a><br><small>${M.esc(s.note)}</small></div></div>`).join('')+'</div>'+
 '<h4>이 앱에 적용한 기준</h4><ul class="basis-list"><li>기재항목·순서: 규칙 제170조②, 고시 별표 3 제1호 양식</li><li>그림문자 생략(해골·부식성·호흡기 과민성과 감탄부호), 5개 이상 시 4개 표시 가능: 고시 제6조의2②</li><li>신호어 “위험” 우선: 고시 제6조의2③ · H 코드별 신호어: 별표 2 제1장</li><li>유해·위험 문구 모두 표시, 중복 생략·유사 조합 허용: 고시 제6조의2④</li><li>예방조치 문구 7개 이상 → 범주별 1개 이상 포함 6개 + MSDS 참고 기재: 고시 제6조의2⑤ · 코드 병기 가능: 제6조의2⑥</li><li>소용량(100mL·100g 이하) 및 반제품용기 특례: 고시 제6조②③</li><li>용량별 최소 표지 면적, 그림문자 1/40·0.5㎠: 고시 별표 3 제2호</li><li>색상: 고시 제8조</li></ul><p class="hint">프로그램 자체 기준(법정 아님): 예방조치 문구 추천 순서, 추천 표지 크기·비율, H 코드 기반 그림문자 추정, 그림문자 자동 크기 측정 방식, 글자 크기 기본값.</p>'}

/* ---------- 시작 ---------- */
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved?.docs?.length)docs=saved.docs.map(M.normalize);if(saved?.base)$('baseUrl').value=saved.base;if(saved?.settings)Object.assign(settings,{layoutMode:['a4p','a4l','label'].includes(saved.settings.layoutMode)?saved.settings.layoutMode:'a4p',margin:Number(saved.settings.margin)>=0?Number(saved.settings.margin):10,gap:Number(saved.settings.gap)>=0?Number(saved.settings.gap):4,pictoBasis:saved.settings.pictoBasis==='diamond'?'diamond':'square'})}catch(e){}
$('layoutMode').value=settings.layoutMode;$('margin').value=settings.margin;$('gap').value=settings.gap;$('pictoBasis').value=settings.pictoBasis;
if(!docs.length)docs=[M.blank()];if(!$('baseUrl').value&&location.hostname.endsWith('github.io'))$('baseUrl').value=new URL('./',location.href).href;paintBasis();load(docs[0].id);
// 왼쪽 메뉴: 01 표지 만들기 / 02 다국어·QR 등록 (같은 페이지에서 화면만 전환)
function showView(){const i18n=location.hash==='#i18n';document.querySelector('.workspace').hidden=i18n;document.querySelector('.steps').hidden=i18n;document.querySelector('.basis').hidden=i18n;$('i18nView').hidden=!i18n;document.querySelectorAll('.rail .nav[data-view]').forEach(n=>n.classList.toggle('active',(n.dataset.view==='i18n')===i18n));if(i18n){$('i18nProduct').textContent=active().name||'이름 없는 제품';readTranslation()}else render()}
window.addEventListener('hashchange',showView);showView();
if(window.requestIdleCallback)requestIdleCallback(()=>imageTemplates().catch(()=>{}));
