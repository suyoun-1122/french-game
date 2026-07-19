import { speakFrench } from "./audio.js";
import { todayKey, recordResult, getDueWords } from "./review.js";

const $=id=>document.getElementById(id);
let WORDS=[],LESSONS=[],RECIPES=[],INGREDIENTS={},currentLesson=1,currentWordIndex=0,wordFilter="all",wordSearch="",recipeFilter="all",collectionFilter="all";
let quiz={items:[],index:0,skill:"meaning",answered:false,daily:false,combo:0,retryQueue:[],retryCount:{}};

const emptySkills=()=>({meaning:{a:0,c:0},article:{a:0,c:0},form:{a:0,c:0},listening:{a:0,c:0},example:{a:0,c:0}});
let progress={version:"4.4.6",stars:0,today:todayKey(),todayDone:0,completedDesserts:[],ingredients:{flour:0,butter:0,egg:0,milk:0,sugar:0,cheese:0,vegetable:0,meat:0,fish:0,fruit:0},madeFoods:{},rewardedDays:[],rewardCounter:0,rewardHistory:[],words:{},difficulty:{},totals:{attempts:0,correct:0},skillTotals:emptySkills(),bestCombo:0};

function loadProgress(){
  try{
    const saved=JSON.parse(localStorage.getItem("yeonjaeFrenchV3")||localStorage.getItem("yeonjaeFrenchV2")||"null");
    if(saved) progress={...progress,...saved,totals:{...progress.totals,...(saved.totals||{})},skillTotals:{...emptySkills(),...(saved.skillTotals||{})},ingredients:{...progress.ingredients,...(saved.ingredients||{})},madeFoods:saved.madeFoods||{},rewardedDays:Array.isArray(saved.rewardedDays)?saved.rewardedDays:[],rewardCounter:Number(saved.rewardCounter)||0,rewardHistory:Array.isArray(saved.rewardHistory)?saved.rewardHistory:[],words:saved.words||{},difficulty:saved.difficulty||{},completedDesserts:Array.isArray(saved.completedDesserts)?saved.completedDesserts:[]};
  }catch(e){}
  if(progress.today!==todayKey()){progress.today=todayKey();progress.todayDone=0;saveProgress()}
}
function saveProgress(){localStorage.setItem("yeonjaeFrenchV3",JSON.stringify(progress))}
function validateData(words,lessonsPayload,recipesPayload){
  if(!Array.isArray(words)||words.length<1)throw new Error("단어 데이터가 비어 있습니다.");
  const ids=new Set();
  words.forEach((w,index)=>{
    if(!w||w.id==null||!w.word||!w.meaning||!w.example||!w.exampleKr)throw new Error(`단어 ${index+1} 필수값 누락`);
    if(ids.has(w.id))throw new Error(`중복 단어 ID: ${w.id}`);
    ids.add(w.id);
    if(w.type==="noun"&&!['un','une'].includes(w.article))throw new Error(`명사 관사 오류: ${w.word}`);
  });
  const lessons=lessonsPayload?.lessons;
  if(!Array.isArray(lessons)||!lessons.length)throw new Error("단원 데이터가 비어 있습니다.");
  lessons.forEach(l=>{if(!Array.isArray(l.wordIds)||l.wordIds.some(id=>!ids.has(id)))throw new Error(`단원 단어 연결 오류: ${l.title||l.id}`)});
  if(!recipesPayload?.ingredients||!Array.isArray(recipesPayload?.recipes)||!recipesPayload.recipes.length)throw new Error("레시피 데이터 오류");
  const recipeIds=new Set();
  recipesPayload.recipes.forEach(r=>{
    if(!r.id||!r.fr||!r.name||!r.gender||!r.cost)throw new Error(`레시피 필수값 누락: ${r.id||'unknown'}`);
    if(recipeIds.has(r.id))throw new Error(`중복 레시피 ID: ${r.id}`);
    recipeIds.add(r.id);
    Object.keys(r.cost).forEach(id=>{if(!recipesPayload.ingredients[id])throw new Error(`알 수 없는 재료: ${id}`)});
  });
}
async function loadData(){
  const [w,l,r]=await Promise.all([fetch("./data/words.json?v=4.3.0").then(r=>r.json()),fetch("./data/lessons.json?v=4.3.0").then(r=>r.json()),fetch("./data/recipes.json?v=4.3.0").then(r=>r.json())]);
  validateData(w,l,r);WORDS=w;LESSONS=l.lessons;RECIPES=r.recipes;INGREDIENTS=r.ingredients;progress.version="4.3.0";saveProgress();renderAll();
}
function showScreen(id,navButton){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));$(id).classList.add("active");
  if(navButton){document.querySelectorAll(".nav button").forEach(b=>b.classList.remove("active"));navButton.classList.add("active")}
  renderAll();window.scrollTo(0,0)
}
window.showScreen=showScreen;
const shuffled=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
const lessonWords=(id=currentLesson)=>{const l=LESSONS.find(x=>x.id===id);return l?l.wordIds.map(id=>WORDS.find(w=>w.id===id)).filter(Boolean):[]};
const wordLabel=w=>`${w.article?w.article+" ":""}${w.word}`;
const pluralLabel=w=>!w.plural?"—":w.type==="noun"?`des ${w.plural}`:w.plural;
const genderLabel=w=>w.type==="noun"?(w.gender==="masculine"?"남성명사 (nom masculin)":"여성명사 (nom féminin)"):w.type==="verb"?"동사 (verbe)":"형용사 (adjectif)";
const adjectiveForms=w=>{
  const plural=String(w.plural||"").split("/").map(x=>x.trim()).filter(Boolean);
  return {ms:w.word,fs:w.feminine||w.word,mp:plural[0]||`${w.word}s`,fp:plural[1]||plural[0]||`${w.feminine||w.word}s`};
};
const stripPronoun=s=>String(s||"").replace(/^(j'|je |tu |il\/elle |nous |vous |ils\/elles )/i,"").trim();
const uniqueOptions=(items,correct)=>{
  // 정답은 반드시 보기 4개 안에 포함되도록 먼저 고정하고, 오답만 무작위로 뽑는다.
  const cleanCorrect=String(correct||"").trim();
  const distractors=[];
  const seen=new Set([cleanCorrect]);
  shuffled(items).forEach(label=>{
    const value=String(label||"").trim();
    if(value&&!seen.has(value)){seen.add(value);distractors.push(value)}
  });
  const selected=distractors.slice(0,3).map(label=>({label,ok:false}));
  selected.push({label:cleanCorrect,ok:true});
  return shuffled(selected);
};
const semanticPool=q=>{
  const category=WORDS.filter(w=>w.id!==q.id&&w.category===q.category);
  const lesson=WORDS.filter(w=>w.id!==q.id&&w.lesson===q.lesson);
  const type=WORDS.filter(w=>w.id!==q.id&&w.type===q.type);
  return [...shuffled(category),...shuffled(lesson),...shuffled(type),...shuffled(WORDS.filter(w=>w.id!==q.id))]
    .filter((w,i,a)=>a.findIndex(x=>x.id===w.id)===i);
};

const DIFFICULTY_LABELS={1:"Easy",2:"Medium",3:"Hard"};
function masteryKey(wordId,skill){return `${wordId}:${skill}`}
function getMastery(wordId,skill){
  const key=masteryKey(wordId,skill);
  const saved=progress.difficulty?.[key]||{};
  return {level:Math.max(1,Math.min(3,Number(saved.level)||1)),streak:Math.max(0,Number(saved.streak)||0)};
}
function updateMastery(wordId,skill,ok){
  const key=masteryKey(wordId,skill),m=getMastery(wordId,skill);
  if(ok){
    m.streak+=1;
    if(m.streak>=3&&m.level<3){m.level+=1;m.streak=0;}
  }else{
    m.streak=0;
    if(m.level>1)m.level-=1;
  }
  progress.difficulty=progress.difficulty||{};
  progress.difficulty[key]=m;
  return m;
}
function difficultyPool(q,level){
  const sameType=WORDS.filter(w=>w.id!==q.id&&w.type===q.type);
  const sameCategory=sameType.filter(w=>w.category===q.category);
  const sameLesson=sameType.filter(w=>w.lesson===q.lesson);
  if(level===1)return [...sameType,...WORDS.filter(w=>w.id!==q.id)];
  if(level===2)return [...sameCategory,...sameLesson,...sameType];
  return [...sameCategory,...sameLesson,...sameType];
}
function scheduleRetry(q,skill){
  const key=masteryKey(q.id,skill);
  const count=quiz.retryCount[key]||0;
  if(count>=2)return;
  quiz.retryCount[key]=count+1;
  const insertAt=Math.min(quiz.items.length,quiz.index+2+Math.floor(Math.random()*2));
  quiz.items.splice(insertAt,0,{...q,__retrySkill:skill,__retry:true});
}

function normalizedSkill(q,skill){
  if(skill==="article"&&q.type!=="noun") return "form";
  return skill;
}
function curatedOptions(q,field,fallback){
  const explicit=Array.isArray(q?.[field])?q[field].filter(Boolean):[];
  const combined=[...explicit,...fallback];
  return combined.filter((value,index,array)=>value&&array.indexOf(value)===index);
}
function isWeakDistractor(value,correct){
  const a=String(value||"").trim(),b=String(correct||"").trim();
  return !a||a===b||a.length<1;
}
function makeQuestion(q,requestedSkill){
  const skill=normalizedSkill(q,requestedSkill);
  const mastery=getMastery(q.id,skill),level=mastery.level;
  const nearby=difficultyPool(q,level);
  if(skill==="meaning"){
    const correct=q.meaning;
    const fallback=nearby.slice(0,18).map(w=>w.meaning).filter(value=>!isWeakDistractor(value,correct));
    const distractors=curatedOptions(q,"meaningDistractors",fallback);
    return {skill,label:"가장 알맞은 뜻을 고르세요",display:wordLabel(q),options:uniqueOptions(distractors,correct),answer:correct,difficulty:level};
  }
  if(skill==="listening"){
    if(level===1){
      const correct=q.meaning;
      const fallback=nearby.slice(0,18).map(w=>w.meaning).filter(value=>!isWeakDistractor(value,correct));
      const distractors=curatedOptions(q,"meaningDistractors",fallback);
      return {skill,label:"단어를 듣고 가장 알맞은 뜻을 고르세요",display:"소리를 잘 듣고 뜻을 골라 보세요",audioText:wordLabel(q),audioKind:"word",options:uniqueOptions(distractors,correct),answer:correct,difficulty:level};
    }
    if(level===2){
      const correct=wordLabel(q);
      const spellings=nearby.slice(0,20).map(wordLabel).filter(value=>!isWeakDistractor(value,correct));
      return {skill,label:"들리는 프랑스어와 같은 철자를 고르세요",display:"발음과 철자를 연결해 보세요",audioText:wordLabel(q),audioKind:"word",options:uniqueOptions(spellings,correct),answer:correct,difficulty:level};
    }
    const correct=q.exampleKr;
    const fallback=nearby.filter(w=>w.exampleKr).slice(0,20).map(w=>w.exampleKr).filter(value=>!isWeakDistractor(value,correct));
    const distractors=curatedOptions(q,"sentenceDistractors",fallback);
    return {skill,label:"문장을 듣고 정확한 뜻을 고르세요",display:"문장 전체를 듣고 핵심 정보를 찾아보세요",audioText:q.example,audioKind:"sentence",options:uniqueOptions(distractors,correct),answer:correct,difficulty:level};
  }
  if(skill==="article"){
    const wrongArticle=q.article==="un"?"une":"un";
    const correctIndefinite=wordLabel(q);
    const correctDefinite=`${q.gender==="masculine"?"le":"la"} ${q.word}`;
    const plural=`des ${q.plural||q.word}`;
    const variant=(q.id+quiz.index+level)%3;
    if(level===1||variant===0){
      return {skill,label:`알맞은 부정관사를 고르세요 · ${genderLabel(q)}`,display:q.word,options:uniqueOptions([wrongArticle,"des",q.gender==="masculine"?"le":"la"],q.article),answer:q.article,difficulty:level};
    }
    if(level===2||variant===1){
      return {skill,label:`알맞은 관사와 명사를 고르세요 · ${genderLabel(q)}`,display:q.word,options:uniqueOptions([`${wrongArticle} ${q.word}`,plural,correctDefinite],correctIndefinite),answer:correctIndefinite,difficulty:level};
    }
    const wrongDefinite=`${q.gender==="masculine"?"la":"le"} ${q.word}`;
    return {skill,label:"문맥에 맞는 관사 형태를 고르세요",display:`Je vois _____.
(${q.meaning})`,options:uniqueOptions([wrongDefinite,plural,correctIndefinite],correctDefinite),answer:correctDefinite,difficulty:level};
  }
  if(skill==="form"){
    if(q.type==="noun"){
      const correct=pluralLabel(q);
      const wrongArticle=q.article==="un"?"une":"un";
      return {skill,label:"단수 명사를 부정관사 복수형으로 바꾸세요",display:`${q.article} ${q.word} → ?`,options:uniqueOptions([`les ${q.plural}`,`${wrongArticle} ${q.word}`,q.plural],correct),answer:correct,difficulty:level};
    }
    if(q.type==="adjective"){
      const f=adjectiveForms(q),variants=[
        {label:"여성 단수 (féminin singulier)",sentence:"La fille est _____.",correct:f.fs},
        {label:"여성 복수 (féminin pluriel)",sentence:"Les filles sont _____.",correct:f.fp},
        {label:"남성 복수 (masculin pluriel)",sentence:"Les garçons sont _____.",correct:f.mp},
        {label:"남성 단수 (masculin singulier)",sentence:"Le garçon est _____.",correct:f.ms}
      ];
      const v=variants[(q.id+quiz.index)%variants.length];
      const options=[f.ms,f.fs,f.mp,f.fp];
      if(new Set(options).size<4){
        const similar=nearby.filter(w=>w.type==="adjective").flatMap(w=>Object.values(adjectiveForms(w)));
        options.push(...similar);
      }
      return {skill,label:`문장에 맞는 형용사 형태를 고르세요 · ${v.label}`,display:`${q.word} (${q.meaning})\n${v.sentence}`,options:uniqueOptions(options,v.correct),answer:v.correct,difficulty:level};
    }
    const keys=["je","tu","nous","vous","ilsElles"],key=keys[(q.id+quiz.index)%keys.length],pronoun={je:"je",tu:"tu",nous:"nous",vous:"vous",ilsElles:"ils/elles"}[key];
    const correct=stripPronoun(q.conjugation?.[key]||q.word);
    const ownForms=Object.values(q.conjugation||{}).map(stripPronoun).filter(x=>x&&x!=="—");
    const closeForms=nearby.filter(w=>w.type==="verb").flatMap(w=>Object.values(w.conjugation||{}).map(stripPronoun));
    return {skill,label:`주어 ${pronoun}에 맞는 현재형을 고르세요`,display:`${q.word} → ${pronoun} ...`,options:uniqueOptions([...ownForms,...closeForms],correct),answer:correct,difficulty:level};
  }
  const sameContext=nearby.filter(w=>w.exampleKr&&w.category===q.category);
  const lessonContext=nearby.filter(w=>w.exampleKr&&w.lesson===q.lesson);
  const fallback=[...sameContext,...lessonContext,...nearby].map(w=>w.exampleKr).filter(value=>!isWeakDistractor(value,q.exampleKr));
  const distractors=curatedOptions(q,"exampleDistractors",fallback);
  return {skill,label:"문장의 뜻을 정확하게 고르세요",display:q.example,options:uniqueOptions(distractors,q.exampleKr),answer:q.exampleKr,difficulty:level};
}

const CAT_GUIDES={
  meaning:{name:"쁘띠냥 · Petit",src:"./assets/characters/petit-vector.svg",line:"단어의 뜻을 차근차근 찾아보자냥!",theme:"petit"},
  article:{name:"쁘띠냥 · Petit",src:"./assets/characters/petit-vector.svg",line:"관사와 명사의 성을 함께 확인하자냥!",theme:"petit"},
  form:{name:"쁘띠냥 · Petit",src:"./assets/characters/petit-vector.svg",line:"형태가 어떻게 바뀌는지 살펴보자냥!",theme:"petit"},
  listening:{name:"치즈냥 · Fromage",src:"./assets/characters/fromage-vector.svg",line:"귀를 쫑긋! 소리를 잘 들어보자냥!",theme:"fromage"},
  example:{name:"라벤더냥 · Lavande",src:"./assets/characters/lavande-vector.svg",line:"문장 속 단서를 찾아 읽어보자냥!",theme:"lavande"}
};
function guideFor(skill){return CAT_GUIDES[skill]||CAT_GUIDES.meaning}
const CHARACTER_STATES={
  petit:{idle:"./assets/characters/petit-vector.svg",happy:"./assets/characters/petit-happy.svg",think:"./assets/characters/petit-think.svg"},
  fromage:{idle:"./assets/characters/fromage-vector.svg",happy:"./assets/characters/fromage-happy.svg",think:"./assets/characters/fromage-think.svg"},
  lavande:{idle:"./assets/characters/lavande-vector.svg",happy:"./assets/characters/lavande-happy.svg",think:"./assets/characters/lavande-think.svg"}
};
function setQuizCharacterState(state="idle"){
  const cat=$("quizCat"),guide=guideFor(quiz.activeSkill||quiz.skill||"meaning");
  if(!cat)return;
  const theme=guide.theme||"petit";
  cat.src=(CHARACTER_STATES[theme]||CHARACTER_STATES.petit)[state]||(CHARACTER_STATES[theme]||CHARACTER_STATES.petit).idle;
  cat.dataset.state=state;
}

const SKILL_REWARD_POOLS={
  meaning:["flour","sugar","fruit"],
  article:["egg","milk","butter"],
  form:["flour","cheese","vegetable"],
  listening:["milk","butter","fish"],
  example:["vegetable","meat","fruit"]
};
function addIngredient(id,amount=1,reason="학습 보상"){
  if(!INGREDIENTS[id]) return null;
  progress.ingredients[id]=(progress.ingredients[id]||0)+amount;
  const item={id,amount,reason,at:new Date().toISOString()};
  progress.rewardHistory=[item,...(progress.rewardHistory||[])].slice(0,12);
  return item;
}
function grantQuizIngredient(skill,combo){
  progress.rewardCounter=(progress.rewardCounter||0)+1;
  const shouldReward=progress.rewardCounter%2===0;
  const comboBonus=combo>0&&combo%5===0;
  if(!shouldReward&&!comboBonus) return [];
  const pool=SKILL_REWARD_POOLS[skill]||Object.keys(INGREDIENTS);
  const id=pool[Math.floor(Math.random()*pool.length)];
  const rewards=[];
  const first=addIngredient(id,comboBonus?2:1,comboBonus?`${combo}연속 정답 보너스`:"정답 2회 보상");
  if(first) rewards.push(first);
  if(comboBonus&&shouldReward){
    const secondId=pool.find(x=>x!==id)||id;
    const second=addIngredient(secondId,1,"정답 2회 보상");
    if(second) rewards.push(second);
  }
  return rewards;
}
function rewardText(rewards){
  return rewards.map(r=>{const it=INGREDIENTS[r.id];return `${it.emoji} ${it.name} +${r.amount}`}).join("  ");
}

function showRewardToast(text){
  const old=document.querySelector(".reward-toast");if(old)old.remove();
  const el=document.createElement("div");el.className="reward-toast";el.setAttribute("role","status");el.textContent=text;
  document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add("show"));
  setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),220)},2600)
}
function celebrate(symbols=["⭐","✨","🥐","🌼"]){
  const layer=$("celebrationLayer");if(!layer||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  layer.innerHTML="";
  for(let i=0;i<18;i++){const bit=document.createElement("i");bit.textContent=symbols[i%symbols.length];bit.style.setProperty("--x",`${8+Math.random()*84}vw`);bit.style.setProperty("--delay",`${Math.random()*.35}s`);bit.style.setProperty("--drift",`${-45+Math.random()*90}px`);layer.appendChild(bit)}
  setTimeout(()=>layer.innerHTML="",1800)
}
function updateOnlineState(){const banner=$("offlineBanner");if(!banner)return;banner.classList.toggle("hidden",navigator.onLine)}
window.addEventListener("online",updateOnlineState);window.addEventListener("offline",updateOnlineState);updateOnlineState();
function grantDailyIngredients(){
  const key=todayKey();if(progress.rewardedDays.includes(key))return false;
  const pool=["flour","butter","egg","milk","sugar","cheese","vegetable","meat","fish","fruit"];
  const rewards=shuffled(pool).slice(0,4);rewards.forEach((id,i)=>addIngredient(id,i===0?2:1,"오늘의 학습 완료"));
  progress.rewardedDays.push(key);saveProgress();showRewardToast("오늘의 보상! 프랑스 요리 재료를 받았어요 🎁");return true
}

function renderHome(){
  const level=Math.floor((Number(progress.stars)||0)/100)+1,xp=(Number(progress.stars)||0)%100;
  $("starsTop").textContent=progress.stars;$("levelNumber").textContent=level;$("xpCurrent").textContent=xp;$("xpBar").style.width=xp+"%";
  if($("streakTop")) $("streakTop").textContent=Math.max(1,Math.min(7,(progress.rewardedDays||[]).length+1));
  $("todayDone").textContent=progress.todayDone;$("todayBar").style.width=(progress.todayDone*10)+"%";
  $("todayLabel").textContent=new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",weekday:"short"}).format(new Date());
  const stage=Math.min(5,Math.floor(progress.todayDone/2));$("foodImage").src=`./assets/foods/stage-${stage}.svg`;
  const preview=$("homeIngredientPreview");
  if(preview){
    preview.innerHTML="";
    const featured=["flour","butter","egg","milk"];
    featured.forEach(id=>{const it=INGREDIENTS[id]||{emoji:"🎁",name:id};const el=document.createElement("div");el.className="mini-ingredient";el.innerHTML=`<span>${it.emoji}</span><b>${progress.ingredients[id]||0}</b><small>${it.name}</small>`;preview.appendChild(el)});
  }
  if(progress.todayDone>=10){
    $("homeGreeting").innerHTML="Bravo!<br>오늘의 학습 완료!";
    $("homeSpeech").innerHTML="오늘 모은 재료로<br>프랑스 음식을 만들어 볼까?";
    $("dailyStatus").innerHTML="오늘의 미션을 완료했어요.<br>요리 화면에서 재료를 확인해요.";
    $("homeCat").src="./assets/characters/trio-vector.svg";
  } else if(progress.todayDone>0){
    $("homeGreeting").innerHTML="Très bien!<br>조금만 더 힘내자!";
    $("homeSpeech").innerHTML=`오늘 ${progress.todayDone}문제 완료!<br>${10-progress.todayDone}문제만 더 풀어 보자.`;
    $("dailyStatus").innerHTML=`${10-progress.todayDone}문제를 더 풀면<br>오늘의 재료 상자가 열려요.`;
    $("homeCat").src="./assets/characters/trio-vector.svg";
  } else {
    $("homeGreeting").innerHTML="오늘도 프랑스어를<br>재미있게 배워 보자!";
    $("homeSpeech").innerHTML="10문제를 완료하면<br>프랑스 요리 재료를 받을 수 있어.";
    $("dailyStatus").innerHTML="10문제를 완료하고<br>요리 재료를 모아 보세요.";
    $("homeCat").src="./assets/characters/trio-vector.svg";
  }
}
function lessonProgress(lesson){
  const learned=lesson.wordIds.filter(id=>progress.words[String(id)]).length;
  return {learned,total:lesson.wordIds.length,percent:lesson.wordIds.length?Math.round(learned/lesson.wordIds.length*100):0};
}
function renderLessonTabs(){
  const box=$("lessonTabs");box.innerHTML="";
  LESSONS.forEach(l=>{const p=lessonProgress(l),b=document.createElement("button");b.className="lesson-tab"+(l.id===currentLesson?" active":"");b.innerHTML=`<span>${l.ce} · ${l.title}</span><small>${p.percent}%</small>`;b.onclick=()=>{currentLesson=l.id;currentWordIndex=0;renderLessonTabs();renderStudy()};box.appendChild(b)})
}
function studyGuideForWord(w){
  if(w.type==="verb")return {name:"치즈냥 · Fromage",src:"./assets/characters/fromage-vector.svg",line:"동사의 소리와 활용을 리듬처럼 익혀 보자냥!",theme:"fromage"};
  if(w.example&&String(w.example).length>32)return {name:"라벤더냥 · Lavande",src:"./assets/characters/lavande-vector.svg",line:"예문 속에서 단어가 어떻게 쓰이는지 찾아보자냥!",theme:"lavande"};
  return {name:"쁘띠냥 · Petit",src:"./assets/characters/petit-vector.svg",line:"단어의 뜻과 성, 형태를 차근차근 확인해 보자냥!",theme:"petit"};
}
function renderStudy(){
  const list=lessonWords();if(!list.length)return;currentWordIndex=Math.max(0,Math.min(currentWordIndex,list.length-1));const w=list[currentWordIndex];
  const studyGuide=studyGuideForWord(w);if($("studyGuideCat"))$("studyGuideCat").src=studyGuide.src;if($("studyGuideName"))$("studyGuideName").textContent=studyGuide.name;if($("studyGuideSpeech"))$("studyGuideSpeech").textContent=studyGuide.line;if($("studyGuidePanel"))$("studyGuidePanel").dataset.guide=studyGuide.theme;if($("studyCard"))$("studyCard").dataset.type=w.type;
  const lesson=LESSONS.find(x=>x.id===currentLesson),lp=lessonProgress(lesson);
  $("lessonProgressTitle").textContent=`${lesson.ce} · ${lesson.title} (${lp.learned}/${lp.total})`;
  $("lessonProgressText").textContent=`${lp.percent}%`;
  $("lessonProgressBar").style.width=`${lp.percent}%`;
  $("studyCount").textContent=`${currentWordIndex+1}/${list.length}`;$("studyEmoji").textContent=w.emoji||"🐾";$("studyWord").textContent=wordLabel(w);$("studyMeaning").textContent=w.meaning;$("studyType").textContent=genderLabel(w);
  $("studyFormLabel").textContent=w.type==="noun"?"복수형":w.type==="verb"?"현재형 활용":"여성형 / 복수형";
  $("studyForm").textContent=w.type==="noun"?pluralLabel(w):w.type==="verb"?"아래 활용표":`${w.feminine||w.word} / ${w.plural||"—"}`;
  $("studyExampleFr").textContent=w.example;$("studyExampleKr").textContent=w.note?`${w.exampleKr} · 💡 ${w.note}`:w.exampleKr;$("conjugationBox").innerHTML="";
  if(w.type==="verb"&&w.conjugation){$("conjugationBox").classList.remove("hidden");Object.entries(w.conjugation).forEach(([p,v])=>{const d=document.createElement("div");d.innerHTML=`<small>${({je:"je",tu:"tu",ilElle:"il/elle",nous:"nous",vous:"vous",ilsElles:"ils/elles"}[p]||p)}</small><b>${v}</b>`;$("conjugationBox").appendChild(d)})}else $("conjugationBox").classList.add("hidden")
}
window.studyPrev=()=>{currentWordIndex=Math.max(0,currentWordIndex-1);renderStudy()};
window.studyNext=()=>{currentWordIndex=Math.min(lessonWords().length-1,currentWordIndex+1);renderStudy()};
window.playStudyAudio=(kind,slow=false)=>{const w=lessonWords()[currentWordIndex];speakFrench(kind==="example"?w.example:wordLabel(w),slow)};

function selectDailyWords(){
  const due=getDueWords(WORDS,progress),unseen=WORDS.filter(w=>!progress.words[String(w.id)]),chosen=[];
  [...shuffled(due),...shuffled(unseen),...shuffled(WORDS)].forEach(w=>{if(chosen.length<10&&!chosen.some(x=>x.id===w.id))chosen.push(w)});
  return chosen
}
window.startDaily=()=>{quiz={items:selectDailyWords(),index:0,skill:"meaning",answered:false,daily:true,combo:0,retryQueue:[],retryCount:{}};showScreen("quizScreen");renderQuiz()};
window.startQuiz=skill=>{
  let pool=lessonWords();
  if(skill==="article") pool=pool.filter(w=>w.type==="noun");
  if(skill==="form") pool=pool.filter(w=>w.type==="noun"||w.type==="verb"||w.type==="adjective");
  if(!pool.length) pool=WORDS.filter(w=>skill!=="article"||w.type==="noun");
  quiz={items:shuffled(pool).slice(0,8),index:0,skill,answered:false,daily:false,combo:0,retryQueue:[],retryCount:{}};showScreen("quizScreen");renderQuiz()
};

function renderQuiz(){
  quiz.answered=false;const q=quiz.items[quiz.index];if(!q)return;
  if(q.__retrySkill) quiz.skill=q.__retrySkill; else if(quiz.daily)quiz.skill=["meaning","article","form","listening","example"][quiz.index%5];
  const question=makeQuestion(q,quiz.skill);quiz.currentQuestion=question;quiz.activeSkill=question.skill;
  const current=quiz.index+1,total=quiz.items.length;
  $("quizCount").textContent=`${current}/${total}`;$("quizProgressBar").style.width=`${(current/total)*100}%`;
  $("quizStars").textContent=progress.stars;$("quizFeedback").textContent="";$("quizFeedback").className="feedback";const reaction=$("quizReaction");if(reaction){reaction.className="quiz-reaction hidden";reaction.textContent="✨"}$("quizCat").classList.remove("react-correct","react-wrong","motion-wave","motion-look","motion-hop");
  $("quizNext").classList.add("hidden");$("quizExample").classList.add("hidden");
  const guide=guideFor(question.skill);$("quizCat").src=guide.src;$("quizCat").dataset.state="idle";$("quizCatName").textContent=guide.name;$("quizGuideLine").textContent=guide.line;const guidePanel=document.querySelector(".quiz-guide-panel");if(guidePanel)guidePanel.dataset.guide=guide.theme||"petit";const quizScreen=$("quizScreen");if(quizScreen)quizScreen.dataset.skill=question.skill;
  $("quizWord").textContent=question.display;$("quizLabel").textContent=`${question.label} · ${DIFFICULTY_LABELS[question.difficulty]}`;
  const audioPanel=$("quizAudioPanel");audioPanel.classList.toggle("hidden",question.skill!=="listening"&&question.skill!=="example");
  if($("audioHint")) $("audioHint").textContent=question.skill==="listening"?(question.audioKind==="sentence"?"문장을 끝까지 듣고 골라 보세요":"처음에는 보통 속도로 들어 보세요"):"문장 발음을 확인해 보세요";
  const box=$("quizOptions");box.innerHTML="";
  question.options.forEach((o,index)=>{const b=document.createElement("button");b.className="quiz-option";b.dataset.correct=String(o.ok);b.innerHTML=`<span class="option-letter">${String.fromCharCode(65+index)}</span><span class="option-text"></span>`;b.querySelector(".option-text").textContent=o.label;b.onclick=()=>answerQuiz(o.ok,b,q);box.appendChild(b)});
  if(question.skill==="listening")setTimeout(()=>playCurrentQuizAudio(false,true),420)
}
function showCharacterReaction(ok,skill,combo=0){
  const cat=$("quizCat"),reaction=$("quizReaction"),line=$("quizGuideLine");
  if(!cat||!reaction)return;
  cat.classList.remove("react-correct","react-wrong");
  void cat.offsetWidth;
  cat.classList.add(ok?"react-correct":"react-wrong");
  setQuizCharacterState(ok?"happy":"think");
  reaction.textContent=ok?(combo>=5?"🏆":"✨"):(skill==="listening"?"👂":"💡");
  reaction.className=`quiz-reaction ${ok?"is-correct":"is-wrong"}`;
  const success={meaning:"Très bien! 단어 뜻을 정확히 찾았어냥!",article:"Bravo! 관사와 명사의 성을 잘 구별했어냥!",form:"Parfait! 단어 형태 변화를 잘 찾았어냥!",listening:"Super! 소리를 아주 잘 들었어냥!",example:"Excellent! 문장 속 단서를 잘 읽었어냥!"};
  const retry={meaning:"괜찮아! 비슷한 뜻을 다시 비교해 보자냥.",article:"관사와 명사의 성을 한 번 더 확인해 보자냥.",form:"단수·복수와 주어를 다시 살펴보자냥.",listening:"한 번 더 들으면 분명히 찾을 수 있어냥!",example:"장소·시간·상태 단어를 차근차근 비교해 보자냥."};
  if(line)line.textContent=(ok?success:retry)[skill]||(ok?"Bravo!":"다시 한번 살펴보자냥!");
  setTimeout(()=>reaction.classList.add("fade"),1500);
}
function answerQuiz(ok,button,q){
  if(quiz.answered)return;quiz.answered=true;progress.totals.attempts++;progress.skillTotals[quiz.activeSkill].a++;
  const optionButtons=[...document.querySelectorAll("#quizOptions .quiz-option")];
  optionButtons.forEach(b=>{b.disabled=true;if(b.dataset.correct==="true")b.classList.add("correct-answer")});
  const feedback=$("quizFeedback");
  if(ok){button.classList.add("correct");progress.totals.correct++;progress.skillTotals[quiz.activeSkill].c++;quiz.combo++;progress.bestCombo=Math.max(progress.bestCombo||0,quiz.combo);progress.stars+=10+(quiz.combo>=3?2:0);feedback.classList.add("success");feedback.textContent=quiz.combo>=3?`정답! ${quiz.combo}연속 ⭐`:"정답! Bravo! ⭐";showCharacterReaction(true,quiz.activeSkill,quiz.combo);const earned=grantQuizIngredient(quiz.activeSkill,quiz.combo);if(earned.length){const text=rewardText(earned);feedback.textContent+=` · ${text}`;showRewardToast(`재료 획득! ${text}`)}}
  else{button.classList.add("wrong");quiz.combo=0;feedback.classList.add("error");feedback.textContent=`정답은 “${quiz.currentQuestion?.answer||q.meaning}”`;showCharacterReaction(false,quiz.activeSkill,0)}
  const mastery=updateMastery(q.id,quiz.activeSkill,ok);
  if(!ok)scheduleRetry(q,quiz.activeSkill);
  else if(mastery.level>quiz.currentQuestion.difficulty)showRewardToast(`${DIFFICULTY_LABELS[mastery.level]} 난이도로 올라갔어요!`);
  progress=recordResult(progress,q.id,ok,quiz.activeSkill);if(quiz.daily&&!q.__retry)progress.todayDone=Math.min(10,progress.todayDone+1);
  $("quizExampleFr").textContent=q.example;$("quizExampleKr").textContent=q.exampleKr;$("quizExample").classList.remove("hidden");$("quizNext").classList.remove("hidden");saveProgress();renderHome();renderProgress()
}
window.nextQuiz=()=>{quiz.index++;if(quiz.index>=quiz.items.length){if(quiz.daily&&progress.todayDone>=10&&!progress.completedDesserts.includes(todayKey())){progress.completedDesserts.push(todayKey());grantDailyIngredients();saveProgress()}showScreen("homeScreen",document.querySelector(".nav button"));return}renderQuiz()};
function playCurrentQuizAudio(slow=false,auto=false){
  const q=quiz.items[quiz.index];if(!q)return;
  const text=quiz.currentQuestion?.audioText||(quiz.activeSkill==="example"?q.example:wordLabel(q));
  const status=$("audioStatus");
  if(status)status.textContent=slow?"천천히 재생 중…":"재생 중…";
  document.querySelectorAll(".quiz-audio-btn").forEach(b=>b.classList.add("is-playing"));
  speakFrench(text,slow,()=>{document.querySelectorAll(".quiz-audio-btn").forEach(b=>b.classList.remove("is-playing"));if(status)status.textContent=auto?"한 번 더 들을 수 있어요":"다시 들을 수 있어요"});
}
window.playQuizAudio=(slow=false)=>playCurrentQuizAudio(slow,false);

function normalizeSearch(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
function renderWords(){
  const dueIds=new Set(getDueWords(WORDS,progress).map(w=>w.id)),query=normalizeSearch(wordSearch);
  const list=WORDS.filter(w=>{
    const filterOk=wordFilter==="all"||w.ce===wordFilter||(wordFilter==="due"&&dueIds.has(w.id));
    const haystack=normalizeSearch([w.word,w.article,w.meaning,w.example,w.exampleKr,w.category,genderLabel(w)].join(" "));
    return filterOk&&(!query||haystack.includes(query));
  });
  $("wordCountTop").textContent=list.length;const box=$("wordList");box.innerHTML="";$("wordEmpty").classList.toggle("hidden",list.length>0);
  list.forEach(w=>{const entry=progress.words[String(w.id)],d=document.createElement("div");d.className="word-item";d.dataset.type=w.type;d.innerHTML=`<div class="word-icon">${w.emoji||"🐾"}</div><div class="word-copy"><b>${wordLabel(w)}</b><strong>${w.meaning}</strong><small>${genderLabel(w)} · ${w.ce}</small></div><span class="badge">${entry?`복습 ${entry.stage}단계`:"새 단어"}</span><i>→</i>`;d.onclick=()=>{currentLesson=w.lesson;currentWordIndex=lessonWords(w.lesson).findIndex(x=>x.id===w.id);showScreen("studyScreen");renderLessonTabs();renderStudy()};box.appendChild(d)})
}
window.filterWords=(f,btn)=>{wordFilter=f;document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));btn.classList.add("active");renderWords()};
window.searchWords=value=>{wordSearch=value;renderWords()};
window.clearWordSearch=()=>{wordSearch="";if($("wordSearch")) $("wordSearch").value="";renderWords()};
function canCook(recipe){return Object.entries(recipe.cost).every(([id,n])=>(progress.ingredients[id]||0)>=n)}
function renderKitchen(){
  if(!RECIPES.length)return;
  const totalIngredients=Object.values(progress.ingredients||{}).reduce((a,b)=>a+(Number(b)||0),0);
  if($("ingredientTotal")) $("ingredientTotal").textContent=totalIngredients;
  if($("rewardStep")) $("rewardStep").textContent=(progress.rewardCounter||0)%2;
  if($("rewardHistory")){
    $("rewardHistory").innerHTML="";
    const history=(progress.rewardHistory||[]).slice(0,5);
    if(!history.length){$("rewardHistory").innerHTML='<div class="reward-empty">퀴즈 정답을 맞히면 여기에 재료 기록이 보여요.</div>'}
    history.forEach(r=>{const it=INGREDIENTS[r.id]||{emoji:"🎁",name:r.id};const row=document.createElement("div");row.className="reward-history-row";row.innerHTML=`<span>${it.emoji}</span><b>${it.name} +${r.amount}</b><small>${r.reason}</small>`;$("rewardHistory").appendChild(row)})
  }
  const ingredientBox=$("ingredientGrid");ingredientBox.innerHTML="";
  Object.entries(INGREDIENTS).forEach(([id,it])=>{const d=document.createElement("div");d.className="ingredient-chip";d.innerHTML=`<span>${it.emoji}</span><b>${it.name} × ${progress.ingredients[id]||0}</b><small>${it.fr}</small>`;ingredientBox.appendChild(d)});
  const list=RECIPES.filter(r=>recipeFilter==="all"||r.difficulty===recipeFilter),box=$("recipeGrid");box.innerHTML="";
  $("madeCountTop").textContent=Object.keys(progress.madeFoods||{}).length;
  const readyCount=RECIPES.filter(canCook).length;if($("readyRecipeCount"))$("readyRecipeCount").textContent=readyCount;
  const latestMade=RECIPES.find(r=>(progress.madeFoods?.[r.id]||0)>0);if($("kitchenHeroPlate"))$("kitchenHeroPlate").innerHTML=latestMade?`<img src="${latestMade.image}" alt="${latestMade.name}">`:"🍽️";
  list.forEach(r=>{const made=progress.madeFoods[r.id]||0,ready=canCook(r),d=document.createElement("article");d.className="recipe-card"+(made?" made":"")+(ready?" ready":"")+(!ready?" unavailable":"");
    const costs=Object.entries(r.cost).map(([id,n])=>{const it=INGREDIENTS[id],lack=(progress.ingredients[id]||0)<n;return `<span class="cost${lack?" lack":""}">${it.emoji} ${it.name} ${progress.ingredients[id]||0}/${n}</span>`}).join("");
    d.innerHTML=`<div class="recipe-visual"><img src="${r.image}" alt="${r.name}"><span class="difficulty">${r.difficulty}</span>${ready?'<span class="ready-ribbon">READY</span>':''}</div><div class="recipe-title"><b>${r.fr}</b><small>${r.name} · ${r.gender}</small></div><div class="cost-list">${costs}</div><button class="cook-btn" ${ready?"":"disabled"}>${made?`다시 만들기 · 완성 ${made}회`:ready?"음식 만들기":"재료가 부족해요"}</button>`;
    d.querySelector("button").onclick=()=>cookFood(r.id);box.appendChild(d)});
}
window.filterRecipes=(f,btn)=>{recipeFilter=f;document.querySelectorAll(".recipe-filters .filter").forEach(x=>x.classList.remove("active"));btn.classList.add("active");renderKitchen()};
window.cookFood=id=>{const r=RECIPES.find(x=>x.id===id);if(!r||!canCook(r))return;Object.entries(r.cost).forEach(([k,n])=>progress.ingredients[k]-=n);progress.madeFoods[r.id]=(progress.madeFoods[r.id]||0)+1;saveProgress();renderKitchen();renderCollection();renderProgress();openCookModal(r);celebrate([r.emoji,"✨","⭐","🎉"])};
function openCookModal(r){if(!r)return;$("cookResultEmoji").innerHTML=`<img src="${r.image}" alt="${r.name}">`;$("cookModalTitle").textContent=`${r.name} 완성!`;$("cookResultFr").textContent=r.fr;$("cookResultInfo").textContent=`${r.gender} · ${r.difficulty} 레시피 · 총 ${progress.madeFoods[r.id]}회 완성`;$("cookModal").classList.remove("hidden");document.body.classList.add("modal-open")}
window.closeCookModal=()=>{if($("cookModal"))$("cookModal").classList.add("hidden");document.body.classList.remove("modal-open")};
window.addEventListener("keydown",e=>{if(e.key==="Escape")closeCookModal()});

