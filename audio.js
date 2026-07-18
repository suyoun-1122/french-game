let cachedFrenchVoice=null;

function selectFrenchVoice(){
  if(cachedFrenchVoice)return cachedFrenchVoice;
  const voices=window.speechSynthesis?.getVoices?.()||[];
  cachedFrenchVoice=voices.find(v=>/^fr[-_](FR|CA|BE|CH)$/i.test(v.lang||""))||voices.find(v=>(v.lang||"").toLowerCase().startsWith("fr"))||null;
  return cachedFrenchVoice;
}

if(window.speechSynthesis){
  window.speechSynthesis.addEventListener?.("voiceschanged",()=>{cachedFrenchVoice=null;selectFrenchVoice()});
}

export function speakFrench(text,slow=false,onEnd=null){
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){
    alert("이 브라우저에서는 음성을 지원하지 않아요.");
    if(typeof onEnd==="function")onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(String(text||""));
  utterance.lang="fr-FR";
  utterance.rate=slow?0.60:0.82;
  utterance.pitch=1.0;
  utterance.volume=1;
  const french=selectFrenchVoice();
  if(french)utterance.voice=french;
  utterance.onend=()=>{if(typeof onEnd==="function")onEnd()};
  utterance.onerror=()=>{if(typeof onEnd==="function")onEnd()};
  window.speechSynthesis.speak(utterance);
}
