/* TichuFunny: shared pure rules for solo and later online variants. */
(function(root){
'use strict';
const specials=['mahjong','dog','phoenix','dragon'];
const regular=c=>c.s>=0,phoenix=c=>c.id==='phoenix',value=c=>c.id==='dragon'?16:c.id==='phoenix'?1.5:c.r;
function deck(){const a=[];for(let s=0;s<4;s++)for(let r=2;r<=14;r++)a.push({id:'c'+s+'-'+r,s,r});for(const id of specials)a.push({id,s:-1,r:id==='mahjong'?1:0});return a;}
function shuffled(){const a=deck();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function scoreCards(cards){return cards.reduce((v,c)=>v+(c.id==='dragon'?25:c.id==='phoenix'?-25:c.r===5?5:c.r===10||c.r===13?10:0),0);}
function classify(cards,prev){
 if(!cards?.length)return null;const n=cards.length,p=cards.filter(phoenix),mj=cards.filter(c=>c.id==='mahjong'),dog=cards.filter(c=>c.id==='dog'),dragon=cards.filter(c=>c.id==='dragon');
 if(n===1){const c=cards[0];return {type:c.id==='dog'?'dog':'single',n,rank:phoenix(c)?(prev?.type==='single'?prev.rank+.5:1.5):value(c),bomb:0};}
 if(dog.length||dragon.length||mj.length>1||p.length>1)return null;
 if(mj.length&&n<5)return null;
 const plain=cards.filter(regular);
 if(n===4&&!p.length&&plain.length===4&&plain.every(c=>c.r===plain[0].r))return {type:'fourbomb',n,rank:plain[0].r,bomb:1};
 if(n>=5){
  const present=plain.map(c=>c.r).concat(mj.map(()=>1)),unique=[...new Set(present)];
  if(unique.length===present.length)for(let low=1;low<=15-n;low++){
   if(low===1&&!mj.length)continue;
   const needed=Array.from({length:n},(_,i)=>i+low),missing=needed.filter(x=>!unique.includes(x));
   if(missing.length===p.length&&present.every(x=>needed.includes(x))&&!(p.length&&missing[0]===1)){
    if(!p.length&&!mj.length&&plain.every(c=>c.s===plain[0].s))return {type:'straightbomb',n,rank:low+n-1,bomb:2};
    return {type:'straight',n,rank:low+n-1,bomb:0};
   }
  }
 }
 if(mj.length)return null;
 if((n===2||n===3)&&plain.length&&plain.every(c=>c.r===plain[0].r))return {type:n===2?'pair':'triple',n,rank:plain[0].r,bomb:0};
 if(n===5)for(let t=2;t<=14;t++)for(let a=2;a<=14;a++){if(t===a)continue;const ct=plain.filter(c=>c.r===t).length,ca=plain.filter(c=>c.r===a).length;if(ct<=3&&ca<=2&&ct+ca===plain.length&&(3-ct)+(2-ca)===p.length)return {type:'full',n,rank:t,bomb:0};}
 if(n>=4&&n%2===0)for(let low=2;low<=15-n/2;low++){
  const ranks=Array.from({length:n/2},(_,i)=>low+i);
  if(plain.every(c=>ranks.includes(c.r))&&ranks.every(r=>plain.filter(c=>c.r===r).length<=2)&&ranks.reduce((v,r)=>v+2-plain.filter(c=>c.r===r).length,0)===p.length)return {type:'pairsrun',n,rank:low+n/2-1,bomb:0};
 }
 return null;
}
function beats(combo,last){
 if(!combo)return false;if(!last)return true;if(combo.type==='dog')return false;
 if(combo.bomb&&!last.bomb)return true;if(last.bomb&&!combo.bomb)return false;
 if(combo.bomb&&last.bomb){if(combo.bomb!==last.bomb)return combo.bomb>last.bomb;if(combo.bomb===2&&combo.n!==last.n)return combo.n>last.n;return combo.rank>last.rank;}
 return combo.type===last.type&&combo.n===last.n&&combo.rank>last.rank;
}
const sortCards=a=>a.slice().sort((x,y)=>value(x)-value(y)||(x.s??0)-(y.s??0));
function candidates(hand,last){
 const result=[],n=hand.length;if(n>16)throw new Error('Unexpected hand size');
 for(let mask=1;mask<(1<<n);mask++){
  let arr=[],k=mask;for(let i=0;i<n;i++){if(k&1)arr.push(hand[i]);k>>=1;}
  if(last&&arr.length!==last.n&&arr.length!==4&&arr.length<5)continue;
  const combo=classify(arr,last);if(!combo||(last&&!beats(combo,last)))continue;
  result.push({cards:arr,combo});
 }
 return result;
}
function legalOptions(hand,last,wish){
 let opts=candidates(hand,last);
 if(wish&&opts.some(o=>o.cards.some(c=>regular(c)&&c.r===wish)))opts=opts.filter(o=>o.cards.some(c=>regular(c)&&c.r===wish));
 return opts;
}
function chooseAI(hand,last,wish,partnerLeading,expert=1){
 const opts=legalOptions(hand,last,wish);if(!opts.length)return null;
 if(last&&partnerLeading&&!wish&&!opts.some(o=>o.cards.length===hand.length))return null;
 const rank=o=>{
  const c=o.combo,hasPhoenix=o.cards.some(phoenix),hasDragon=o.cards.some(x=>x.id==='dragon');
  let v=c.n*(last?9:11)-c.rank*.4;
  if(c.bomb)v-=expert===2?60:30;
  if(hasPhoenix)v-=expert===2?15:5;
  if(hasDragon)v-=expert===2?20:5;
  if(c.type==='dog')v+=7;
  if(o.cards.length===hand.length)v+=400;
  if(wish&&o.cards.some(x=>regular(x)&&x.r===wish))v+=10;
  return v+(Math.random()-.5)*(expert===0?20:expert===1?6:1);
 };
 return opts.reduce((best,opt)=>!best||rank(opt)>rank(best)?opt:best,null);
}
root.TichuRules={deck,shuffled,scoreCards,classify,beats,candidates,legalOptions,chooseAI,sortCards,regular,value};
})(typeof window!=='undefined'?window:globalThis);
