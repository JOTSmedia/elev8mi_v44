// ELEV8MI 528 Hz sound menu. "Tone" (the live 528 Hz synth drone) is always
// last. Each instrument is ONE line: id = file slug, so the files are
// elev8mi-528hz-<id>.ogg and elev8mi-528hz-<id>.mp3 next to index.html.
// All instrument files are normalised to about -18 LUFS and share one gain;
// the Tone drone is set to the same loudness in audio.js. Entries whose files
// are missing on the server are hidden from the menu automatically.
window.Elev8SoundConfig={
  sharedGain:1.0,
  instruments:[
    {id:'guitar',label:'Guitar'},
    {id:'cello',label:'Cello'},
    {id:'violin',label:'Violin'},
    {id:'piano',label:'Piano'},
    {id:'harp',label:'Harp'},
    {id:'bowl',label:'Singing Bowl'}
  ]
};
