import { speakFrench } from "./audio.js";
import { todayKey, recordResult, getDueWords } from "./review.js";

const $=id=>document.getElementById(id);
let WORDS=[],LESSONS=[],RECIPES=[],INGREDIENTS={},currentLesson=1,currentWordIndex=0,wordFilter="all",wordSearch="",recipeFilter="all";
let quiz={items:[],index:0,skill:"meaning",answered:false,daily:false,combo:0};

const emptySkills=()=>({meaning:{a:0,c:0},article:{a:0,c:0},form:{a:0,c:0},listening:{a:0,c:0},example:{a:0,c:0}});
let progress={version:"3.4",stars:0,today:todayKey(),todayDone:0,completedDesserts:[],ingredients:{flour:0,butter:0,egg:0,milk:0,sugar:0,cheese:0,vegetable:0,meat:0,fish:0,fruit:0},madeFoods:{},rewardedDays:[],words:{},totals:{attempts:0,correct:0},skillTotals:emptySkills(),bestCombo:0};

function loadProgress(){
  try{
    const saved=JSON.parse(localStorage.getItem("yeonjaeFrenchV3")||localStorage.getItem("yeonjaeFrenchV2")||"null");
    if(saved) progress={...progress,...saved,totals:{...progress.totals,...(saved.totals||{})},skillTotals:{...emptySkills(),...(saved.skillTotals||{})},ingredients:{...progress.ingredients,...(saved.ingredients||{})},madeFoods:saved.madeFoods||{},rewardedDays:Array.isArray(saved.rewardedDays)?saved.rewardedDays:[],words:saved.words||{},completedDesserts:Array.isArray(saved.completedDesserts)?saved.completedDesserts:[]};
  }catch(e){}
  if(progress.today!==todayKey()){progress.today=todayKey();progress.todayDone=0;saveProgress()}
}
function saveProgress(){localStorage.setItem("yeonjaeFrenchV3",JSON.stringify(progress))}
async function loadData(){
  const [w,l,r]=await Promise.all([fetch("./data/words.json?v=3.4").then(r=>r.json()),fetch("./data/lessons.json?v=3.4").then(r=>r.json()),fetch("./data/recipes.json?v=3.4").then(r=>r.json())]);
  WORDS=w;LESSONS=l.lessons;RECIPES=r.recipes;INGREDIENTS=r.ingredients;renderAll();
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
  const seen=new Set(),out=[];
  shuffled([correct,...items]).forEach(label=>{if(label && !seen.has(label)){seen.add(label);out.push({label,ok:label===correct})}});
  if(!out.some(x=>x.ok)) out.unshift({label:correct,ok:true});
  return shuffled(out).slice(0,4);
};
const semanticPool=q=>{
  const category=WORDS.filter(w=>w.id!==q.id&&w.category===q.category);
  const lesson=WORDS.filter(w=>w.id!==q.id&&w.lesson===q.lesson);
  const type=WORDS.filter(w=>w.id!==q.id&&w.type===q.type);
  return [...shuffled(category),...shuffled(lesson),...shuffled(type),...shuffled(WORDS.filter(w=>w.id!==q.id))]
    .filter((w,i,a)=>a.findIndex(x=>x.id===w.id)===i);
};
function normalizedSkill(q,skill){
  if(skill==="article"&&q.type!=="noun") return "form";
  return skill;
}
function makeQuestion(q,requestedSkill){
  const skill=normalizedSkill(q,requestedSkill),nearby=semanticPool(q);
  if(skill==="meaning"||skill==="listening"){
    const correct=q.meaning;
    return {skill,label:skill==="listening"?"프랑스어 발음을 듣고 가장 알맞은 뜻을 고르세요":"가장 알맞은 뜻을 고르세요",display:skill==="listening"?"🔊 소리를 듣고 고르세요":wordLabel(q),options:uniqueOptions(nearby.slice(0,12).map(w=>w.meaning),correct),answer:correct};
  }
  if(skill==="article"){
    const correct=wordLabel(q);
    const wrongArticle=q.article==="un"?"une":"un";
    const plural=`des ${q.plural||q.word}`;
    const definite=`${q.gender==="masculine"?"le":"la"} ${q.word}`;
    return {skill,label:`알맞은 관사와 명사를 고르세요 · ${genderLabel(q)}`,display:q.word,options:uniqueOptions([`${wrongArticle} ${q.word}`,plural,definite],correct),answer:correct};
  }
  if(skill==="form"){
    if(q.type==="noun"){
      const correct=pluralLabel(q);
      const wrongArticle=q.article==="un"?"une":"un";
      return {skill,label:"단수 명사를 부정관사 복수형으로 바꾸세요",display:`${q.article} ${q.word} → ?`,options:uniqueOptions([`les ${q.plural}`,`${wrongArticle} ${q.word}`,q.plural],correct),answer:correct};
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
      return {skill,label:`문장에 맞는 형용사 형태를 고르세요 · ${v.label}`,display:`${q.word} (${q.meaning})\n${v.sentence}`,options:uniqueOptions(options,v.correct),answer:v.correct};
    }
    const keys=["je","tu","nous","vous","ilsElles"],key=keys[(q.id+quiz.index)%keys.length],pronoun={je:"je",tu:"tu",nous:"nous",vous:"vous",ilsElles:"ils/elles"}[key];
    const correct=stripPronoun(q.conjugation?.[key]||q.word);
    const ownForms=Object.values(q.conjugation||{}).map(stripPronoun).filter(x=>x&&x!=="—");
    const closeForms=nearby.filter(w=>w.type==="verb").flatMap(w=>Object.values(w.conjugation||{}).map(stripPronoun));
    return {skill,label:`주어 ${pronoun}에 맞는 현재형을 고르세요`,display:`${q.word} → ${pronoun} ...`,options:uniqueOptions([...ownForms,...closeForms],correct),answer:correct};
  }
  const sameContext=nearby.filter(w=>w.exampleKr&&w.category===q.category);
  const lessonContext=nearby.filter(w=>w.exampleKr&&w.lesson===q.lesson);
  const distractors=[...sameContext,...lessonContext,...nearby].map(w=>w.exampleKr).filter(Boolean);
  return {skill,label:"문장의 뜻을 정확하게 고르세요",display:q.example,options:uniqueOptions(distractors,q.exampleKr),answer:q.exampleKr};
}

