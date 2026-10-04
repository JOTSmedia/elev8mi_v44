(() => {
  'use strict';
  const A=window.Astronomy;
  if(!A)return;
  const texture=new Image();texture.src='assets/moon.webp';
  let state,cachedEclipse=null,eclipseSearchStart=0;
  const normalize=v=>(v%360+360)%360;
  function calculate(date=new Date()) {
    const angle=normalize(A.MoonPhase(date));
    const illuminated=A.Illumination('Moon',date).phase_fraction;
    const names=['New Moon','Waxing crescent','First quarter','Waxing gibbous','Full Moon','Waning gibbous','Last quarter','Waning crescent'];
    let name=angle<6||angle>354?names[0]:angle<84?names[1]:angle<96?names[2]:angle<174?names[3]:angle<186?names[4]:angle<264?names[5]:angle<276?names[6]:names[7];
    const full=A.SearchMoonPhase(180,new Date(date.getTime()-16*864e5),35)?.date;
    let blue=false;
    if(full && Math.abs(date-full)<864e5){
      const start=new Date(full.getFullYear(),full.getMonth(),1);
      const first=A.SearchMoonPhase(180,start,32)?.date;
      blue=first && full-first>20*864e5;
    }
    if(!cachedEclipse||date.getTime()<eclipseSearchStart||date.getTime()>cachedEclipse.peak.date.getTime()+(cachedEclipse.sd_penum+60)*60000){
      eclipseSearchStart=date.getTime()-864e5;cachedEclipse=A.SearchLunarEclipse(new Date(eclipseSearchStart));
    }
    const eclipse=cachedEclipse;
    const minutes=Math.abs(date-eclipse.peak.date)/60000;
    let eclipseStrength=0;
    if(eclipse.sd_partial>0 && minutes<eclipse.sd_partial){
      eclipseStrength=Math.min(1,(eclipse.sd_partial-minutes)/Math.max(1,eclipse.sd_partial-eclipse.sd_total));
      name=eclipseStrength>=.98?'Blood Moon · total eclipse':'Partial lunar eclipse';
    }else if(blue)name='Blue Moon · second full Moon';
    return {date,angle,illuminated,name,blue,eclipseStrength};
  }
  function render(canvas,size=84) {
    if(!canvas||!state||!texture.complete||!texture.naturalWidth)return;
    canvas.width=size*2;canvas.height=size*2;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const n=canvas.width,r=n/2;
    ctx.clearRect(0,0,n,n);ctx.save();ctx.beginPath();ctx.arc(r,r,r-1,0,Math.PI*2);ctx.clip();
    ctx.drawImage(texture,0,0,n,n);
    if(state.eclipseStrength){ctx.globalCompositeOperation='source-atop';ctx.fillStyle=`rgba(181,57,20,${state.eclipseStrength*.66})`;ctx.fillRect(0,0,n,n);ctx.globalCompositeOperation='source-over';}
    const mask=ctx.createImageData(n,n), phase=state.angle*Math.PI/180;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const nx=(x-r+.5)/r,ny=(y-r+.5)/r,rr=nx*nx+ny*ny;if(rr>1)continue;
      const z=Math.sqrt(1-rr),light=nx*Math.sin(phase)-z*Math.cos(phase);
      const shadow=Math.max(0,Math.min(1,.5-light*35));
      const i=(y*n+x)*4;mask.data[i]=255;mask.data[i+1]=255;mask.data[i+2]=255;mask.data[i+3]=Math.round((1-shadow)*255);
    }
    const phaseMask=document.createElement('canvas');phaseMask.width=n;phaseMask.height=n;phaseMask.getContext('2d').putImageData(mask,0,0);
    // Keep only the illuminated texture. CSS glow follows this alpha silhouette.
    ctx.globalCompositeOperation='destination-in';ctx.drawImage(phaseMask,0,0);ctx.restore();
  }
  function update(){
    state=calculate();
    document.getElementById('moonPhaseName').textContent=state.name;
    document.getElementById('moonPhaseInfo').textContent=`${Math.round(state.illuminated*100)}% illuminated · live phase`;
    const panel=document.querySelector('.moon-now');
    panel.title=state.eclipseStrength?'Global eclipse state; visibility depends on your location.':state.blue?'Blue Moon is a calendar name; the Moon is not normally blue.':'Phase calculated from your current device time. Northern-hemisphere orientation.';
    render(document.getElementById('liveMoon'));
    window.dispatchEvent(new CustomEvent('elev8mi:moon'));
  }
  window.Elev8Moon={calculate,render,get state(){return state;}};
  texture.onload=update;update();setInterval(()=>{if(!document.hidden)update();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
})();
