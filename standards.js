/* 경고표지 판정 로직. 기준 값은 standards-data.js. DOM에 의존하지 않음(테스트 가능). */
(function(root){'use strict';
const S=root.MSDSStdData||(typeof require==='function'?require('./standards-data.js'):null);
const PNAME=['폭발성','인화성','산화성','고압가스','부식성','급성독성','감탄부호(!)','건강 유해성','환경 유해성'];
const ST={ok:'충족',bad:'미충족',need:'확인 필요',na:'해당 없음'};

// "H300+H310", "H 225" 등 → 개별 H 코드 집합. EUH 코드는 제외.
function hCodes(text){const set=new Set();for(const m of String(text||'').matchAll(/(?<![A-Za-z])H\s*(\d{3})((?:\s*\+\s*H?\s*\d{3})*)/g)){set.add('H'+m[1]);for(const x of (m[2]||'').matchAll(/(\d{3})/g))set.add('H'+x[1])}return set}

function parseCapacity(value,unit){const n=Number(String(value??'').replace(/,/g,'').trim());if(!(n>0)||!isFinite(n))return null;
 switch(unit){case 'mL':return {kind:'volume',mL:n,text:n+' mL'};case 'L':return {kind:'volume',mL:n*1000,text:n+' L'};case 'g':return {kind:'mass',g:n,text:n+' g'};case 'kg':return {kind:'mass',g:n*1000,text:n+' kg'};default:return null}}

// 별표 3 제2호 가목. 경계: 하한 포함, 상한 제외. 비교는 mL 정수 기준으로 해 부동소수 오차를 피함.
function sizeRule(cap,sideAreaCm2){
 if(!cap)return {status:ST.need,min:null,band:null,msg:'용기·포장 용량을 입력하면 별표 3 구간을 판정합니다.'};
 if(cap.kind==='mass')return {status:ST.need,min:null,band:null,msg:'별표 3 표지 크기는 용량(ℓ) 구간으로 정해져 있습니다. 질량(g·kg)은 부피 환산 근거(밀도 등)를 확인해 mL·L로 입력하세요.'};
 const mL=Math.round(cap.mL*1000)/1000;const band=S.SIZE_BANDS.find(b=>mL>=b.min*1000&&mL<b.max*1000);
 if(band.area)return {status:'ok',min:band.area,band,msg:band.label+' → '+band.area+'㎠ 이상'};
 const side=Number(sideAreaCm2);if(side>0)return {status:'ok',min:Math.round(side*band.surfacePct)/100,band,msg:band.label+' → 측면 표면적 '+side+'㎠의 5% = '+(Math.round(side*band.surfacePct)/100)+'㎠ 이상'};
 return {status:ST.need,min:null,band,msg:band.label+': '+band.note+'. 용기 측면 표면적(㎠)을 입력해야 최소 면적을 계산할 수 있습니다.'};
}
function smallEligible(cap){return !!cap&&((cap.kind==='volume'&&cap.mL<=S.SMALL.mL)||(cap.kind==='mass'&&cap.g<=S.SMALL.g))}
function pictoMin(areaCm2){return Math.max(areaCm2*S.PICTO_SIZE.fraction,S.PICTO_SIZE.minCm2)}
// sideMm: 그림문자 외곽 정사각형 한 변. GHS 마름모는 이 정사각형에 내접(면적 1/2).
function pictoCheck(sideMm,areaCm2){const min=pictoMin(areaCm2),square=(sideMm/10)**2,diamond=square/2;
 const status=diamond>=min?ST.ok:square>=min?ST.need:ST.bad;return {min,square,diamond,status}}
// 별표 3 기준 면적 이상이 되도록 하는 프로그램 추천 크기(법정 비율 아님). 5mm 단위 올림.
function recommendSizes(minCm2){if(!(minCm2>0))return [];const need=minCm2*100;return [['세로형 3:4',3,4],['가로형 4:3',4,3],['정사각형',1,1]].map(([name,rw,rh])=>{let w=Math.ceil(Math.sqrt(need*rw/rh)/5)*5,h=Math.ceil(need/w/5)*5;w=Math.max(w,20);h=Math.max(h,20);return {name,w,h,area:w*h/100}})}

function inferPictos(hset){const out={};for(const h of hset)for(const n of S.H_PICTO[h]||[])(out[n]=out[n]||[]).push(h);return out}
function inferSignal(hset){const r={danger:[],warning:[],ambiguous:[],none:[]};for(const h of hset){if(S.SIGNAL_DANGER.includes(h))r.danger.push(h);else if(S.SIGNAL_WARNING.includes(h))r.warning.push(h);else if(S.SIGNAL_AMBIG.includes(h))r.ambiguous.push(h);else if(S.SIGNAL_NONE.includes(h))r.none.push(h)}
 r.signal=r.danger.length?'위험':r.ambiguous.length?'':r.warning.length?'경고':'';r.certain=!!r.danger.length||(!r.ambiguous.length&&!!r.warning.length);return r}

// 고시 제6조의2제2항 제1~3호: 감탄부호 생략 판단. 감탄부호가 나타내는 유해성(H 코드)을 함께 본다.
function exclamation(pictos,hset){
 if(!pictos.includes(7))return null;
 if(pictos.includes(6))return {removable:true,rule:'제6조의2②1',msg:'해골과 X자형 뼈와 감탄부호에 모두 해당 → 해골과 X자형 뼈만 표시'};
 const reasons=[...hset].filter(h=>(S.H_PICTO[h]||[]).includes(7));
 if(!reasons.length)return {removable:null,rule:'',msg:'감탄부호의 근거 H 코드(H302·H315·H317·H319·H335 등)를 찾지 못해 생략 여부를 판단하지 않았습니다.'};
 const resp=hset.has('H334')&&pictos.includes(8),corr=pictos.includes(5);
 const covered=h=>(['H315','H319'].includes(h)&&(corr||resp))||(h==='H317'&&resp);
 if(reasons.every(covered)){const rule=corr&&reasons.every(h=>h!=='H317')?'제6조의2②2':'제6조의2②3';return {removable:true,rule,reasons,msg:'감탄부호 근거('+reasons.join('·')+')가 모두 '+(rule.endsWith('2')?'부식성':'호흡기 과민성')+' 그림문자에 포함되는 경우 → 감탄부호 생략 대상'}}
 const other=reasons.filter(h=>!covered(h));return {removable:false,rule:'',reasons,msg:'감탄부호가 '+other.join('·')+' 유해성도 나타내므로 유지합니다'+((corr||resp)?' (부식성/호흡기 과민성만으로 생략하지 않음).':'.')};
}

// P 행 목록에서 포함·중복 관계 표시: 다른 행의 코드 집합에 완전히 포함되면 subsumedBy.
function pRelations(rows){const sets=rows.map(r=>new Set((r.code.match(/P\d{3}/gi)||[]).map(x=>x.toUpperCase())));
 return rows.map((r,i)=>{if(!sets[i].size)return null;for(let j=0;j<rows.length;j++){if(i===j||!sets[j].size)continue;const sup=[...sets[i]].every(c=>sets[j].has(c));if(sup&&(sets[j].size>sets[i].size||(sets[j].size===sets[i].size&&j<i)))return j}return null})}

function pictoReport(d){const ext=d.extracted||{},hs=hCodes(d.hazards),inferred=inferPictos(hs),source=new Set([...(ext.pictosText||[]),...(ext.pictosImage||[])]);
 return {hs,inferred,source,text:ext.pictosText||[],image:ext.pictosImage||[],uncertain:ext.pictosUncertain||[],
  inferredMissing:Object.keys(inferred).map(Number).filter(n=>!d.pictos.includes(n)&&!source.has(n)),
  unsupported:d.pictos.filter(n=>!source.has(n)&&!inferred[n]),excl:exclamation(d.pictos,hs),many:d.pictos.length>=5}}

/* 표시사항 점검. m: 화면 측정값 {w,h,f,pictoSides[],overflow,qrOverlap}. ctx: {M, approved}.
   kind: auto=프로그램 계산 / human=사람의 원문 대조 필요 / mixed=둘 다 */
function evaluate(d,m,ctx){const M=ctx.M,ap=ctx.approved===true,R=S.REFS,items=[];const type=d.labelType||'standard';
 const add=(key,title,status,value,basis,kind)=>items.push({key,title,status,value,basis,kind});
 const human=(st,v)=>st===ST.need&&ap?[ST.ok,v+' · 사용자 원문 대조 확인']:[st,v];
 const cap=parseCapacity(d.capValue,d.capUnit),small=smallEligible(cap);
 // 표지 종류 조건
 if(type==='small')add('type','표지 종류: 소용량 용기',small?ST.ok:ST.bad,small?'내용량 '+cap.text+' ≤ 100 mL·g → '+S.SMALL.items+'만 표시 가능':'내용량 100mL·100g 이하일 때만 적용 (현재 '+(cap?cap.text:'용량 미입력')+')',R.small,'auto');
 if(type==='semi')add('type','표지 종류: 반제품용기',d.semiConfirmed?ST.need:ST.bad,d.semiConfirmed?'사업장 자체 사용 반제품용기로 확인함. 보관·저장장소에 경고표지 부착 또는 MSDS 게시가 필요합니다(단서).':'사업장 자체 사용 반제품용기인지 확인 체크가 필요합니다.',R.semi,'human');
 const reduced=(type==='small'&&small)||(type==='semi'&&d.semiConfirmed);
 // 1 명칭
 if(!d.name.trim())add('name','명칭(제품명)',ST.bad,'비어 있음',R.name,'human');else add('name','명칭(제품명)',...human(ST.need,'“'+d.name.trim()+'” — MSDS 제1항 제품명과 대조'),R.name,'human');
 // 2 그림문자
 const pr=pictoReport(d);
 if(type==='semi'&&d.semiConfirmed&&!d.pictos.length)add('picto','그림문자',ST.na,'반제품용기: 신호어만 표시 가능',R.semi,'auto');
 else if(!d.pictos.length&&!d.noPictos)add('picto','그림문자',ST.bad,'선택되지 않음 — 원문 확인 후 선택하거나 “해당 없음”을 확인하세요',R.picto,'human');
 else if(!d.pictos.length)add('picto','그림문자',Object.keys(pr.inferred).length?ST.need:human(ST.need,'원문에 그림문자 없음으로 확인')[0],Object.keys(pr.inferred).length?'“해당 없음”으로 표시했지만 H 코드로 '+Object.keys(pr.inferred).map(n=>PNAME[n-1]).join('·')+' 추정 — 원문 확인 필요':human(ST.need,'원문에 그림문자 없음으로 표시')[1],R.picto,'human');
 else{const notes=[];if(pr.excl&&pr.excl.removable)notes.push(pr.excl.msg);if(pr.inferredMissing.length)notes.push('H 코드 기준 추정 미선택: '+pr.inferredMissing.map(n=>PNAME[n-1]).join('·'));if(pr.unsupported.length)notes.push('원문·H 코드 근거 미확인: '+pr.unsupported.map(n=>PNAME[n-1]).join('·'));if(pr.many)notes.push('5개 이상: 4개만 표시할 수 있음(선택)');
  const v=d.pictos.length+'개 ('+d.pictos.map(n=>PNAME[n-1]).join(', ')+')'+(notes.length?' — '+notes.join(' / '):'');add('picto','그림문자',...(notes.length?[ST.need,v]:human(ST.need,v)),R.picto,'mixed')}
 // 3 신호어
 const sig=inferSignal(pr.hs);
 if(!d.signal)add('signal','신호어',ST.bad,'선택되지 않음',R.signal,'human');
 else if(d.signal==='없음')add('signal','신호어',sig.signal?ST.need:human(ST.need,'없음')[0],sig.signal?'“없음” 선택 — H 코드상 “'+sig.signal+'” 추정('+(sig.danger[0]||sig.warning[0])+')':human(ST.need,'없음 — 원문 확인')[1],R.signal,'human');
 else if(d.signal==='경고'&&sig.danger.length)add('signal','신호어',ST.need,'경고 선택 — '+sig.danger.join('·')+'는 “위험” 해당. 모두 해당하면 “위험”만 표시',R.signal,'mixed');
 else add('signal','신호어',...human(ST.need,d.signal+(sig.signal&&sig.signal!==d.signal?' (H 코드 추정: '+(sig.signal||'판단 불가')+')':'')),R.signal,'mixed');
 // 4 유해·위험 문구
 const hl=M.lines(d.hazards),ex=(d.extracted&&d.extracted.hazards)||[];
 if(reduced)add('hazard','유해·위험 문구',ST.na,hl.length?hl.length+'개 입력(표지에는 생략)':'생략',type==='small'?R.small:R.semi,'auto');
 else if(!hl.length)add('hazard','유해·위험 문구',ST.bad,'비어 있음',R.hazard,'human');
 else{const exH=hCodes(ex.join('\n')),miss=[...exH].filter(h=>!pr.hs.has(h));const v=hl.length+'개 모두 표시'+(ex.length?' · 원문 추출 '+ex.length+'개':'')+(miss.length?' — 원문 추출 코드 누락: '+miss.join('·'):'');add('hazard','유해·위험 문구',...(miss.length?[ST.need,v]:human(ST.need,v)),R.hazard,'mixed')}
 // 5 예방조치 문구
 const rows=M.pRows(d),shown=M.selectedP(d),errs=M.pSelectionErrors(d);
 if(reduced)add('precaution','예방조치 문구',ST.na,rows.length?rows.length+'개 입력(표지에는 생략)':'생략',type==='small'?R.small:R.semi,'auto');
 else if(!rows.length)add('precaution','예방조치 문구',ST.bad,'비어 있음',R.precaution,'human');
 else if(errs.length)add('precaution','예방조치 문구',ST.bad,errs.join(' '),R.precaution,'auto');
 else{const v='총 '+rows.length+'개 중 '+shown.length+'개 표시'+(shown.length<rows.length?' + MSDS 참조 문구':'')+(d.pMode!=='all'&&rows.length>=7?' (예방·대응·저장·폐기 포함 확인)':'');add('precaution','예방조치 문구',...human(ST.need,v),R.precaution,'mixed')}
 // 6 공급자 정보
 if(type==='semi'&&d.semiConfirmed)add('supplier','공급자 정보',ST.na,'반제품용기 특례',R.semi,'auto');
 else if(!d.supplier.trim()||!d.phone.trim())add('supplier','공급자 정보',ST.bad,(!d.supplier.trim()?'공급자명 ':'')+(!d.phone.trim()?'전화번호 ':'')+'비어 있음',R.supplier,'human');
 else add('supplier','공급자 정보',...human(ST.need,d.supplier.trim()+' · '+d.phone.trim()+(d.address.trim()?'':' (주소 미입력)')+' — MSDS 제1항과 대조'),R.supplier,'human');
 // 7 표지 면적
 const area=Math.round(m.w*m.h)/100,sr=sizeRule(cap,d.sideArea);
 if(sr.status==='ok')add('size','표지 크기',area>=sr.min?ST.ok:ST.bad,m.w+'×'+m.h+'mm = '+area+'㎠ '+(area>=sr.min?'≥':'<')+' 기준 '+sr.min+'㎠ ('+sr.msg+')',R.size,'auto');
 else add('size','표지 크기',ST.need,m.w+'×'+m.h+'mm = '+area+'㎠ — '+sr.msg,R.size,'auto');
 // 8 그림문자 크기
 if(!m.pictoSides.length)add('pictoSize','그림문자 크기',ST.na,'표시된 그림문자 없음',R.pictoSize,'auto');
 else{const s=Math.min(...m.pictoSides),pc=pictoCheck(s,area);add('pictoSize','그림문자 크기',pc.status,'1개 '+(s/10).toFixed(1)+'×'+(s/10).toFixed(1)+'cm: 외곽 정사각형 '+pc.square.toFixed(2)+'㎠ · 마름모 '+pc.diamond.toFixed(2)+'㎠ / 기준 '+pc.min.toFixed(2)+'㎠'+(pc.status===ST.need?' — 측정 정의가 원문에 없어 외곽 기준으로만 충족':''),R.pictoSize,'auto')}
 // 9 색상
 add('color','색상',ST.ok,'흰 바탕·검정 글씨와 테두리, 그림문자 검정 그림·빨간 테두리·흰 바탕(앱 출력 고정). 용기 직접 인쇄·유색 포장 예외는 별도 확인',R.color,'auto');
 // 10 잘림·겹침·넘침
 add('layout','글자 잘림·겹침·넘침',m.overflow||m.qrOverlap?ST.bad:ST.ok,m.overflow?'내용이 표지 밖으로 넘칩니다 — 표지를 키우세요':m.qrOverlap?'QR이 다른 내용과 겹칩니다':'넘침·겹침 없음(화면 측정)',R.layout,'auto');
 // 11 글자 크기(판정 없음)
 add('font','본문 글자 크기',ST.na,m.f+'pt (실제 출력 크기)',' 법정 최소 글자 크기: 확인된 근거 없음 — 판정하지 않음','auto');
 // 12 한글 작성
 add('korean','한글 작성',...human(ST.need,'한글 경고표지 여부(외국어 병기 가능)'),R.korean,'human');
 return items;
}
function summary(items){const c={};for(const i of items)c[i.status]=(c[i.status]||0)+1;return c}
root.MSDSStd={ST,PNAME,hCodes,parseCapacity,sizeRule,smallEligible,pictoMin,pictoCheck,recommendSizes,inferPictos,inferSignal,exclamation,pRelations,pictoReport,evaluate,summary};
if(typeof module!=='undefined')module.exports=root.MSDSStd;
})(globalThis);
