(() => {
 'use strict';
 const dialog=document.getElementById('readingGuide'),help=document.getElementById('readingHelp');
 if(!dialog||!help)return;
 let nextFocus=help;
 function open(){if(dialog.open)return;nextFocus=help;if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('open','');document.getElementById('closeReadingGuide')?.focus();}}
 function restore(){nextFocus?.focus();}
 function close(){if(!dialog.open)return;if(typeof dialog.close==='function')dialog.close();else{dialog.removeAttribute('open');restore();}}
 help.addEventListener('click',open);
 dialog.addEventListener('close',restore);
 document.getElementById('closeReadingGuide').addEventListener('click',()=>{nextFocus=help;close();});
 document.getElementById('beginReading').addEventListener('click',()=>{nextFocus=document.getElementById('question');close();});
 dialog.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();nextFocus=help;close();}
   else if(event.key==='Tab'&&typeof dialog.showModal!=='function'){
     const items=[...dialog.querySelectorAll('button')].filter(el=>!el.disabled&&!el.hidden),first=items[0],last=items.at(-1);
     if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
 });
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom){nextFocus=help;close();}}});
})();