function collectionRank(found){
  if(found===RECIPES.length&&found>0)return ["🏆","프랑스 요리 마스터"];
  if(found>=10)return ["👑","그랑 셰프"];
  if(found>=5)return ["🥇","꼬마 셰프"];
  if(found>=1)return ["🥄","요리 견습생"];
  return ["🔒","첫 요리를 완성해 보세요"];
}
function renderCollection(){
  if(!RECIPES.length||!$("collectionGrid"))return;
  const found=RECIPES.filter(r=>(progress.madeFoods?.[r.id]||0)>0).length;
  const total=RECIPES.reduce((sum,r)=>sum+(progress.madeFoods?.[r.id]||0),0);
  const percent=Math.round(found/RECIPES.length*100);
  const [medal,rank]=collectionRank(found);
  $("collectionCountTop").textContent=found;$("collectionFound").textContent=found;$("collectionLocked").textContent=RECIPES.length-found;$("collectionMadeTotal").textContent=total;
  $("collectionPercent").textContent=percent;$("collectionBar").style.width=percent+"%";$("collectionMedal").textContent=medal;$("collectionRank").textContent=rank;
  const list=RECIPES.filter(r=>collectionFilter==="all"||(collectionFilter==="found"&&(progress.madeFoods?.[r.id]||0)>0)||(collectionFilter==="locked"&&!(progress.madeFoods?.[r.id]||0)));
  const box=$("collectionGrid");box.innerHTML="";
  list.forEach((r,index)=>{const count=progress.madeFoods?.[r.id]||0,found=count>0,d=document.createElement("article");d.className="collection-card "+(found?"unlocked":"locked");
    d.innerHTML=`<div class="collection-number">${String(RECIPES.indexOf(r)+1).padStart(2,"0")}</div><div class="collection-food-emoji"><img src="${r.image}" alt="${found?r.name:"잠긴 음식"}"></div><div class="collection-card-copy"><b>${found?r.fr:"???"}</b><small>${found?`${r.name} · ${r.gender}`:"아직 발견하지 못했어요"}</small>${found?`<span>${r.region} · 완성 ${count}회</span>`:"<span>재료를 모아 만들어 보세요</span>"}</div><div class="collection-status">${found?"✓":"🔒"}</div>`;
    if(found)d.onclick=()=>openCollectionModal(r);box.appendChild(d)});
}
window.filterCollection=(f,btn)=>{collectionFilter=f;document.querySelectorAll("#collectionScreen .filter").forEach(x=>x.classList.remove("active"));btn.classList.add("active");renderCollection()};
window.openCollectionModal=r=>{const count=progress.madeFoods?.[r.id]||0;$("collectionDetailEmoji").innerHTML=`<img src="${r.image}" alt="${r.name}">`;$("collectionDetailRegion").textContent=r.region.toUpperCase();$("collectionModalTitle").textContent=r.fr;$("collectionDetailKo").textContent=r.name;$("collectionDetailGender").textContent=r.gender;$("collectionDetailDesc").textContent=r.description;$("collectionDetailCount").textContent=`지금까지 ${count}회 완성했어요`;$("collectionModal").classList.remove("hidden");document.body.classList.add("modal-open")};
window.closeCollectionModal=()=>{$("collectionModal").classList.add("hidden");document.body.classList.remove("modal-open")};

