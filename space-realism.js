// E8-05: photoreal WebGL (three.js) renderer for the hero's planets and the Moon.
// Layout is untouched: solar-system.js still positions, clips, orders and sizes
// every button. Each body is rendered as a lit physically based sphere into one
// small HDR atlas (ACES filmic tone mapping + gentle bloom), and each tile is
// copied into a canvas inside that body's existing button, so z-order, pointer
// events, clip paths and focus all stay with the DOM. Without WebGL 2, or with
// reduced motion, nothing here runs and the v31 2D scene remains.
import * as THREE from './vendor/three.module.min.js?v=38';

const root = document.documentElement;
const solar = document.getElementById('solarSystem');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const fail = why => { root.dataset.spaceGl = 'off'; root.dataset.spaceGlReason = why; };
let teardown = () => {};
start();

function start() {
  if (!solar || !window.Elev8Motion) return fail('no-scene');
  if (reduced.matches) return fail('reduced-motion');
  // v35: the WebGL2 probe releases its context at once (it used to hold a
  // spare WebGL context until garbage collection).
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) return fail('no-webgl2');
  window.Elev8ContextGuard?.release?.(probe.canvas); probe.getExtension('WEBGL_lose_context')?.loseContext();
  try { build(); } catch (error) { console.warn('Space realism unavailable:', error); try { teardown(); } catch (_) {} fail('error'); }
}

