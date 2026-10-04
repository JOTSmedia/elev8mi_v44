(() => {
 'use strict';
 // "Book a personalized reading": sends the request to Allison through the
 // same Web3Forms setup as the reading form (form-config.js), with an email
 // draft fallback, then forwards to the payment link from payment-config.js.
 const form=document.getElementById('bookingForm');
 if(!form)return;
 const EMAIL='elev8miangel@gmail.com';
 const READINGS={
  'one-card':{name:'One Card Pull',price:'$11.11'},
  'five-card':{name:'5 Card Story',price:'$22.22',detail:'Up to 5 cards; the story includes an expansion of card 1 based on your question.'}
 };
 const config=window.Elev8FormConfig||{},payments=(window.Elev8PaymentConfig||{}).links||{};
 const submit=document.getElementById('bookSubmit'),status=document.getElementById('bookStatus');
 const fields={name:document.getElementById('bookName'),email:document.getElementById('bookEmail'),question:document.getElementById('bookQuestion')};
 const choices=[...form.querySelectorAll('input[name="reading"]')],choiceError=document.getElementById('bookReadingError');
 const honeypot=document.getElementById('bookBotcheck');
 const active=()=>typeof config.accessKey==='string'&&/^[0-9a-f-]{20,}$/i.test(config.accessKey.trim());
 const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
 // A payment link is usable only once its placeholder has been replaced.
 const paymentLink=id=>{const link=String(payments[id]||'').trim();return /^https:\/\/\S+$/i.test(link)&&!/PASTE-/i.test(link)?link:'';};
 const chosen=()=>choices.find(c=>c.checked)?.value||'';
 function check(field,show){
  const value=field.value.trim();let error='';
  if(field===fields.name&&!value)error='Please enter your name.';
  if(field===fields.email)error=!value?'Please enter your email so Allison can reply.':!emailPattern.test(value)?'Please enter a valid email address, like name@example.com.':'';
  if(field===fields.question&&!value)error='Please enter your question.';
  const note=document.getElementById(field.id+'Error');
  if(show||field.getAttribute('aria-invalid')==='true'){field.setAttribute('aria-invalid',String(Boolean(error)));note.textContent=error;note.hidden=!error;}
  return !error;
 }
 function checkChoice(show){
  const ok=Boolean(chosen());
  if(show||!choiceError.hidden){choiceError.textContent=ok?'':'Please choose a reading.';choiceError.hidden=ok;choices.forEach(c=>c.setAttribute('aria-invalid',String(!ok)));}
  return ok;
 }
 Object.values(fields).forEach(field=>{field.addEventListener('blur',()=>{if(field.value)check(field,true);});field.addEventListener('input',()=>check(field,false));});
 choices.forEach(c=>c.addEventListener('change',()=>checkChoice(false)));
 function say(text,kind){status.replaceChildren(text);status.dataset.kind=kind||'';}
 function details(){
  const id=chosen(),r=READINGS[id];
  const subject=`ELEV8MI booking: ${r.name} (${r.price})`;
  const body=`READING: ${r.name} - ${r.price}`+(r.detail?`\n${r.detail}`:'')+`\n\nMY QUESTION:\n${fields.question.value.trim()}\n\nFROM:\n${fields.name.value.trim()} <${fields.email.value.trim()}>`;
  return {id,r,subject,body};
 }
 const mailtoHref=d=>`mailto:${EMAIL}?subject=`+encodeURIComponent(d.subject)+'&body='+encodeURIComponent(d.body);
 // Step after a successful send or the email draft: go to payment, or explain.
 function toPayment(d,lead){
  const link=paymentLink(d.id);
  if(link){say(`${lead} Taking you to payment for your ${d.r.name} (${d.r.price})…`,'success');setTimeout(()=>{location.href=link;},1600);}
  else say(`${lead} The payment link is coming soon. Allison will email you with payment details for your ${d.r.name} (${d.r.price}).`,'success');
 }
 function fallbackLink(d){
  const link=document.createElement('a');link.href=mailtoHref(d);link.textContent='Open an email draft instead';
  link.addEventListener('click',()=>setTimeout(()=>toPayment(d,'Your email draft is ready to send.'),400));
  return link;
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const valid=[fields.name,fields.email,fields.question].map(f=>check(f,true)),choiceOk=checkChoice(true);
  if(valid.includes(false)||!choiceOk){
   ([fields.name,fields.email,fields.question][valid.indexOf(false)]||choices[0]).focus();
   say('Please fix the highlighted fields.','error');return;
  }
  if(honeypot.checked){say('Thank you.','success');return;} // bots: silently drop
  const d=details();
  if(!active()){
   say('Direct sending is not active yet, so your email app will open with your booking filled in.','info');
   location.href=mailtoHref(d);
   setTimeout(()=>toPayment(d,'Your email draft is ready to send.'),900);
   return;
  }
  const payload={
   access_key:config.accessKey.trim(),subject:d.subject,from_name:config.fromName||'ELEV8MI website',
   name:fields.name.value.trim(),email:fields.email.value.trim(),replyto:fields.email.value.trim(),
   reading:d.r.name,price:d.r.price,question:fields.question.value.trim(),message:d.body,botcheck:false
  };
  submit.disabled=true;submit.textContent='Sending…';say('Sending your booking to Allison…','info');
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
   const response=await fetch(config.endpoint||'https://api.web3forms.com/submit',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),signal:controller.signal});
   clearTimeout(timer);
   const result=await response.json().catch(()=>({}));
   if(!response.ok||result.success===false)throw new Error(result.message||`HTTP ${response.status}`);
   form.hidden=true;form.after(status);
   toPayment(d,`Thank you, ${payload.name}. Your booking was sent to Allison. She will reply to ${payload.email}.`);
  }catch(_){
   submit.disabled=false;submit.textContent='Book my reading';
   say('Sorry, your booking could not be sent right now.','error');status.append(' ',fallbackLink(d));
  }
 });
})();
