
export function speakFrench(text, slow=false){
  if(!window.speechSynthesis || !window.SpeechSynthesisUtterance){
    alert("이 브라우저에서는 음성을 지원하지 않아요.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = slow ? 0.62 : 0.84;
  utterance.pitch = 1.02;
  const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
  const french = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("fr"));
  if(french) utterance.voice = french;
  window.speechSynthesis.speak(utterance);
}