const CAT_GUIDES={
  meaning:{name:"쁘띠냥 · Petit",src:"./assets/characters/petit.svg",line:"단어의 뜻을 차근차근 찾아보자냥!"},
  article:{name:"쁘띠냥 · Petit",src:"./assets/characters/petit.svg",line:"관사와 명사의 성을 함께 확인하자냥!"},
  form:{name:"쁘띠냥 · Petit",src:"./assets/characters/petit.svg",line:"형태가 어떻게 바뀌는지 살펴보자냥!"},
  listening:{name:"치즈냥 · Fromage",src:"./assets/characters/fromage.svg",line:"귀를 쫑긋! 소리를 잘 들어보자냥!"},
  example:{name:"라벤더냥 · Lavande",src:"./assets/characters/lavande.svg",line:"문장 속 단서를 찾아 읽어보자냥!"}
};
function guideFor(skill){return CAT_GUIDES[skill]||CAT_GUIDES.meaning}
function showRewardToast(text){const old=document.querySelector(".reward-toast");if(old)old.remove();const el=document.createElement("div");el.className="reward-toast";el.textContent=text;document.body.appendChild(el);setTimeout(()=>el.remove(),2800)}
function grantDailyIngredients(){
  const key=todayKey();if(progress.rewardedDays.includes(key))return false;
  const pool=["flour","butter","egg","milk","sugar","cheese","vegetable","meat","fish","fruit"];
  const rewards=shuffled(pool).slice(0,4);rewards.forEach((id,i)=>progress.ingredients[id]=(progress.ingredients[id]||0)+(i===0?2:1));
  progress.rewardedDays.push(key);saveProgress();showRewardToast("오늘의 보상! 프랑스 요리 재료를 받았어요 🎁");return true
}