function build() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mobile = matchMedia('(max-width: 720px)').matches || (coarse && Math.max(screen.width, screen.height) <= 1024);
  const tier = mobile
    ? {name: 'mobile', suffix: '-m', dprCap: 1.5, msaa: 0, bloom: false, shadow: 256, fps: 30, zoom: 1.25}
    : {name: 'desktop', suffix: '', dprCap: 2, msaa: 4, bloom: true, shadow: 1024, fps: 60, zoom: 1.5};
  const atlas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({canvas: atlas, alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power'});
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const loader = new THREE.TextureLoader();
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let moonDirty = true;
  const tex = (file, color = true) => {
    const t = loader.load(`assets/space/${file}${tier.suffix}.webp?v=38`, () => { moonDirty = true; });
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = maxAniso; t.wrapS = THREE.RepeatWrapping;
    return t;
  };

  // NASA rotation periods (h) and obliquity (deg), as in planet-spin.js.
  const SPIN = {Mercury: [1407.6, .034], Venus: [-5832.5, 177.4], Mars: [24.6, 25.2], Jupiter: [9.9, 3.1], Saturn: [10.7, 26.7], Uranus: [-17.2, 97.8], Neptune: [16.1, 28.3]};
  // v33 (E8-12): display spin periods in seconds of scene time (one turn every
  // 40-120 s, varied); negative = retrograde (Venus, Uranus). The Moon turns too.
  // Hook: window.Elev8SpinTable (same shape) overrides these before this module runs.
  const TURN = Object.assign({Mercury: 96, Venus: -118, Mars: 64, Jupiter: 42, Saturn: 48, Uranus: -72, Neptune: 58, Moon: 90}, window.Elev8SpinTable || {});
  const sphere = new THREE.SphereGeometry(1, mobile ? 48 : 72, mobile ? 32 : 48);

  // Regolith (Moon, Mercury): Lommel–Seeliger photometry, so a full Moon stays
  // bright to its limb like the real one; LOLA-derived normals give crater relief.
  const regolith = (map, normal, strength) => new THREE.ShaderMaterial({
    uniforms: {map: {value: map}, normalMap: {value: normal}, useNormal: {value: normal ? 1 : 0}, strength: {value: strength},
      lightDir: {value: new THREE.Vector3(0, 0, 1)}, sun: {value: 4.0}, earthshine: {value: .003}, tint: {value: new THREE.Color(1, 1, 1)},
      phaseMask: {value: 0}},
    vertexShader: `varying vec2 vUv;varying vec3 vN,vE,vNo;
      void main(){vUv=uv;vec3 n=normalize(position);vec3 e=normalize(vec3(n.z,0.0,-n.x)+vec3(1e-5,0.0,0.0));vec3 no=cross(n,e);
        mat3 m=mat3(modelMatrix);vN=normalize(m*n);vE=normalize(m*e);vNo=normalize(m*no);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D map,normalMap;uniform float useNormal,strength,sun,earthshine,phaseMask;uniform vec3 lightDir,tint;
      varying vec2 vUv;varying vec3 vN,vE,vNo;
      void main(){vec3 g=normalize(vN);vec3 n=g;
        if(useNormal>.5){vec3 t=texture2D(normalMap,vUv).xyz*2.0-1.0;t.xy*=strength;n=normalize(g*t.z+normalize(vE)*t.x+normalize(vNo)*t.y);}
        vec3 albedo=texture2D(map,vUv).rgb;albedo=pow(albedo,vec3(2.2))*tint;
        float mu0=max(0.0,dot(n,lightDir)),mu=max(.05,g.z);
        float ls=2.0*mu0/(mu0+mu);
        float terminator=smoothstep(-.015,.05,dot(g,lightDir));
        // For the Moon (phaseMask 1) only the sunlit phase is drawn: the unlit
        // hemisphere is fully transparent (no dark disc, no earthshine).
        float lit=smoothstep(-.02,.06,dot(g,lightDir));
        gl_FragColor=vec4(albedo*(sun*ls*terminator+earthshine*(1.0-phaseMask)),mix(1.0,lit,phaseMask));}`
  });

  const ringTexture = loader.load('assets/space/saturn-rings.png?v=38');
  ringTexture.colorSpace = THREE.SRGBColorSpace;

  function makeBody(name, button) {
    const scene = new THREE.Scene();
    const roll = new THREE.Group(), pitch = new THREE.Group(), spin = new THREE.Group();
    roll.add(pitch); pitch.add(spin); scene.add(roll);
    const light = new THREE.DirectionalLight(0xfff6ec, 3.3);
    scene.add(light, light.target, new THREE.AmbientLight(0xfff0dc, .6));
    let material, extent = 2.05, regolithMat = null, ring = null;
    const [hours, obliquity] = SPIN[name] || [24, 0];
    const tilt = (obliquity > 90 ? obliquity - 180 : obliquity) * Math.PI / 180;
    if (name === 'Mercury') regolithMat = material = regolith(tex('mercury'), null, 0);
    else if (name === 'Moon') { regolithMat = material = regolith(tex('moon'), tex('moon-normal', false), 1.0); regolithMat.uniforms.phaseMask.value = 1; extent = 1.02; }
    else {
      const map = tex(name.toLowerCase());
      material = new THREE.MeshStandardMaterial({map, roughness: name === 'Mars' ? .95 : .88, metalness: 0,
        bumpMap: name === 'Mars' ? map : null, bumpScale: name === 'Mars' ? 1.5 : 0});
    }
    const mesh = new THREE.Mesh(sphere, material); spin.add(mesh);
    if (name === 'Moon') mesh.rotation.y = -Math.PI / 2; // near side faces the viewer
    if (name === 'Saturn') {
      const inner = 1.11, outer = 2.33, geo = new THREE.RingGeometry(inner, outer, mobile ? 96 : 160, 1);
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), .5);
      ring = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({map: ringTexture, transparent: true, side: THREE.DoubleSide, roughness: 1, metalness: 0, depthWrite: false}));
      ring.rotation.x = -Math.PI / 2;
      ring.customDepthMaterial = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, map: ringTexture, alphaTest: .3});
      pitch.add(ring);
      mesh.castShadow = mesh.receiveShadow = ring.castShadow = ring.receiveShadow = true;
      light.castShadow = true; light.shadow.mapSize.set(tier.shadow, tier.shadow);
      Object.assign(light.shadow.camera, {left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: .1, far: 12});
      light.shadow.bias = -.0015; light.shadow.normalBias = .015; light.shadow.radius = mobile ? 1 : 2.5;

      extent = 2.38 * 1.12;
    }
    const camera = new THREE.OrthographicCamera(-extent, extent, extent, -extent, .1, 20);
    camera.position.set(0, 0, 8);
    const out = document.createElement('canvas');
    out.className = name === 'Moon' ? 'moon-gl-cache' : 'planet-gl';
    out.setAttribute('aria-hidden', 'true');
    return {name, button, scene, roll, pitch, spin, light, camera, regolithMat, tilt, out, ctx: out.getContext('2d'),
      seconds: Math.abs(TURN[name] || 60), sign: Math.sign(TURN[name] || 1), tile: null};
  }

  const bodies = [];
  document.querySelectorAll('.solar-body[data-planet]').forEach(button => {
    const name = button.dataset.planet;
    if (!SPIN[name]) return;
    const body = makeBody(name, button);
    button.querySelector('.planet-model')?.append(body.out);
    bodies.push(body);
  });
  const moonCanvas = document.querySelector('.orbit-moon-disc');
  const moon = moonCanvas ? makeBody('Moon', moonCanvas.parentElement) : null;
  const all = moon ? [...bodies, moon] : bodies;

  const target = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: tier.msaa});
  const half = {type: THREE.HalfFloatType, depthBuffer: false};
  const blur = [[new THREE.WebGLRenderTarget(2, 2, half), new THREE.WebGLRenderTarget(2, 2, half)], [new THREE.WebGLRenderTarget(2, 2, half), new THREE.WebGLRenderTarget(2, 2, half)]];
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const vs = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
  const brightPass = new THREE.ShaderMaterial({uniforms: {src: {value: null}, threshold: {value: .8}}, vertexShader: vs, depthTest: false, toneMapped: false,
    fragmentShader: 'uniform sampler2D src;uniform float threshold;varying vec2 vUv;void main(){vec3 c=texture2D(src,vUv).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(threshold,threshold+.6,l),1.0);}'});
  const blurPass = new THREE.ShaderMaterial({uniforms: {src: {value: null}, dir: {value: new THREE.Vector2()}}, vertexShader: vs, depthTest: false, toneMapped: false,
    fragmentShader: 'uniform sampler2D src;uniform vec2 dir;varying vec2 vUv;void main(){vec3 c=texture2D(src,vUv).rgb*.2270;c+=(texture2D(src,vUv+dir*1.385).rgb+texture2D(src,vUv-dir*1.385).rgb)*.3162;c+=(texture2D(src,vUv+dir*3.231).rgb+texture2D(src,vUv-dir*3.231).rgb)*.0703;gl_FragColor=vec4(c,1.0);}'});
  // HDR scene + bloom -> ACES filmic (three's tonemapping chunk) -> sRGB. Glow
  // keeps an alpha equal to its brightness so it composites over the page.
  const finalPass = new THREE.ShaderMaterial({uniforms: {src: {value: null}, bloomA: {value: null}, bloomB: {value: null}, bloom: {value: tier.bloom ? .3 : 0}},
    vertexShader: vs, depthTest: false, toneMapped: true,
    fragmentShader: `uniform sampler2D src,bloomA,bloomB;uniform float bloom;varying vec2 vUv;
      void main(){vec4 s=texture2D(src,vUv);vec3 g=vec3(0.0);
        if(bloom>0.0)g=(texture2D(bloomA,vUv).rgb*.65+texture2D(bloomB,vUv).rgb*.35)*bloom;
        gl_FragColor=vec4(s.rgb+g,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        float a=clamp(max(s.a,max(gl_FragColor.r,max(gl_FragColor.g,gl_FragColor.b))),0.0,1.0);
        gl_FragColor=vec4(gl_FragColor.rgb,a);}`});
  const pass = (material, out) => { quad.material = material; renderer.setRenderTarget(out); renderer.render(quadScene, quadCamera); };

  let atlasW = 16, atlasH = 16, dpr = 1;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, tier.dprCap);
    const gutter = 10;
    let x = gutter, y = gutter, row = 0, width = 0;
    all.forEach(body => {
      let css;
      if (body.name === 'Moon') css = moonCanvas.offsetWidth || 58;
      else {
        const sprite = parseFloat(body.button.querySelector('.planet-model > img')?.style.width) || 20;
        css = body.name === 'Saturn' ? sprite * 1.12 : sprite * 2.05;
      }
      const px = Math.max(16, Math.min(256, Math.round(css * dpr * (body.name === 'Moon' ? 1 : tier.zoom))));
      if (x + px + gutter > 1024) { x = gutter; y += row + gutter; row = 0; }
      body.tile = {x, y, size: px};
      x += px + gutter; row = Math.max(row, px); width = Math.max(width, x);
      if (body.out.width !== px) body.out.width = body.out.height = px;
      if (body.name !== 'Moon') body.out.style.width = body.out.style.height = `${css.toFixed(2)}px`;
    });
    atlasW = Math.max(16, width); atlasH = Math.max(16, y + row + gutter);
    renderer.setSize(atlasW, atlasH, false);
    target.setSize(atlasW, atlasH);
    blur[0].forEach(t => t.setSize(Math.ceil(atlasW / 2), Math.ceil(atlasH / 2)));
    blur[1].forEach(t => t.setSize(Math.ceil(atlasW / 4), Math.ceil(atlasH / 4)));
    moonDirty = true;
  }

  const sunDir = new THREE.Vector3();
  function orient(body, time) {
    const c = window.elev8miCelestial;
    if (body.name === 'Moon') {
      // v32: a slow, steady axial turn (v33: one revolution every 90 s of scene time).
      body.spin.rotation.y = time / body.seconds * Math.PI * 2;
      const angle = (window.Elev8Moon?.state?.angle ?? 90) * Math.PI / 180;
      body.regolithMat.uniforms.lightDir.value.set(Math.sin(angle), 0, -Math.cos(angle)).normalize();
      const eclipse = window.Elev8Moon?.state?.eclipseStrength || 0;
      body.regolithMat.uniforms.tint.value.setRGB(1 - eclipse * .35, 1 - eclipse * .72, 1 - eclipse * .85);
      return;
    }
    const pitch = Math.asin(Math.max(-.6, Math.min(.6, c?.sinPitch ?? .2)));
    if (body.name === 'Saturn') { body.roll.rotation.z = .24; body.pitch.rotation.x = .38; }
    else { body.roll.rotation.z = -body.tilt; body.pitch.rotation.x = pitch * .6; }
    body.spin.rotation.y = time / body.seconds * Math.PI * 2 * body.sign;
    const p = c?.planetPositions?.[body.name], sun = c?.heroSun;
    if (p && sun) sunDir.set(sun.x - (p.displayX ?? p.x), -(sun.y - (p.displayY ?? p.y)), (sun.z || 0) - (p.z || 0));
    else sunDir.set(-.45, .32, .84);
    if (sunDir.lengthSq() < 1e-6) sunDir.set(0, 0, 1);
    sunDir.normalize();
    if (body.regolithMat) body.regolithMat.uniforms.lightDir.value.copy(sunDir);
    body.light.position.copy(sunDir).multiplyScalar(6);
  }

  let lastMoonClock = -1;
  let visible = true, ready = false, frames = 0, busyMs = 0, statsFrom = performance.now();
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }, {rootMargin: '120px'});
  io.observe(solar);

  function frame(time) {
    if (!visible || document.hidden || window.Elev8ContextGuard?.lost(atlas)) return;
    const t0 = performance.now();
    const clock = window.elev8miCelestial?.time ?? time;
    renderer.setRenderTarget(target); target.scissorTest = false; target.viewport.set(0, 0, atlasW, atlasH);
    renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true);
    if (Math.abs(clock - lastMoonClock) > 1 / 30) { moonDirty = true; lastMoonClock = clock; }
    const list = all.filter(b => b.name === 'Moon' ? moonDirty : b.button.style.visibility !== 'hidden');
    list.forEach(body => {
      orient(body, clock);
      const {x, y, size} = body.tile, gy = atlasH - y - size;
      target.viewport.set(x, gy, size, size); target.scissor.set(x, gy, size, size); target.scissorTest = true;
      renderer.setRenderTarget(target);
      renderer.render(body.scene, body.camera);
    });
    target.scissorTest = false; target.viewport.set(0, 0, atlasW, atlasH);
    if (tier.bloom) {
      const step = (src, out, dx, dy) => { blurPass.uniforms.src.value = src.texture; blurPass.uniforms.dir.value.set(dx, dy); pass(blurPass, out); };
      brightPass.uniforms.src.value = target.texture; pass(brightPass, blur[0][0]);
      step(blur[0][0], blur[0][1], 1 / blur[0][0].width, 0); step(blur[0][1], blur[0][0], 0, 1 / blur[0][0].height);
      step(blur[0][0], blur[1][1], 1 / blur[1][0].width, 0); step(blur[1][1], blur[1][0], 0, 1 / blur[1][0].height);
      finalPass.uniforms.bloomA.value = blur[0][0].texture; finalPass.uniforms.bloomB.value = blur[1][0].texture;
    }
    finalPass.uniforms.src.value = target.texture;
    renderer.setRenderTarget(null); renderer.setViewport(0, 0, atlasW, atlasH); renderer.clear(true, false, false);
    pass(finalPass, null);
    // Copy each tile within this same task (no preserveDrawingBuffer needed).
    let moonDrawn = false;
    list.forEach(body => {
      const {x, y, size} = body.tile;
      body.ctx.clearRect(0, 0, size, size);
      body.ctx.drawImage(atlas, x, y, size, size, 0, 0, size, size);
      if (body.name === 'Moon') moonDrawn = true;
    });
    if (!ready) { ready = true; root.dataset.spaceGl = 'on'; root.dataset.spaceGlTier = tier.name; }
    if (moonDrawn) { moonDirty = false; paintMoonDisc(); }
    frames++; busyMs += performance.now() - t0;
  }

  // The orbiting Moon keeps its live phase (lunar-phase.js computes it); only the
  // orbit disc's pixels come from the 3D Moon. The "Moon tonight" widget and the
  // hover portrait keep v31's own renderer.
  const originalRender = window.Elev8Moon?.render?.bind(window.Elev8Moon);
  function paintMoonDisc() {
    if (!moonCanvas || !moon || !ready) return;
    const size = moon.out.width;
    if (moonCanvas.width !== size) moonCanvas.width = moonCanvas.height = size;
    const g = moonCanvas.getContext('2d'); g.clearRect(0, 0, size, size); g.drawImage(moon.out, 0, 0);
  }
  if (window.Elev8Moon && originalRender) {
    window.Elev8Moon.render = (canvas, size) => (canvas === moonCanvas && ready) ? paintMoonDisc() : originalRender(canvas, size);
  }
  window.addEventListener('elev8mi:moon', () => { moonDirty = true; });

  layout();
  window.addEventListener('resize', layout, {passive: true});
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(solar);
  window.addEventListener('scroll', () => { if (window.Elev8Motion.paused) requestAnimationFrame(() => frame(window.Elev8Motion.time)); }, {passive: true});
  const unsubscribe = window.Elev8Motion.add(time => frame(time), {fps: tier.fps});
  // Paused motion still gets a lit frame once the textures have arrived.
  [900, 3200].forEach(ms => setTimeout(() => { if (window.Elev8Boot?.hold) return; moonDirty = true; frame(window.Elev8Motion.time || 0); }, ms));

  teardown = () => {
    unsubscribe(); all.forEach(body => body.out.remove());
    if (window.Elev8Moon && originalRender) window.Elev8Moon.render = originalRender;
    if (moonCanvas && originalRender) originalRender(moonCanvas, 58);
    io.disconnect(); renderer.dispose(); delete root.dataset.spaceGlTier;
  };
  window.Elev8ContextGuard?.init(renderer, {name: 'space', onRestore: () => { layout(); moonDirty = true; frame(window.Elev8Motion.time || 0); }});
  reduced.addEventListener('change', event => { if (event.matches) { teardown(); fail('reduced-motion'); } });
  window.Elev8SpaceGL = {tier: tier.name, get ready() { return ready; }, warmup() { moonDirty = true; frame(window.Elev8Motion.time || 0); },
    stats() { const s = (performance.now() - statsFrom) / 1000, r = {tier: tier.name, renderFps: +(frames / s).toFixed(1), msPerFrame: +(busyMs / Math.max(1, frames)).toFixed(2), atlas: `${atlasW}x${atlasH}`, dpr}; frames = 0; busyMs = 0; statsFrom = performance.now(); return r; }};
}
