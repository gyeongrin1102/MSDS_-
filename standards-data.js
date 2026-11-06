/* 경고표지 법정 기준 데이터 (판정 로직은 standards.js).
   확인일 2026-11-06 · 국가법령정보센터(law.go.kr) 원문 대조.
   기준이 바뀌면 이 파일의 값과 SOURCES만 갱신한다. */
(function(root){'use strict';
const CHECKED='2026-11-06';
const LAW='https://www.law.go.kr';
const NOTICE_URL=LAW+'/admRulInfoP.do?admRulSeq=2100000278320';
const SOURCES=[
 {id:'act',kind:'법률',duty:'법적 의무',status:'확인',name:'산업안전보건법',version:'법률 제22122호',date:'시행 2026. 10. 27.',articles:'제115조(물질안전보건자료대상물질 용기 등의 경고표시)',url:LAW+'/법령/산업안전보건법/제115조',checked:CHECKED,note:'양도·제공자 및 사업장 사업주의 경고표시 의무.'},
 {id:'rule',kind:'시행규칙',duty:'법적 의무',status:'확인',name:'산업안전보건법 시행규칙',version:'고용노동부령 제477호',date:'시행 2026. 8. 1.',articles:'제170조(경고표시 방법 및 기재항목) 제1항~제4항',url:LAW+'/법령/산업안전보건법시행규칙/제170조',checked:CHECKED,note:'기재항목 6가지(명칭·그림문자·신호어·유해·위험 문구·예방조치 문구·공급자 정보) 모두 포함.'},
 {id:'notice',kind:'고시',duty:'법적 의무(위임 고시)',status:'확인',name:'화학물질의 분류·표시 및 물질안전보건자료에 관한 기준',version:'고용노동부고시 제2026-26호',date:'시행 2026. 4. 24.',articles:'제5조(부착), 제6조(작성방법·소용량·반제품용기), 제6조의2(기재항목 작성방법), 제7조(양식·규격), 제8조(색상·위치), 별표 2(기재항목), 별표 3(양식 및 규격)',url:NOTICE_URL,checked:CHECKED,note:'별표 2·3은 같은 페이지의 별표 PDF로 확인.'},
 {id:'kosha-w14',kind:'기술지침',duty:'권고(법적 의무 아님)',status:'근거 확인 필요',name:'KOSHA GUIDE W-14-2022 경고표지 작성 지침',version:'-',date:'확인 필요',articles:'-',url:'https://portal.kosha.or.kr/',checked:CHECKED,note:'공식 원문을 열지 못해 발행일·현행 여부·대체 관계를 확인하지 못함(검색에서는 W-14-2020 게시본만 확인). 판정에 사용하지 않음.'},
 {id:'kosha-c29',kind:'기술지침',duty:'권고(법적 의무 아님)',status:'근거 확인 필요',name:'C-C-29-2026 경고표지를 이용한 화학물질 관리에 관한 기술지원규정',version:'-',date:'확인 필요',articles:'-',url:'https://portal.kosha.or.kr/',checked:CHECKED,note:'공식 원문을 확인하지 못함. 유사 명칭의 P-51-2012 기술지침 게시본만 검색되어 대체 관계 미확인. 판정에 사용하지 않음.'}
];
// 고시 별표 3 제2호 가목: 하한 포함(≤), 상한 제외(<). 단위 ℓ.
const SIZE_BANDS=[
 {min:500,max:Infinity,area:450,label:'용량 ≥ 500ℓ'},
 {min:200,max:500,area:300,label:'200ℓ ≤ 용량 < 500ℓ'},
 {min:50,max:200,area:180,label:'50ℓ ≤ 용량 < 200ℓ'},
 {min:5,max:50,area:90,label:'5ℓ ≤ 용량 < 50ℓ'},
 {min:0,max:5,area:null,surfacePct:5,label:'용량 < 5ℓ',note:'용기 또는 포장의 상하면적을 제외한 전체 표면적의 5% 이상'}
];
// 별표 3 제2호 나목
const PICTO_SIZE={fraction:1/40,minCm2:0.5,ref:'고시 별표 3 제2호 나목',note:'개별 그림문자 크기: 표지 규격의 1/40 이상, 최소 0.5㎠ 이상. 크기의 측정 방법(마름모 면적/외곽 정사각형)은 원문에 정의되어 있지 않음.'};
// 고시 제6조제2항
const SMALL={mL:100,g:100,ref:'고시 제6조제2항',items:'명칭, 그림문자, 신호어, 공급자 정보'};
const REFS={name:'규칙 제170조②1 · 고시 제6조의2①',picto:'규칙 제170조②2 · 고시 제6조의2② · 별표 2',signal:'규칙 제170조②3 · 고시 제6조의2③',hazard:'규칙 제170조②4 · 고시 제6조의2④',precaution:'규칙 제170조②5 · 고시 제6조의2⑤',supplier:'규칙 제170조②6',code:'고시 제6조의2⑥',size:'고시 제7조 · 별표 3 제2호 가목',pictoSize:'고시 별표 3 제2호 나목',color:'고시 제8조',korean:'고시 제5조①',small:'고시 제6조②',semi:'고시 제6조③',layout:'고시 별표 3 제1호(양식)'};
// 별표 2 제1장: H 코드별 신호어(본문 텍스트에서 확인). 같은 H 코드에 구분별로 위험/경고가 모두 있는 경우는 AMBIG.
const SIGNAL_DANGER='H200 H201 H202 H203 H205 H220 H222 H224 H225 H232 H240 H241 H250 H251 H260 H270 H271 H300 H301 H304 H310 H311 H314 H318 H330 H331 H334 H340 H350 H360 H370 H372'.split(' ');
const SIGNAL_WARNING='H204 H221 H223 H226 H227 H229 H252 H280 H281 H290 H302 H303 H305 H312 H313 H315 H317 H319 H320 H332 H333 H335 H336 H341 H351 H361 H371 H373 H400 H410 H420'.split(' ');
const SIGNAL_NONE='H362 H411 H412 H413'.split(' ');
const SIGNAL_AMBIG='H228 H242 H261 H272'.split(' ');
// H 코드 → GHS 그림문자 번호. 별표 2 그림(이미지)을 자동 판독해 GHS 대응과 대조한 프로그램 추정 표. 원문 MSDS 표시가 우선.
const H_PICTO={H200:[1],H201:[1],H202:[1],H203:[1],H204:[1],H205:[1],H240:[1],H241:[1,2],
 H220:[2],H222:[2],H223:[2],H224:[2],H225:[2],H226:[2],H228:[2],H232:[2],H242:[2],H250:[2],H251:[2],H252:[2],H260:[2],H261:[2],
 H270:[3],H271:[3],H272:[3],H280:[4],H281:[4],H290:[5],H314:[5],H318:[5],
 H300:[6],H301:[6],H310:[6],H311:[6],H330:[6],H331:[6],
 H302:[7],H312:[7],H332:[7],H315:[7],H317:[7],H319:[7],H335:[7],H336:[7],H420:[7],
 H304:[8],H305:[8],H334:[8],H340:[8],H341:[8],H350:[8],H351:[8],H360:[8],H361:[8],H370:[8],H371:[8],H372:[8],H373:[8],
 H400:[9],H410:[9],H411:[9]};
root.MSDSStdData={CHECKED,SOURCES,SIZE_BANDS,PICTO_SIZE,SMALL,REFS,SIGNAL_DANGER,SIGNAL_WARNING,SIGNAL_NONE,SIGNAL_AMBIG,H_PICTO};
if(typeof module!=='undefined')module.exports=root.MSDSStdData;
})(globalThis);
