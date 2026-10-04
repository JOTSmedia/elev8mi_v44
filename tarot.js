(() => {
  'use strict';
  const deck=window.Elev8TarotDeck,draw=document.getElementById('drawBtn'),choices=document.getElementById('deckChoices');
  if(!deck||!draw||!choices)return;
  const style=document.getElementById('question'),spread=document.getElementById('spread'),hint=document.getElementById('pickHint');
  const meanings=document.getElementById('meanings'),synthesis=document.getElementById('synthesis'),copy=document.getElementById('copyReading');
  const controls=[...document.querySelectorAll('#spreadRow button')];
  let count=1,picks=[],positions=[],question='',remaining=[],phase='waiting';
  function random(n){
    if(window.crypto?.getRandomValues){const values=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(values);}while(values[0]>=limit);return values[0]%n;}
    return Math.floor(Math.random()*n);
  }
  function shuffle(){const cards=deck.slice();for(let i=cards.length-1;i>0;i--){const j=random(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;}
  function artwork(card,reversed){
    const art=document.createElement('div');art.className='tarot-art'+(reversed?' is-reversed':'');
    art.style.backgroundPosition=`${card.index%13/12*100}% ${Math.floor(card.index/13)/5*100}%`;
    art.setAttribute('role','img');art.setAttribute('aria-label',card.name+(reversed?', reversed':', upright'));
    // Swappable deck: a per-card file in assets/deck/ replaces the atlas cell.
    // The atlas only appears if the card's file is missing (no flash of old art).
    if(window.Elev8Deck){art.classList.add('is-loading');window.Elev8Deck.image(card).then(img=>{art.classList.remove('is-loading');if(!img)return;art.style.backgroundImage=`url("${img.src}")`;art.style.backgroundSize='cover';art.style.backgroundPosition='center';art.classList.add('is-deck-file');});}
    return art;
  }
  window.Elev8Deck?.back().then(img=>{if(!img)return;choices.style.setProperty('--deck-back-image',`url("${img.src}")`);choices.classList.add('has-deck-back');});
  function lockControls(locked){style.disabled=locked;controls.forEach(button=>button.disabled=locked);draw.disabled=locked||!style.value;}
  function clearReading(){
    spread.replaceChildren();meanings.replaceChildren();synthesis.textContent='';copy.hidden=true;copy.textContent='Copy this reading';
    picks=[];window._reading=null;window.dispatchEvent(new Event('elev8mi:reading-reset'));
  }
  function showDeck(waiting){
    choices.replaceChildren();choices.dataset.state=waiting?'waiting':'ready';
    for(let index=0;index<9;index++){
      const button=document.createElement('button');button.type='button';button.className='deck-choice';button.disabled=waiting;
      button.style.setProperty('--card-index',index);
      button.setAttribute('aria-label',waiting?`Face-down card ${index+1}. Choose a reading style to unlock the deck.`:`Choose face-down card ${index+1} of 9`);
      button.innerHTML='<span class="deck-back" aria-hidden="true"><span>✦</span></span>';
      button.addEventListener('click',()=>choose(button,index));choices.append(button);
    }
  }
  function waitForStyle(){
    phase='waiting';remaining=[];question='';clearReading();showDeck(true);lockControls(false);
    draw.textContent='Shuffle again';hint.textContent='Choose a reading style above to bring these cards to life. You can choose one card or three.';
  }
  function start(){
    if(!style.value){waitForStyle();return;}
    count=controls.find(button=>button.getAttribute('aria-pressed')==='true')?.dataset.spread==='three'?3:1;
    positions=count===3?['Past','Present','What may unfold']:['Your focus'];question=style.value.trim();remaining=shuffle().slice(0,9);
    clearReading();phase='ready';showDeck(false);lockControls(false);draw.textContent='Shuffle again';
    hint.textContent=`Your deck is ready. Choose ${count===1?'one card':'three cards'} below, or change your reading style and spread before your first pick.`;
  }
  function write(){
    meanings.replaceChildren();picks.forEach((pick,index)=>{
      const article=document.createElement('article');article.className='meaning';
      const heading=document.createElement('h3');heading.textContent=`${positions[index]} · ${pick.card.name} · ${pick.rev?'Reversed':'Upright'}`;
      const text=document.createElement('p');text.textContent=pick.rev?pick.card.reversed:pick.card.upright;article.append(heading,text);meanings.append(article);
    });
    synthesis.textContent=(question?`Your reading style: ${question}. `:'')+'Consider how these themes relate to your situation; the cards offer reflection, not a guaranteed outcome.';
    window._reading={picks,positions,q:question};copy.hidden=false;window.dispatchEvent(new CustomEvent('elev8mi:reading-complete',{detail:window._reading}));
  }
  function choose(button,index){
    if(button.disabled||phase==='waiting'||phase==='complete'||picks.length>=count)return;
    phase='drawing';choices.dataset.state=phase;lockControls(true);button.disabled=true;button.classList.add('is-chosen');
    const pick={card:remaining[index],rev:random(100)<28};picks.push(pick);button.setAttribute('aria-label',`${pick.card.name}, selected`);
    const slot=document.createElement('div');slot.className='slot';
    const position=document.createElement('div');position.className='pos';position.textContent=positions[picks.length-1];
    const face=document.createElement('div');face.className='illustrated-card';face.append(artwork(pick.card,pick.rev));
    const name=document.createElement('p');name.className='tarot-name';name.textContent=pick.card.name;
    const orientation=document.createElement('p');orientation.className='tarot-orientation';orientation.textContent=pick.rev?'Reversed':'Upright';slot.append(position,face,name,orientation);spread.append(slot);
    if(picks.length===count){
      phase='complete';choices.dataset.state=phase;[...choices.children].forEach(card=>card.disabled=true);
      lockControls(false);draw.textContent='Shuffle for a new reading';
      hint.textContent='Your spread is complete. Read the meanings below, ask Allison to interpret them, or shuffle for a new reading.';write();
    }else hint.textContent=`Choose ${count-picks.length} more ${count-picks.length===1?'card':'cards'}. Your next position is ${positions[picks.length]}.`;
  }
  controls.forEach(button=>button.addEventListener('click',()=>{
    controls.forEach(item=>{item.classList.toggle('on',item===button);item.setAttribute('aria-pressed',String(item===button));});
    if(style.value)start();else hint.textContent='Your spread is selected. Choose a reading style above to unlock the cards.';
  }));
  style.addEventListener('change',start);draw.addEventListener('click',start);
  copy.addEventListener('click',async()=>{
    const text=[question,...picks.map((pick,index)=>`${positions[index]}: ${pick.card.name} (${pick.rev?'Reversed':'Upright'})\n${pick.rev?pick.card.reversed:pick.card.upright}`)].join('\n\n');
    try{await navigator.clipboard.writeText(text);copy.textContent='Copied';}catch(_){hint.textContent='Copy is unavailable here. Select the reading text to copy it.';}
    setTimeout(()=>copy.textContent='Copy this reading',1500);
  });
  if(style.value)start();else waitForStyle();
})();
