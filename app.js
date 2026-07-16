
import { speakFrench } from "./audio.js";
import { todayKey, recordResult, getDueWords } from "./review.js";

const $ = id => document.getElementById(id);
let WORDS = [];
let LESSONS = [];
let currentLesson = 1;
let currentWordIndex = 0;
let quiz = {items:[],index:0,skill:"meaning",answered:false,daily:false};

let progress = {
  version:"2.1", stars:0, today:todayKey(), todayDone:0,
  completedDesserts:[], words:{}, totals:{attempts:0,correct:0},
  skillTotals:{meaning:{a:0,c:0},article:{a:0,c:0},form:{a:0,c:0},listening:{a:0,c:0},example:{a:0,c:0}}
};

function loadProgress(){
  try{
    const raw=localStorage.getItem("yeonjaeFrenchV2");
    if(raw){
      const saved=JSON.parse(raw);
      progress={
        ...progress,
        ...saved,
        totals:{...progress.totals,...(saved.totals||{})},
        skillTotals:{
          ...progress.skillTotals,
          ...(saved.skillTotals||{})
        },
        words:saved.words||{},
        completedDesserts:Array.isArray(saved.completedDesserts)?saved.completedDesserts:[]
      };
    }
  }catch(e){}
  if(progress.today!==todayKey()){
    progress.today=todayKey();
    progress.todayDone=0;
    saveProgress();
  }
}
function saveProgress(){
  localStorage.setItem("yeonjaeFrenchV2",JSON.stringify(progress));
}
async function loadData(){
  const [w,l]=await Promise.all([
    fetch("./data/words.json?v=2.1").then(r=>r.json()),
    fetch("./data/lessons.json?v=2.1").then(r=>r.json())
  ]);
  WORDS=w; LESSONS=l.lessons;
  renderAll();
}
function showScreen(id, navButton){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  $(id).classList.add("active");
  document.querySelectorAll(".nav button").forEach(b=>b.classList.remove("active"));
  if(navButton) navButton.classList.add("active");
  renderAll();
}
window.showScreen=showScreen;

function lessonWords(lessonId=currentLesson){
  const lesson=LESSONS.find(x=>x.id===lessonId);
  return lesson ? lesson.wordIds.map(id=>WORDS.find(w=>w.id===id)).filter(Boolean) : [];
}
function wordLabel(w){
  return `${w.article ? w.article+" " : ""}${w.word}`;
}
function pluralLabel(w){
  if(!w.plural) return "—";
  return w.type==="noun" ? `des ${w.plural}` : w.plural;
}
function genderLabel(w){
  if(w.type!=="noun") return w.type==="verb" ? "동사" : "형용사";
  return w.gender==="masculine" ? "남성명사" : "여성명사";
}
function renderHome(){
  const stars=Number(progress.stars)||0;
  const level=Math.floor(stars/100)+1;
  const xpCurrent=stars%100;

  $("starsTop").textContent=stars;
  $("todayDone").textContent=progress.todayDone;
  $("todayBar").style.width=`${progress.todayDone*10}%`;

  if($("levelNumber")) $("levelNumber").textContent=level;
  if($("xpCurrent")) $("xpCurrent").textContent=xpCurrent;
  if($("xpNext")) $("xpNext").textContent=100;
  if($("xpBar")) $("xpBar").style.width=`${xpCurrent}%`;
  if($("todayLabel")){
    $("todayLabel").textContent=new Intl.DateTimeFormat("ko-KR",{
      month:"long",day:"numeric",weekday:"short"
    }).format(new Date());
  }

  const stage=Math.min(5,Math.floor(progress.todayDone/2));
  $("foodImage").src=`./assets/foods/stage-${stage}.svg`;
  for(let i=1;i<=5;i++) $("ing"+i).classList.toggle("on",progress.todayDone>=i*2);

  if(progress.todayDone>=10){
    $("homeSpeech").innerHTML="Magnifique!<br>오늘의 파티스리가 완성됐어! 🧁✨";
    if($("dailyTitle")) $("dailyTitle").textContent="오늘의 컵케이크 완성!";
  }else if(progress.todayDone>0){
    $("homeSpeech").innerHTML=`Très bien!<br>완성까지 ${10-progress.todayDone}문제 남았어!`;
    if($("dailyTitle")) $("dailyTitle").textContent="컵케이크가 자라고 있어요!";
  }else{
    $("homeSpeech").innerHTML="Bonjour, Yeonjae!<br>오늘도 맛있게 프랑스어를 배워보자!";
    if($("dailyTitle")) $("dailyTitle").textContent="컵케이크를 완성해 보자!";
  }
}
function renderLessonTabs(){
  const box=$("lessonTabs"); box.innerHTML="";
  LESSONS.forEach(l=>{
    const b=document.createElement("button");
    b.className="lesson-tab"+(l.id===currentLesson?" active":"");
    b.textContent=`${l.ce} · ${l.title}`;
    b.onclick=()=>{currentLesson=l.id;currentWordIndex=0;renderStudy();renderLessonTabs()};
    box.appendChild(b);
  });
}
function renderStudy(){
  const list=lessonWords();
  if(!list.length) return;
  currentWordIndex=Math.max(0,Math.min(currentWordIndex,list.length-1));
  const w=list[currentWordIndex];
  $("studyCount").textContent=`${currentWordIndex+1}/${list.length}`;
  $("studyEmoji").textContent=w.emoji||"🐾";
  $("studyWord").textContent=wordLabel(w);
  $("studyMeaning").textContent=w.meaning;
  $("studyType").textContent=genderLabel(w);
  $("studyFormLabel").textContent=w.type==="noun"?"복수형":w.type==="verb"?"현재형 활용":"여성형 / 복수형";
  $("studyForm").textContent=w.type==="noun"?pluralLabel(w):w.type==="verb"?"활용표 보기":`${w.feminine||w.word} / ${w.plural||"—"}`;
  $("studyExampleFr").textContent=w.example;
  $("studyExampleKr").textContent=w.exampleKr;
  $("conjugationBox").innerHTML="";
  if(w.type==="verb"&&w.conjugation){
    $("conjugationBox").classList.remove("hidden");
    Object.entries(w.conjugation).forEach(([p,v])=>{
      const d=document.createElement("div");
      const label={je:"je",tu:"tu",ilElle:"il/elle",nous:"nous",vous:"vous",ilsElles:"ils/elles"}[p]||p;
      d.innerHTML=`<small>${label}</small><b>${v}</b>`;
      $("conjugationBox").appendChild(d);
    });
  }else $("conjugationBox").classList.add("hidden");
  $("studyCat").src="./assets/cat/cat-think.svg";
}
window.studyPrev=()=>{currentWordIndex--;renderStudy()};
window.studyNext=()=>{currentWordIndex++;renderStudy()};
window.playStudyAudio=(kind,slow=false)=>{
  const w=lessonWords()[currentWordIndex];
  if(kind==="word") speakFrench(wordLabel(w),slow);
  if(kind==="form"){
    if(w.type==="noun") speakFrench(pluralLabel(w),slow);
    else if(w.type==="verb") speakFrench(Object.values(w.conjugation).join(". "),slow);
    else speakFrench(`${w.feminine||w.word}. ${w.plural||w.word}`,slow);
  }
  if(kind==="example") speakFrench(w.example,slow);
};

