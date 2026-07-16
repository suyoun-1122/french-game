import { speakFrench } from "./audio.js";
import { todayKey, recordResult, getDueWords } from "./review.js";

const $=id=>document.getElementById(id);
let WORDS=[],LESSONS=[],currentLesson=1,currentWordIndex=0,wordFilter="all";
let quiz={items:[],index:0,skill:"meaning",answered:false,daily:false,combo:0};

const emptySkills=()=>({meaning:{a:0,c:0},article:{a:0,c:0},form:{a:0,c:0},listening:{a:0,c:0},example:{a:0,c:0}});
let progress={version:"3.2",stars:0,today:todayKey(),todayDone:0,completedDesserts:[],words:{},totals:{attempts:0,correct:0},skillTotals:emptySkills(),bestCombo:0};

function loadProgress(){
  try{
    const saved=JSON.parse(localStorage.getItem("yeonjaeFrenchV3")||localStorage.getItem("yeonjaeFrenchV2")||"null");
    if(saved) progress={...progress,...saved,totals:{...progress.totals,...(saved.totals||{})},skillTotals:{...emptySkills(),...(saved.skillTotals||{})},words:saved.words||{},completedDesserts:Array.isArray(saved.completedDesserts)?saved.completedDesserts:[]};
  }catch(e){}
  if(progress.today!==todayKey()){progress.today=todayKey();progress.todayDone=0;saveProgress()}
}
function saveProgress(){localStorage.setItem("yeonjaeFrenchV3",JSON.stringify(progress))}
async function loadData(){
  const [w,l]=await Promise.all([fetch("./data/words.json?v=3.2").then(r=>r.json()),fetch("./data/lessons.json?v=3.2").then(r=>r.json())]);
  WORDS=w;LESSONS=l.lessons;renderAll();
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
const uniqueOptions=(items,correct)=>{
  const seen=new Set(),out=[];
  [correct,...items].forEach(label=>{if(label&& !seen.has(label)){seen.add(label);out.push({label,ok:label===correct})}});
  return shuffled(out).slice(0,4);
};
function makeQuestion(q,skill){
  const sameLesson=shuffled(WORDS.filter(w=>w.id!==q.id&&w.lesson===q.lesson));
  const sameType=shuffled(WORDS.filter(w=>w.id!==q.id&&w.type===q.type));
  const fallback=shuffled(WORDS.filter(w=>w.id!==q.id));
  const nearby=[...sameLesson,...sameType,...fallback].filter((w,i,a)=>a.findIndex(x=>x.id===w.id)===i);
  if(skill==="meaning"||skill==="listening"){
    const correct=`${q.emoji||"🐾"} ${q.meaning}`;
    return {label:skill==="listening"?"프랑스어 발음을 듣고 뜻을 고르세요":"알맞은 뜻을 고르세요",display:skill==="listening"?"🔊 소리를 듣고 고르세요":wordLabel(q),options:uniqueOptions(nearby.slice(0,8).map(w=>`${w.emoji||"🐾"} ${w.meaning}`),correct),answer:q.meaning};
  }
  if(skill==="article"){
    if(q.type==="noun"){
      const correct=q.gender==="masculine"?"남성명사 (nom masculin)":"여성명사 (nom féminin)";
      return {label:"관사와 품사를 함께 확인하세요",display:wordLabel(q),options:uniqueOptions(["형용사 (adjectif)","동사 (verbe)",q.gender==="masculine"?"여성명사 (nom féminin)":"남성명사 (nom masculin)"],correct),answer:correct};
    }
    const correct=genderLabel(q);
    return {label:"프랑스어 품사 표현까지 확인하세요",display:q.word,options:uniqueOptions(["형용사 (adjectif)","동사 (verbe)","남성명사 (nom masculin)","여성명사 (nom féminin)"].filter(x=>x!==correct),correct),answer:correct};
  }
  if(skill==="form"){
    if(q.type==="noun"){
      const correct=pluralLabel(q);
      const definite=q.gender==="masculine"?`le ${q.word}`:`la ${q.word}`;
      return {label:"부정관사 복수형으로 바꾸세요",display:`${q.article} ${q.word} → ?`,options:uniqueOptions([`${q.article} ${q.word}`,definite,q.plural,`les ${q.plural}`],correct),answer:correct};
    }
    if(q.type==="adjective"){
      const f=adjectiveForms(q),variants=[
        {label:"여성 단수형",sentence:`La fille est _____.`,correct:f.fs},
        {label:"여성 복수형",sentence:`Les filles sont _____.`,correct:f.fp},
        {label:"남성 복수형",sentence:`Les garçons sont _____.`,correct:f.mp},
        {label:"남성 단수형",sentence:`Le garçon est _____.`,correct:f.ms}
      ];
      const v=variants[(q.id+quiz.index)%variants.length];
      return {label:`문장에 맞는 형용사 형태를 고르세요 · ${v.label}`,display:`${q.word} (${q.meaning})
${v.sentence}`,options:uniqueOptions([f.ms,f.fs,f.mp,f.fp],v.correct),answer:v.correct};
    }
    const keys=["je","nous","vous","ilsElles"],key=keys[(q.id+quiz.index)%keys.length],pronoun={je:"je",nous:"nous",vous:"vous",ilsElles:"ils/elles"}[key];
    const correct=q.conjugation?.[key]||q.word;
    const forms=Object.values(q.conjugation||{}).filter(x=>x&&x!=="—");
    return {label:`${pronoun} 주어에 맞는 현재형을 고르세요`,display:`${q.word} → ${pronoun} ...`,options:uniqueOptions(forms,correct),answer:correct};
  }
  const candidates=nearby.filter(w=>w.exampleKr).slice(0,10);
  return {label:"문장의 뜻을 고르세요",display:q.example,options:uniqueOptions(candidates.map(w=>w.exampleKr),q.exampleKr),answer:q.exampleKr};
}

function renderHome(){
  const level=Math.floor((Number(progress.stars)||0)/100)+1,xp=(Number(progress.stars)||0)%100;
  $("starsTop").textContent=progress.stars;$("levelNumber").textContent=level;$("xpCurrent").textContent=xp;$("xpBar").style.width=xp+"%";
  $("todayDone").textContent=progress.todayDone;$("todayBar").style.width=(progress.todayDone*10)+"%";
  $("todayLabel").textContent=new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",weekday:"short"}).format(new Date());
  const stage=Math.min(5,Math.floor(progress.todayDone/2));$("foodImage").src=`./assets/foods/stage-${stage}.svg`;
  if(progress.todayDone>=10){$("homeSpeech").innerHTML="Bravo!<br>오늘의 학습을 모두 마쳤어.";$("homeCat").src="./assets/cat/cat-happy.svg"}
  else if(progress.todayDone>0){$("homeSpeech").innerHTML=`Très bien!<br>${10-progress.todayDone}문제만 더 풀어 보자.`;$("homeCat").src="./assets/cat/cat-default.svg"}
  else{$("homeSpeech").innerHTML="Bonjour, Yeonjae!<br>오늘의 프랑스어를 시작해 보자.";$("homeCat").src="./assets/cat/cat-default.svg"}
}
function renderLessonTabs(){
  const box=$("lessonTabs");box.innerHTML="";
  LESSONS.forEach(l=>{const b=document.createElement("button");b.className="lesson-tab"+(l.id===currentLesson?" active":"");b.textContent=`${l.ce} · ${l.title}`;b.onclick=()=>{currentLesson=l.id;currentWordIndex=0;renderLessonTabs();renderStudy()};box.appendChild(b)})
}
function renderStudy(){
  const list=lessonWords();if(!list.length)return;currentWordIndex=Math.max(0,Math.min(currentWordIndex,list.length-1));const w=list[currentWordIndex];
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
window.startQuiz=skill=>{quiz={items:shuffled(lessonWords()).slice(0,8),index:0,skill,answered:false,daily:false,combo:0};showScreen("quizScreen");renderQuiz()};

function renderQuiz(){
  quiz.answered=false;const q=quiz.items[quiz.index];if(!q)return;
  if(quiz.daily)quiz.skill=["meaning","article","form","listening","example"][quiz.index%5];
  const question=makeQuestion(q,quiz.skill);quiz.currentQuestion=question;
  $("quizCount").textContent=`${quiz.index+1}/${quiz.items.length}`;$("quizStars").textContent=progress.stars;$("quizFeedback").textContent="";$("quizNext").classList.add("hidden");$("quizExample").classList.add("hidden");$("quizCat").src="./assets/cat/cat-think.svg";
  $("quizEmoji").textContent=q.emoji||"🐾";$("quizWord").textContent=question.display;$("quizLabel").textContent=question.label;
  const box=$("quizOptions");box.innerHTML="";question.options.forEach(o=>{const b=document.createElement("button");b.className="quiz-option";b.textContent=o.label;b.onclick=()=>answerQuiz(o.ok,b,q);box.appendChild(b)});
  if(quiz.skill==="listening")setTimeout(()=>speakFrench(wordLabel(q)),350)
}
function answerQuiz(ok,button,q){
  if(quiz.answered)return;quiz.answered=true;progress.totals.attempts++;progress.skillTotals[quiz.skill].a++;
  if(ok){button.classList.add("correct");progress.totals.correct++;progress.skillTotals[quiz.skill].c++;quiz.combo++;progress.bestCombo=Math.max(progress.bestCombo||0,quiz.combo);progress.stars+=10+(quiz.combo>=3?2:0);$("quizFeedback").textContent=quiz.combo>=3?`정답! ${quiz.combo}연속 ⭐`:"정답! Bravo! ⭐";$("quizCat").src="./assets/cat/cat-happy.svg"}
  else{button.classList.add("wrong");quiz.combo=0;$("quizFeedback").textContent=`정답: ${quiz.currentQuestion?.answer||q.meaning}`}
  progress=recordResult(progress,q.id,ok,quiz.skill);if(quiz.daily)progress.todayDone=Math.min(10,progress.todayDone+1);
  $("quizExampleFr").textContent=q.example;$("quizExampleKr").textContent=q.exampleKr;$("quizExample").classList.remove("hidden");$("quizNext").classList.remove("hidden");saveProgress();renderHome();renderProgress()
}
window.nextQuiz=()=>{quiz.index++;if(quiz.index>=quiz.items.length){if(quiz.daily&&progress.todayDone>=10&&!progress.completedDesserts.includes(todayKey())){progress.completedDesserts.push(todayKey());saveProgress()}showScreen("homeScreen",document.querySelector(".nav button"));return}renderQuiz()};
window.playQuizAudio=(slow=false)=>{const q=quiz.items[quiz.index];speakFrench(quiz.skill==="example"?q.example:wordLabel(q),slow)};

function renderWords(){
  const dueIds=new Set(getDueWords(WORDS,progress).map(w=>w.id));const list=WORDS.filter(w=>wordFilter==="all"||w.ce===wordFilter||(wordFilter==="due"&&dueIds.has(w.id)));
  $("wordCountTop").textContent=list.length;const box=$("wordList");box.innerHTML="";
  list.forEach(w=>{const entry=progress.words[String(w.id)],d=document.createElement("div");d.className="word-item";d.innerHTML=`<div class="row"><div><b>${w.emoji||"🐾"} ${wordLabel(w)}</b><div class="small">${w.meaning} · ${genderLabel(w)} · ${w.ce}</div></div><span class="badge">${entry?`복습 ${entry.stage}단계`:"새 단어"}</span></div>`;d.onclick=()=>{currentLesson=w.lesson;currentWordIndex=lessonWords(w.lesson).findIndex(x=>x.id===w.id);showScreen("studyScreen");renderLessonTabs();renderStudy()};box.appendChild(d)})
}
window.filterWords=(f,btn)=>{wordFilter=f;document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));btn.classList.add("active");renderWords()};
function renderProgress(){
  const learned=Object.keys(progress.words).length;$("learnedWords").textContent=learned;$("totalWords").textContent=WORDS.length;$("learnedBar").style.width=(WORDS.length?learned/WORDS.length*100:0)+"%";
  $("totalAttempts").textContent=progress.totals.attempts;$("totalAccuracy").textContent=progress.totals.attempts?Math.round(progress.totals.correct/progress.totals.attempts*100)+"%":"0%";$("bestCombo").textContent=progress.bestCombo||0;$("dessertCount").textContent=progress.completedDesserts.length;
  const box=$("skillStats");box.innerHTML="";Object.entries(progress.skillTotals).forEach(([k,v])=>{const d=document.createElement("div"),rate=v.a?Math.round(v.c/v.a*100):0;d.className="stat";d.innerHTML=`<span>${({meaning:"단어 뜻",article:"관사·품사",form:"형태 변화",listening:"듣기",example:"문장 이해"}[k])}</span><b>${rate}%</b><small>${v.c}/${v.a}</small>`;box.appendChild(d)})
}
window.resetProgress=()=>{if(confirm("모든 학습 기록을 초기화할까요?")){localStorage.removeItem("yeonjaeFrenchV3");localStorage.removeItem("yeonjaeFrenchV2");location.reload()}};
function renderAll(){if(!WORDS.length)return;renderHome();renderLessonTabs();renderStudy();renderWords();renderProgress()}
loadProgress();loadData().catch(e=>{$("homeSpeech").innerHTML="데이터를 불러오지 못했어요.<br>GitHub Pages에서 다시 열어 주세요.";console.error(e)});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