function renderProgress(){
  const learned=Object.keys(progress.words).length;$("learnedWords").textContent=learned;$("totalWords").textContent=WORDS.length;$("learnedBar").style.width=(WORDS.length?learned/WORDS.length*100:0)+"%";const medal=document.querySelector(".progress-hero-medal");if(medal)medal.textContent=learned>=80?"🏆":learned>=40?"🥇":learned>=10?"🏅":"🌱";
  $("totalAttempts").textContent=progress.totals.attempts;$("totalAccuracy").textContent=progress.totals.attempts?Math.round(progress.totals.correct/progress.totals.attempts*100)+"%":"0%";$("bestCombo").textContent=progress.bestCombo||0;$("dessertCount").textContent=Object.keys(progress.madeFoods||{}).length;
  const box=$("skillStats");box.innerHTML="";Object.entries(progress.skillTotals).forEach(([k,v])=>{const d=document.createElement("div"),rate=v.a?Math.round(v.c/v.a*100):0;d.className="stat";d.innerHTML=`<span>${({meaning:"단어 뜻",article:"관사·품사",form:"형태 변화",listening:"듣기",example:"문장 이해"}[k])}</span><b>${rate}%</b><small>${v.c}/${v.a}</small>`;box.appendChild(d)})
}
window.resetProgress=()=>{if(confirm("모든 학습 기록을 초기화할까요?")){localStorage.removeItem("yeonjaeFrenchV3");localStorage.removeItem("yeonjaeFrenchV2");location.reload()}};
function renderAll(){if(!WORDS.length)return;renderHome();renderLessonTabs();renderStudy();renderWords();renderKitchen();renderCollection();renderProgress()}