function shuffled(array){
  const a=[...array];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
function selectDailyWords(){
  const due=getDueWords(WORDS,progress);
  const unseen=WORDS.filter(w=>!progress.words[String(w.id)]);
  const chosen=[...shuffled(due).slice(0,5),...shuffled(unseen).slice(0,5)];
  for(const w of shuffled(WORDS)){
    if(chosen.length>=10) break;
    if(!chosen.some(x=>x.id===w.id)) chosen.push(w);
  }
  return chosen.slice(0,10);
}
window.startDaily=()=>{
  quiz={items:selectDailyWords(),index:0,skill:"meaning",answered:false,daily:true};
  showScreen("quizScreen");
  renderQuiz();
};
window.startQuiz=(skill)=>{
  quiz={items:shuffled(lessonWords()).slice(0,10),index:0,skill,answered:false,daily:false};
  showScreen("quizScreen");
  renderQuiz();
};
function buildOptions(q,skill){
  if(skill==="meaning"||skill==="listening"){
    const distractors=shuffled(WORDS.filter(w=>w.id!==q.id)).slice(0,2);
    return shuffled([q,...distractors]).map(w=>({label:`${w.emoji||"🐾"} ${w.meaning}`,ok:w.id===q.id}));
  }
  if(skill==="article"){
    if(q.type!=="noun") return [{label:q.type==="verb"?"동사":"형용사",ok:true},{label:"명사",ok:false}];
    return ["un","une","des"].map(x=>({label:x,ok:x===q.article}));
  }
  if(skill==="form"){
    const correct=q.type==="noun"?pluralLabel(q):q.type==="verb"?q.conjugation.je:(q.feminine||q.word);
    const pool=shuffled(WORDS.filter(w=>w.id!==q.id)).slice(0,2).map(w=>w.type==="noun"?pluralLabel(w):w.type==="verb"?(w.conjugation?.je||w.word):(w.feminine||w.word));
    return shuffled([correct,...pool]).map(x=>({label:x,ok:x===correct}));
  }
  if(skill==="example"){
    const distractors=shuffled(WORDS.filter(w=>w.id!==q.id)).slice(0,2);
    return shuffled([q,...distractors]).map(w=>({label:w.exampleKr,ok:w.id===q.id}));
  }
}
function renderQuiz(){
  quiz.answered=false;
  const q=quiz.items[quiz.index];
  const skills=quiz.daily?["meaning","article","form","listening","example"]:null;
  if(skills) quiz.skill=skills[quiz.index%skills.length];
  $("quizCount").textContent=`${quiz.index+1}/${quiz.items.length}`;
  $("quizStars").textContent=progress.stars;
  $("quizFeedback").textContent="";
  $("quizNext").classList.add("hidden");
  $("quizExample").classList.add("hidden");
  $("quizCat").src="./assets/cat/cat-think.svg";
  $("quizEmoji").textContent=q.emoji||"🐾";
  $("quizWord").textContent=quiz.skill==="listening"?"🔊 ?":wordLabel(q);
  $("quizMeaning").textContent="";
  const labels={meaning:"뜻을 골라주세요",article:"관사 또는 품사를 골라주세요",form:"올바른 변형을 골라주세요",listening:"발음을 듣고 뜻을 골라주세요",example:"예문의 뜻을 골라주세요"};
  $("quizLabel").textContent=labels[quiz.skill];
  if(quiz.skill==="example") $("quizWord").textContent=q.example;
  const box=$("quizOptions");box.innerHTML="";
  buildOptions(q,quiz.skill).forEach(o=>{
    const b=document.createElement("button");
    b.className="quiz-option";b.textContent=o.label;
    b.onclick=()=>answerQuiz(o.ok,b,q);
    box.appendChild(b);
  });
  if(quiz.skill==="listening") setTimeout(()=>speakFrench(wordLabel(q)),300);
}
function answerQuiz(ok,button,q){
  if(quiz.answered)return;
  quiz.answered=true;
  progress.totals.attempts++;
  progress.skillTotals[quiz.skill].a++;
  if(ok){
    button.classList.add("correct");
    progress.totals.correct++;
    progress.skillTotals[quiz.skill].c++;
    progress.stars+=10;
    $("quizFeedback").textContent="정답! Bravo! ⭐";
    $("quizCat").src="./assets/cat/cat-happy.svg";
  }else{
    button.classList.add("wrong");
    $("quizFeedback").textContent=`정답: ${quiz.skill==="meaning"||quiz.skill==="listening"?q.meaning:quiz.skill==="article"?(q.article||genderLabel(q)):quiz.skill==="form"?(q.type==="noun"?pluralLabel(q):q.type==="verb"?q.conjugation.je:(q.feminine||q.word)):q.exampleKr}`;
  }
  progress=recordResult(progress,q.id,ok,quiz.skill);
  if(quiz.daily) progress.todayDone=Math.min(10,progress.todayDone+1);
  $("quizExampleFr").textContent=q.example;
  $("quizExampleKr").textContent=q.exampleKr;
  $("quizExample").classList.remove("hidden");
  $("quizNext").classList.remove("hidden");
  saveProgress();renderAll();
}
window.nextQuiz=()=>{
  quiz.index++;
  if(quiz.index>=quiz.items.length){
    if(quiz.daily&&progress.todayDone>=10&&!progress.completedDesserts.includes(todayKey())){
      progress.completedDesserts.push(todayKey());saveProgress();
    }
    showScreen("homeScreen",document.querySelector(".nav button"));
    return;
  }
  renderQuiz();
};
window.playQuizAudio=(slow=false)=>{
  const q=quiz.items[quiz.index]; speakFrench(quiz.skill==="example"?q.example:wordLabel(q),slow);
};

function renderWords(){
  const box=$("wordList");box.innerHTML="";
  WORDS.forEach(w=>{
    const entry=progress.words[String(w.id)];
    const d=document.createElement("div");d.className="word-item";
    d.innerHTML=`<div class="row"><div><b>${w.emoji||"🐾"} ${wordLabel(w)}</b><div class="small">${w.meaning} · ${genderLabel(w)}</div></div><span class="badge">${entry?`복습 ${entry.stage}단계`:"새 단어"}</span></div>`;
    d.onclick=()=>{currentLesson=w.lesson;currentWordIndex=lessonWords(w.lesson).findIndex(x=>x.id===w.id);showScreen("studyScreen");renderLessonTabs();renderStudy()};
    box.appendChild(d);
  });
}
function renderProgress(){
  const learned=Object.keys(progress.words).length;
  $("learnedWords").textContent=learned;
  $("learnedBar").style.width=`${Math.min(100,learned/500*100)}%`;
  $("totalAttempts").textContent=progress.totals.attempts;
  $("totalAccuracy").textContent=progress.totals.attempts?`${Math.round(progress.totals.correct/progress.totals.attempts*100)}%`:"0%";
  $("dessertCount").textContent=progress.completedDesserts.length;
  const skillBox=$("skillStats");skillBox.innerHTML="";
  Object.entries(progress.skillTotals).forEach(([k,v])=>{
    const names={meaning:"단어 뜻",article:"관사",form:"변형",listening:"듣기",example:"예문"};
    const rate=v.a?Math.round(v.c/v.a*100):0;
    const d=document.createElement("div");d.className="stat";d.innerHTML=`<span>${names[k]}</span><b>${rate}%</b><small>${v.c}/${v.a}</small>`;skillBox.appendChild(d);
  });
}
function renderAll(){
  renderHome();renderLessonTabs();renderStudy();renderWords();renderProgress();
}
loadProgress();
loadData().catch(err=>{
  console.error(err);
  $("homeSpeech").innerHTML="데이터를 불러오지 못했어요.<br>GitHub Pages에서 다시 열어주세요.";
});
