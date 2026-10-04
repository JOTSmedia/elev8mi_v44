(() => {
  'use strict';
  const root = document.getElementById('solarSystem');
  const host = document.getElementById('solarBodies');
  const canvas = document.getElementById('orbitPaths');
  const detail = document.getElementById('planetDetail');
  if (!root || !host || !canvas || !window.Elev8Motion) return;
  const ctx = canvas.getContext('2d');
  // NASA/NSSDCA Planetary Fact Sheet: km, days, eccentricity, inclination.
  // Initial orbital phases come from Astronomy Engine. Distances and time
  // are compressed for display; this is an illustrative solar-system view.
  const planets = [
    ['Mercury',4879,88,.206,7,.30, .3],
    ['Venus',12104,224.7,.007,3.4,.37, 2.2],
    ['Earth',12756,365.2,.017,0,.44, 4.8],
    ['Mars',6792,687,.094,1.8,.52, 3.4],
    ['Jupiter',142984,4331,.049,1.3,.65, .8],
    ['Saturn',120536,10747,.052,2.5,.77, 3.8],
    ['Uranus',51118,30589,.047,.8,.89, 5.7],
    ['Neptune',49528,59800,.010,1.8,1, 2.5]
  ];
  const TAU = Math.PI * 2;
  // Visible but gentle motion, with separate orbital, axial and daylight clocks.
  // Real relative periods are preserved; the display remains time-compressed.
  const orbitRate = .4;
  const earthYearSeconds = 7 / orbitRate;
  const moonOrbitSeconds = 24 / .7 / orbitRate;
  // Surface rotation is independent of the orbital and weather clocks.
  const earthSpinSeconds = 360;
  // Always open at midnight with the Moon on the near side, above Earth.
  // Its live phase controls the illuminated texture only; it must not make
  // a fresh visit start in daylight or place the Moon behind the globe.
  const moonOrbitPhase=0;
  let width = 0, height = 0, radius = 0, diameterScale = 0, shortLandscape = false, mobileOrbitFrame = false;
  let moonHalf = 29;
  let visible = true, inspecting = false, localTime = 0, stillFrame = 0;
  let earthPoint = {x:0,y:0,depth:0};
  let viewRotation=0,sunY=0,rootDocumentTop=0,rootDocumentLeft=0,lastTracks=-1,tracksDirty=true,lastMoonVisibility=null;
  let sinPitch=0,cosPitch=1,sinRoll=0,cosRoll=1,cameraDistance=1,horizontalFit=1,openingGap=1,stageHeight=0,earthScreenRadius=1;
  // Reuse the small lighting vectors. Coordinates are hero pixels, Y down,
  // with positive Z toward the viewer, matching the orbit's depth convention.
  const heroSun={x:0,y:0,z:0},moonPosition={x:0,y:0,z:0};
  const planetPositions=Object.fromEntries(planets.map(p=>[p[0],{x:0,y:0,z:0,displayX:0,displayY:0,perspective:1,depthCue:.5,behindEarth:true,visible:true}]));
  const photo=document.querySelector(".journey-plate img");
  const apsides=[77.46,131.60,102.94,336.06,14.75,92.43,170.96,44.97];
  const distances=[.387,.723,1,1.524,5.203,9.537,19.191,30.069];
  planets.forEach((p,i)=>{
    // Foreground Earth is an enlargement. Radial distances are compressed
    // to frame the tilted plane without turning phone orbits into tall hoops.
    p[5]=[.52,.77,.94,.955,.97,.98,.99,1][i];
    if(window.Astronomy){
      const longitude=window.Astronomy.Ecliptic(window.Astronomy.HelioVector(p[0],new Date())).elon*Math.PI/180;
      const trueAnomaly=longitude-apsides[i]*Math.PI/180;
      const E=2*Math.atan2(Math.sqrt(1-p[3])*Math.sin(trueAnomaly/2),Math.sqrt(1+p[3])*Math.cos(trueAnomaly/2));
      p[6]=E-p[3]*Math.sin(E);
    }
  });
  const bodies = planets.map((planet, i) => {
    const [name,diameter,period] = planet;
    const button = document.createElement('button');
    button.dataset.planet=name;button.className = 'solar-body'; button.type = 'button';
    button.setAttribute('aria-label', `${name}: diameter ${diameter.toLocaleString()} kilometers, orbital period ${period.toLocaleString()} days`);
    const img = new Image(); img.src = `assets/${name.toLowerCase()}.webp`;
    img.className = name === 'Saturn' ? 'planet-ringed' : 'planet-disc';
    img.alt = ''; img.draggable = false; img.decoding = 'async';
    const model=document.createElement('span');model.className='planet-model';model.setAttribute('aria-hidden','true');model.append(img);
    button.append(model); host.append(button);
    if(name === "Earth"){img.hidden=true;button.classList.add("earth-location");button.textContent="VIEW FROM · NEW YORK CITY";}
    const show = () => {
      inspecting = true;
      detail.replaceChildren();
      const portrait = img.cloneNode(); portrait.className += ' planet-portrait'; portrait.hidden=false; portrait.style.width='54px';
      portrait.style.visibility='visible';
      // Same wording as v31; the name and figures are separate spans for the style audit.
      const copy = document.createElement('span');
      const label = document.createElement('span'); label.className = 'planet-detail-name'; label.textContent = name;
      const figures = document.createElement('span'); figures.className = 'planet-detail-figures';
      figures.textContent = ` · ${diameter.toLocaleString()} km · ${period.toLocaleString()} days${name === 'Earth' ? ' · Moon in orbit' : ''}`;
      copy.append(label, figures);
      detail.append(portrait, copy); detail.classList.add('is-visible');
    };
    const hide = () => { inspecting = false; detail.classList.remove('is-visible'); };
    button.addEventListener('pointerenter', show);
    button.addEventListener('pointerleave', () => { if(document.activeElement !== button) hide(); });
    button.addEventListener('focus', show); button.addEventListener('blur', hide);
    button.addEventListener('click', show);
    return {planet, button, img, model, perihelion:apsides[i]*Math.PI/180};
  });
  const moon = document.createElement('button'); moon.type = 'button'; moon.className = 'solar-body solar-moon';
  moon.setAttribute('aria-label','Moon: diameter 3,475 kilometers; orbits Earth every 27.3 days');
  const moonImage=document.createElement('canvas');moonImage.className='orbit-moon-disc';moon.append(moonImage);host.append(moon);
  const paintMoon=()=>window.Elev8Moon?.render(moonImage,58);
  window.addEventListener('elev8mi:moon',()=>{paintMoon();scheduleStill();});paintMoon();
  function showMoon() {
    inspecting=true;detail.replaceChildren();
    const portrait=document.createElement('canvas');portrait.className='planet-portrait';window.Elev8Moon?.render(portrait,54);
    const text=document.createElement('span');const label=document.createElement('span');label.className='planet-detail-name';label.textContent='Moon';const figures=document.createElement('span');figures.className='planet-detail-figures';figures.textContent=` · ${window.Elev8Moon?.state?.name || 'Live lunar phase'} · ${Math.round((window.Elev8Moon?.state?.illuminated || 0)*100)}% illuminated`;text.append(label,figures);
    detail.append(portrait,text);detail.classList.add('is-visible');
  }
  moon.addEventListener('pointerenter',showMoon);moon.addEventListener('pointerleave',()=>{if(document.activeElement!==moon){inspecting=false;detail.classList.remove('is-visible');}});moon.addEventListener('focus',showMoon);moon.addEventListener('click',showMoon);
  moon.addEventListener('blur',()=>{inspecting=false;detail.classList.remove('is-visible');});

  function position(body, eccentricAnomaly) {
    const p=body.planet, a=radius*p[5], e=p[3], angle=body.perihelion+viewRotation;
    const x=a*(Math.cos(eccentricAnomaly)-e);
    const z=a*Math.sqrt(1-e*e)*Math.sin(eccentricAnomaly);
    const rx=x*Math.cos(angle)-z*Math.sin(angle);
    const rz=x*Math.sin(angle)+z*Math.cos(angle);
    // Rotate the orbital plane in 3D, then use the same perspective divide
    // for its path and moving body. Earth/Sun's axis stays centered on screen.
    const wy=rx*Math.sin(p[4]*Math.PI/180);
    const cx=rx*cosRoll-wy*sinRoll,cy=rx*sinRoll+wy*cosRoll;
    const screenY=rz*sinPitch+cy*cosPitch,depth=rz*cosPitch-cy*sinPitch;
    const perspective=cameraDistance/Math.max(radius*.025,cameraDistance-depth);
    return {x:width/2+cx*perspective*horizontalFit,y:sunY+screenY*perspective,depth,perspective};
  }
  function fitTracks(){
    // Enclose each eccentric orbit in a Sun-centered circle, then fit that
    // circle's perspective projection. The same horizontal lens applies to
    // tracks and bodies; the centered Sun/Earth axis keeps its vertical anchor.
    let furthestDepth=0;
    bodies.forEach(({planet:p})=>{
      const reach=radius*p[5]*(1+p[3]);
      const tilt=sinRoll+Math.sin(p[4]*Math.PI/180)*cosRoll;
      furthestDepth=Math.max(furthestDepth,reach*Math.hypot(tilt*sinPitch,cosPitch));
    });
    cameraDistance=Math.max(cameraDistance,furthestDepth+radius*.025);
    let projectedWidth=1;
    bodies.forEach(({planet:p})=>{
      const reach=radius*p[5]*(1+p[3]),inclination=Math.sin(p[4]*Math.PI/180);
      const u=cosRoll-inclination*sinRoll,dX=-(sinRoll+inclination*cosRoll)*sinPitch,dZ=cosPitch;
      const denominator=cameraDistance*cameraDistance-reach*reach*(dX*dX+dZ*dZ);
      const center=u*reach*reach*cameraDistance*dX/denominator;
      const halfWidth=Math.abs(u)*reach*cameraDistance*Math.sqrt(Math.max(0,cameraDistance*cameraDistance-reach*reach*dZ*dZ))/denominator;
      projectedWidth=Math.max(projectedWidth,Math.abs(center)+halfWidth);
    });
    horizontalFit=Math.min(1,Math.max(1,width*.5-18)/projectedWidth);
  }
  function limbAt(x){
    const dx=rootDocumentLeft+x-innerWidth*.5;
    return earthPoint.y+earthScreenRadius-Math.sqrt(Math.max(0,earthScreenRadius*earthScreenRadius-dx*dx));
  }
  function earthClip(x,y){
    // Use the renderer's exact sphere silhouette across the whole sprite,
    // including rings and halos. No tangent line cuts through the planet.
    const points=['-100px -100px','144px -100px'];
    for(let step=0;step<=10;step++){const offset=122-step*24.4;points.push(`${(22+offset).toFixed(2)}px ${(22+limbAt(x+offset)-y).toFixed(2)}px`);}
    return `polygon(${points.join(',')})`;
  }
  function anomaly(mean,e) {
    let value=mean;
    for(let i=0;i<6;i++) value-=(value-e*Math.sin(value)-mean)/(1-e*Math.cos(value));
    return value;
  }
  function smoothstep(low,high,value) {
    const t=Math.max(0,Math.min(1,(value-low)/(high-low)));
    return t*t*(3-2*t);
  }
  function scheduleStill() {
    if(stillFrame)return;
    // Journey registers its geometry update first. This frame redraw follows
    // that update, without adding elapsed time to the orbital clock.
    stillFrame=requestAnimationFrame(()=>{
      stillFrame=0;draw();window.Elev8PlanetLighting?.refresh();
    });
  }
  function drawTracks(){
    if(!ctx)return;ctx.clearRect(0,0,width,stageHeight);
    const pulse=.82+.18*Math.sin(localTime*TAU/7.8);
    ctx.lineCap='round';ctx.lineJoin='round';
    bodies.forEach(body=>{
      ctx.setLineDash([]);ctx.beginPath();
      for(let step=0;step<=128;step++){const point=position(body,step/128*TAU);if(step)ctx.lineTo(point.x,point.y);else ctx.moveTo(point.x,point.y);}
      ctx.strokeStyle=`rgba(185,200,235,${(.055*pulse).toFixed(3)})`;ctx.lineWidth=.6;ctx.stroke();
      for(const front of [false,true]){
        ctx.beginPath();let connected=false;
        for(let i=0;i<=128;i++){const point=position(body,i/128*TAU);
          // Keep the complete projected paths, even over foreground Earth.
          // Their faint technical overlay is independent of body occlusion.
          if((point.depth>0)!==front){connected=false;continue;}
          if(connected)ctx.lineTo(point.x,point.y);else ctx.moveTo(point.x,point.y);connected=true;
        }
        const alpha=(front?.22:.085)*pulse*(body.planet[0]==='Earth'?1.35:1);
        ctx.strokeStyle=`rgba(${body.planet[0]==='Earth'?'151,214,255':'201,185,248'},${alpha.toFixed(3)})`;
        ctx.setLineDash(front?[]:[2,5]);ctx.lineWidth=front?.9:.6;ctx.stroke();
      }
    });ctx.setLineDash([]);
    // Foreground Earth hides the parts of every track that lie behind it, so a
    // planet setting at the limb reads as passing behind Earth, not into it.
    if(earthScreenRadius>1){ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();
      ctx.arc(innerWidth*.5-rootDocumentLeft,earthPoint.y+earthScreenRadius,earthScreenRadius,0,TAU);ctx.fill();ctx.restore();}
    tracksDirty=false;lastTracks=localTime;
  }
  function draw() {
    if(!width||!height)return;
    // Rotate the viewing frame with Earth, keeping the photographed foreground
    // Earth anchored. Other planets move relative to Earth in this view.
    const earth=bodies[2],pEarth=earth.planet;
    const earthMean=pEarth[6]+localTime*TAU/earthYearSeconds;
    const E=anomaly(earthMean,pEarth[3]);
    const trueAngle=Math.atan2(Math.sqrt(1-pEarth[3]**2)*Math.sin(E),Math.cos(E)-pEarth[3]);
    viewRotation=Math.PI/2-earth.perihelion-trueAngle;
    const rootTop=rootDocumentTop-window.scrollY;
    const state=window.elev8miJourney;
    let horizon=innerHeight*.56;
    if(state&&photo?.naturalWidth){
      const scale=Math.max(innerWidth/photo.naturalWidth,state.plateHeight/photo.naturalHeight);
      const dh=photo.naturalHeight*scale;
      horizon=(state.plateHeight-dh)/2+dh*.52-state.camera;
      earthScreenRadius=2.4*dh;
    }
    const earthRadius=radius*pEarth[5]*(1-pEarth[3]*Math.cos(E));
    // A phone uses a wide, oblique orbital plane viewed from outside the
    // system. Forcing its miniature Earth orbit down to the enlarged globe's
    // horizon placed the camera too close and turned its ellipses into hoops.
    // The foreground enlargement and lunar arc keep their original landmark.
    // Desktop retains its original Earth-anchored viewing geometry.
    cameraDistance=mobileOrbitFrame?radius*2.65:Math.max(radius*.72,openingGap*earthRadius*cosPitch/Math.max(1,openingGap-earthRadius*sinPitch));
    fitTracks();
    earthPoint={x:width/2,y:horizon-rootTop,depth:cameraDistance-radius*.02};
    if(tracksDirty||localTime-lastTracks>=1/10)drawTracks();
    bodies.forEach(body=>{
      const p=body.planet;
      const mean=p[6]+localTime*TAU/(earthYearSeconds*(p[2]/365.2));
      const point=p[0]==='Earth'?earthPoint:position(body,anomaly(mean,p[3]));
      body.orbitPoint=point;
      const lightPoint=planetPositions[p[0]];lightPoint.x=point.x;lightPoint.y=point.y;lightPoint.z=point.depth;
      lightPoint.perspective=point.perspective||1;
      lightPoint.depthCue=smoothstep(-radius*.72,radius*.72,point.depth);
      // Seen from Earth, every planet is farther than Earth and the Moon. Depth
      // order among planets uses a fine scale inside the solar-bodies layer.
      body.button.style.zIndex=p[0]==='Earth'?'1001':String(Math.round(500+400*Math.max(-1,Math.min(1,point.depth/(radius*1.3)))));
      body.displayScale=p[0]==='Earth'?1:Math.max(.48,Math.min(2.25,point.perspective));
      body.button.style.setProperty('--planet-perspective',body.displayScale.toFixed(4));
      body.button.dataset.displayScale=body.displayScale.toFixed(4);
      body.button.style.opacity='1';
      body.model.style.filter=p[0]==='Earth'?'':`blur(${((1-lightPoint.depthCue)*.18).toFixed(3)}px) brightness(${(.74+.26*lightPoint.depthCue).toFixed(3)})`;
    });
    // The large Earth is a foreground enlargement. The visible Moon passes
    // across an ellipse centered below its horizon, rather than a tiny replica.
    const angle=moonOrbitPhase-Math.PI/2+localTime*TAU/moonOrbitSeconds;
    // The Moon is Earth's nearest neighbour: a tighter, closer orbit.
    const rx=width*.27,ry=Math.min(shortLandscape?48:70,height*.13),cy=earthPoint.y-22;
    const arc=window.Elev8HeroApex?.moonArc?.(earthPoint.x,cy,rx,ry,rootTop,rootDocumentLeft-window.scrollX)||{cx:earthPoint.x,cy,rx,ry};
    const mx=arc.cx+Math.cos(angle)*arc.rx,my=arc.cy+Math.sin(angle)*arc.ry;
    moon.style.transform=`translate3d(${mx-22}px,${my-22}px,0)`;
    // On the far half of the orbit, Earth's photographed limb clips the Moon.
    // The curved limb rises at the center and falls toward the photograph edges.
    const limb=limbAt(mx);
    const rear=Math.sin(angle)>0;
    const visibleHeight=rear?Math.max(0,Math.min(moonHalf*2,limb-(my-moonHalf))):moonHalf*2;
    // Let the crescent's halo extend beyond its button. Only Earth's limb
    // clips it: the far-side glow must not draw over the foreground planet.
    moon.style.clipPath=rear?earthClip(mx,my):'none';
    const moonVisible=visibleHeight>0;
    if(!moonVisible&&document.activeElement===moon){moon.blur();inspecting=false;detail.classList.remove('is-visible');}
    if(moonVisible!==lastMoonVisibility){moon.style.opacity=moonVisible?'1':'0';moon.style.pointerEvents=moonVisible?'auto':'none';moon.tabIndex=moonVisible?0:-1;moon.setAttribute('aria-hidden',moonVisible?'false':'true');lastMoonVisibility=moonVisible;}
    moon.style.zIndex='1000';
    // Bodies sit exactly on their projected orbits. No spacing or anti-overlap
    // nudges: planets at different depths may overlap and occlude each other.
    const markers=bodies.map(body=>({body,x:body.orbitPoint.x,y:body.orbitPoint.y,r:body.displayRadius*body.displayScale,fixed:body.planet[0]==='Earth'}));
    markers.forEach(marker=>{
      const body=marker.body;if(!body)return;
      const lightPoint=planetPositions[body.planet[0]];lightPoint.displayX=marker.x;lightPoint.displayY=marker.y;
      body.button.style.transform=`translate3d(${marker.x-22}px,${marker.y-22}px,0)`;
      if(body.planet[0]==='Earth')return;
      const limb=limbAt(marker.x),behindEarth=body.orbitPoint.depth<earthPoint.depth;
      const visible=(!behindEarth||marker.y-marker.r<limb)&&marker.x+marker.r>0&&marker.x-marker.r<width&&marker.y+marker.r>0&&marker.y-marker.r<stageHeight;
      lightPoint.behindEarth=behindEarth;lightPoint.visible=visible;
      body.button.style.visibility=visible?'visible':'hidden';body.button.tabIndex=visible?0:-1;body.button.setAttribute('aria-hidden',String(!visible));
      body.button.style.clipPath=behindEarth?earthClip(marker.x,marker.y):'none';
      if(!visible&&document.activeElement===body.button){body.button.blur();inspecting=false;detail.classList.remove('is-visible');}
    });
    // Civil twilight extends briefly below the horizon. Dawn and dusk have
    // separate directions, while the visible Sun follows the Moon's rear arc.
    // Screen-space azimuth is shared with the atmosphere renderer, so its
    // warm horizon, cloud lighting and disc all agree on the light's position.
    const solarAltitude=Math.sin(angle);
    const sunRising=Math.cos(angle)>0;
    const sunAzimuth=.5-.27*Math.cos(angle);
    const daylight=smoothstep(-.10,.72,solarAltitude);
    const twilight=1-smoothstep(0,.42,Math.abs(solarAltitude));
    const sunrise=sunRising?twilight:0,sunset=sunRising?0:twilight;
    const phase=twilight>.01?(sunRising?'sunrise':'sunset'):(solarAltitude>0?'day':'night');
    heroSun.x=width/2;heroSun.y=sunY;
    moonPosition.x=mx;moonPosition.y=my;moonPosition.z=-Math.sin(angle)*rx;
    const lunarIllumination=Math.max(0,Math.min(1,Number(window.Elev8Moon?.state?.illuminated)||0));
    const moonScreenX=(rootDocumentLeft-window.scrollX+mx)/innerWidth;
    const moonScreenY=(rootTop+my)/innerHeight;
    const moonAltitude=Math.max(-1,Math.min(1,(horizon-(rootTop+my))/120));
    const moonLight=.22*lunarIllumination*(visibleHeight/(moonHalf*2))*(1-daylight);
    document.documentElement.style.setProperty('--daylight',daylight.toFixed(3));
    document.documentElement.style.setProperty('--nightlight',(1-daylight).toFixed(3));
    document.documentElement.style.setProperty('--twilight',twilight.toFixed(3));
    document.documentElement.style.setProperty('--sunrise',sunrise.toFixed(3));
    document.documentElement.style.setProperty('--sunset',sunset.toFixed(3));
    document.documentElement.style.setProperty('--sun-azimuth',sunAzimuth.toFixed(4));
    document.documentElement.style.setProperty('--twilight-color',sunRising?'255 168 92':'255 116 84');
    const risingSun=document.getElementById('horizonSun');if(risingSun){const radius=Math.max(34,Math.min(62,innerWidth*.046))/2;const sunCenter=horizon+radius-Math.max(0,solarAltitude)*(window.Elev8HeroApex?.sunRise?.(horizon,radius)??(110+radius));risingSun.style.left=window.Elev8HeroApex?.sunLeft?.(sunAzimuth)??`${sunAzimuth*100}%`;risingSun.style.top=`${sunCenter}px`;risingSun.style.opacity=solarAltitude>.001?'1':'0';risingSun.style.clipPath=`inset(-240px -240px ${Math.max(-240,sunCenter+radius-horizon)}px -240px)`;}
    window.elev8miCelestial={moonBehindEarth:rear,moonVisible:visibleHeight>0,time:localTime,orbitRate,earthYearSeconds,moonOrbitSeconds,earthSpinSeconds,solarAltitude,sunAzimuth,sunRising,phase,sunrise,sunset,twilight,daylight,horizon,width,height,heroSun,moonPosition,planetPositions,lunarIllumination,moonScreenX,moonScreenY,moonAltitude,moonLight,cameraDistance,horizontalFit,mobileOrbitFrame,sinPitch,orbitalRadius:radius,earthOcclusionDepth:earthPoint.depth,earthScreenRadius};
  }
  function resize() {
    const rect=root.getBoundingClientRect();rootDocumentTop=rect.top+window.scrollY;rootDocumentLeft=rect.left+window.scrollX;tracksDirty=true;
    width=root.clientWidth;height=root.clientHeight;
    shortLandscape=innerWidth>innerHeight&&innerHeight<=500;
    const portrait=innerWidth<innerHeight;
    mobileOrbitFrame=portrait&&innerWidth<=720;
    radius=width*(mobileOrbitFrame?.405:width<600?.30:.435);
    sunY=shortLandscape?Math.max(108,innerHeight*.37)-rootDocumentTop:height*.27;
    // Rotate the complete plane, including its depth axis; no screen-Y squash.
    // The front arc expands and rear arc recedes through perspective naturally.
    const pitch=(mobileOrbitFrame?24:portrait?52:12)*Math.PI/180,roll=(mobileOrbitFrame?-9:portrait?-5:-8)*Math.PI/180;
    sinPitch=Math.sin(pitch);cosPitch=Math.cos(pitch);sinRoll=Math.sin(roll);cosRoll=Math.cos(roll);
    openingGap=Math.max(40,innerHeight*(shortLandscape?.86:.56)-rootDocumentTop-sunY);
    stageHeight=Math.ceil(Math.max(height,innerHeight*.80));
    root.style.setProperty('--orbit-stage-height',`${stageHeight}px`);
    // The emblem and orbit/light origin share this exact measured position.
    root.style.setProperty('--hero-sun-y',`${sunY}px`);
    diameterScale=(width<600?36:60)/142984;
    const dpr=Math.min(window.devicePixelRatio||1,innerWidth<=720?1.5:2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(stageHeight*dpr);
    if(ctx){
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    }
    bodies.forEach(body=>{
      const distanceScale=1/(1+.42*Math.log1p(distances[bodies.indexOf(body)]));
      const size=Math.max(width<600?6:8,body.planet[1]*diameterScale*distanceScale);
      // Saturn's full sprite includes rings; its globe is 42% of sprite width.
      const spriteWidth=size*(body.planet[0]==='Saturn'?2.38:1);
      body.img.style.width=`${spriteWidth}px`;
      body.displayRadius=body.planet[0]==='Earth'?38:Math.max(4,spriteWidth/2);
    });
    moonHalf=(moonImage.offsetWidth||58)/2;
    paintMoon();draw();if(window.Elev8Motion.paused)scheduleStill();
  }
  // v32: the Moon-phase pill is a small badge fixed in the page's bottom-right
  // corner (v33: where the Pause motion button was). It fades aside whenever it would cover a
  // control, so it never blocks nav, sound, draws, booking or forms.
  const pill=document.querySelector('.moon-now');
  if(pill){document.body.append(pill);pill.classList.add('moon-pill');}
  const controls='a[href],button,input,select,textarea,label,[role="menuitemradio"],[tabindex="0"]';
  let pillFrame=0;
  function checkPill(){
    pillFrame=0;if(!pill)return;const r=pill.getBoundingClientRect();if(!r.width)return;
    pill.style.visibility='hidden';let covered=false;
    for(let i=0;i<=4&&!covered;i++)for(let j=0;j<=2&&!covered;j++){
      const t=document.elementFromPoint(r.left+2+(r.width-4)*i/4,r.top+2+(r.height-4)*j/2);
      if(t&&t.closest(controls)&&!t.closest('.solar-body'))covered=true;
    }
    pill.style.visibility='';pill.classList.toggle('is-yielding',covered);
  }
  const queuePill=()=>{if(!pillFrame)pillFrame=requestAnimationFrame(checkPill);};
  window.addEventListener('scroll',queuePill,{passive:true});window.addEventListener('resize',queuePill,{passive:true});
  document.addEventListener('toggle',queuePill,true);document.addEventListener('click',()=>setTimeout(queuePill,350),true);
  // v32: the hero card sits right under Earth and the orbits, in the first
  // screen. Earth's horizon opens at 56% of the viewport height.
  const heroCopy=document.querySelector('.hero-copy');let heroWidth=0;
  function placeHeroCopy(){
    if(!heroCopy)return;
    const touch=matchMedia('(pointer: coarse)').matches;
    if(touch&&heroWidth===innerWidth&&heroCopy.style.marginTop)return; // ignore URL-bar height changes
    heroWidth=innerWidth;heroCopy.style.marginTop='0px';heroCopy.style.marginBottom='';
    let top=0;for(let e=heroCopy;e;e=e.offsetParent)top+=e.offsetTop;
    const target=Math.round(innerHeight*.56+(innerWidth<=720?34:42)),lift=Math.min(0,target-top);
    // The same space is returned below the card, so the hero keeps its height:
    // Earth's opening horizon and every later section stay where they were.
    heroCopy.style.marginTop=`${lift}px`;heroCopy.style.marginBottom=`${-lift}px`;queuePill();
  }
  placeHeroCopy();window.addEventListener('resize',placeHeroCopy,{passive:true});
  document.fonts?.ready.then(()=>{heroWidth=0;placeHeroCopy();});window.addEventListener('load',()=>{heroWidth=0;placeHeroCopy();});
  if('ResizeObserver'in window&&pill){const watch=new ResizeObserver(queuePill);watch.observe(pill);if(heroCopy)watch.observe(heroCopy);}
  // Entrance animations settle the page after load; re-check once they end.
  document.addEventListener('animationend',queuePill,true);[1500,4000].forEach(delay=>setTimeout(queuePill,delay));
  window.addEventListener('scroll',()=>{tracksDirty=true;if(window.Elev8Motion.paused)scheduleStill();},{passive:true});
  document.fonts?.ready.then(resize);
  if('ResizeObserver'in window)new ResizeObserver(resize).observe(root);
  window.addEventListener('resize',resize,{passive:true});
  if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;},{rootMargin:'100px'}).observe(root);
  window.Elev8Motion.add((time,dt)=>{localTime+=dt;
    // The celestial clock powers the whole scroll journey. Keep it advancing
    // beyond the hero; its offscreen markers remain a negligible eight bodies.
    draw();});
  resize();
})();
