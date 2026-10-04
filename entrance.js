(() => {
'use strict';
const loader=document.getElementById('loader');
const fly=document.getElementById('flyLogo');
const hero=document.getElementById('heroLogo');
const header=document.querySelector('header');
const fill=document.getElementById('fill');
const pct=document.getElementById('pct');
const status=document.getElementById('status');
const ui=document.getElementById('loadUi');
const mark=document.querySelector('.load-mark');
let animation=null, settled=false;

function setProgress(n,label){
  const value=Math.max(0,Math.min(100,Number(n)||0));
  const glow=document.getElementById('logoGlow');
  const ring=document.getElementById('loadRingProgress');
  if(glow) glow.style.opacity=String(Math.max(.12,value/100));
  if(ring) ring.style.strokeDashoffset=String(100-value);
  if(fill) fill.style.width=`${value}%`;
  if(pct) pct.textContent=`${Math.floor(value)}%`;
  if(status&&label) status.textContent=label;
  document.getElementById('loadProgress')?.setAttribute('aria-valuenow',String(Math.floor(value)));
}
function blockPage(blocked){
  ['header','main','footer'].forEach(selector=>{const el=document.querySelector(selector);if(el)el.inert=blocked;});
  document.body.setAttribute('aria-busy',String(blocked));
  loader?.setAttribute('aria-hidden',String(!blocked));
}
function begin(){
  settled=false;
  animation?.cancel(); animation=null;
  if(mark&&fly&&fly.parentElement!==mark) mark.append(fly);
  if(fly){fly.removeAttribute('style');fly.className='pulse';fly.style.visibility='visible';}
  if(hero){hero.style.opacity='1';hero.style.visibility='visible';}
  blockPage(true);
  document.body.classList.add('locked');document.body.classList.remove('live');header?.classList.remove('ready');
  if(loader){loader.className='';loader.setAttribute('aria-hidden','false');}
  ui?.classList.remove('hide');
  setProgress(0,'Preparing the sky');
}
function ready(){
  blockPage(false);document.body.classList.remove('locked');document.body.classList.add('live');header?.classList.add('ready');
}
function settle(){
  if(settled)return;settled=true;animation?.cancel();animation=null;
  try{ready();}catch(_){document.body.classList.remove('locked');document.body.classList.add('live');}
  try{
    if(hero){hero.style.opacity='0';hero.style.visibility='hidden';}
    const sigil=hero?.parentElement;
    if(sigil&&fly){if(fly.parentElement!==sigil)sigil.append(fly);fly.style.cssText='';fly.style.width='100%';fly.style.height='auto';fly.style.position='relative';fly.style.zIndex='7';fly.style.visibility='visible';sigil.classList.add('breathing');}
    loader?.classList.add('done');
    loader?.setAttribute('aria-hidden','true');
    setProgress(100,'The table is ready');
  }catch(_){loader?.classList.add('done');}
}
async function reveal(){
  if(!loader||!fly||!hero){settle();return;}
  setProgress(100,'Opening the table');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduced){settle();return;}
  const from=fly.getBoundingClientRect(),to=hero.getBoundingClientRect();
  if(!fly.animate||!from.width||!to.width){settle();return;}
  ready();
  loader.classList.add('revealing');ui?.classList.add('hide');hero.style.opacity='0';document.body.append(fly);
  Object.assign(fly.style,{position:'fixed',left:`${from.left}px`,top:`${from.top}px`,width:`${from.width}px`,height:`${from.height}px`,margin:'0',zIndex:'4500',pointerEvents:'none',animation:'none',transformOrigin:'top left'});
  animation=fly.animate([
    {transform:'translate(0,0) scale(1,1)',opacity:1},
    {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(${to.width/from.width},${to.height/from.height})`,opacity:1}
  ],{duration:720,easing:'cubic-bezier(.22,.7,.24,1)',fill:'forwards'});
  try{await animation.finished;}catch(_){}
  settle();
}
function failOpen(message='Opening the table'){
  setProgress(100,message);settle();
}
async function replay(){
  window.scrollTo({top:0,behavior:'smooth'});
  await new Promise(r=>setTimeout(r,220));
  begin();
  for(const [p,label,ms] of [[24,'Returning to the stars',100],[58,'Aligning the sky',100],[86,'Opening the table',100]]){setProgress(p,label);await new Promise(r=>setTimeout(r,ms));}
  await reveal();
}
window.Elev8Entrance={begin,setProgress,reveal,failOpen,replay};
document.getElementById('replay')?.addEventListener('click',replay);
})();
