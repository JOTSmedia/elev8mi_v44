(() => {
  'use strict';
  const bar=document.querySelector('.header-content');
  const nav=document.getElementById('nav');
  const menu=document.getElementById('menuToggle');
  const layer=document.querySelector('.nav-trails');
  const top=document.getElementById('navTrailTop');
  const bottom=document.getElementById('navTrailBottom');
  if(!bar||!nav||!menu||!layer||!top||!bottom)return;
  const links=[...nav.querySelectorAll('a[href^="#"]')];
  const sections=links.map(link=>document.querySelector(link.getAttribute('href')));
  const narrow=matchMedia('(max-width:720px)');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  let track=null,parkedKey='',loopPhase=0,active=null,animations=[],geometry='',pendingClose=0,unlock=0,locked=false,raf=0,resizeFrame=0;
  function syncMotion(){
    const paused=reduced.matches||window.Elev8Motion?.paused||document.hidden;
    animations.forEach(animation=>paused?animation.pause():animation.play());
  }
  function place(){
    const width=layer.clientWidth,height=layer.clientHeight,inset=1.5;
    if(width<=0||height<=0)return;
    const corner=Math.min(parseFloat(getComputedStyle(bar).borderTopLeftRadius)||height/2,width/2,height/2);
    const radius=Math.max(0,corner-inset),key=`${width}/${height}/${radius}`;
    if(key===geometry){applyIndicator();return;}
    geometry=key;parkedKey='';
    // Preserve the lap position on resize. Both dashes follow the same closed
    // path, half a lap apart: top goes right, bottom goes left, corners turn.
    const previous=animations[0];
    const phase=previous?((Number(previous.currentTime)||0)/previous.effect.getTiming().duration)%1:loopPhase;
    animations.forEach(animation=>animation.cancel());animations=[];
    layer.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const right=width-inset,bottomEdge=height-inset;
    track={width,height,inset,radius,right,bottomEdge};
    const path=`M ${inset+radius} ${inset} H ${right-radius} A ${radius} ${radius} 0 0 1 ${right} ${inset+radius} V ${bottomEdge-radius} A ${radius} ${radius} 0 0 1 ${right-radius} ${bottomEdge} H ${inset+radius} A ${radius} ${radius} 0 0 1 ${inset} ${bottomEdge-radius} V ${inset+radius} A ${radius} ${radius} 0 0 1 ${inset+radius} ${inset} Z`;
    top.setAttribute('d',path);bottom.setAttribute('d',path);
    // Analytic length avoids stale SVG geometry caches when a paused path resizes.
    const perimeter=2*(width+height-4*inset)-8*radius+2*Math.PI*radius,trace=Math.min(96,Math.max(40,width*.085));
    const duration=Math.max(4800,perimeter/145*1000);
    track.perimeter=perimeter;track.trace=trace;track.duration=duration;track.phase=phase;
    if(parkTarget()){loopPhase=phase;applyIndicator();return;}
    [top,bottom].forEach((line,index)=>{
      const start=-index*perimeter/2;
      line.style.strokeDasharray=`${trace}px ${perimeter-trace}px`;
      line.style.strokeDashoffset=`${start}px`;
      if(!line.animate)return;
      const animation=line.animate([{strokeDashoffset:`${start}px`},{strokeDashoffset:`${start-perimeter}px`}],{duration,iterations:Infinity,easing:'linear'});
      animation.currentTime=phase*duration;animations.push(animation);
    });
    layer.classList.remove('is-parked');parkedKey='';
    syncMotion();
  }
  // Active indicator: on the desktop bar, both gold lines leave their loop and
  // sit exactly over (top edge) and under (bottom edge) the active link's text.
  // Without an active link, or in the mobile menu, the lines keep looping.
  function parkTarget(){
    if(!active||narrow.matches||!track)return null;
    const text=document.createRange();text.selectNodeContents(active);
    const box=text.getBoundingClientRect(),frame=layer.getBoundingClientRect();
    if(!box.width||!frame.width)return null;
    const scale=frame.width/track.width||1,cap=1.7/2;
    const low=track.inset+track.radius,high=track.right-track.radius;
    const x1=Math.max(low,(box.left-frame.left)/scale+cap),x2=Math.min(high,(box.right-frame.left)/scale-cap);
    return x2>x1?{x1,x2}:null;
  }
  function applyIndicator(){
    const target=parkTarget();
    if(!target){if(layer.classList.contains('is-parked'))restartLoop();else syncMotion();return;}
    const {x1,x2}=target,{inset,radius,right,bottomEdge,perimeter}=track;
    const key=`${geometry}|${x1.toFixed(2)}|${x2.toFixed(2)}`;
    if(key===parkedKey)return;
    const first=animations[0];
    if(first)loopPhase=((Number(first.currentTime)||0)/first.effect.getTiming().duration)%1;
    animations.forEach(animation=>animation.cancel());animations=[];
    // Distances along the closed path: the top edge runs left to right from
    // (inset+radius); the bottom edge runs right to left after the right side.
    const length=x2-x1,straight=right-radius-(inset+radius),side=bottomEdge-radius-(inset+radius),quarter=Math.PI*radius/2;
    const topStart=x1-(inset+radius),bottomStart=straight+quarter+side+quarter+(right-radius-x2);
    [[top,topStart],[bottom,bottomStart]].forEach(([line,start])=>{
      line.style.strokeDasharray=`${length}px ${perimeter-length}px`;
      line.style.strokeDashoffset=`${-start}px`;
    });
    if(!layer.classList.contains('is-parked')){layer.classList.add('is-parked');}
    parkedKey=key;
  }
  function restartLoop(){layer.classList.remove('is-parked');geometry='';place();}
  function schedulePlace(){
    if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;place();});
  }
  function select(link){
    if(link===active)return;
    active=link;
    links.forEach(item=>{if(item===link)item.setAttribute('aria-current','location');else item.removeAttribute('aria-current');});
    applyIndicator();
  }
  function setMenu(open){
    nav.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu');
  }
  menu.addEventListener('click',()=>{clearTimeout(pendingClose);setMenu(!nav.classList.contains('open'));});
  links.forEach(link=>link.addEventListener('click',()=>{
    clearTimeout(unlock);clearTimeout(pendingClose);locked=true;select(link);
    unlock=setTimeout(()=>{locked=false;},1600);
    if(narrow.matches)pendingClose=setTimeout(()=>setMenu(false),reduced.matches?0:480);
  }));
  document.getElementById('brandSlot')?.addEventListener('click',()=>{locked=true;clearTimeout(unlock);select(null);setMenu(false);unlock=setTimeout(()=>locked=false,1500);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('open')){clearTimeout(pendingClose);setMenu(false);menu.focus();}});
  function spy(){
    raf=0;if(locked)return;
    const threshold=Math.max(140,innerHeight*.25);let chosen=null;
    sections.forEach((section,index)=>{if(section&&section.getBoundingClientRect().top<=threshold)chosen=links[index];});
    select(chosen);
  }
  window.addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(spy);},{passive:true});
  window.addEventListener('resize',schedulePlace,{passive:true});
  window.addEventListener('elev8mi:motion',syncMotion);
  document.addEventListener('visibilitychange',syncMotion);
  reduced.addEventListener('change',syncMotion);
  if('ResizeObserver'in window){const observer=new ResizeObserver(()=>{parkedKey='';schedulePlace();});observer.observe(bar);observer.observe(nav);links.forEach(link=>observer.observe(link));}
  // Font swaps change link widths; re-measure when any face finishes loading.
  document.fonts?.ready.then(()=>{parkedKey='';schedulePlace();});
  document.fonts?.addEventListener?.('loadingdone',()=>{parkedKey='';schedulePlace();});
  narrow.addEventListener?.('change',()=>{parkedKey='';geometry='';schedulePlace();});
  const initial=links.find(link=>link.hash===location.hash);if(initial)select(initial);
  place();
})();
