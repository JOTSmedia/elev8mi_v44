(() => {
  'use strict';
  const canvas=document.getElementById('worldEffects');
  const world=document.getElementById('journeyWorld');
  const journey=document.getElementById('journey');
  if(!canvas||!world||!journey||!window.Elev8Motion)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const plates=[...world.querySelectorAll('.journey-plate')];
  const cave=plates[2]?.querySelector('img');
  const surface=plates[1]?.querySelector('img');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  let w=0,h=0,lastFog=-1,lastDay=-1,lastMist=-1,lastRays=-1;
  const stars=Array.from({length:90},(_,i)=>({x:((i*73.37)%100)/100,y:((i*31.71)%100)/100,r:.35+(i%4)*.18,phase:i*1.7}));
  const dust=Array.from({length:27},(_,i)=>({x:((i*61.13)%100)/100,y:((i*43.79)%100)/100,s:.3+(i%6)*.15}));
  function resize(){
    w=innerWidth;h=innerHeight;const dpr=Math.min(devicePixelRatio||1,innerWidth<=720?1.5:2);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  // Cache photographic cloud detail once per source, only when a GPU is not
  // available. Terrain is excluded from these layers: moving a whole picture
  // of Earth also moves its coastlines and makes the planet look rubbery.
  const cloudLayers=plates.slice(0,2).map((plate,index)=>({image:plate.querySelector('img'),index,source:'',tones:[]}));
  const cloudTones=[[131,151,186],[235,246,255],[255,183,126],[240,142,117]];
  const earthPhoto=cloudLayers[0]?.image;
  cloudLayers.forEach(layer=>layer.image?.addEventListener('load',()=>{
    if(window.Elev8Motion.paused&&!window.Elev8Boot?.hold&&!document.hidden)render(window.Elev8Motion.time);
  }));
  // An inexpensive spherical renderer keeps Earth alive without WebGL. Map
  // pixels and ray intersections are cached; only longitude and lighting
  // change between frames. Loading these optional maps never gates entrance.
  const earthMapSize=512,earthMaps=[];
  const earthBuffer=document.createElement('canvas'),earthPainter=earthBuffer.getContext('2d');
  let earthRequested=false,earthProjection=null,earthSky=[4,8,17],earthSkySource='',earthLastTime=-Infinity,earthLastWeather=-Infinity,earthLastLight='',earthFrames=0,earthRenderMs=0,earthActive=false;
  function requestEarthMaps(){
    if(earthRequested||!earthPainter)return;earthRequested=true;
    // v35: the 1K maps are plenty for the 512x256 sample (and spare phone memory).
    ['assets/space/earth-surfacemap-m.webp','assets/space/earth-cloudmap-m.webp'].forEach((source,index)=>{
      const image=new Image();image.decoding='async';image.onload=()=>{
        try{
          const sample=document.createElement('canvas');sample.width=earthMapSize;sample.height=earthMapSize/2;
          const painter=sample.getContext('2d',{willReadFrequently:true});if(!painter)return;
          painter.drawImage(image,0,0,sample.width,sample.height);
          earthMaps[index]=painter.getImageData(0,0,sample.width,sample.height).data;
          sample.width=sample.height=1;
          earthLastTime=-Infinity;
        }catch(_){earthMaps[index]=null;}
        finally{image.onload=null;image.removeAttribute('src');}
        if(window.Elev8Motion.paused&&!window.Elev8Boot?.hold&&!document.hidden)render(window.Elev8Motion.time);
      };image.src=source;
    });
  }
  function cacheEarthSky(){
    const source=earthPhoto?.currentSrc||earthPhoto?.src;
    if(!earthPhoto?.naturalWidth||earthSkySource===source)return;
    earthSkySource=source;
    try{
      const strip=document.createElement('canvas');strip.width=earthMapSize;strip.height=1;
      const painter=strip.getContext('2d',{willReadFrequently:true});if(!painter)return;
      // Only the unaffected space photograph may supply the background.
      // Everything at and below the atmospheric boundary is generated.
      painter.drawImage(earthPhoto,0,earthPhoto.naturalHeight*.405,earthPhoto.naturalWidth,1,0,0,earthMapSize,1);
      const data=painter.getImageData(0,0,earthMapSize,1).data;earthSky=[0,0,0];
      for(let x=0;x<earthMapSize;x++){earthSky[0]+=data[x*4]/earthMapSize;earthSky[1]+=data[x*4+1]/earthMapSize;earthSky[2]+=data[x*4+2]/earthMapSize;}
    }catch(_){earthSky=[4,8,17];}
  }
  const tiltCos=Math.cos(.408407),tiltSin=Math.sin(.408407),viewCos=Math.cos(1.04719755),viewSin=Math.sin(1.04719755);
  function mapCoordinates(x,y,z,target,index){
    const tx=x*tiltCos-y*tiltSin,ty=x*tiltSin+y*tiltCos;
    const wy=ty*viewCos-z*viewSin,wz=ty*viewSin+z*viewCos;
    target[index]=Math.atan2(tx,wz)/(Math.PI*2)+.5;target[index+1]=clamp(.5-Math.asin(clamp(wy,-1,1))/Math.PI,.001,.999);
  }
  function projectEarth(state,g){
    const start=Math.max(0,Math.floor(g.dy+g.dh*.42)),end=Math.min(h,state.plateHeight-state.camera);
    if(end<=start)return null;
    const height=end-start,mobile=w<720,budget=mobile?85000:120000;
    const scale=Math.min((mobile?288:400)/w,Math.sqrt(budget/(w*height)),1);
    const cols=Math.max(1,Math.ceil(w*scale)),rows=Math.max(1,Math.ceil(height*scale));
    const key=[cols,rows,start.toFixed(1),height.toFixed(1),g.dx.toFixed(1),g.dy.toFixed(1),g.dw.toFixed(1),g.dh.toFixed(1),state.seam].join(':');
    if(earthProjection?.key===key)return earthProjection;
    earthBuffer.width=cols;earthBuffer.height=rows;
    const count=cols*rows,normals=new Float32Array(count*3),cloudNormals=new Float32Array(count*3);
    const uv=new Float32Array(count*2),weatherUV=new Float32Array(count*2),aerosolUV=new Float32Array(count*2),aerosolMask=new Uint8Array(count),aerosolColumn=new Float32Array(count),aerosolExterior=new Float32Array(count),aerosolNormals=new Float32Array(count*3),limb=new Float32Array(count),ring=new Float32Array(count);
    const kind=new Uint8Array(count),alpha=new Uint8ClampedArray(count),skyHeight=new Float32Array(count);
    const radius=2.4,aspect=earthPhoto.naturalWidth/earthPhoto.naturalHeight;
    const surfaceTop=state.plateHeight-state.seam-state.camera,blendTop=g.dy+g.dh*.42;
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const p=y*cols+x,sx=(x+.5)*w/cols,sy=start+(y+.5)*height/rows;
      const u=(sx-g.dx)/g.dw,v=(sy-g.dy)/g.dh;
      const nx=(u-.5)*aspect/radius,ny=(.52+radius-v)/radius,r2=nx*nx+ny*ny;
      const horizon=.52+radius-Math.sqrt(Math.max(0,radius*radius-((u-.5)*aspect)**2));
      // Fade into the unaltered Milky Way above the limb, then take complete
      // ownership before reaching the old photograph's Earth edge.
      alpha[p]=Math.round(255*smooth(blendTop,blendTop+g.dh*.035,sy)*(1-smooth(surfaceTop,surfaceTop+state.seam,sy)));
      skyHeight[p]=clamp((horizon-v)/.525);
      ring[p]=Math.exp(-Math.abs(Math.sqrt(r2)-1)/.0045);
      if(r2<1){
        kind[p]=1;const nz=Math.sqrt(1-r2),n=p*3;normals[n]=nx;normals[n+1]=ny;normals[n+2]=nz;
        mapCoordinates(nx,ny,nz,uv,p*2);limb[p]=(1-nz)**4;
      }
      const cx=nx/1.003,cy=ny/1.003,cr2=cx*cx+cy*cy;
      if(cr2<1){
        if(!kind[p])kind[p]=2;const cz=Math.sqrt(1-cr2),n=p*3;cloudNormals[n]=cx;cloudNormals[n+1]=cy;cloudNormals[n+2]=cz;
        mapCoordinates(cx,cy,cz,weatherUV,p*2);
      }
      // The raised aerosol sphere reaches beyond the solid limb and the
      // high cloud shell. Its texture rotates about exactly the same axis.
      const ax=nx/1.016,ay=ny/1.016,ar2=ax*ax+ay*ay;
      if(ar2<1){
        const az=Math.sqrt(1-ar2),n=p*3,fade=1-smooth(.001,.016,Math.max(0,Math.sqrt(r2)-1));
        aerosolMask[p]=1;mapCoordinates(ax,ay,az,aerosolUV,p*2);
        aerosolNormals[n]=ax;aerosolNormals[n+1]=ay;aerosolNormals[n+2]=az;
        aerosolColumn[p]=(1-az)**2.5*fade**1.45;aerosolExterior[p]=smooth(.999,1.001,r2);
      }
    }
    earthProjection={key,cols,rows,start,height,normals,cloudNormals,uv,weatherUV,aerosolUV,aerosolMask,aerosolColumn,aerosolExterior,aerosolNormals,limb,ring,kind,alpha,skyHeight,sunward:new Float32Array(cols),lunarward:new Float32Array(cols),pixels:earthPainter.createImageData(cols,rows)};
    earthLastTime=-Infinity;return earthProjection;
  }
  function normalize(x,y,z){const length=Math.hypot(x,y,z)||1;return [x/length,y/length,z/length];}
  function earthWeatherSample(u,v){
    u-=Math.floor(u);const row=Math.min(earthMapSize/2-1,Math.max(0,Math.floor(v*earthMapSize/2)))*earthMapSize;
    const at=u*earthMapSize,x=Math.floor(at),t=at-x;
    const a=(row+x)*4,b=(row+(x+1)%earthMapSize)*4;
    return (earthMaps[1][a]*(1-t)+earthMaps[1][b]*t)/255;
  }
  function drawEarth(time,state,clock,depth){
    earthActive=false;if(reducedMotion.matches){delete journey.dataset.earthFallback;return;}
    const g=photoGeometry(earthPhoto,0,state);if(!g||g.dy+g.dh*.42>h||g.dy+g.dh<0)return;
    requestEarthMaps();if(!earthMaps[0]||!earthMaps[1]||!earthPainter)return;
    cacheEarthSky();const projection=projectEarth(state,g);if(!projection)return;
    const frameTime=clock?.time??time,fps=w<720?15:20;
    const lightKey=[clock?.daylight,clock?.twilight,clock?.sunAzimuth,clock?.moonLight].map(value=>(value||0).toFixed(3)).join(':');
    // Reuse the last projected frame between bounded CPU updates. Geometry
    // changes, a replay, or pause/resume repaint immediately at its new state.
    if(Math.abs(frameTime-earthLastTime)>=1/fps||Math.abs(time-earthLastWeather)>=1/fps||(window.Elev8Motion.paused&&lightKey!==earthLastLight)){
      const started=performance.now(),{cols,rows,normals,cloudNormals,uv,weatherUV,aerosolUV,aerosolMask,aerosolColumn,aerosolExterior,aerosolNormals,kind,alpha,limb,ring,skyHeight,pixels}=projection;
      const day=clamp(clock?.daylight||0),twilight=clamp(clock?.twilight||0),rising=clock?.sunRising!==false;
      const spin=frameTime/(clock?.earthSpinSeconds||360),weather=time%10000;
      const glowBreath=1+.08*Math.sin(time*Math.PI*2/7.78+3.46);
      const solarX=clock?.sunAzimuth??.33,solarAltitude=clock?.solarAltitude||0;
      const moon=clamp(clock?.moonLight??((clock?.moonVisible?1:0)*(window.Elev8Moon?.state?.illuminated||0)*(1-day)*.10));
      const moonX=clock?.moonScreenX??.65;
      const light=normalize((solarX-.5)*2.4,.10+Math.max(0,solarAltitude)*.72,.30+day*.65);
      const lunarLight=normalize((moonX-.5)*2.4,.12+Math.max(0,clock?.moonAltitude||0)*.60,.50);
      const halfSun=normalize(light[0],light[1],light[2]+1),halfMoon=normalize(lunarLight[0],lunarLight[1],lunarLight[2]+1);
      const warm=rising?[1,.63,.32]:[1,.35,.19],ambient=.30+.12*day+.07*twilight;
      const horizonColor=mixColor(mixColor([11,17,33],[156,204,242],day),warm.map(c=>c*255),twilight);
      const highColor=mixColor(mixColor([2,5,12],[26,77,158],day),rising?[33,54,102]:[56,31,79],twilight);
      const immersion=smooth(.35,.80,depth),{sunward,lunarward}=projection;
      const ground=earthMaps[0],out=pixels.data;
      for(let x=0;x<cols;x++){
        const u=((x+.5)*w/cols-g.dx)/g.dw;
        sunward[x]=Math.exp(-(((u-solarX)/.40)**2));lunarward[x]=Math.exp(-(((u-moonX)/.38)**2));
      }
      for(let p=0;p<cols*rows;p++){
        const x=p%cols,n=p*3,k=p*4,m=p*2;
        let r=0,gc=0,b=0,cloud=0,cloudMoon=0;
        const height=skyHeight[p],skyBlend=clamp(immersion+(1-immersion)*Math.exp(-height*7)*(day*.91+twilight*.92));
        const tint=height**.65;
        r=earthSky[0]*(1-skyBlend)+(horizonColor[0]+(highColor[0]-horizonColor[0])*tint)*skyBlend;
        gc=earthSky[1]*(1-skyBlend)+(horizonColor[1]+(highColor[1]-horizonColor[1])*tint)*skyBlend;
        b=earthSky[2]*(1-skyBlend)+(horizonColor[2]+(highColor[2]-horizonColor[2])*tint)*skyBlend;
        if(kind[p]){
          const cx=cloudNormals[n],cy=cloudNormals[n+1],cz=cloudNormals[n+2];
          const cu=weatherUV[m]+spin,cv=weatherUV[m+1];
          const dense=earthWeatherSample(cu+weather*.00085,cv+.0015*Math.sin(weather*.043+cu*19)),cirrus=earthWeatherSample(cu-weather*.00135+.13,.25+cv*.50);
          cloud=clamp(dense*.88+smooth(.28,.84,cirrus)*.21);
          const cloudSun=Math.max(0,cx*light[0]+cy*light[1]+cz*light[2]);
          cloudMoon=Math.max(0,cx*lunarLight[0]+cy*lunarLight[1]+cz*lunarLight[2]);
          let cr=.17+( .91*(.50+.50*cloudSun)-.17)*day,cg=.24+(.96*(.50+.50*cloudSun)-.24)*day,cb=.36+(1*(.50+.50*cloudSun)-.36)*day;
          cr+=(warm[0]*(.46+.51*cloudSun)-cr)*twilight*.78;cg+=(warm[1]*(.46+.51*cloudSun)-cg)*twilight*.78;cb+=(warm[2]*(.46+.51*cloudSun)-cb)*twilight*.78;
          cr+=.48*cloudMoon*moon*.46;cg+=.65*cloudMoon*moon*.46;cb+=cloudMoon*moon*.46;
          if(kind[p]===1){
            const longitude=uv[m]+spin,wrapped=longitude-Math.floor(longitude),at=wrapped*earthMapSize,ix=Math.floor(at),fx=at-ix;
            const iy=Math.min(earthMapSize/2-2,Math.floor(uv[m+1]*(earthMapSize/2-1))),fy=uv[m+1]*(earthMapSize/2-1)-iy;
            const a=(iy*earthMapSize+ix)*4,c=(iy*earthMapSize+(ix+1)%earthMapSize)*4,d=a+earthMapSize*4,e=c+earthMapSize*4;
            const lr=((ground[a]*(1-fx)+ground[c]*fx)*(1-fy)+(ground[d]*(1-fx)+ground[e]*fx)*fy)/255;
            const lg=((ground[a+1]*(1-fx)+ground[c+1]*fx)*(1-fy)+(ground[d+1]*(1-fx)+ground[e+1]*fx)*fy)/255;
            const lb=((ground[a+2]*(1-fx)+ground[c+2]*fx)*(1-fy)+(ground[d+2]*(1-fx)+ground[e+2]*fx)*fy)/255;
            const nx=normals[n],ny=normals[n+1],nz=normals[n+2];
            const diffuse=Math.max(0,nx*light[0]+ny*light[1]+nz*light[2]),lunarDiffuse=Math.max(0,nx*lunarLight[0]+ny*lunarLight[1]+nz*lunarLight[2]);
            const exposure=1.08*(ambient+(.88*day+.20*twilight)*diffuse)*(1-cloud*(.10+.15*day));
            const water=(1-smooth(.025,.13,lr))*smooth(.01,.05,lb-lr);
            const sunSpec=water>.01?Math.max(0,nx*halfSun[0]+ny*halfSun[1]+nz*halfSun[2])**80*water*.20*(1-cloud)*day:0;
            const moonSpec=water>.01&&moon>0?Math.max(0,nx*halfMoon[0]+ny*halfMoon[1]+nz*halfMoon[2])**65*water*.10*(1-cloud)*moon:0;
            const cover=smooth(.12,.88,cloud)*.92;
            r=lr*exposure*(1+twilight*.12*.32)+lr*.46*lunarDiffuse*moon*.42;
            gc=lg*exposure*(1-twilight*.33*.32)+lg*.64*lunarDiffuse*moon*.42;
            b=lb*exposure*(1-twilight*.60*.32)+lb*lunarDiffuse*moon*.42;
            r+=(cr-r)*cover;gc+=(cg-gc)*cover;b+=(cb-b)*cover;
            r+=sunSpec+.42*moonSpec;gc+=.92*sunSpec+.66*moonSpec;b+=.77*sunSpec+moonSpec;
            let ar=.055+(.30-.055)*day,ag=.12+(.62-.12)*day,ab=.24+(.92-.24)*day;
            ar+=(warm[0]*.8-ar)*twilight;ag+=(warm[1]*.8-ag)*twilight;ab+=(warm[2]*.8-ab)*twilight;
            ar+=.19*moon*cloudMoon;ag+=.34*moon*cloudMoon;ab+=.60*moon*cloudMoon;
            const haze=limb[p]*(.25+.25*sunward[x])*(.86+.14*cloud);
            r+=(ar-r)*haze;gc+=(ag-gc)*haze;b+=(ab-b)*haze;r*=255;gc*=255;b*=255;
          }else{
            const cover=smooth(.15,.82,cloud)*.38;
            r+=(cr*255-r)*cover;gc+=(cg*255-gc)*cover;b+=(cb*255-b)*cover;
          }
        }
        let aerosol=0;
        // The primary cloud shell already owns interior weather. Restrict
        // extra optical sampling to the grazing limb and exterior sky.
        if(aerosolMask[p]&&aerosolColumn[p]>.007&&(aerosolExterior[p]>.01||ring[p]>.015)){
          const au=aerosolUV[m]+spin,av=aerosolUV[m+1];
          const low=earthWeatherSample(au+weather*.00085,av+.0015*Math.sin(weather*.043+au*19));
          const high=earthWeatherSample(au-weather*.00135+.13,.25+av*.50);
          aerosol=clamp(low*.88+smooth(.28,.84,high)*.21);
          const column=aerosolColumn[p],outside=aerosolExterior[p];
          const airSun=Math.max(0,aerosolNormals[n]*light[0]+aerosolNormals[n+1]*light[1]+aerosolNormals[n+2]*light[2]);
          const airMoon=Math.max(0,aerosolNormals[n]*lunarLight[0]+aerosolNormals[n+1]*lunarLight[1]+aerosolNormals[n+2]*lunarLight[2]);
          let sr=.055+(.28-.055)*day,sg=.13+(.58-.13)*day,sb=.27+(.88-.27)*day;
          const warmWeight=twilight*sunward[x]*.83;
          sr+=(warm[0]*.92-sr)*warmWeight;sg+=(warm[1]*.92-sg)*warmWeight;sb+=(warm[2]*.92-sb)*warmWeight;
          sr+=.19*moon*airMoon;sg+=.34*moon*airMoon;sb+=.60*moon*airMoon;
          const opacity=(.06+.57*aerosol**.72)*column*(.2+.8*outside);
          r+=(sr*255-r)*opacity;gc+=(sg*255-gc)*opacity;b+=(sb*255-b)*opacity;
          let vr=.11+(.75*(.55+.45*airSun)-.11)*day,vg=.19+(.86*(.55+.45*airSun)-.19)*day,vb=.34+((.55+.45*airSun)-.34)*day;
          vr+=(warm[0]*(.48+.47*airSun)-vr)*warmWeight;vg+=(warm[1]*(.48+.47*airSun)-vg)*warmWeight;vb+=(warm[2]*(.48+.47*airSun)-vb)*warmWeight;
          vr+=.48*moon*airMoon*.46;vg+=.65*moon*airMoon*.46;vb+=moon*airMoon*.46;
          const veil=smooth(.12,.58,aerosol)*column*outside*.32;
          r+=(vr*255-r)*veil;gc+=(vg*255-gc)*veil;b+=(vb*255-b)*veil;
        }
        // Haze optical density changes outside the limb too. Its shape stays
        // spherical; only satellite cloud/aerosol detail advects through it.
        const rim=ring[p]*(.18+.52*aerosol)*glowBreath;
        let rr=.07+(.29-.07)*day,rg=.17+(.61-.17)*day,rb=.35+(.95-.35)*day;
        const rimWarm=.63+.32*sunward[x];rr+=(warm[0]*rimWarm-rr)*twilight;rg+=(warm[1]*rimWarm-rg)*twilight;rb+=(warm[2]*rimWarm-rb)*twilight;
        rr+=.19*lunarward[x]*moon;rg+=.35*lunarward[x]*moon;rb+=.65*lunarward[x]*moon;
        out[k]=r+(rr*255-r)*rim;out[k+1]=gc+(rg*255-gc)*rim;out[k+2]=b+(rb*255-b)*rim;out[k+3]=alpha[p];
      }
      earthPainter.putImageData(pixels,0,0);earthLastTime=frameTime;earthLastWeather=time;earthLastLight=lightKey;earthFrames++;earthRenderMs=performance.now()-started;
    }
    ctx.drawImage(earthBuffer,0,projection.start,w,projection.height);earthActive=true;
    if(journey.dataset.earthFallback!=='projected')journey.dataset.earthFallback='projected';
  }
  window.Elev8EarthFallback={get active(){return earthActive;},get frames(){return earthFrames;},get width(){return earthBuffer.width;},get height(){return earthBuffer.height;},get renderMs(){return earthRenderMs;},get mapReady(){return !!(earthMaps[0]&&earthMaps[1]);}};
  function prepareClouds(layer){
    const image=layer.image,source=image?.currentSrc||image?.src;
    if(!image?.naturalWidth||source===layer.source)return;
    layer.source=source;layer.tones=[];
    try{
      const sample=document.createElement('canvas');sample.width=innerWidth<720?384:512;sample.height=Math.round(sample.width*image.naturalHeight/image.naturalWidth);
      const c=sample.getContext('2d',{willReadFrequently:true});if(!c)return;
      c.drawImage(image,0,0,sample.width,sample.height);
      const original=c.getImageData(0,0,sample.width,sample.height);
      cloudTones.forEach(tone=>{
        const result=document.createElement('canvas');result.width=sample.width;result.height=sample.height;
        const painter=result.getContext('2d');if(!painter)return;
        const pixels=painter.createImageData(sample.width,sample.height);
        for(let y=0;y<sample.height;y++)for(let x=0;x<sample.width;x++){
          const k=(y*sample.width+x)*4,v=y/sample.height;
          const brightness=Math.min(original.data[k],original.data[k+1],original.data[k+2])/255;
          const saturation=(Math.max(original.data[k],original.data[k+1],original.data[k+2])/255-brightness);
          const region=layer.index===0?smooth(.545,.59,v):1-smooth(.23,.285,v);
          const mask=smooth(.30,.74,brightness)*(1-smooth(.18,.52,saturation))*region;
          const detail=.40+.60*brightness;
          pixels.data[k]=tone[0]*detail;pixels.data[k+1]=tone[1]*detail;pixels.data[k+2]=tone[2]*detail;pixels.data[k+3]=Math.round(mask*158);
        }
        painter.putImageData(pixels,0,0);layer.tones.push(result);
      });
    }catch(_){layer.tones=[];}
  }
  const mixColor=(a,b,t)=>a.map((channel,i)=>Math.round(channel+(b[i]-channel)*t));
  const rgba=(color,alpha)=>`rgba(${color.join(',')},${clamp(alpha)})`;
  function atmosphere(time,state,clock,depth){
    const day=clamp(clock?.daylight||0),twilight=clamp(clock?.twilight||0),rising=clock?.sunRising!==false;
    const warm=rising?[255,163,96]:[239,105,82];
    const duskTop=rising?[73,63,123]:[54,35,95];
    cloudLayers.forEach(layer=>{
      const g=photoGeometry(layer.image,layer.index,state);if(!g||g.dy>h||g.dy+g.dh<0)return;
      const orbital=layer.index===0;
      // A local surface exposure grade leaves the roots and cave unchanged.
      if(!orbital&&day<.995){
        const frame=state.scenes[layer.index];
        const top=reducedMotion.matches?0:frame.top-state.camera;
        const bottom=reducedMotion.matches?h:top+frame.height;
        const exposure=ctx.createLinearGradient(0,top,0,bottom);
        exposure.addColorStop(0,rgba([7,17,37],0));
        exposure.addColorStop(reducedMotion.matches?0:Math.min(.3,state.seam/frame.height),rgba([7,17,37],(1-day)*.40));
        exposure.addColorStop(.86,rgba([7,17,37],(1-day)*.40));exposure.addColorStop(1,rgba([7,17,37],0));
        ctx.fillStyle=exposure;ctx.fillRect(0,Math.max(0,top),w,Math.min(h,bottom)-Math.max(0,top));
      }
      const skyEnd=orbital?.535:.285,skyBottom=g.dy+g.dh*skyEnd;
      const immersion=orbital?smooth(.32,.78,depth):1;
      const upper=mixColor(mixColor([7,15,38],[27,99,179],day),duskTop,twilight*.86);
      const horizon=mixColor(mixColor([28,49,84],[170,216,245],day),warm,twilight*.94);
      const sky=ctx.createLinearGradient(0,g.dy,0,skyBottom);
      const strength=orbital?(.18+.60*immersion):.62;
      sky.addColorStop(0,rgba(upper,strength*(orbital?immersion:.7)));
      sky.addColorStop(.66,rgba(upper,strength*.82));
      sky.addColorStop(.94,rgba(horizon,strength));sky.addColorStop(1,rgba(horizon,0));
      ctx.fillStyle=sky;ctx.fillRect(0,Math.max(0,g.dy),w,Math.min(h,skyBottom)-Math.max(0,g.dy));
      if(twilight>.01&&skyBottom>0&&g.dy<h){
        const x=w*(clock?.sunAzimuth??.33),y=skyBottom-g.dh*.014;
        const glow=ctx.createRadialGradient(x,y,0,x,y,Math.max(w*.46,g.dh*.10));
        glow.addColorStop(0,rgba(warm,twilight*.19));glow.addColorStop(1,rgba(warm,0));
        ctx.save();ctx.beginPath();ctx.rect(0,Math.max(0,g.dy),w,Math.min(h,skyBottom)-Math.max(0,g.dy));ctx.clip();
        ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);ctx.restore();
      }
      // Once satellite maps are available the raised spherical cloud shell
      // owns all orbital clouds; never blend fixed photographic clouds over it.
      if(orbital&&!reducedMotion.matches&&earthMaps[0]&&earthMaps[1])return;
      prepareClouds(layer);if(layer.tones.length!==4)return;
      const twilightWeight=twilight*.78;
      const weights=[(1-day)*(1-twilightWeight),day*(1-twilightWeight),rising?twilightWeight:0,rising?0:twilightWeight];
      const drift=Math.sin(time*.072+layer.index*1.6)*g.dw*(orbital?.026:.033);
      const lift=Math.sin(time*.033+layer.index)*g.dh*.0015;
      ctx.save();
      // The slower high cloud layer and the lower drifting cloud detail use
      // the existing image, not synthetic particles or procedural storms.
      weights.forEach((weight,i)=>{if(weight<.015)return;
        ctx.globalAlpha=weight*.35;ctx.drawImage(layer.tones[i],g.dx+drift*.42,g.dy-lift,g.dw,g.dh);
        ctx.globalAlpha=weight*.82;ctx.drawImage(layer.tones[i],g.dx+drift,g.dy+lift,g.dw,g.dh);
      });ctx.restore();
    });
  }
  function water(time,state){
    if(!cave?.complete||!cave.naturalWidth)return;
    const g=photoGeometry(cave,2,state);if(!g)return;
    const {scale,dw,dh,dx,dy}=g,wide=cave.naturalWidth>cave.naturalHeight;
    const top=dy+dh*(wide?.73:.813),bottom=dy+dh*(wide?.99:.945);
    if(bottom<0||top>h)return;
    const polygon=wide?[[.35,.73],[.70,.73],[.89,.80],[.98,.90],[.68,.99],[.33,.99],[.09,.94],[.02,.87],[.20,.78]]:[[.35,.813],[.77,.813],[.90,.85],[.96,.893],[.80,.945],[.27,.928],[.13,.889],[.28,.851]];
    ctx.save();ctx.beginPath();polygon.forEach(([x,y],i)=>i?ctx.lineTo(dx+x*dw,dy+y*dh):ctx.moveTo(dx+x*dw,dy+y*dh));ctx.closePath();ctx.clip();
    // Refract only the pool, leaving cave walls perfectly still.
    for(let y=Math.max(0,top);y<Math.min(h,bottom);y+=3){
      const sy=(y-dy)/scale;
      const edge=Math.sin(clamp((y-top)/(bottom-top))*Math.PI);
      const offset=(Math.sin(y*.063-time*1.7)+Math.sin(y*.027+time*.9))*4.5*edge;
      ctx.drawImage(cave,0,sy,cave.naturalWidth,4/scale,dx+offset,y,dw,4);
    }
    for(let i=0;i<3;i++){
      const phase=(time*.3+i*.34)%1;
      ctx.beginPath();ctx.ellipse(dx+dw*(.40+i*.105),top+(bottom-top)*(.36+i*.12),7+phase*43,1+phase*7,0,0,Math.PI*2);
      ctx.strokeStyle=`rgba(169,219,239,${(1-phase)*.22})`;ctx.lineWidth=.6;ctx.stroke();
    }
    ctx.restore();
  }
  function photoGeometry(image,index,state) {
    if(!image?.complete||!image.naturalWidth)return null;
    if(reducedMotion.matches){
      if(!plates[index]?.classList.contains('is-active')&&!(index===0&&!plates.some(plate=>plate.classList.contains('is-active'))))return null;
      const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight),dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;
      return {scale,dw,dh,dx:(w-dw)/2,dy:(h-dh)/2};
    }
    const frame=state.scenes[index];
    const scale=Math.max(w/image.naturalWidth,frame.height/image.naturalHeight);
    const dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;
    return {scale,dw,dh,dx:(w-dw)/2,dy:frame.top-state.camera+(frame.height-dh)/2};
  }
  function clipPhoto(points,g) {
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(g.dx+x*g.dw,g.dy+y*g.dh):ctx.moveTo(g.dx+x*g.dw,g.dy+y*g.dh));ctx.closePath();ctx.clip();
  }
  function landscape(time,state) {
    const g=photoGeometry(surface,1,state);if(!g||g.dy>h||g.dy+g.dh<0)return;
    const wide=surface.naturalWidth>surface.naturalHeight;
    const centers=wide?[[.51,.432],[.574,.496],[.563,.527],[.584,.542],[.545,.59],[.586,.61],[.558,.665]]:[[.59,.409],[.60,.428],[.675,.45],[.76,.48],[.69,.51],[.61,.54],[.71,.564]];
    // Trace the existing river rather than moving its banks or the mountains.
    const river=wide?[...centers.map(([x,y],i)=>[x-.002-i*.0013,y]),...centers.map(([x,y],i)=>[x+.002+i*.0013,y]).reverse()]:[[.59,.397],[.57,.412],[.54,.421],[.57,.429],[.62,.435],[.65,.445],[.65,.46],[.71,.468],[.75,.478],[.70,.494],[.66,.506],[.65,.522],[.58,.535],[.58,.55],[.70,.568],[.73,.563],[.62,.55],[.63,.54],[.70,.526],[.71,.51],[.77,.496],[.79,.48],[.76,.466],[.69,.455],[.70,.445],[.67,.435],[.61,.427],[.58,.421],[.61,.414],[.62,.403]];
    ctx.save();clipPhoto(river,g);
    const riverTop=g.dy+g.dh*(wide?.432:.397),riverBottom=g.dy+g.dh*(wide?.665:.57);
    for(let y=Math.max(0,riverTop);y<Math.min(h,riverBottom);y+=3){
      const sy=(y-g.dy)/g.scale;
      const shift=(Math.sin(y*.065-time*3.7)+Math.sin(y*.03+time*1.3)) * 2.2;
      ctx.drawImage(surface,0,sy,surface.naturalWidth,4/g.scale,g.dx+shift,y,g.dw,4);
    }
    // Small moving highlights follow the downstream channel.
    for(let i=0;i<11;i++){
      const travel=(time*.065+i/11)%1,part=travel*(centers.length-1),j=Math.floor(part),t=part-j;
      const a=centers[j],b=centers[Math.min(j+1,centers.length-1)];
      const x=g.dx+(a[0]+(b[0]-a[0])*t)*g.dw,y=g.dy+(a[1]+(b[1]-a[1])*t)*g.dh;
      ctx.strokeStyle=`rgba(218,237,251,${Math.sin(travel*Math.PI)*.38})`;ctx.lineWidth=.7;
      ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+9,y+.6);ctx.stroke();
    }
    ctx.restore();
    // Sway only photographed tree silhouettes. Each has a rooted base and
    // a different wind phase; terrain and camera remain unchanged.
    const trees=wide?[
      {p:[[0,.18],[.05,.25],[.13,.52],[.17,.82],[0,.89]],base:.89,phase:0},
      {p:[[1,.43],[.94,.49],[.89,.62],[.87,.83],[1,.90]],base:.90,phase:2.5}
    ]:[
      {p:[[0,.19],[.065,.35],[.12,.5],[.07,.59],[.17,.7],[.075,.88],[0,.89]],base:.89,phase:0},
      {p:[[.265,.49],[.215,.64],[.145,.78],[.14,.86],[.32,.86],[.33,.77],[.30,.61]],base:.86,phase:1.4},
      {p:[[1,.31],[.94,.43],[.89,.55],[.97,.6],[.86,.77],[.93,.85],[1,.88]],base:.88,phase:2.5},
      {p:[[.74,.60],[.69,.72],[.65,.83],[.81,.85],[.82,.77],[.78,.69]],base:.85,phase:3.6}
    ];
    trees.forEach(tree=>{
      const top=g.dy+g.dh*Math.min(...tree.p.map(p=>p[1])),bottom=g.dy+g.dh*tree.base;
      if(bottom<0||top>h)return;
      ctx.save();clipPhoto(tree.p,g);
      for(let y=Math.max(0,top);y<Math.min(h,bottom);y+=4){
        const sy=(y-g.dy)/g.scale,flex=clamp((bottom-y)/(bottom-top));
        const shift=(Math.sin(time*.65+tree.phase)+.24*Math.sin(time*1.17+tree.phase))*4*flex*flex;
        ctx.drawImage(surface,0,sy,surface.naturalWidth,5/g.scale,g.dx+shift,y,g.dw,5);
      }
      ctx.restore();
    });
    // Distant birds are deliberately small silhouettes within the valley sky.
    const passage=time%38;
    if(passage<19){
      const fade=Math.sin(passage/19*Math.PI)*.5;
      for(let i=0;i<4;i++){
        const x=g.dx+g.dw*(.12+passage*.037-i*.024),y=g.dy+g.dh*((wide?.19:.30)+i*.006)+Math.sin(time*.5+i)*3;
        if(y<-10||y>h+10)continue;
        const wing=1.7+Math.sin(time*4.8+i)*1.5;
        ctx.strokeStyle=`rgba(15,27,37,${fade})`;ctx.lineWidth=.9;
        ctx.beginPath();ctx.moveTo(x-4,y-wing);ctx.quadraticCurveTo(x-2,y-1,x,y);ctx.quadraticCurveTo(x+2,y-1,x+4,y-wing);ctx.stroke();
      }
    }
  }
  function render(time){
    ctx.clearRect(0,0,w,h);
    const s=window.elev8miJourney;if(!s)return;
    // Cinematic sunrise is synchronized with Moon occlusion by request.
    // The real lunar phase remains independent of this demonstration.
    const clock=window.elev8miCelestial;
    const daylight=clock?.daylight??0;
    if(Math.abs(daylight-lastDay)>.003){
      document.documentElement.style.setProperty('--daylight',daylight.toFixed(3));
      document.documentElement.style.setProperty('--nightlight',(1-daylight).toFixed(3));lastDay=daylight;
    }
    const depth=s.center/s.plateHeight;
    const space=1-smooth(.4,.78,depth);
    const air=smooth(.65,.95,depth)*(1-smooth(1.30,1.62,depth));
    const ground=s.scenes[1],cavern=s.scenes[2];
    const forest=smooth(ground.top,ground.top+s.seam,s.center)*(1-smooth(cavern.top,cavern.top+s.seam,s.center));
    const underground=smooth(cavern.top,cavern.top+s.seam,s.center);
    const fog=air*.85+forest*.65+underground*.22;
    if(Math.abs(fog-lastFog)>.015){journey.style.setProperty('--fog-opacity',fog.toFixed(3));lastFog=fog;}
    const gpu=window.Elev8PhotoMotion?.active&&!reducedMotion.matches;
    if(gpu){earthActive=false;delete journey.dataset.earthFallback;}
    const mist=gpu?forest*.085:air*.15+forest*.12;
    const rays=(air*.30+forest*.12)*(daylight*.25+(clock?.twilight||0)*.8);
    if(Math.abs(mist-lastMist)>.004){journey.style.setProperty('--atmosphere-mist',mist.toFixed(3));lastMist=mist;}
    if(Math.abs(rays-lastRays)>.004){journey.style.setProperty('--atmosphere-rays',rays.toFixed(3));lastRays=rays;}
    // renderAll(0) repaints this layer when motion is paused. Repainting the
    // frozen frame preserves its lighting instead of clearing the atmosphere.
    if(space>.001){
      stars.forEach((st,i)=>{
        const x=st.x*w,y=st.y*h-s.camera*.035;
        const pulse=Math.pow((1+Math.sin(time*(.65+i%5*.12)+st.phase))*.5,8);
        const alpha=Math.min(1,space*(1-daylight)*(.42+.58*pulse));
        ctx.beginPath();ctx.arc(x,y,st.r*(1.15+pulse*.6),0,Math.PI*2);ctx.fillStyle=`rgba(232,241,255,${alpha})`;ctx.fill();
        if(i%5===0&&pulse>.25){const arm=2.5+4.5*pulse;ctx.strokeStyle=`rgba(222,236,255,${alpha*.75})`;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x-arm,y);ctx.lineTo(x+arm,y);ctx.moveTo(x,y-arm);ctx.lineTo(x,y+arm);ctx.stroke();}
      });
      const cycle=time%14;
      if(cycle>10&&cycle<11.15){const t=(cycle-10)/1.15;const x=w*(.78-t*.48),y=h*(.10+t*.28);const fade=Math.sin(t*Math.PI)*space;
        const trail=ctx.createLinearGradient(x,y,x+70,y-38);trail.addColorStop(0,`rgba(218,232,255,${fade*.8})`);trail.addColorStop(1,'rgba(218,232,255,0)');ctx.strokeStyle=trail;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+70,y-38);ctx.stroke();}
    }
    const density=forest*.7+underground*.35;
    if(density>.01)dust.forEach((p,i)=>{
      const x=(p.x*w+Math.sin(time*.11+i)*25+w)%w;
      const y=(p.y*h-time*(1.4+p.s)+h*100)%h;
      const a=density*(.14+.18*Math.sin(time*.8+i)**2);
      ctx.beginPath();ctx.arc(x,y,p.s,0,Math.PI*2);ctx.fillStyle=i%5===0&&forest>.2?`rgba(224,211,148,${a})`:`rgba(201,218,231,${a})`;ctx.fill();
    });
    if(!gpu){
      landscape(time,s);if(underground>.05)water(time,s);
      atmosphere(time,s,clock,depth);
      drawEarth(time,s,clock,depth);
    }
    // Wildlife remains a small independent layer in the GPU path.
    else if(forest>.1){
      const g=photoGeometry(surface,1,s);
      if(g){for(let i=0;i<4;i++){
        const t=(time+i*.3)%38;if(t>19)continue;
        const x=g.dx+g.dw*(.12+t*.037-i*.024),y=g.dy+g.dh*((surface.naturalWidth>surface.naturalHeight?.19:.30)+i*.006)+Math.sin(time*.5+i)*3;
        if(y<0||y>h)continue;const wing=1.7+Math.sin(time*4.8+i)*1.5;
        ctx.strokeStyle=`rgba(15,27,37,${Math.sin(t/19*Math.PI)*.5})`;ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(x-4,y-wing);ctx.quadraticCurveTo(x-2,y-1,x,y);ctx.quadraticCurveTo(x+2,y-1,x+4,y-wing);ctx.stroke();
      }}
    }
  }
  let stillPaint=0;
  function scheduleStillPaint(){
    if(!window.Elev8Motion.paused||document.hidden||stillPaint)return;
    stillPaint=window.requestAnimationFrame(()=>{
      stillPaint=0;
      if(window.Elev8Motion.paused&&!window.Elev8Boot?.hold&&!document.hidden)render(window.Elev8Motion.time);
    });
  }
  // Pausing freezes time, not the scroll camera. Journey's earlier listeners
  // measure its new geometry before this one coalesced, unchanged-time paint.
  window.addEventListener('scroll',scheduleStillPaint,{passive:true});
  window.addEventListener('resize',()=>{resize();scheduleStillPaint();},{passive:true});
  window.addEventListener('pageshow',scheduleStillPaint);
  window.addEventListener('elev8mi:photo-fallback',scheduleStillPaint);
  window.addEventListener('elev8mi:moon',scheduleStillPaint);
  document.fonts?.ready.then(scheduleStillPaint);
  document.fonts?.addEventListener('loadingdone',scheduleStillPaint);
  if('ResizeObserver'in window){
    const observer=new ResizeObserver(scheduleStillPaint);
    for(const target of [document.querySelector('main'),document.querySelector('footer'),journey])if(target)observer.observe(target);
  }
  resize();window.Elev8Motion.add(render,{fps:30});
  // Journey geometry is measured in the next frame. A visitor who saved
  // Reduced motion (paused) still receives the same correctly lit, frozen globe.
  const firstPaint=()=>window.requestAnimationFrame(()=>render(window.Elev8Motion.time));
  if(window.Elev8Boot?.hold)window.addEventListener('elev8mi:boot-release',firstPaint,{once:true});else firstPaint();
})();
