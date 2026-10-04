(() => {
 'use strict';
 const dialog=document.getElementById('interpretDialog'),reopen=document.getElementById('interpretReading'),cards=document.getElementById('interpretCards'),message=document.getElementById('interpretMessage'),email=document.getElementById('interpretEmail');
 if(!dialog||!reopen||!cards||!message||!email)return;
 let previousFocus=null;
 function open(){if(!window._reading||dialog.open)return;previousFocus=document.activeElement;if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('open','');document.getElementById('closeInterpret')?.focus();}}
 function restoreFocus(){const target=previousFocus?.isConnected&&previousFocus!==document.body&&previousFocus!==document.documentElement&&previousFocus.tabIndex>=0&&!previousFocus.disabled&&!previousFocus.closest('[hidden],[inert]')&&getComputedStyle(previousFocus).display!=='none'&&getComputedStyle(previousFocus).visibility!=='hidden'?previousFocus:(!reopen.hidden?reopen:document.getElementById('drawBtn'));target?.focus();}
 function close(){if(!dialog.open)return;if(typeof dialog.close==='function')dialog.close();else{dialog.removeAttribute('open');restoreFocus();}}
 dialog.addEventListener('close',restoreFocus);
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='Tab'&&typeof dialog.showModal!=='function'){const items=[...dialog.querySelectorAll('button,a[href],textarea,input:not([tabindex="-1"])')].filter(el=>!el.disabled&&!el.hidden);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
 document.getElementById('closeInterpret').addEventListener('click',close);
 document.getElementById('continueReading').addEventListener('click',close);
 reopen.addEventListener('click',open);
 const EMAIL='elev8miangel@gmail.com',download=document.getElementById('downloadCards');
 let cardSheet=null;
 window.addEventListener('elev8mi:reading-reset',()=>{close();reopen.hidden=true;cards.replaceChildren();message.value='';email.removeAttribute('href');if(cardSheet)URL.revokeObjectURL(cardSheet);cardSheet=null;if(download){download.hidden=true;download.removeAttribute('href');}});
 // Draw the chosen cards into one PNG the visitor can attach to the email.
 // Uses deck files when present, otherwise the built-in atlas (same origin).
 async function sheet(reading){
  const deck=window.Elev8Deck;if(!deck||!download)return null;
  const atlas=new Image();atlas.src='assets/tarot-atlas.webp';
  const faces=await Promise.all(reading.picks.map(pick=>deck.image(pick.card)));
  if(faces.some(face=>!face))await atlas.decode().catch(()=>{});
  const cw=384,ch=faces.every(Boolean)?672:660,gap=48,pad=64,n=reading.picks.length,top=150,label=118;
  const canvas=document.createElement('canvas');canvas.width=pad*2+n*cw+(n-1)*gap;canvas.height=top+ch+label+90;
  const g=canvas.getContext('2d');if(!g)return null;
  g.fillStyle='#120a22';g.fillRect(0,0,canvas.width,canvas.height);
  g.textAlign='center';g.fillStyle='#ead3ff';g.font='600 46px Cinzel, Georgia, serif';g.fillText('ELEV8MI · MY CARDS',canvas.width/2,78);
  g.fillStyle='#c6b5d5';g.font='italic 28px "Cormorant Garamond", Georgia, serif';g.fillText(reading.q?`Reading style: ${reading.q}`:'Tarot reading',canvas.width/2,120);
  reading.picks.forEach((pick,i)=>{
   const x=pad+i*(cw+gap),face=faces[i];
   g.save();g.translate(x+cw/2,top+ch/2);if(pick.rev)g.rotate(Math.PI);
   if(face)g.drawImage(face,-cw/2,-ch/2,cw,ch);
   else if(atlas.naturalWidth){const c=deck.atlasCell(pick.card),w=atlas.naturalWidth/c.cols,h=atlas.naturalHeight/c.rows;g.drawImage(atlas,c.col*w,c.row*h,w,h,-cw/2,-ch/2,cw,ch);}
   g.restore();g.strokeStyle='#c4a8e7';g.lineWidth=2;g.strokeRect(x,top,cw,ch);
   g.fillStyle='#f7efff';g.font='600 30px Cinzel, Georgia, serif';g.fillText(pick.card.name,x+cw/2,top+ch+48);
   g.fillStyle='#d7b9f7';g.font='22px "Plus Jakarta Sans", Arial, sans-serif';g.fillText(`${reading.positions[i]} · ${pick.rev?'Reversed':'Upright'}`,x+cw/2,top+ch+84);
  });
  g.fillStyle='#9f8fb5';g.font='22px "Plus Jakarta Sans", Arial, sans-serif';g.fillText(`${EMAIL} · www.elev8mi.com · @elev8mi`,canvas.width/2,canvas.height-34);
  return new Promise(resolve=>{try{canvas.toBlob(blob=>resolve(blob),'image/png');}catch(_){resolve(null);}});
 }
 window.addEventListener('elev8mi:reading-complete',async({detail:reading})=>{
   const selected=reading.picks.map((pick,i)=>`${reading.positions[i]}: ${pick.card.name} (${pick.rev?'Reversed':'Upright'})`);
   cards.replaceChildren(...reading.picks.map((pick,i)=>{const li=document.createElement('li'),face=document.createElement('div'),img=document.createElement('img'),label=document.createElement('span');face.className='interpret-card-face'+(pick.rev?' is-reversed':'');img.alt=pick.card.name+(pick.rev?', reversed':', upright');label.textContent=selected[i];face.append(img);li.append(face,label);window.Elev8Deck?.image(pick.card).then(source=>{if(source)img.src=source.src;});return li;}));
   const compose=()=>{
    const deck=window.Elev8Deck,mode=deck?.config?.emailImageLinks??'auto';
    const links=deck&&mode!==false?reading.picks.filter(pick=>mode===true||deck.hasFile(pick.card)).map(pick=>`${pick.card.name}: ${deck.publicUrl(pick.card)}`):[];
    const body='ALLISON-\n\nI DREW MY CARDS ON YOUR WEBSITE AND WOULD LOVE FOR YOU TO INTERPRET THEM FOR ME.\n\nMY CARDS:\n'+selected.join('\n')+(reading.q?'\n\nREADING STYLE:\n'+reading.q:'')+(links.length?'\n\nCARD IMAGES:\n'+links.join('\n'):'');
    message.value=body;
    email.href=`mailto:${EMAIL}?subject=`+encodeURIComponent('INTERPRET MY CARDS')+'&body='+encodeURIComponent(body);
   };
   compose();reopen.hidden=false;open();
   // Card files load asynchronously; refresh links once their status is known.
   await Promise.all(reading.picks.map(pick=>window.Elev8Deck?.image(pick.card)));
   if(window._reading!==reading)return;compose();
   const blob=await sheet(reading).catch(()=>null);
   if(window._reading!==reading||!blob||!download)return;
   cardSheet=URL.createObjectURL(blob);download.href=cardSheet;download.download='elev8mi-my-cards.png';download.hidden=false;
 });

 // Direct send (Web3Forms, see form-config.js). The mailto draft above stays
 // as the fallback when the key is not configured or a send fails.
 const form=document.getElementById('sendReading');
 if(form){
  const config=window.Elev8FormConfig||{},submit=document.getElementById('sendReadingSubmit'),status=document.getElementById('sendStatus');
  const fields={name:document.getElementById('sendName'),email:document.getElementById('sendEmail')},question=document.getElementById('sendQuestion'),honeypot=document.getElementById('sendBotcheck');
  const active=()=>typeof config.accessKey==='string'&&/^[0-9a-f-]{20,}$/i.test(config.accessKey.trim());
  const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function check(field,show){
   const value=field.value.trim();let error='';
   if(field===fields.name&&!value)error='Please enter your name.';
   if(field===fields.email)error=!value?'Please enter your email so Allison can reply.':!emailPattern.test(value)?'Please enter a valid email address, like name@example.com.':'';
   const note=document.getElementById(field.id+'Error');
   if(show||field.getAttribute('aria-invalid')==='true'){
    field.setAttribute('aria-invalid',String(Boolean(error)));note.textContent=error;note.hidden=!error;
   }
   return !error;
  }
  Object.values(fields).forEach(field=>{field.addEventListener('blur',()=>{if(field.value)check(field,true);});field.addEventListener('input',()=>check(field,false));});
  function say(text,kind,withMailto){
   status.replaceChildren(text);status.dataset.kind=kind||'';
   if(withMailto&&email.href){const link=document.createElement('a');link.href=email.href;link.textContent='Open an email draft instead';status.append(' ',link);}
  }
  function fallbackHref(){
   const extra=question.value.trim(),who=`${fields.name.value.trim()} <${fields.email.value.trim()}>`;
   return `mailto:${EMAIL}?subject=`+encodeURIComponent('INTERPRET MY CARDS')+'&body='+encodeURIComponent(message.value+(extra?'\n\nMY QUESTION:\n'+extra:'')+'\n\nFROM:\n'+who);
  }
  function resetForm(){form.reset();Object.values(fields).forEach(f=>{f.removeAttribute('aria-invalid');const n=document.getElementById(f.id+'Error');n.hidden=true;n.textContent='';});say('','');submit.disabled=false;submit.textContent='Send to Allison';form.hidden=false;}
  window.addEventListener('elev8mi:reading-reset',resetForm);
  window.addEventListener('elev8mi:reading-complete',()=>{resetForm();if(!active())say('Direct sending is not active yet. Use “Email Allison” below, or press Send to open a ready-made email draft.','info');});
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const valid=[fields.name,fields.email].map(field=>check(field,true));
   if(valid.includes(false)){(valid[0]?fields.email:fields.name).focus();say('Please fix the highlighted fields.','error');return;}
   if(honeypot.checked){say('Thank you.','success');return;} // bots: silently drop
   if(!window._reading){say('Draw your cards first.','error');return;}
   if(!active()){say('Direct sending is not active yet, so your email app will open with everything filled in.','info');location.href=fallbackHref();return;}
   const reading=window._reading,extra=question.value.trim();
   const payload={
    access_key:config.accessKey.trim(),subject:config.subject||'ELEV8MI reading',from_name:config.fromName||'ELEV8MI website',
    name:fields.name.value.trim(),email:fields.email.value.trim(),replyto:fields.email.value.trim(),
    message:message.value+(extra?'\n\nMY QUESTION:\n'+extra:''),
    reading_style:reading.q||'',
    cards:reading.picks.map((pick,i)=>`${reading.positions[i]}: ${pick.card.name} (${pick.rev?'Reversed':'Upright'})${window.Elev8Deck?' - '+window.Elev8Deck.publicUrl(pick.card):''}`).join('\n'),
    botcheck:false
   };
   submit.disabled=true;submit.textContent='Sending…';say('Sending your reading to Allison…','info');
   try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    const response=await fetch(config.endpoint||'https://api.web3forms.com/submit',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),signal:controller.signal});
    clearTimeout(timer);
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.success===false)throw new Error(result.message||`HTTP ${response.status}`);
    form.hidden=true;say(`Thank you, ${payload.name}. Your reading was sent to Allison. She will reply to ${payload.email}.`,'success');
    status.parentElement!==form||form.after(status);
   }catch(_){
    submit.disabled=false;submit.textContent='Send to Allison';
    email.href=fallbackHref();
    say('Sorry, your reading could not be sent right now.','error',true);
   }
  });
 }
})();