function renderHome(){
  const level=Math.floor((Number(progress.stars)||0)/100)+1,xp=(Number(progress.stars)||0)%100;
  $("starsTop").textContent=progress.stars;$("levelNumber").textContent=level;$("xpCurrent").textContent=xp;$("xpBar").style.width=xp+"%";
  $("todayDone").textContent=progress.todayDone;$("todayBar").style.width=(progress.todayDone*10)+"%";
  $("todayLabel").textContent=new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",weekday:"short"}).format(new Date());
  const stage=Math.min(5,Math.floor(progress.todayDone/2));$("foodImage").src=`./assets/foods/stage-${stage}.svg`;
  if(progress.todayDone>=10){$("homeSpeech").innerHTML="Bravo!<br>오늘의 학습을 모두 마쳤어.";$("homeCat").src="./assets/characters/fromage.svg"}
  else if(progress.todayDone>0){$("homeSpeech").innerHTML=`Très bien!<br>${10-progress.todayDone}문제만 더 풀어 보자.`;$("homeCat").src="./assets/characters/petit.svg"}
  else{$("homeSpeech").innerHTML="Bonjour, Yeonjae!<br>오늘의 프랑스어를 시작해 보자.";$("homeCat").src="./assets/characters/petit.svg"}
}
function lessonProgress(lesson){
  const learned=lesson.wordIds.filter(id=>progress.words[String(id)]).length;
  return {learned,total:lesson.wordIds.length,percent:lesson.wordIds.length?Math.round(learned/lesson.wordIds.length*100):0};
}
function renderLessonTabs(){
  const box=$("lessonTabs");box.innerHTML="";
  LESSONS.forEach(l=>{const p=lessonProgress(l),b=document.createElement("button");b.className="lesson-tab"+(l.id===currentLesson?" active":"");b.innerHTML=`<span>${l.ce} · ${l.title}</span><small>${p.percent}%</small>`;b.onclick=()=>{currentLesson=l.id;currentWordIndex=0;renderLessonTabs();renderStudy()};box.appendChild(b)})
}
function renderStudy(){
  const list=lessonWords();if(!list.length)return;currentWordIndex=Math.max(0,Math.min(currentWordIndex,list.length-1));const w=list[currentWordIndex];
  const lesson=LESSONS.find(x=>x.id===currentLesson),lp=lessonProgress(lesson);
  $("lessonProgressTitle").textContent=`${lesson.ce} · ${lesson.title} (${lp.learned}/${lp.total})`;
  $("lessonProgressText").textContent=`${lp.percent}%`;
  $("lessonProgressBar").style.width=`${lp.percent}%`;
  $("studyCount").textContent=`${currentWordIndex+1}/${list.length}`;$("studyEmoji").textContent=w.emoji||"🐾";$("studyWord").textContent=wordLabel(w);$("studyMeaning").textContent=w.meaning;$("studyType").textContent=genderLabel(w);
  $("studyFormLabel").textContent=w.type==="noun"?"복수형":w.type==="verb"?"현재형 활용":"여성형 / 복수형";
  $("studyForm").textContent=w.type==="noun"?pluralLabel(w):w.type==="verb"?"아래 활용표":`${w.feminine||w.word} / ${w.plural||"—"}`;
  $("studyExampleFr").textContent=w.example;$("studyExampleKr").textContent=w.exampleKr;$("conjugationBox").innerHTML="";
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
window.startDaily=()=>{quiz={items:selectDailyWords(),index:0,skill:"meaning",answered:false,daily:true,combo:0};showScreen("quizScreen");renderQuiz()};
window.startQuiz=skill=>{
  let pool=lessonWords();
  if(skill==="article") pool=pool.filter(w=>w.type==="noun");
  if(skill==="form") pool=pool.filter(w=>w.type==="noun"||w.type==="verb"||w.type==="adjective");
  if(!pool.length) pool=WORDS.filter(w=>skill!=="article"||w.type==="noun");
  quiz={items:shuffled(pool).slice(0,8),index:0,skill,answered:false,daily:false,combo:0};showScreen("quizScreen");renderQuiz()
};

function renderQuiz(){
  quiz.answered=false;const q=quiz.items[quiz.index];if(!q)return;
  if(quiz.daily)quiz.skill=["meaning","article","form","listening","example"][quiz.index%5];
  const question=makeQuestion(q,quiz.skill);quiz.currentQuestion=question;quiz.activeSkill=question.skill;
  $("quizCount").textContent=`${quiz.index+1}/${quiz.items.length}`;$("quizStars").textContent=progress.stars;$("quizFeedback").textContent="";$("quizNext").classList.add("hidden");$("quizExample").classList.add("hidden");
  const guide=guideFor(question.skill);$("quizCat").src=guide.src;$("quizCatName").textContent=guide.name;
  $("quizEmoji").textContent=q.emoji||"🐾";$("quizWord").textContent=question.display;$("quizLabel").textContent=`${question.label} · ${guide.line}`;
  const box=$("quizOptions");box.innerHTML="";question.options.forEach(o=>{const b=document.createElement("button");b.className="quiz-option";b.textContent=o.label;b.onclick=()=>answerQuiz(o.ok,b,q);box.appendChild(b)});
  if(quiz.skill==="listening")setTimeout(()=>speakFrench(wordLabel(q)),350)
}
function answerQuiz(ok,button,q){
  if(quiz.answered)return;quiz.answered=true;progress.totals.attempts++;progress.skillTotals[quiz.activeSkill].a++;
  if(ok){button.classList.add("correct");progress.totals.correct++;progress.skillTotals[quiz.activeSkill].c++;quiz.combo++;progress.bestCombo=Math.max(progress.bestCombo||0,quiz.combo);progress.stars+=10+(quiz.combo>=3?2:0);$("quizFeedback").textContent=quiz.combo>=3?`정답! ${quiz.combo}연속 ⭐`:"정답! Bravo! ⭐";$("quizCat").src=guideFor(quiz.activeSkill).src}
  else{button.classList.add("wrong");quiz.combo=0;$("quizFeedback").textContent=`정답: ${quiz.currentQuestion?.answer||q.meaning}`}
  progress=recordResult(progress,q.id,ok,quiz.activeSkill);if(quiz.daily)progress.todayDone=Math.min(10,progress.todayDone+1);
  $("quizExampleFr").textContent=q.example;$("quizExampleKr").textContent=q.exampleKr;$("quizExample").classList.remove("hidden");$("quizNext").classList.remove("hidden");saveProgress();renderHome();renderProgress()
}
window.nextQuiz=()=>{quiz.index++;if(quiz.index>=quiz.items.length){if(quiz.daily&&progress.todayDone>=10&&!progress.completedDesserts.includes(todayKey())){progress.completedDesserts.push(todayKey());grantDailyIngredients();saveProgress()}showScreen("homeScreen",document.querySelector(".nav button"));return}renderQuiz()};
window.playQuizAudio=(slow=false)=>{const q=quiz.items[quiz.index];speakFrench(quiz.skill==="example"?q.example:wordLabel(q),slow)};

function normalizeSearch(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
function renderWords(){
  const dueIds=new Set(getDueWords(WORDS,progress).map(w=>w.id)),query=normalizeSearch(wordSearch);
  const list=WORDS.filter(w=>{
    const filterOk=wordFilter==="all"||w.ce===wordFilter||(wordFilter==="due"&&dueIds.has(w.id));
    const haystack=normalizeSearch([w.word,w.article,w.meaning,w.example,w.exampleKr,w.category,genderLabel(w)].join(" "));
    return filterOk&&(!query||haystack.includes(query));
  });
  $("wordCountTop").textContent=list.length;const box=$("wordList");box.innerHTML="";$("wordEmpty").classList.toggle("hidden",list.length>0);
  list.forEach(w=>{const entry=progress.words[String(w.id)],d=document.createElement("div");d.className="word-item";d.innerHTML=`<div class="row"><div><b>${w.emoji||"🐾"} ${wordLabel(w)}</b><div class="small">${w.meaning} · ${genderLabel(w)} · ${w.ce}</div></div><span class="badge">${entry?`복습 ${entry.stage}단계`:"새 단어"}</span></div>`;d.onclick=()=>{currentLesson=w.lesson;currentWordIndex=lessonWords(w.lesson).findIndex(x=>x.id===w.id);showScreen("studyScreen");renderLessonTabs();renderStudy()};box.appendChild(d)})
}
window.filterWords=(f,btn)=>{wordFilter=f;document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));btn.classList.add("active");renderWords()};
window.searchWords=value=>{wordSearch=value;renderWords()};
window.clearWordSearch=()=>{wordSearch="";if($("wordSearch")) $("wordSearch").value="";renderWords()};
function canCook(recipe){return Object.entries(recipe.cost).every(([id,n])=>(progress.ingredients[id]||0)>=n)}
function renderKitchen(){
  if(!RECIPES.length)return;
  const ingredientBox=$("ingredientGrid");ingredientBox.innerHTML="";
  Object.entries(INGREDIENTS).forEach(([id,it])=>{const d=document.createElement("div");d.className="ingredient-chip";d.innerHTML=`<span>${it.emoji}</span><b>${it.name} × ${progress.ingredients[id]||0}</b><small>${it.fr}</small>`;ingredientBox.appendChild(d)});
  const list=RECIPES.filter(r=>recipeFilter==="all"||r.difficulty===recipeFilter),box=$("recipeGrid");box.innerHTML="";
  $("madeCountTop").textContent=Object.keys(progress.madeFoods||{}).length;
  list.forEach(r=>{const made=progress.madeFoods[r.id]||0,ready=canCook(r),d=document.createElement("article");d.className="recipe-card"+(made?" made":"");
    const costs=Object.entries(r.cost).map(([id,n])=>{const it=INGREDIENTS[id],lack=(progress.ingredients[id]||0)<n;return `<span class="cost${lack?" lack":""}">${it.emoji} ${it.name} ${progress.ingredients[id]||0}/${n}</span>`}).join("");
    d.innerHTML=`<div class="recipe-head"><div class="recipe-emoji">${r.emoji}</div><span class="difficulty">${r.difficulty}</span></div><div class="recipe-title"><b>${r.fr}</b><small>${r.name} · ${r.gender}</small></div><div class="cost-list">${costs}</div><button class="cook-btn" ${ready?"":"disabled"}>${made?`다시 만들기 · 완성 ${made}회`:ready?"음식 만들기":"재료가 부족해요"}</button>`;
    d.querySelector("button").onclick=()=>cookFood(r.id);box.appendChild(d)});
}
window.filterRecipes=(f,btn)=>{recipeFilter=f;document.querySelectorAll(".recipe-filters .filter").forEach(x=>x.classList.remove("active"));btn.classList.add("active");renderKitchen()};
window.cookFood=id=>{const r=RECIPES.find(x=>x.id===id);if(!r||!canCook(r))return;Object.entries(r.cost).forEach(([k,n])=>progress.ingredients[k]-=n);progress.madeFoods[r.id]=(progress.madeFoods[r.id]||0)+1;saveProgress();showRewardToast(`${r.emoji} ${r.fr} 완성!`);renderKitchen();renderProgress()};

