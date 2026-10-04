// ELEV8MI deck configuration. To install the custom 78-card deck, upload one
// WebP per card to basePath using the names in assets/deck/FILENAMES.txt,
// plus back.webp. Any missing file falls back to the built-in atlas art.
window.Elev8DeckConfig={
  basePath:'assets/deck/',      // folder relative to index.html
  extension:'.webp',
  version:'1',                  // bump when replacing deck files (cache-busting)
  // 'auto': card image links go in the email only once that card's deck file
  // loads on the site (so Allison never receives a broken link). true / false.
  emailImageLinks:'auto'
};
(() => {
  'use strict';
  const config=window.Elev8DeckConfig,ranks=['ace','two','three','four','five','six','seven','eight','nine','ten','page','knight','queen','king'];
  const slug=text=>text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  // major-00-the-fool … major-21-the-world; <suit>-01-ace … <suit>-14-king.
  function fileName(card){
    if(card.index<22)return `major-${String(card.index).padStart(2,'0')}-${slug(card.name)}`;
    const [rank,,suit]=card.name.toLowerCase().split(' ');
    return `${suit}-${String(ranks.indexOf(rank)+1).padStart(2,'0')}-${rank}`;
  }
  const path=name=>`${config.basePath}${name}${config.extension}`;
  const status=new Map();
  // Resolves to the loaded <img> for a card's deck file, or null (use atlas).
  function load(name){
    if(!status.has(name))status.set(name,new Promise(resolve=>{
      const img=new Image();img.decoding='async';
      // WebP first, then the deck's JPG fallback, then null (atlas art).
      const sources=[path(name),config.extension==='.jpg'?null:`${config.basePath}${name}.jpg`].filter(Boolean);
      const next=()=>{const src=sources.shift();if(!src){resolve(null);return;}img.src=`${src}?v=${encodeURIComponent(config.version)}`;};
      img.onload=()=>resolve(img.naturalWidth?img:null);img.onerror=next;next();
    }));
    return status.get(name);
  }
  const loaded=new Set();
  window.Elev8Deck={
    config,fileName,
    url:card=>`${path(fileName(card))}?v=${encodeURIComponent(config.version)}`,
    // Built from the page's own address, so links work on a GitHub Pages
    // subpath now and on www.elev8mi.com later (no hard-coded domain).
    publicUrl:card=>new URL(path(fileName(card)),location.href).href,
    image:card=>load(fileName(card)).then(img=>{if(img)loaded.add(card.index);return img;}),
    back:()=>load('back'),
    hasFile:card=>loaded.has(card.index),
    // Atlas fallback: 13 columns × 6 rows of 192×330 cells.
    atlasCell:card=>({col:card.index%13,row:Math.floor(card.index/13),cols:13,rows:6})
  };
})();
