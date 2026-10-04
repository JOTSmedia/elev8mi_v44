(() => {
 'use strict';
 // Major moons orbit their planets in each planet's equatorial plane, tilted
 // with the planet's axis. Real order, direction and relative periods are kept;
 // display radii and time are compressed (period^0.5) so they read at this scale.
 // [name, km diameter, sidereal days (negative = retrograde), display orbit in
 //  planet radii, base colour, inclination to the equator in degrees]
 const systems={
  Mars:[['Phobos',22.5,.319,1.9,'#9a8b7c',1.1],['Deimos',12.4,1.263,2.8,'#ad9e8b',1.8]],
  Jupiter:[['Io',3643,1.769,1.85,'#eadb8f',.05],['Europa',3122,3.551,2.3,'#e3dccd',.47],['Ganymede',5268,7.155,2.8,'#b3aa9c',.2],['Callisto',4821,16.69,3.4,'#857a6c',.2]],
  Saturn:[['Rhea',1527,4.518,2.75,'#d2cfc9',.35],['Titan',5150,15.945,3.5,'#e0ad5c',.35]],
  Uranus:[['Titania',1578,8.706,2.6,'#beb5ad',.08],['Oberon',1523,13.46,3.2,'#aa9f95',.07]],
  Neptune:[['Triton',2707,-5.877,2.7,'#ddcdcb',23]]
 };
 const tilts={Mars:25.2,Jupiter:3.1,Saturn:26.7,Uranus:97.8,Neptune:28.3};
 const TAU=Math.PI*2,EARTH_MOON_SECONDS=24/.7/.4,moons=[];
 Object.entries(systems).forEach(([planet,list])=>{
  const button=document.querySelector(`.solar-body[data-planet="${planet}"]`),model=button?.querySelector('.planet-model'),img=model?.querySelector('img');
  if(!model||!img)return;
  const tilt=(tilts[planet]>90?tilts[planet]-180:tilts[planet])*Math.PI/180;
  list.forEach(([name,diameter,days,orbit,color,inclination],i)=>{
   const el=document.createElement('span');el.className='planet-moon';el.dataset.moon=name;el.setAttribute('aria-hidden','true');
   el.style.setProperty('--moon-color',color);
   model.append(el);
   moons.push({el,img,planet,name,orbit,tilt,
    size:1.3+2.3*Math.sqrt(diameter/5268),
    seconds:EARTH_MOON_SECONDS*Math.sqrt(Math.abs(days)/27.32),sign:Math.sign(days),
    inclination:inclination*Math.PI/180,phase:(i*2.39+planet.length*.83)%TAU,lastFront:null});
  });
  // Tooltip copy mentions the moons now drawn in orbit.
  button.dataset.moons=list.map(m=>m[0]).join(', ');
 });
 if(!moons.length)return;
 function render(time){
  const state=window.elev8miCelestial,positions=state?.planetPositions,sun=state?.heroSun;
  const flat=Math.max(.3,Math.min(.55,state?.sinPitch??.3)),small=(state?.width||1000)<600;
  for(const m of moons){
   const width=parseFloat(m.img.style.width)||0;if(!width)continue;
   const radius=(m.planet==='Saturn'?width/2.38:width)/2;
   const a=Math.max(radius*m.orbit,radius+4+m.orbit*1.2);
   const angle=m.phase+m.sign*time*TAU/m.seconds;
   // Circular orbit in the equatorial plane; the camera's pitch flattens it.
   const ox=Math.cos(angle)*a,depth=Math.sin(angle)*a;
   const oy=depth*flat+Math.sin(angle)*a*Math.sin(m.inclination)*.5;
   const x=ox*Math.cos(m.tilt)-oy*Math.sin(m.tilt),y=ox*Math.sin(m.tilt)+oy*Math.cos(m.tilt);
   const front=depth>0,hidden=!front&&Math.hypot(x,y)<radius*.98;
   const size=m.size*(small?.85:1);
   m.el.style.transform=`translate(${(x-size/2).toFixed(2)}px,${(y-size/2).toFixed(2)}px)`;
   if(m.lastSize!==size){m.el.style.width=m.el.style.height=`${size.toFixed(2)}px`;m.lastSize=size;}
   if(front!==m.lastFront){m.el.style.zIndex=front?'2':'-1';m.lastFront=front;}
   m.el.style.opacity=hidden?'0':'1';
   // Shade toward the hero Sun from the planet's on-screen position.
   const p=positions?.[m.planet];
   if(p&&sun){const dx=sun.x-(p.displayX??p.x),dy=sun.y-(p.displayY??p.y),l=Math.hypot(dx,dy)||1;
    m.el.style.setProperty('--lx',(dx/l).toFixed(3));m.el.style.setProperty('--ly',(dy/l).toFixed(3));}
  }
 }
 if(window.Elev8Motion)window.Elev8Motion.add(time=>render(time),{fps:30});else render(0);
 window.addEventListener('resize',()=>render(window.Elev8Motion?.time||0),{passive:true});
})();
