(() => {
 'use strict';
 // NASA sidereal periods (hours) and axial obliquity (degrees). These disc
 // photographs supply illustrative surface detail, not complete longitude maps.
 // Signed periods retain Venus/Uranus retrograde rotation. Compressed axial
 // periods are independent of Earth's slower foreground surface rotation.
 const data={Mercury:[1407.6,.034,'#c9bdb0',.065,12],Venus:[-5832.5,177.4,'#ffd799',.10,7],Earth:[23.9345,23.44,'#84ccff',.22,24],Mars:[24.6,25.2,'#ff9e73',.06,12],Jupiter:[9.9,3.1,'#e9ba94',.13,10],Saturn:[10.7,26.7,'#f1d59d',.12,12],Uranus:[-17.2,97.8,'#85edf2',.16,16],Neptune:[16.1,28.3,'#84a9ff',.18,18]};
 const spinning=[],halos=[],moonButton=document.querySelector('.solar-moon');let last=-1;
 const TAU=Math.PI*2, textureSize=128,frameSize=64,moonColor=[.68,.82,1.12];
 const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
 function normal(x,y,z){const length=Math.hypot(x,y,z)||1;return{x:x/length,y:y/length,z:z/length};}
 function pointLight(source,point,cosTilt,sinTilt){
   const direction=normal(source.x-point.x,source.y-point.y,source.z-point.z);
   // The globe canvas is tilted in CSS. Transform the screen-space direction
   // back into its local normal frame, keeping illumination aimed at the Sun.
   return {x:direction.x*cosTilt+direction.y*sinTilt,y:-direction.x*sinTilt+direction.y*cosTilt,z:direction.z};
 }
 function lightFor(body){
   const state=window.elev8miCelestial,positions=state?.planetPositions,position=positions?.[body.name];
   if(!position||!state.heroSun)return {sun:{x:-.45,y:-.32,z:.84},moon:{x:.35,y:.25,z:.9},moonStrength:0,daylight:.5,twilight:0};
   const point={x:position.displayX??position.x,y:position.displayY??position.y,z:position.z};
   return {sun:pointLight(state.heroSun,point,body.cosTilt,body.sinTilt),moon:pointLight(state.moonPosition||state.heroSun,point,body.cosTilt,body.sinTilt),moonStrength:clamp(state.moonLight??0,0,.22)*.85,daylight:clamp(state.daylight??.5,0,1),twilight:clamp(state.twilight??0,0,1)};
 }
 function halo(button,name,index){
   const color=data[name]?.[2]||'#b9d4ff',rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
   button.style.setProperty('--planet-glow',color);button.style.setProperty('--planet-glow-rgb',rgb.join(','));
   halos.push({button,name,index});
 }
 function prepare(button,index){
   const name=button.dataset.planet,parameters=data[name],img=button.querySelector('img');
   if(!parameters)return;
   halo(button,name,index);
   if(!img||name==='Earth')return;
   const source=document.createElement('canvas');source.width=source.height=textureSize;
   const sample=source.getContext('2d',{willReadFrequently:true});if(!sample)return;
   const output=document.createElement('canvas');output.width=output.height=frameSize;output.className='spinning-planet';output.setAttribute('aria-hidden','true');
   const context=output.getContext('2d');if(!context)return;
   const tilt=parameters[1]>90?parameters[1]-180:parameters[1],radians=tilt*Math.PI/180;
   output.style.transform=`translate(-50%,-50%) rotate(${tilt}deg)`;
   function load(){
     try{
       const fraction=name==='Saturn'?.42:.98,side=Math.min(img.naturalWidth,img.naturalHeight)*fraction;
       sample.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,textureSize,textureSize);
       const original=sample.getImageData(0,0,textureSize,textureSize).data,pixels=new Uint8ClampedArray(original.length);
       // Unwrap each photographed latitude into a seamless strip. Mirroring at
       // its seam avoids sampling the photograph's transparent square corners.
       for(let y=0;y<textureSize;y++){const latitude=(y+.5-textureSize/2)/(textureSize/2),half=Math.sqrt(Math.max(0,1-latitude*latitude))*(textureSize/2-2);
         for(let x=0;x<textureSize;x++){const sx=clamp(Math.round(textureSize/2+Math.sin((x/textureSize-.5)*TAU)*half),0,textureSize-1),from=(y*textureSize+sx)*4,to=(y*textureSize+x)*4;for(let c=0;c<4;c++)pixels[to+c]=original[from+c];}
       }
       const frame=context.createImageData(frameSize,frameSize),mapping=[];
       for(let y=0;y<frameSize;y++)for(let x=0;x<frameSize;x++){
         const nx=(x+.5-frameSize/2)/(frameSize/2),ny=(y+.5-frameSize/2)/(frameSize/2),r2=nx*nx+ny*ny;if(r2>=1)continue;
         const z=Math.sqrt(1-r2),longitude=Math.atan2(nx,z),latitude=Math.asin(ny);
         // Normals and sample coordinates are computed once, never read back
         // from the rendered canvas. Limb alpha softens the tiny globe edge.
         mapping.push({out:(y*frameSize+x)*4,u:longitude/TAU+.5,v:clamp(Math.round((latitude/Math.PI+.5)*(textureSize-1)),0,textureSize-1),x:nx,y:ny,z,alpha:Math.round(clamp((1-Math.sqrt(r2))*frameSize/2,0,1)*255)});
       }
       // Saturn's photographed ring plane stays fixed; only its globe spins.
       if(name!=='Saturn')img.style.visibility='hidden';
       (button.querySelector('.planet-model')||button).append(output);
       // v33 (E8-12): the same gentle display periods as the WebGL scene (40-120 s, Venus/Uranus retrograde).
       const turn=Object.assign({Mercury:96,Venus:-118,Mars:64,Jupiter:42,Saturn:48,Uranus:-72,Neptune:58},window.Elev8SpinTable||{})[name],seconds=turn?Math.abs(turn):(10/.4)*Math.pow(Math.abs(parameters[0])/23.9345,.32),sign=turn?Math.sign(turn):Math.sign(parameters[0]);
       output.dataset.rotationPeriod=seconds.toFixed(3);
       const body={button,img,output,context,pixels,frame,mapping,seconds,sign,name,cosTilt:Math.cos(radians),sinTilt:Math.sin(radians),specular:parameters[3],shininess:parameters[4]};
       function resizeGlobe(){const size=parseFloat(img.style.width)||20;output.style.width=`${size*(name==='Saturn'?.42:1)}px`;}
       body.resize=resizeGlobe;resizeGlobe();
       if('ResizeObserver'in window)new ResizeObserver(resizeGlobe).observe(img);
       spinning.push(body);
       render(window.Elev8Motion?.time||0,true);
     }catch(_){output.remove();img.style.visibility='';}
   }
   if(img.complete&&img.naturalWidth)load();else img.addEventListener('load',load,{once:true});
 }
 function render(time,force=false){
   if(time===last&&!force)return;
   const state=window.elev8miCelestial;
   halos.forEach(({button,name,index})=>{
     // Separate phases and 7–9 second periods give a calm breathing halo. Its
     // clock is shared with every other effect, so pause/reduced motion freeze.
     const pulse=.5+.5*Math.sin(time*TAU/(7.2+index*.29)+index*1.73),night=1-(state?.daylight??.5);
     const depth=state?.planetPositions?.[name]?.depthCue??.5;
     button.style.setProperty('--planet-halo-alpha',((.44+pulse*.22+night*.14)*(.74+.26*depth)).toFixed(3));
     button.style.setProperty('--planet-halo-inner',(2.2+pulse*1.0).toFixed(2)+'px');
     button.style.setProperty('--planet-halo-outer',(8+pulse*3.2).toFixed(2)+'px');
     button.style.setProperty('--planet-halo-bloom',(15+pulse*4.5).toFixed(2)+'px');
     if(name==='Earth')button.style.setProperty('--earth-marker-halo',(.3+pulse*.26).toFixed(3));
   });
   const moonPulse=.5+.5*Math.sin(time*TAU/8.6+.7);
   moonButton?.style.setProperty('--moon-halo-alpha',(.62+moonPulse*.18).toFixed(3));
   // E8-05: the WebGL renderer (space-realism.js) owns the globes when active.
 if(document.documentElement.dataset.spaceGl==='on'){last=time;return;}
 spinning.forEach(body=>{
     const offset=time/body.seconds*body.sign,lighting=lightFor(body),sun=lighting.sun,moon=lighting.moon;
     const sunHalf=normal(sun.x,sun.y,sun.z+1),moonHalf=normal(moon.x,moon.y,moon.z+1);
     // A small warm/cool light shift supports the site's cinematic cycle; the
     // Sun remains dominant. Moon fill is deliberately subtle, not photometry.
     // Space has no terrestrial sunset filter: sunlight stays near-white.
     const sunColor=[1.02,1.00,.97];
     for(const point of body.mapping){
       const longitude=((point.u+offset)%1+1)%1*textureSize,x=Math.floor(longitude),fraction=longitude-x,i=(point.v*textureSize+x)*4,next=(point.v*textureSize+(x+1)%textureSize)*4,o=point.out;
       const diffuse=Math.max(0,point.x*sun.x+point.y*sun.y+point.z*sun.z),lunar=Math.max(0,point.x*moon.x+point.y*moon.y+point.z*moon.z)*lighting.moonStrength;
       const spec=Math.pow(Math.max(0,point.x*sunHalf.x+point.y*sunHalf.y+point.z*sunHalf.z),body.shininess)*body.specular*diffuse;
       const moonSpec=Math.pow(Math.max(0,point.x*moonHalf.x+point.y*moonHalf.y+point.z*moonHalf.z),16)*lighting.moonStrength*.16;
       const ambient=.26+.07*point.z+.06*(1-lighting.daylight),shade=ambient+diffuse*.98;
       for(let c=0;c<3;c++)body.frame.data[o+c]=clamp((body.pixels[i+c]*(1-fraction)+body.pixels[next+c]*fraction)*(shade*sunColor[c]+lunar*moonColor[c])+(spec*sunColor[c]+moonSpec*moonColor[c])*255,0,255);
       body.frame.data[o+3]=point.alpha;
     }
     body.context.putImageData(body.frame,0,0);
     body.output.dataset.lightX=sun.x.toFixed(3);body.output.dataset.lightY=sun.y.toFixed(3);body.output.dataset.lightZ=sun.z.toFixed(3);
     body.output.dataset.moonLight=lighting.moonStrength.toFixed(4);
     if(body.name==='Saturn'){
       // Two-sided ring material reflects light from either face. Its photo
       // keeps the original inclined plane while incident light changes.
       const screenSun={x:sun.x*body.cosTilt-sun.y*body.sinTilt,y:sun.x*body.sinTilt+sun.y*body.cosTilt,z:sun.z};
       const ringIncidence=Math.abs(screenSun.x*-.12+screenSun.y*-.48+screenSun.z*.87);
       body.button.style.setProperty('--ring-light',(.55+.6*ringIncidence+lighting.moonStrength*.4).toFixed(3));
       body.button.style.setProperty('--ring-warmth',(1+lighting.twilight*.12).toFixed(3));
     }
   });last=time;
 }
 document.querySelectorAll('.solar-body[data-planet]').forEach(prepare);
 window.Elev8PlanetLighting={refresh(){spinning.forEach(body=>body.resize());render(window.Elev8Motion?.time||0,true);}};
 window.addEventListener('resize',()=>spinning.forEach(body=>body.resize()),{passive:true});
 window.addEventListener('elev8mi:moon',()=>render(window.Elev8Motion?.time||0,true));
 window.Elev8Motion?.add(time=>render(time),{fps:30});
})();
