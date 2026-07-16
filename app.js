import { speakFrench } from "./audio.js";
import { todayKey, recordResult, getDueWords } from "./review.js";

const $=id=>document.getElementById(id);
let WORDS=[],LESSONS=[],currentLesson=1,currentWordIndex=0,wordFilter="all";
let quiz={items:[],index:0,skill:"meaning",answered:false,daily:false,combo:0};

const emptySkills=()=>({meaning:{a:0,c:0},article:{a:0,c:0},form:{a:0,c:0},listening:{a:0,c:0},example:{a:0,c:0}});
let progress={version:"3.0",stars:0,today:todayKey(),todayDone:0,completedDesserts:[],words:{},totals:{attempts:0,correct:0},skillTotals:emptySkills(),bestCombo:0};

function loadProgress(){
  try{
    const saved=JSON.parse(localStorage.getItem("yeonjaeFrenchV3")||localStorage.getItem("yeonjaeFrenchV2")||"null");
    if(saved) progress={...progress,...saved,totals:{...progress.totals,...(saved.totals||{})},skillTotals:{...emptySkills(),...(saved.skillTotals||{})},words:saved.words||{},completedDesserts:Array.isArray(saved.completedDesserts)?saved.completedDesserts:[]};
  }catch(e){}
  if(progress.today!==todayKey()){progress.today=todayKey();progress.todayDone=0;saveProgress()}
}
function saveProgress(){localStorage.setItem("yeonjaeFrenchV3",JSON.stringify(progress))}
async function loadData(){
  const [w,l]=await Promise.all([fetch("./data/words.json?v=3").then(r=>r.json()),fetch("./data/lessons.json?v=3").then(r=>r.json())]);
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
const genderLabel=w=>w.type==="noun"?(w.gender==="masculine"?"남성명사 (nom masculin)":"여성명사 (nom féminin)"):w.type==="verb"?"동사":"형용사 (adjectif)";

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

function buildOptions(q,skill){
  const other=shuffled(WORDS.filter(w=>w.id!==q.id));
  if(skill==="meaning"||skill==="listening")return shuffled([q,...other.slice(0,3)]).map(w=>({label:`${w.emoji||"🐾"} ${w.meaning}`,ok:w.id===q.id}));
  if(skill==="article"){if(q.type!=="noun")return shuffled([{label:genderLabel(q),ok:true},{label:"남성명사 (nom masculin)",ok:false},{label:"여성명사 (nom féminin)",ok:false}]);return ["un","une","des"].map(x=>({label:x,ok:x===q.article}))}
  if(skill==="form"){const correct=q.type==="noun"?pluralLabel(q):q.type==="verb"?q.conjugation.je:(q.feminine||q.word);const pool=other.slice(0,3).map(w=>w.type==="noun"?pluralLabel(w):w.type==="verb"?(w.conjugation?.je||w.word):(w.feminine||w.word));return shuffled([correct,...pool]).map((x,i,a)=>({label:x,ok:x===correct&&a.findIndex(y=>y===x)===i})).filter((x,i,a)=>a.findIndex(y=>y.label===x.label)===i)}
  return shuffled([q,...other.slice(0,3)]).map(w=>({label:w.exampleKr,ok:w.id===q.id}))
}
function correctText(q){
  if(quiz.skill==="meaning"||quiz.skill==="listening")return q.meaning;
  if(quiz.skill==="article")return q.article||genderLabel(q);
  if(quiz.skill==="form")return q.type==="noun"?pluralLabel(q):q.type==="verb"?q.conjugation.je:(q.feminine||q.word);
  return q.exampleKr
}
function renderQuiz(){
  quiz.answered=false;const q=quiz.items[quiz.index];if(!q)return;
  if(quiz.daily)quiz.skill=["meaning","article","form","listening","example"][quiz.index%5];
  $("quizCount").textContent=`${quiz.index+1}/${quiz.items.length}`;$("quizStars").textContent=progress.stars;$("quizFeedback").textContent="";$("quizNext").classList.add("hidden");$("quizExample").classList.add("hidden");$("quizCat").src="./assets/cat/cat-think.svg";
  $("quizEmoji").textContent=q.emoji||"🐾";$("quizWord").textContent=quiz.skill==="listening"?"🔊 소리를 듣고 고르세요":quiz.skill==="example"?q.example:wordLabel(q);
  $("quizLabel").textContent=({meaning:"알맞은 뜻을 고르세요",article:"관사 또는 품사를 고르세요",form:"올바른 형태를 고르세요",listening:"프랑스어 발음을 듣고 뜻을 고르세요",example:"문장의 뜻을 고르세요"}[quiz.skill]);
  const box=$("quizOptions");box.innerHTML="";buildOptions(q,quiz.skill).forEach(o=>{const b=document.createElement("button");b.className="quiz-option";b.textContent=o.label;b.onclick=()=>answerQuiz(o.ok,b,q);box.appendChild(b)});
  if(quiz.skill==="listening")setTimeout(()=>speakFrench(wordLabel(q)),350)
}
function answerQuiz(ok,button,q){
  if(quiz.answered)return;quiz.answered=true;progress.totals.attempts++;progress.skillTotals[quiz.skill].a++;
  if(ok){button.classList.add("correct");progress.totals.correct++;progress.skillTotals[quiz.skill].c++;quiz.combo++;progress.bestCombo=Math.max(progress.bestCombo||0,quiz.combo);progress.stars+=10+(quiz.combo>=3?2:0);$("quizFeedback").textContent=quiz.combo>=3?`정답! ${quiz.combo}연속 ⭐`:"정답! Bravo! ⭐";$("quizCat").src="./assets/cat/cat-happy.svg"}
  else{button.classList.add("wrong");quiz.combo=0;$("quizFeedback").textContent=`정답: ${correctText(q)}`}
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
