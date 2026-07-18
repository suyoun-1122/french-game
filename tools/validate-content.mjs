import fs from 'node:fs';
const words=JSON.parse(fs.readFileSync(new URL('../data/words.json',import.meta.url),'utf8'));
const errors=[];
const ids=new Set();
for(const w of words){
  if(ids.has(w.id)) errors.push(`중복 ID: ${w.id}`); ids.add(w.id);
  for(const key of ['id','ce','lesson','category','type','word','meaning','example','exampleKr']) if(w[key]===undefined||w[key]==='') errors.push(`${w.id}: ${key} 누락`);
  if(w.type==='noun'){
    if(!w.article||!w.gender||!w.plural) errors.push(`${w.id}: 명사 정보 누락`);
    if(w.gender==='masculine'&&w.article==='une') errors.push(`${w.id}: 남성명사/une 불일치`);
    if(w.gender==='feminine'&&w.article==='un') errors.push(`${w.id}: 여성명사/un 불일치`);
  }
  const ds=w.meaningDistractors||[];
  if(ds.length<3) errors.push(`${w.id}: 뜻 오답 후보 3개 미만`);
  if(new Set(ds).size!==ds.length) errors.push(`${w.id}: 뜻 오답 중복`);
  if(ds.includes(w.meaning)) errors.push(`${w.id}: 정답이 오답 후보에 포함`);
}
if(words.length!==100) errors.push(`단어 수 ${words.length}개 (예상 100)`);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`검증 통과: 단어 ${words.length}개, ID/필수값/명사 성·관사/오답 후보 정상`);
