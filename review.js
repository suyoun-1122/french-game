
export const intervals = [0,1,3,7,14,30];

export function todayKey(){
  return new Date().toISOString().slice(0,10);
}
export function addDays(dateString, days){
  const d = new Date(dateString + "T00:00:00");
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}
export function recordResult(progress, wordId, correct, skill){
  const key = String(wordId);
  const entry = progress.words[key] || {
    seen:0, correct:0, wrong:0, stage:0, due:todayKey(),
    skills:{meaning:0,article:0,form:0,listening:0,example:0}
  };
  entry.seen += 1;
  if(correct){
    entry.correct += 1;
    entry.stage = Math.min(intervals.length-1, entry.stage+1);
  }else{
    entry.wrong += 1;
    entry.stage = Math.max(0, entry.stage-1);
  }
  entry.due = addDays(todayKey(), intervals[entry.stage]);
  if(skill) entry.skills[skill] = (entry.skills[skill]||0) + (correct ? 1 : -1);
  progress.words[key] = entry;
  return progress;
}
export function getDueWords(words, progress){
  const today = todayKey();
  return words.filter(w => {
    const e = progress.words[String(w.id)];
    return e && e.due <= today;
  });
}
