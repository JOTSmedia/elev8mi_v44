(() => {
'use strict';
let state='idle', promise=null;
const targets=['toneBtn','soundMenuButton','heroTone'];
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error(`Unable to load ${src}`));document.head.append(s);});}
function busy(on,error=false){
  const tuner=document.getElementById('tuner'),menuButton=document.getElementById('soundMenuButton'),tone=document.getElementById('toneBtn'),label=document.getElementById('soundMenuLabel');
  tuner?.classList.toggle('audio-booting',on);tuner?.classList.toggle('audio-boot-error',error);
  [menuButton,tone].forEach(el=>{if(!el)return;if(on)el.setAttribute('aria-busy','true');else el.removeAttribute('aria-busy');});
  if(label){if(on){label.dataset.beforeAudio=label.textContent;label.textContent='Loading…';}else if(label.dataset.beforeAudio){label.textContent=label.dataset.beforeAudio;delete label.dataset.beforeAudio;}}
}
async function ensure(){
  if(state==='ready')return true;
  if(promise)return promise;
  state='loading';busy(true);
  promise=(async()=>{
    try{
      await loadScript('sound-config.js?v=38');
      await loadScript('audio.js?v=38');
      state='ready';busy(false);window.dispatchEvent(new CustomEvent('elev8mi:audio-ready'));return true;
    }catch(error){console.error('528 Hz audio could not be initialized:',error);state='error';busy(false,true);return false;}
    finally{promise=null;}
  })();
  return promise;
}
async function intercept(event){
  if(state==='ready')return;
  const target=event.target.closest?.(targets.map(id=>`#${id}`).join(','));if(!target)return;
  event.preventDefault();event.stopImmediatePropagation();
  const ok=await ensure();if(ok){target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));}
}
document.addEventListener('click',intercept,true);
window.Elev8AudioGate={ensure,get state(){return state;}};
})();