function renderProgress(){
  const learned=Object.keys(progress.words).length;$("learnedWords").textContent=learned;$("totalWords").textContent=WORDS.length;$("learnedBar").style.width=(WORDS.length?learned/WORDS.length*100:0)+"%";
  $("totalAttempts").textContent=progress.totals.attempts;$("totalAccuracy").textContent=progress.totals.attempts?Math.round(progress.totals.correct/progress.totals.attempts*100)+"%":"0%";$("bestCombo").textContent=progress.bestCombo||0;$("dessertCount").textContent=Object.keys(progress.madeFoods||{}).length;
  const box=$("skillStats");box.innerHTML="";Object.entries(progress.skillTotals).forEach(([k,v])=>{const d=document.createElement("div"),rate=v.a?Math.round(v.c/v.a*100):0;d.className="stat";d.innerHTML=`<span>${({meaning:"단어 뜻",article:"관사·품사",form:"형태 변화",listening:"듣기",example:"문장 이해"}[k])}</span><b>${rate}%</b><small>${v.c}/${v.a}</small>`;box.appendChild(d)})
}
window.resetProgress=()=>{if(confirm("모든 학습 기록을 초기화할까요?")){localStorage.removeItem("yeonjaeFrenchV3");localStorage.removeItem("yeonjaeFrenchV2");location.reload()}};
function renderAll(){if(!WORDS.length)return;renderHome();renderLessonTabs();renderStudy();renderWords();renderKitchen();renderProgress()}
loadProgress();loadData().catch(e=>{$("homeSpeech").innerHTML="데이터를 불러오지 못했어요.<br>GitHub Pages에서 다시 열어 주세요.";console.error(e)});
if("serviceWorker" in navigator)window.addEventListener("load",async()=>{
  try{
    const reg=await navigator.serviceWorker.register("./service-worker.js?v=3.4");
    await reg.update();
  }catch(e){console.warn("서비스 워커 업데이트 실패",e)}
});
