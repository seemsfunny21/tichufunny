/* TichuFunny single-player game controller — built on rules.js */
(function(){
'use strict';
const R=window.TichuRules;
if(!R)throw new Error('rules.js not loaded');
const $=id=>document.getElementById(id);
const KEY='tichufunny:game:v1',STAT='tichufunny:stats:v1',NAMES=['Εσύ','Νίκος (AI)','Συμπαίκτης (AI)','Μαρία (AI)'],SUITS=['♠','♥','♦','♣'];
const label=c=>c.id==='mahjong'?'🀄':c.id==='dog'?'🐕':c.id==='dragon'?'🐉':c.id==='phoenix'?'🪽':(c.r===14?'A':c.r===13?'K':c.r===12?'Q':c.r===11?'J':c.r)+SUITS[c.s];
const strength=cards=>cards.reduce((p,c)=>p+(c.id==='dragon'?5:c.id==='phoenix'?4:c.r===14?2.6:c.r===13?1.5:0),0);
const rand=(n)=>Math.floor(Math.random()*n);
const newState=()=>({phase:'grand',hands:[[],[],[],[]],extras:[[],[],[],[]],turn:0,trick:null,pile:[],passed:0,captured:[[],[],[],[]],order:[],wish:0,bids:[0,0,0,0],played:[false,false,false,false],totals:[0,0],round:1,aiLevel:1,roundSummary:''});
let g=newState(),selected=[],live=true,embedded=true,aiTimer=0,stats={games:0,won:0};
try{stats=JSON.parse(localStorage.getItem(STAT)||'null')||stats;}catch(_){}
function say(txt){$('message').textContent=txt;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(g));}catch(_){}}
function nextAlive(after){for(let i=1;i<=4;i++){const p=(after+i)%4;if(g.hands[p].length)return p;}return after;}
function deal(resetScores=false){
 clearTimeout(aiTimer);selected=[];
 const scores=resetScores?[0,0]:g.totals,round=resetScores?1:g.round+1,ai=g.aiLevel;
 g=newState();g.totals=scores;g.round=round;g.aiLevel=ai;
 const cards=R.shuffled();for(let i=0;i<4;i++){g.hands[i]=R.sortCards(cards.splice(0,8));g.extras[i]=cards.splice(0,6);}
 for(let p=1;p<4;p++)if(strength(g.hands[p])>=8&&Math.random()<.38)g.bids[p]=200;
 say('Δες τις 8 πρώτες κάρτες. Θέλεις Grand Tichu (+200 / −200);');
 render();save();
}
function grand(bet){
 if(g.phase!=='grand')return;
 if(bet)g.bids[0]=200;
 for(let i=0;i<4;i++){g.hands[i]=R.sortCards(g.hands[i].concat(g.extras[i]));g.extras[i]=[];}
 g.phase='trade';selected=[];say('Επίλεξε 3 κάρτες με τη σειρά: 1η αριστερά, 2η στον συμπαίκτη, 3η δεξιά.');
 render();save();
}
function tradeChoice(hand,recipient){
 const ordered=R.sortCards(hand);
 if(recipient===2){return ordered.find(x=>x.id==='dog')||ordered.find(x=>x.r===14)||ordered.find(x=>x.r===13)||ordered.at(-1);}
 if(recipient===1){return ordered.find(x=>x.r===2)||ordered.find(x=>x.r===3)||ordered.find(x=>x.r===4)||ordered[0];}
 return ordered.find(x=>x.r===5)||ordered.find(x=>x.r===6)||ordered[0];
}
function doTrade(){
 if(g.phase!=='trade'||selected.length!==3){say('Επίλεξε ακριβώς τρεις κάρτες για ανταλλαγή.');return;}
 const give=Array.from({length:4},()=>[]);
 give[0]=selected.slice();
 for(let p=1;p<4;p++){
  let hand=g.hands[p].slice();
  for(let offset=1;offset<=3;offset++){const pick=tradeChoice(hand,offset);give[p].push(pick.id);hand=hand.filter(c=>c.id!==pick.id);}
 }
 const received=Array.from({length:4},()=>[]);
 for(let p=0;p<4;p++)for(let offset=1;offset<=3;offset++){
  const id=give[p][offset-1],card=g.hands[p].find(c=>c.id===id);
  if(!card)throw new Error('Card missing in trade');
  received[(p+offset)%4].push(card);
 }
 for(let p=0;p<4;p++){const leave=new Set(give[p]);g.hands[p]=R.sortCards(g.hands[p].filter(c=>!leave.has(c.id)).concat(received[p]));}
 g.phase='play';g.turn=g.hands.findIndex(h=>h.some(c=>c.id==='mahjong'));selected=[];
 say('Οι ανταλλαγές ολοκληρώθηκαν. Ξεκινά ο κάτοχος του Mahjong.');
 render();save();scheduleAI();
}
function hasWishPlay(p){return g.wish&&R.legalOptions(g.hands[p],g.trick?.combo||null,g.wish).some(o=>o.cards.some(c=>R.regular(c)&&c.r===g.wish));}
function canPass(p){return g.trick&&!hasWishPlay(p);}
function playCards(p,cards){
 if(g.phase!=='play'||p!==g.turn)return false;
 const combo=R.classify(cards,g.trick?.combo||null);
 if(!combo|| (g.trick&&!R.beats(combo,g.trick.combo))|| (combo.type==='dog'&&!!g.trick))return false;
 if(g.wish&&hasWishPlay(p)&&!cards.some(c=>R.regular(c)&&c.r===g.wish))return false;
 if(!cards.every(c=>g.hands[p].some(x=>x.id===c.id)))return false;
 const ids=new Set(cards.map(c=>c.id));g.hands[p]=g.hands[p].filter(c=>!ids.has(c.id));g.played[p]=true;
 if(cards.some(c=>R.regular(c)&&c.r===g.wish))g.wish=0;
 if(cards.some(c=>c.id==='mahjong')){
  if(p===0){const wish=Number($('wish').value);g.wish=wish>=2&&wish<=14?wish:0;}
  else{const wishRanks=R.sortCards(g.hands[p]).filter(R.regular).map(c=>c.r);g.wish=wishRanks.length?wishRanks[Math.min(2,wishRanks.length-1)]:14;}
 }
 g.pile.push(...cards);g.passed=0;
 if(combo.type==='dog'){
  g.captured[p].push(...g.pile);g.pile=[];g.trick=null;
  if(g.hands[p].length===0)g.order.push(p);
  if(checkEnd())return true;
  g.turn=g.hands[(p+2)%4].length?(p+2)%4:nextAlive((p+2)%4);
  say(NAMES[p]+' έπαιξε Dog και έδωσε τη σειρά στον συμπαίκτη.');
 }else{
  g.trick={combo,owner:p,cards:cards.map(c=>c.id)};
  if(g.hands[p].length===0){g.order.push(p);say(NAMES[p]+' τελείωσε τις κάρτες του!');}
  if(checkEnd())return true;
  g.turn=nextAlive(p);
 }
 selected=[];render();save();scheduleAI();return true;
}
function pass(p){
 if(g.phase!=='play'||p!==g.turn||!canPass(p))return;
 g.passed++;
 const defenders=[0,1,2,3].filter(q=>q!==g.trick.owner&&g.hands[q].length);
 if(g.passed>=defenders.length){
  const owner=g.trick.owner;let award=owner;
  if(g.pile.some(c=>c.id==='dragon'))award=(owner+1)%4;
  g.captured[award].push(...g.pile);g.pile=[];g.trick=null;g.passed=0;
  g.turn=g.hands[owner].length?owner:nextAlive(owner);
  say('Η μπάζα πήγε στον '+NAMES[award]+'. Νέα σειρά.');
 }else{g.turn=nextAlive(p);say(NAMES[p]+' πάσο.');}
 selected=[];render();save();scheduleAI();
}
function checkEnd(){
 const winners=g.order;
 if(winners.length>=2&&winners[0]%2===winners[1]%2){finishRound(winners[0]%2);return true;}
 if(winners.length>=3){finishRound(null);return true;}
 return false;
}
function finishRound(doubleTeam){
 clearTimeout(aiTimer);g.phase='result';
 if(g.trick&&g.pile.length){const owner=g.trick.owner;const award=g.pile.some(c=>c.id==='dragon')?(owner+1)%4:owner;g.captured[award].push(...g.pile);g.pile=[];g.trick=null;}
 let earned=[0,0];
 if(doubleTeam!==null){earned[doubleTeam]=200;}
 else{
  const last=[0,1,2,3].find(p=>!g.order.includes(p));
  const first=g.order[0];if(last!==undefined){
   g.captured[first].push(...g.captured[last]);g.captured[last]=[];
   g.captured[(last+1)%4].push(...g.hands[last]);g.hands[last]=[];
  }
  for(let p=0;p<4;p++)earned[p%2]+=R.scoreCards(g.captured[p]);
 }
 for(let p=0;p<4;p++)if(g.bids[p])earned[p%2]+=(g.order[0]===p?g.bids[p]:-g.bids[p]);
 g.totals=[g.totals[0]+earned[0],g.totals[1]+earned[1]];
 g.roundSummary=(doubleTeam!==null?'Διπλή νίκη ομάδας '+(doubleTeam===0?'Εσύ + Συμπαίκτης':'Αντίπαλοι')+'! ':'')+'Αυτός ο γύρος: '+earned[0]+' – '+earned[1]+'. Συνολικά: '+g.totals[0]+' – '+g.totals[1]+'.';
 stats.games++;if(g.totals[0]>=1000&&g.totals[0]>g.totals[1])stats.won++;
 try{localStorage.setItem(STAT,JSON.stringify(stats));}catch(_){}
 say(g.roundSummary);render();save();
}
function humanPlay(){
 if(g.turn!==0||g.phase!=='play')return;
 const hand=g.hands[0],set=new Set(selected),cards=hand.filter(c=>set.has(c.id));
 if(!cards.length){say('Επίλεξε κάρτες για να παίξεις.');return;}
 if(!playCards(0,cards)){say('Ο συνδυασμός δεν επιτρέπεται ή πρέπει να ικανοποιήσεις την ευχή Mahjong.');}
}
function aiTurn(){
 aiTimer=0;if(!live||g.phase!=='play'||g.turn===0)return;
 const p=g.turn,hand=g.hands[p],last=g.trick?.combo||null,partnerLeading=!!g.trick&&g.trick.owner%2===p%2;
 if(!g.played[p]&&!g.bids[p]&&strength(hand)>=9&&Math.random()<.2)g.bids[p]=100;
 const pick=R.chooseAI(hand,last,g.wish,partnerLeading,g.aiLevel);
 if(!pick){if(g.trick)pass(p);else{const fallback=R.chooseAI(hand,null,g.wish,false,g.aiLevel);if(fallback)playCards(p,fallback.cards);}}else playCards(p,pick.cards);
}
function scheduleAI(){clearTimeout(aiTimer);aiTimer=0;if(live&&g.phase==='play'&&g.turn!==0)aiTimer=setTimeout(aiTurn,360);}
function render(){
 $('round').textContent='Γύρος '+g.round;
 $('score').textContent=g.totals[0]+' – '+g.totals[1];
 $('turn').textContent=g.phase==='grand'?'Grand Tichu;':g.phase==='trade'?'Ανταλλαγή':g.phase==='result'?'Τέλος γύρου':g.turn===0?'Η σειρά σου':'Παίζει '+NAMES[g.turn];
 $('gcontrol').hidden=g.phase!=='grand';
 $('tradecontrol').hidden=g.phase!=='trade';
 $('playcontrol').hidden=g.phase!=='play';
 $('resultcontrol').hidden=g.phase!=='result';
 $('call').hidden=g.phase!=='play'||g.turn!==0||g.played[0]||!!g.bids[0];
 $('pass').disabled=g.phase!=='play'||g.turn!==0||!canPass(0);
 $('play').disabled=g.phase!=='play'||g.turn!==0||!selected.length;
 $('trade').disabled=g.phase!=='trade'||selected.length!==3;
 $('wish').disabled=g.phase!=='play'||g.turn!==0;
 for(let p=1;p<4;p++){$('n'+p).textContent=NAMES[p]+(g.order.includes(p)?' · Τέλος':' · '+g.hands[p].length+' κάρτες')+(g.bids[p]?' · Tichu!':'');}
 $('pile').replaceChildren();
 if(g.trick){
  const div=document.createElement('div');div.className='piletext';div.textContent='Παίζει: '+NAMES[g.trick.owner]+' · '+({'single':'Μονό','pair':'Ζευγάρι','triple':'Τριάδα','full':'Φουλ','straight':'Σκάλα','pairsrun':'Συνεχόμενα ζευγάρια','fourbomb':'Βόμβα 4','straightbomb':'Βόμβα σκάλας','dog':'Dog'}[g.trick.combo.type]||g.trick.combo.type);$('pile').appendChild(div);
  const row=document.createElement('div');row.className='cards center';for(const id of g.trick.cards){const card=R.deck().find(c=>c.id===id);if(card)row.appendChild(cardEl(card));}$('pile').appendChild(row);
 }else{$('pile').textContent=g.phase==='play'?'Νέα μπάζα — παίξε όποιον συνδυασμό θέλεις.':'Οι κάρτες θα εμφανιστούν εδώ.';}
 $('wishinfo').textContent=g.wish?'Ευχή Mahjong: '+g.wish:'';
 const h=$('hand');h.replaceChildren();const hand=g.hands[0];const count=document.createElement('div');count.className='hand-title';count.textContent='Οι κάρτες σου ('+hand.length+')'+(g.bids[0]?' · '+(g.bids[0]===200?'Grand Tichu':'Tichu'):'');h.appendChild(count);
 const row=document.createElement('div');row.className='cards handcards';
 for(const card of hand){const b=cardEl(card);b.type='button';b.classList.add('selectable');if(selected.includes(card.id))b.classList.add('picked');b.addEventListener('click',()=>toggle(card.id));row.appendChild(b);}h.appendChild(row);
 $('tradeinfo').textContent=selected.length?'Επιλεγμένες: '+selected.map((id,i)=>['Αριστερά','Συμπαίκτη','Δεξιά'][i]+': '+label(hand.find(c=>c.id===id))).join(' · '):'Επίλεξε ακριβώς 3 κάρτες.';
 $('roundinfo').textContent=g.roundSummary;
 $('next').textContent=g.totals.some(x=>x>=1000)?'↻ Νέο παιχνίδι':'↻ Επόμενος γύρος';
}
function cardEl(c){
 const b=document.createElement('button');b.className='card'+(c.s===1||c.s===2?' red':'')+(c.s<0?' special':'');b.textContent=label(c);b.setAttribute('aria-label',label(c));return b;
}
function toggle(id){
 if(g.phase==='play'&&g.turn!==0)return;
 if(g.phase!=='trade'&&g.phase!=='play')return;
 const i=selected.indexOf(id);
 if(i>=0)selected.splice(i,1);else if(g.phase!=='trade'||selected.length<3)selected.push(id);
 render();
}
function callTichu(){if(g.phase==='play'&&g.turn===0&&!g.played[0]&&!g.bids[0]){g.bids[0]=100;say('Δήλωσες Tichu: +100 αν τελειώσεις πρώτος, αλλιώς −100.');render();save();}}
function visibility(){live=document.visibilityState==='visible'&&embedded; if(!live){clearTimeout(aiTimer);aiTimer=0;}else scheduleAI();}
let restored=false;
try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&['grand','trade','play','result'].includes(v.phase)&&Array.isArray(v.hands)&&v.hands.length===4){g=v;restored=true;}}catch(_){}
$('grandyes').addEventListener('click',()=>grand(true));$('grandno').addEventListener('click',()=>grand(false));$('trade').addEventListener('click',doTrade);$('play').addEventListener('click',humanPlay);$('pass').addEventListener('click',()=>pass(0));$('call').addEventListener('click',callTichu);
$('next').addEventListener('click',()=>deal(g.totals.some(x=>x>=1000)));
$('reset').addEventListener('click',()=>{if(confirm('Νέο παιχνίδι; Θα μηδενιστούν οι βαθμοί της παρτίδας.'))deal(true);});
$('difficulty').addEventListener('change',e=>{g.aiLevel=Number(e.target.value);save();});
document.addEventListener('visibilitychange',visibility);
window.addEventListener('message',e=>{if(e.origin!==location.origin)return;if(e.data?.type==='tichufunny:visibility'){embedded=!!e.data.active;visibility();}});
if(restored){$('difficulty').value=String(g.aiLevel);say('Η αποθηκευμένη παρτίδα συνεχίζεται.');render();scheduleAI();}else deal(true);
})();