/* V4.4.6 character motion controller */
function restartCharacterMotion(el,kind="wave"){
  if(!el||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  el.classList.remove("motion-wave","motion-look","motion-hop");
  void el.offsetWidth;
  el.classList.add(`motion-${kind}`);
  setTimeout(()=>el.classList.remove(`motion-${kind}`),900);
}
function startCharacterMotionLoop(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const targets=[
    [$("homeCat"),4200],
    [$("studyGuideCat"),5200],
    [$("quizCat"),4700]
  ];
  targets.forEach(([el,delay],index)=>{
    if(!el)return;
    setTimeout(()=>restartCharacterMotion(el,index===0?"hop":"wave"),700+index*260);
    setInterval(()=>{
      if(document.hidden||!el.isConnected)return;
      const kinds=index===0?["hop","look"]:["wave","look"];
      restartCharacterMotion(el,kinds[Math.floor(Math.random()*kinds.length)]);
    },delay);
  });
}
window.addEventListener("load",()=>setTimeout(startCharacterMotionLoop,500));

loadProgress();loadData().catch(e=>{$("homeSpeech").innerHTML="데이터를 불러오지 못했어요.<br>GitHub Pages에서 다시 열어 주세요.";console.error(e)});
if("serviceWorker" in navigator)window.addEventListener("load",async()=>{
  try{
    const reg=await navigator.serviceWorker.register("./service-worker.js?v=4.4.6");
    await reg.update();
  }catch(e){console.warn("서비스 워커 업데이트 실패",e)}
});
