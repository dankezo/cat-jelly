
(function(){
"use strict";
if(!window.THREE){ document.getElementById('fallback').style.display='block'; return; }
var $=function(id){ return document.getElementById(id); };
var wrap=$('wrap'), canvas=$('scene');
var reduced=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Renderer + performance profile ----------
   Mobile (coarse pointer or a narrow screen) starts cheaper: lower
   pixel-ratio cap, no transmission pass (the single most expensive
   material feature - it re-renders the whole scene), smaller shadow
   map and lighter geometry. An adaptive governor in the main loop
   steps quality down further if the measured fps stays low. */
var isMobilePerf=false;
try{ isMobilePerf=(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || window.innerWidth<820; }catch(e){}
var basePixelRatio=Math.min(window.devicePixelRatio||1, isMobilePerf?1.25:1.6);
var renderer;
try{renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,powerPreference:'high-performance'});}catch(error){$('fallback').textContent='WebGL is unavailable. Enable hardware acceleration or try a WebGL-capable browser.';$('fallback').style.display='block';$('fallback').setAttribute('role','alert');return;}
renderer.setPixelRatio(basePixelRatio);
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
if('outputColorSpace' in renderer && THREE.SRGBColorSpace!==undefined) renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.78;
var isSoftwareGL=false;
try{
  var _gl=renderer.getContext(); var _dbg=_gl.getExtension('WEBGL_debug_renderer_info');
  var _r=String(_gl.getParameter(_dbg?_dbg.UNMASKED_RENDERER_WEBGL:_gl.RENDERER));
  isSoftwareGL=/swiftshader|llvmpipe|software/i.test(_r);
}catch(e){}
if(isSoftwareGL){ renderer.setPixelRatio(1); renderer.shadowMap.enabled=false; }
var useTransmission=!isSoftwareGL && !isMobilePerf;
/* live-piece budgets: phones simulate fewer fragments at once */
var MAX_CRUMBS=isMobilePerf?170:280, MAX_PIECES=isMobilePerf?190:320;
var spawnScale=isMobilePerf?0.7:1; /* adaptive governor lowers this too */

var scene=new THREE.Scene();
scene.background=new THREE.Color(0x080f16);
scene.fog=new THREE.Fog(0x080f16,26,58);

/* ---------- Camera: low bench-level view ---------- */
var camera=new THREE.PerspectiveCamera(40,1,0.1,140);
var camTheta=0.25, camPhi=1.28, camDist=18.5, camTarget=new THREE.Vector3(0,3.1,0);
var camHome={theta:0.25,phi:1.28,dist:18.5};
function applyCam(){
  camera.position.set(
    camTarget.x+camDist*Math.sin(camPhi)*Math.sin(camTheta),
    camTarget.y+camDist*Math.cos(camPhi),
    camTarget.z+camDist*Math.sin(camPhi)*Math.cos(camTheta));
  camera.lookAt(camTarget);
}

/* ---------- Environment for glossy gel reflections ---------- */
function buildEnv(){
  try{
    var pmrem=new THREE.PMREMGenerator(renderer);
    var es=new THREE.Scene();
    var dome=new THREE.Mesh(new THREE.SphereGeometry(50,16,16),new THREE.MeshBasicMaterial({side:THREE.BackSide}));
    dome.material.color.setRGB(.18,.23,.28); es.add(dome);
    function box(r,g,b,x,y,z,w,h){ var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial()); m.material.color.setRGB(r,g,b); m.position.set(x,y,z); m.lookAt(0,0,0); es.add(m); }
    box(2.8,3.1,3.2,-8,15,6,17,10); box(3.2,1.1,1.4,14,6,-4,12,8); box(0.9,3,2.6,4,5,15,12,8); box(3.6,2.6,1.0,-4,-12,-8,14,8);
    scene.environment=pmrem.fromScene(es,0.06).texture; pmrem.dispose();es.traverse(function(o){if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
  }catch(e){}
}
if(document.readyState==='complete') setTimeout(buildEnv,50); else window.addEventListener('load',function(){ setTimeout(buildEnv,50); });

/* ---------- Lights: warm studio ---------- */
scene.add(new THREE.HemisphereLight(0xc5e9ed,0x111922,0.4));
var sun=new THREE.DirectionalLight(0xffe6d4,1.4); sun.position.set(7,13,6); sun.castShadow=true;
sun.shadow.mapSize.set(isMobilePerf?1024:2048,isMobilePerf?1024:2048); sun.shadow.camera.left=-11; sun.shadow.camera.right=11; sun.shadow.camera.top=12; sun.shadow.camera.bottom=-6; sun.shadow.bias=-0.0004; sun.shadow.radius=4;
scene.add(sun);
var fill=new THREE.PointLight(0xffc8b5,12,30,1.9); fill.position.set(-8,5,7); scene.add(fill);
var rim=new THREE.PointLight(0x9bd9e0,20,30,1.9); rim.position.set(8,4,-7); scene.add(rim);

/* ---------- Warm studio backdrop ---------- */
var backdrop=new THREE.Mesh(new THREE.SphereGeometry(70,24,16),new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{top:{value:new THREE.Color(0xe9f0eb)},mid:{value:new THREE.Color(0xdce6e1)},bot:{value:new THREE.Color(0xc2d1cd)}},
  vertexShader:"varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader:"uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h=normalize(vP).y*0.5+0.5; vec3 c=h>0.5? mix(mid,top,smoothstep(0.5,1.0,h)) : mix(bot,mid,smoothstep(0.0,0.5,h)); gl_FragColor=vec4(c,1.0); }"
}));
scene.add(backdrop);backdrop.visible=false;

/* ---------- Floor and steel bed ---------- */
var BED_Y=0.34;
/* ---------- Floor: the user's own Vietnamese floral tile photo ----------
   The floor uses the real gach hoa photo the user sent
   (a 2x2 sheet of classic Vietnamese floral
   cement tiles), not a procedural imitation. It is drawn wrap-around
   with a slight blur so the repeat stays seamless, then pulled DOWN
   a touch and given more contrast (brightness 0.88, contrast 1.17,
   plus a faint warm shade wash and a darker material tint): the old
   cream veil made the floor glare almost white and washed the motif
   out. The pattern stays clearly readable - darker and punchier,
   never gloomy - so the cat on the steel bed stays the brightest
   thing in the scene. The page background in CSS uses the same
   photo under a matching warm shade. */
/* One embedded tile, shared by CSS background and Three.js floor. */
var TILE_ART_DATA='./assets/workshop-floor.png';
document.documentElement.style.setProperty('--tile-art','url("'+TILE_ART_DATA+'")');
function hoaTileTexture(){
  var cv=document.createElement('canvas'); cv.width=cv.height=600;
  var cx=cv.getContext('2d');
  cx.fillStyle='#e0ca94'; cx.fillRect(0,0,600,600);
  var tex=new THREE.CanvasTexture(cv);
  tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(9,9);
  if(THREE.SRGBColorSpace!==undefined) tex.colorSpace=THREE.SRGBColorSpace;
  tex.anisotropy=4;
  var img=new Image();
  img.onload=function(){
    try{ cx.filter='blur(1.2px) brightness(0.88) contrast(1.17) saturate(1.07)'; }catch(e){}
    for(var dx=-600;dx<=600;dx+=600) for(var dy=-600;dy<=600;dy+=600) cx.drawImage(img,dx,dy,600,600);
    try{ cx.filter='none'; }catch(e){}
    cx.fillStyle='rgba(88,58,22,0.10)'; cx.fillRect(0,0,600,600);
    tex.needsUpdate=true;
  };
  img.src=TILE_ART_DATA;
  return tex;
}
var floor=new THREE.Mesh(new THREE.CircleGeometry(80,48),new THREE.MeshStandardMaterial({map:hoaTileTexture(),color:0xd9c8a4,roughness:0.95,metalness:0}));
var workshopFloorMap=floor.material.map;floor.material.map=null;floor.material.color.set(0x101e26);floor.material.envMapIntensity=.15;floor.material.roughness=1;
floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
var floorRing=new THREE.Mesh(new THREE.TorusGeometry(8.6,0.07,10,72),new THREE.MeshStandardMaterial({color:0xb08d55,roughness:0.6,metalness:0.3}));
floorRing.material.color.set(0x91aaa2);floorRing.visible=false;floorRing.rotation.x=Math.PI/2; floorRing.position.y=0.02; scene.add(floorRing);

var steel=new THREE.MeshStandardMaterial({color:0x9aa2ad,roughness:0.34,metalness:0.88});
var steelDark=new THREE.MeshStandardMaterial({color:0x39404a,roughness:0.45,metalness:0.8});
var inkMetal=new THREE.MeshStandardMaterial({color:0x23262c,roughness:0.5,metalness:0.65});
var bed=new THREE.Mesh(new THREE.CylinderGeometry(3.55,3.8,BED_Y,44),steel);
bed.position.y=BED_Y/2; bed.castShadow=true; bed.receiveShadow=true; scene.add(bed);
var bedRim=new THREE.Mesh(new THREE.TorusGeometry(3.55,0.09,12,56),steelDark);
bed.material=steel.clone();bed.material.color.set(0x344650);bed.material.roughness=.72;bed.material.metalness=.45;bed.material.envMapIntensity=.35;
bedRim.rotation.x=Math.PI/2; bedRim.position.y=BED_Y; scene.add(bedRim);

// A soft contact shadow also grounds the specimen on software WebGL.
var shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;var shadowCtx=shadowCanvas.getContext('2d'),shadowGradient=shadowCtx.createRadialGradient(64,64,4,64,64,64);shadowGradient.addColorStop(0,'rgba(0,0,0,.55)');shadowGradient.addColorStop(1,'rgba(0,0,0,0)');shadowCtx.fillStyle=shadowGradient;shadowCtx.fillRect(0,0,128,128);
var contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(4,3),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contactShadow.rotation.x=-Math.PI/2;contactShadow.position.set(0,BED_Y+.007,-.1);scene.add(contactShadow);
/* ---------- Trash bin: where the vacuum sends every crumb ---------- */
var BIN_POS=new THREE.Vector3(4.5,1.05,2.5);
(function(){
  var bin=new THREE.Group();
  var body=new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.42,1.05,20),new THREE.MeshStandardMaterial({color:0x39404a,roughness:0.5,metalness:0.75}));
  body.position.y=0.53; body.castShadow=true; bin.add(body);
  var band=new THREE.Mesh(new THREE.CylinderGeometry(0.535,0.535,0.14,20),new THREE.MeshStandardMaterial({color:0xe5322d,roughness:0.4,metalness:0.3}));
  band.position.y=0.86; bin.add(band);
  var lid=new THREE.Mesh(new THREE.CylinderGeometry(0.56,0.56,0.09,20),steelDark);
  lid.position.set(0.16,1.12,0); lid.rotation.z=0.5; lid.castShadow=true; bin.add(lid);
  bin.position.set(BIN_POS.x,0,BIN_POS.z); scene.add(bin);
})();

/* ---------- The press frame: a real four-post hydraulic press ----------
   Mechanism first, ornament second (per the asset prompt pack):
   FOUR load-bearing posts (a front pair under the crossbeam, a rear
   pair under a rear rail, tied together by side rails), a FIXED top
   crossbeam, a STATIC cylinder housing hanging from the beam, and a
   ram + platen that travel vertically on their own - never fused to
   the frame, never blocked by decor. The bed is fixed. Each fantasy
   machine then dresses THIS skeleton with its own cladding, so the
   three machines share a mechanism but never a silhouette. */
var press=new THREE.Group(); scene.add(press);
var POST_XS=[-3.15,3.15], POST_ZS=[-0.85,-2.25];
POST_XS.forEach(function(x){
  POST_ZS.forEach(function(z){
    var post=new THREE.Mesh(new THREE.CylinderGeometry(0.30,0.36,7.6,20),inkMetal);
    post.position.set(x,3.8,z); post.castShadow=true; press.add(post);
    var foot=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.72,0.28,20),steelDark);
    foot.position.set(x,0.14,z); foot.castShadow=true; press.add(foot);
    var collar=new THREE.Mesh(new THREE.CylinderGeometry(0.44,0.44,0.5,20),steel);
    collar.position.set(x,6.6,z); press.add(collar);
  });
});
var beam=new THREE.Mesh(new THREE.BoxGeometry(7.5,1.05,1.7),inkMetal);
beam.position.set(0,7.35,-0.85); beam.castShadow=true; press.add(beam);
/* rear top rail + side rails: the rear posts carry a real top frame too */
var rearRail=new THREE.Mesh(new THREE.BoxGeometry(7.5,0.8,1.0),inkMetal);
rearRail.position.set(0,7.35,-2.25); rearRail.castShadow=true; press.add(rearRail);
POST_XS.forEach(function(x){
  var sideRail=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.7,3.1),inkMetal);
  sideRail.position.set(x,7.35,-1.55); sideRail.castShadow=true; press.add(sideRail);
});
/* static cylinder housing: fixed to the beam, the ram slides out of
   it - it is part of the frame, NOT of the moving platen group */
var cylHousing=new THREE.Group(); press.add(cylHousing);
var cylBody=new THREE.Mesh(new THREE.CylinderGeometry(0.95,0.95,0.40,28),steelDark);
cylBody.position.set(0,6.62,-0.1); cylBody.castShadow=true; cylHousing.add(cylBody);
var cylFlange=new THREE.Mesh(new THREE.CylinderGeometry(1.10,1.10,0.13,28),steel);
cylFlange.position.set(0,6.40,-0.1); cylFlange.castShadow=true; cylHousing.add(cylFlange);
var cylNeck=new THREE.Mesh(new THREE.CylinderGeometry(0.60,0.75,0.22,20),steel);
cylNeck.position.set(0,6.90,-0.1); cylHousing.add(cylNeck);
/* hazard stripe plate on the beam, drawn on a canvas texture */
(function(){
  var cv=document.createElement('canvas'); cv.width=256; cv.height=32; var cx=cv.getContext('2d');
  cx.fillStyle='#ffd21f'; cx.fillRect(0,0,256,32); cx.fillStyle='#191919';
  for(var i=-1;i<9;i++){ cx.beginPath(); cx.moveTo(i*32,32); cx.lineTo(i*32+16,0); cx.lineTo(i*32+32,0); cx.lineTo(i*32+16,32); cx.fill(); }
  var tex=new THREE.CanvasTexture(cv); tex.wrapS=THREE.RepeatWrapping; tex.repeat.x=2;
  var plate=new THREE.Mesh(new THREE.BoxGeometry(7.52,0.34,1.72),new THREE.MeshBasicMaterial({map:tex}));
  plate.position.set(0,6.72,-0.85); press.add(plate);
})();
/* machine aura light: recoloured per fantasy machine (dragon fire
   orange, hell violet, angel cyan) - see applyMachineTheme */
var auraLight=new THREE.PointLight(0x000000,0,30,2); auraLight.position.set(0,6.6,-0.85); press.add(auraLight);
/* rest height leaves a real open gap: platen top 6.11 hangs below the
   housing flange (6.34) with a visible length of ram between them -
   at the old 6.8 the platen's top overlapped the beam and the head
   read as fused to the frame */
var PLATEN_R=2.35, PLATEN_TOP=5.85, PLATEN_MIN=0.62;
var platenGroup=new THREE.Group(); press.add(platenGroup);
var ram=new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.52,1,16),steel);
ram.castShadow=true; platenGroup.add(ram);
var platen=new THREE.Mesh(new THREE.CylinderGeometry(PLATEN_R,PLATEN_R+0.12,0.52,44),steelDark);
platen.castShadow=true; platen.receiveShadow=true; platenGroup.add(platen);
var platenFace=new THREE.Mesh(new THREE.CylinderGeometry(PLATEN_R-0.18,PLATEN_R-0.18,0.1,44),steel);
platenFace.position.y=-0.3; platenGroup.add(platenFace);
var platenY=PLATEN_TOP;
function layoutPlaten(){
  platen.position.set(0,platenY,-0.1);
  platenFace.position.set(0,platenY-0.3,-0.1);
  if(typeof platenRig!=='undefined' && platenRig) platenRig.position.y=platenY;
  var ramTop=6.82, ramBot=platenY+0.26, len=Math.max(0.2,ramTop-ramBot);
  ram.scale.y=len; ram.position.set(0,ramBot+len/2,-0.1);
}
layoutPlaten();
function platenBottom(){ return platenY-0.35; }
function platenTopY(){ return platenY+0.26; }
var platenVelY=0; /* units per second, tracked every frame in animate() */

/* Flush fasteners at the structural joints, shared geometry and material. */
var boltGeo=new THREE.CylinderGeometry(.07,.07,.06,6);
POST_XS.forEach(function(x){POST_ZS.forEach(function(z){[-.25,.25].forEach(function(offset){var bolt=new THREE.Mesh(boltGeo,steel);bolt.position.set(x+offset,.3,z);press.add(bolt);});});});
var labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=96;
var labelCtx=labelCanvas.getContext('2d');labelCtx.fillStyle='#304146';labelCtx.fillRect(0,0,512,96);labelCtx.fillStyle='#dce9dd';labelCtx.font='26px monospace';labelCtx.fillText('CJ / MATERIAL LAB',30,40);labelCtx.font='15px monospace';labelCtx.fillText('HYDRAULIC TEST RIG     No. 003',30,72);
var machineLabel=new THREE.Mesh(new THREE.PlaneGeometry(2.8,.52),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(labelCanvas)}));machineLabel.position.set(0,7.35,.02);press.add(machineLabel);
/* ---------- Fantasy press skins: EXACTLY three machines ----------
   Built to the user's Fantasy Hydraulic Press asset sheet, and each
   one is a different MACHINE, not a recolour: different frame
   dressing, different platen underside, different aura light,
   different ambient effects, different pressure/speed stats (see
   MACHINES below).
   1. FIRE DRAGON - blackened bronze frame, a lava-lit dragon whose
      body wraps the posts and over the beam, head breathing fire at
      the top, braziers, red banners, a molten ring under the platen.
   2. HELL - black-purple frame, a horned skull on the beam, skulls
      hanging from chains, a chain slung between the posts, purple
      pentagram banners and a glowing rune circle on the bed.
   3. ANGEL - white-and-gold frame, feathered wings fanned over the
      beam, a floating halo, cyan crystals on the posts, at the bed
      and orbiting the platen, ringed in gold and cyan light.
   Only the active machine's decor group is visible; applyMachineTheme
   switches groups, frame colours and the aura light together. */
var decorGroups={}, platenDecor={};
var machineFx={dragon:{flames:[]},hell:{wisps:[]},angel:{floats:[]}};
var decorMats={
  dragonBody:new THREE.MeshStandardMaterial({color:0x38130a,roughness:0.52,metalness:0.35,emissive:0xff3d00,emissiveIntensity:0.20}),
  dragonScale:new THREE.MeshStandardMaterial({color:0x5c1a0c,roughness:0.42,metalness:0.30,emissive:0xff5a00,emissiveIntensity:0.38}),
  lava:new THREE.MeshStandardMaterial({color:0xff6a00,roughness:0.40,metalness:0.0,emissive:0xff4400,emissiveIntensity:1.7}),
  bone:new THREE.MeshStandardMaterial({color:0xcfc6b4,roughness:0.82,metalness:0.05}),
  hellDark:new THREE.MeshStandardMaterial({color:0x1a1426,roughness:0.58,metalness:0.55}),
  hellGlow:new THREE.MeshStandardMaterial({color:0x8a2be2,roughness:0.40,metalness:0.0,emissive:0x9b30ff,emissiveIntensity:1.5}),
  gold:new THREE.MeshStandardMaterial({color:0xd9a83e,roughness:0.30,metalness:0.9}),
  feather:new THREE.MeshStandardMaterial({color:0xf5efe2,roughness:0.55,metalness:0.05,emissive:0xfff4d6,emissiveIntensity:0.14,side:THREE.DoubleSide}),
  crystal:new THREE.MeshPhysicalMaterial({color:0x9fe8ff,roughness:0.05,metalness:0.0,transparent:true,opacity:0.88,emissive:0x38c8ff,emissiveIntensity:0.95,flatShading:true}),
  angelGlow:new THREE.MeshStandardMaterial({color:0x66d9ff,roughness:0.30,metalness:0.0,emissive:0x4dc3ff,emissiveIntensity:1.4}),
  bronze:new THREE.MeshStandardMaterial({color:0xb18a4f,roughness:0.38,metalness:0.85}),
  obsidian:new THREE.MeshStandardMaterial({color:0x241a16,roughness:0.62,metalness:0.35}),
  pearl:new THREE.MeshStandardMaterial({color:0xe9e2d2,roughness:0.24,metalness:0.12}),
  magentaGlow:new THREE.MeshStandardMaterial({color:0xcc6aff,roughness:0.35,metalness:0.0,emissive:0xcc6aff,emissiveIntensity:1.3})
};
/* flame-sigil disc for the dragon machine's cylinder housing: a
   gold flame swirl on scorched black, drawn once on a canvas */
function dragonSigilTexture(){
  var cv=document.createElement('canvas'); cv.width=cv.height=256;
  var cx=cv.getContext('2d');
  cx.fillStyle='#160b06'; cx.fillRect(0,0,256,256);
  cx.strokeStyle='#ffb52e'; cx.lineWidth=7; cx.shadowColor='#ff5a00'; cx.shadowBlur=13;
  cx.beginPath(); cx.arc(128,128,86,0,6.29); cx.stroke();
  cx.lineWidth=9; cx.beginPath();
  for(var a=0;a<=6.6;a+=0.15){
    var r=12+a*10.5, px=128+Math.cos(a+0.6)*r, py=128+Math.sin(a+0.6)*r;
    if(a===0) cx.moveTo(px,py); else cx.lineTo(px,py);
  }
  cx.stroke();
  cx.fillStyle='#ffe359';
  cx.beginPath(); cx.moveTo(128,58); cx.lineTo(140,86); cx.lineTo(116,86); cx.closePath(); cx.fill();
  var tex=new THREE.CanvasTexture(cv);
  if(THREE.SRGBColorSpace!==undefined) tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}
function dMesh(geo,mat,x,y,z,parent){
  var m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.castShadow=true;
  if(parent) parent.add(m);
  return m;
}
function glowDisc(color,opacity,radius){
  var m=new THREE.Mesh(new THREE.CircleGeometry(radius,40),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:opacity,blending:THREE.AdditiveBlending,depthWrite:false}));
  m.rotation.x=-Math.PI/2; m.position.y=0.03; return m;
}
function pentagramTexture(){
  var cv=document.createElement('canvas'); cv.width=cv.height=256;
  var cx=cv.getContext('2d');
  cx.clearRect(0,0,256,256);
  cx.strokeStyle='#c07dff'; cx.lineWidth=7; cx.shadowColor='#9b30ff'; cx.shadowBlur=14;
  cx.beginPath(); cx.arc(128,128,102,0,6.29); cx.stroke();
  cx.lineWidth=5;
  cx.beginPath();
  for(var i=0;i<=5;i++){
    var a=-Math.PI/2+i*(Math.PI*4/5);
    var px=128+Math.cos(a)*88, py=128+Math.sin(a)*88;
    if(i===0) cx.moveTo(px,py); else cx.lineTo(px,py);
  }
  cx.stroke();
  var tex=new THREE.CanvasTexture(cv);
  if(THREE.SRGBColorSpace!==undefined) tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}
/* ----- 1. FIRE DRAGON ----- */
(function(){
  var g=new THREE.Group();
  var curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(4.35,0.7,2.2), new THREE.Vector3(4.10,2.2,0.2),
    new THREE.Vector3(3.80,3.8,-1.8), new THREE.Vector3(3.30,5.6,-2.3),
    new THREE.Vector3(1.80,7.4,-2.2), new THREE.Vector3(-0.20,8.25,-1.95),
    new THREE.Vector3(-2.00,8.20,-1.60), new THREE.Vector3(-3.05,7.60,-0.50),
    new THREE.Vector3(-3.30,7.75,0.30)
  ]);
  var body=new THREE.Mesh(new THREE.TubeGeometry(curve,72,0.30,10),decorMats.dragonBody);
  body.castShadow=true; g.add(body);
  for(var ti=0.06;ti<0.92;ti+=0.075){
    var pt=curve.getPoint(ti);
    var spike=dMesh(new THREE.ConeGeometry(0.10,0.36,6),decorMats.dragonScale,pt.x,pt.y+0.30,pt.z,g);
    spike.rotation.z=(Math.random()-0.5)*0.5; spike.rotation.x=(Math.random()-0.5)*0.5;
  }
  var tail=dMesh(new THREE.ConeGeometry(0.30,1.15,8),decorMats.dragonScale,4.42,0.45,2.45,g);
  tail.rotation.x=2.55; tail.rotation.z=-0.5;
  var head=new THREE.Group(); head.position.set(-3.50,7.90,0.60); head.rotation.y=-0.5; g.add(head);
  dMesh(new THREE.BoxGeometry(0.58,0.42,0.72),decorMats.dragonBody,0,0,0,head);
  dMesh(new THREE.BoxGeometry(0.40,0.24,0.58),decorMats.dragonScale,0,-0.06,0.58,head);
  dMesh(new THREE.BoxGeometry(0.34,0.10,0.50),decorMats.dragonBody,0,-0.26,0.52,head);
  [-1,1].forEach(function(s){
    var horn=dMesh(new THREE.ConeGeometry(0.09,0.62,6),decorMats.bone,s*0.21,0.32,-0.28,head);
    horn.rotation.x=-0.75; horn.rotation.z=-s*0.25;
    dMesh(new THREE.SphereGeometry(0.06,8,8),decorMats.lava,s*0.17,0.09,0.40,head);
    for(var th=0;th<2;th++){
      var tooth=dMesh(new THREE.ConeGeometry(0.035,0.13,5),decorMats.bone,s*(0.08+th*0.11),-0.22,0.62+th*0.1,head);
      tooth.rotation.x=Math.PI;
    }
  });
  var breath=dMesh(new THREE.ConeGeometry(0.17,1.0,8),decorMats.lava,0,-0.14,1.25,head);
  breath.rotation.x=2.0; machineFx.dragon.flames.push(breath);
  [-3.15,3.15].forEach(function(x){
    dMesh(new THREE.CylinderGeometry(0.30,0.20,0.24,10),decorMats.hellDark,x,0.42,-0.85,g);
    var fl=dMesh(new THREE.ConeGeometry(0.21,0.62,8),decorMats.lava,x,0.82,-0.85,g);
    machineFx.dragon.flames.push(fl);
    var ring=dMesh(new THREE.TorusGeometry(0.40,0.055,8,20),decorMats.dragonScale,x,6.55,-0.85,g);
    ring.rotation.x=Math.PI/2;
  });
  [-2.25,2.25].forEach(function(x){
    var ban=new THREE.Mesh(new THREE.PlaneGeometry(0.72,1.5),new THREE.MeshStandardMaterial({color:0x7a1408,roughness:0.85,emissive:0xff2200,emissiveIntensity:0.28,side:THREE.DoubleSide}));
    ban.position.set(x,6.30,0.05); g.add(ban);
  });
  var lavaRing=dMesh(new THREE.TorusGeometry(3.56,0.075,10,56),decorMats.lava,0,BED_Y+0.03,0,g);
  lavaRing.rotation.x=Math.PI/2;
  g.add(glowDisc(0xff4400,0.16,5.4));
  /* --- DRAGON frame cladding: this machine's own frame, not a
     recolour - bronze post armour, a second dragon body HELIXED
     around each front post (real 3D wrap, outside the press gap),
     a bronze beam fascia with an ember gem, the flame sigil on the
     cylinder housing, side power tanks and an obsidian base skirt
     with a small dragon head at the front --- */
  POST_XS.forEach(function(x){
    POST_ZS.forEach(function(z){
      [1.25,3.45,5.55].forEach(function(y){
        var col=dMesh(new THREE.TorusGeometry(0.42,0.06,8,22),decorMats.bronze,x,y,z,g);
        col.rotation.x=Math.PI/2;
      });
    });
    /* side power tank, standing on the floor beside the rear post */
    var tank=dMesh(new THREE.CylinderGeometry(0.42,0.46,2.1,16),decorMats.obsidian,x*1.24,1.08,-2.25,g);
    var tb1=dMesh(new THREE.TorusGeometry(0.44,0.05,8,20),decorMats.bronze,x*1.24,1.78,-2.25,g); tb1.rotation.x=Math.PI/2;
    var tb2=dMesh(new THREE.TorusGeometry(0.45,0.05,8,20),decorMats.bronze,x*1.24,0.45,-2.25,g); tb2.rotation.x=Math.PI/2;
    var gauge=dMesh(new THREE.CylinderGeometry(0.16,0.16,0.06,16),decorMats.bronze,x*1.24,1.58,-1.80,g);
    gauge.rotation.x=Math.PI/2;
  });
  [-3.15,3.15].forEach(function(x){
    /* helical dragon body wrapping the front post, y 0.9 to 5.6 */
    var pts=[], hi2;
    for(hi2=0;hi2<=40;hi2++){
      var ht=hi2/40, ha=ht*Math.PI*5.0+(x>0?1.4:0);
      pts.push(new THREE.Vector3(x+Math.cos(ha)*0.47,0.9+ht*4.7,-0.85+Math.sin(ha)*0.47));
    }
    var coil=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),64,0.13,8),decorMats.dragonScale);
    coil.castShadow=true; g.add(coil);
    for(var ci2=4;ci2<40;ci2+=8){
      var cp=pts[ci2];
      var csp=dMesh(new THREE.ConeGeometry(0.06,0.22,5),decorMats.dragonBody,cp.x,cp.y+0.14,cp.z,g);
      csp.rotation.z=(Math.random()-0.5)*0.6;
    }
  });
  var fasciaD=dMesh(new THREE.BoxGeometry(7.54,0.62,0.16),decorMats.bronze,0,7.35,0.06,g);
  dMesh(new THREE.OctahedronGeometry(0.21),decorMats.lava,0,7.35,0.22,g);
  [-2.6,-1.3,1.3,2.6].forEach(function(x){
    dMesh(new THREE.OctahedronGeometry(0.11),decorMats.lava,x,7.35,0.17,g);
  });
  var sigilD=new THREE.Mesh(new THREE.CircleGeometry(0.52,28),new THREE.MeshBasicMaterial({map:dragonSigilTexture()}));
  sigilD.position.set(0,6.58,0.86); g.add(sigilD);
  /* skirt centre y is 0.12, NOT 0.17: at 0.17 the skirt's top cap lands
     exactly on the bed top plane (both at BED_Y=0.34), and the two
     overlapping triangle fans z-fight into a jagged black radial
     starburst that swallows the cat. 0.05 lower the cap reads as a
     plinth step below the bed and the fighting is gone. All three
     machine skirts share this offset for the same reason. */
  var skirtD=dMesh(new THREE.CylinderGeometry(3.95,4.10,0.34,44),decorMats.obsidian,0,0.12,-0.1,g);
  dMesh(new THREE.BoxGeometry(0.30,0.52,0.34),decorMats.obsidian,0,0.30,3.80,g); /* bracket: skirt to head, nothing floats */
  var miniHead=new THREE.Group(); miniHead.position.set(0,0.62,3.72); g.add(miniHead);
  dMesh(new THREE.BoxGeometry(0.46,0.34,0.40),decorMats.dragonBody,0,0,0,miniHead);
  dMesh(new THREE.BoxGeometry(0.30,0.18,0.34),decorMats.dragonScale,0,-0.05,0.32,miniHead);
  [-1,1].forEach(function(s){
    var mh=dMesh(new THREE.ConeGeometry(0.07,0.44,6),decorMats.bone,s*0.17,0.26,-0.12,miniHead);
    mh.rotation.x=-0.7; mh.rotation.z=-s*0.25;
    dMesh(new THREE.SphereGeometry(0.045,8,8),decorMats.lava,s*0.13,0.06,0.22,miniHead);
  });
  press.add(g); decorGroups.dragon=g;
})();
/* ----- 2. HELL ----- */
(function(){
  var g=new THREE.Group();
  var penta=pentagramTexture();
  var skull=new THREE.Group(); skull.position.set(0,7.42,0.38); g.add(skull);
  var cranium=dMesh(new THREE.SphereGeometry(0.52,18,14),decorMats.bone,0,0.06,0,skull);
  cranium.scale.set(1,0.92,0.9);
  dMesh(new THREE.BoxGeometry(0.54,0.30,0.36),decorMats.bone,0,-0.48,0.10,skull);
  [-1,1].forEach(function(s){
    dMesh(new THREE.SphereGeometry(0.115,10,8),decorMats.hellGlow,s*0.20,0.08,0.40,skull);
    var horn=dMesh(new THREE.ConeGeometry(0.13,1.0,8),decorMats.hellDark,s*0.58,0.48,-0.05,skull);
    horn.rotation.z=-s*0.85; horn.rotation.x=-0.2;
    for(var th=0;th<2;th++) dMesh(new THREE.BoxGeometry(0.07,0.16,0.05),decorMats.bone,s*(0.09+th*0.13),-0.68,0.24,skull);
  });
  function chainLink(x,y,z,flip){
    var l=dMesh(new THREE.TorusGeometry(0.085,0.024,6,12),decorMats.hellDark,x,y,z,g);
    if(flip) l.rotation.x=Math.PI/2;
    return l;
  }
  for(var ci=0;ci<15;ci++){
    var ct=ci/14, cxp=-3.15+ct*6.3, cyp=6.95-Math.sin(ct*Math.PI)*0.55;
    chainLink(cxp,cyp,-0.15,ci%2===0);
  }
  [-2.55,2.55].forEach(function(x){
    for(var li=0;li<5;li++) chainLink(x,6.72-li*0.17,0.10,li%2===0);
    var sk=new THREE.Group(); sk.position.set(x,5.62,0.10); g.add(sk);
    var sc=dMesh(new THREE.SphereGeometry(0.27,14,12),decorMats.bone,0,0,0,sk);
    sc.scale.set(1,0.92,0.9);
    dMesh(new THREE.BoxGeometry(0.28,0.16,0.20),decorMats.bone,0,-0.27,0.05,sk);
    dMesh(new THREE.SphereGeometry(0.05,8,6),decorMats.hellGlow,-0.10,0.03,0.22,sk);
    dMesh(new THREE.SphereGeometry(0.05,8,6),decorMats.hellGlow,0.10,0.03,0.22,sk);
  });
  [-2.3,2.3].forEach(function(x){
    var ban=new THREE.Mesh(new THREE.PlaneGeometry(0.85,1.9),new THREE.MeshStandardMaterial({color:0x17102a,roughness:0.9,emissive:0x9b30ff,emissiveIntensity:0.35,emissiveMap:penta,map:penta,side:THREE.DoubleSide}));
    ban.position.set(x,5.85,0.05); g.add(ban);
  });
  var rune=new THREE.Mesh(new THREE.CircleGeometry(2.45,40),new THREE.MeshBasicMaterial({map:penta,transparent:true,opacity:0.9,depthWrite:false}));
  rune.rotation.x=-Math.PI/2; rune.position.set(0,BED_Y+0.015,-0.1); g.add(rune);
  for(var si=0;si<8;si++){
    var sa=si/8*Math.PI*2;
    var sp=dMesh(new THREE.ConeGeometry(0.09,0.52,6),decorMats.hellDark,Math.cos(sa)*3.95,0.26,Math.sin(sa)*3.95,g);
    sp.rotation.z=(Math.random()-0.5)*0.2;
  }
  [[-2.9,1.7],[3.1,1.5],[-3.4,0.6]].forEach(function(p){
    var bs=dMesh(new THREE.SphereGeometry(0.24,12,10),decorMats.bone,p[0],0.24,p[1],g);
    bs.scale.set(1,0.9,0.9);
  });
  [-3.5,3.5].forEach(function(x){
    var w=dMesh(new THREE.ConeGeometry(0.16,0.58,8),decorMats.hellGlow,x,0.55,1.1,g);
    machineFx.hell.wisps.push(w);
  });
  g.add(glowDisc(0x8a2be2,0.15,5.6));
  /* --- HELL frame cladding: barbed iron collars on all four posts,
     a black fascia with a violet core gem, a spike row along the
     beam, the pentagram seal ON the cylinder housing, diagonal
     chains across the front posts, glowing crystal cartridges in
     iron brackets, and a blackstone base skirt with a horned skull
     medallion bolted to its front --- */
  POST_XS.forEach(function(x){
    POST_ZS.forEach(function(z){
      [2.2,4.6].forEach(function(y){
        var bc=dMesh(new THREE.TorusGeometry(0.43,0.07,8,20),decorMats.hellDark,x,y,z,g);
        bc.rotation.x=Math.PI/2;
        for(var bsp=0;bsp<6;bsp++){
          var ba=bsp/6*Math.PI*2;
          var bk=dMesh(new THREE.ConeGeometry(0.05,0.20,5),decorMats.hellDark,x+Math.cos(ba)*0.52,y,z+Math.sin(ba)*0.52,g);
          bk.rotation.z=-Math.cos(ba)*1.35; bk.rotation.x=Math.sin(ba)*1.35;
        }
      });
    });
    /* crystal cartridge in an iron bracket on each front post */
    var brk=dMesh(new THREE.BoxGeometry(0.30,0.62,0.30),decorMats.hellDark,x,3.3,-0.42,g);
    dMesh(new THREE.OctahedronGeometry(0.16),decorMats.hellGlow,x,3.3,-0.38,g);
  });
  [-3.15,3.15].forEach(function(x){
    /* diagonal chain run down the front post */
    for(var di2=0;di2<12;di2++){
      var dtp=di2/11;
      chainLink(x+(dtp-0.5)*0.55,5.9-dtp*3.4,-0.38,di2%2===0);
    }
  });
  var fasciaH=dMesh(new THREE.BoxGeometry(7.54,0.60,0.16),decorMats.hellDark,0,7.35,0.06,g);
  dMesh(new THREE.OctahedronGeometry(0.20),decorMats.hellGlow,0,7.35,0.22,g);
  for(var spk=-3;spk<=3;spk++){
    if(spk===0) continue;
    var sk2=dMesh(new THREE.ConeGeometry(0.09,0.55,6),decorMats.hellDark,spk*1.05,8.12,-0.85,g);
  }
  var sigilH=new THREE.Mesh(new THREE.CircleGeometry(0.52,28),new THREE.MeshBasicMaterial({map:penta,transparent:true,opacity:0.95}));
  sigilH.position.set(0,6.58,0.86); g.add(sigilH);
  var hRing=dMesh(new THREE.TorusGeometry(1.00,0.045,8,36),decorMats.hellGlow,0,6.55,-0.1,g);
  hRing.rotation.x=Math.PI/2;
  var skirtH=dMesh(new THREE.CylinderGeometry(3.95,4.10,0.34,44),decorMats.hellDark,0,0.12,-0.1,g); /* y 0.12: top cap below bed top, see skirtD note */
  dMesh(new THREE.BoxGeometry(0.85,0.95,0.16),decorMats.hellDark,0,0.48,3.86,g); /* medallion plate, bolted to the skirt */
  var medSkull=new THREE.Group(); medSkull.position.set(0,0.55,3.98); g.add(medSkull);
  var msc=dMesh(new THREE.SphereGeometry(0.30,14,12),decorMats.bone,0,0.03,0,medSkull);
  msc.scale.set(1,0.92,0.9);
  dMesh(new THREE.BoxGeometry(0.32,0.18,0.22),decorMats.bone,0,-0.28,0.05,medSkull);
  [-1,1].forEach(function(s){
    dMesh(new THREE.SphereGeometry(0.06,8,8),decorMats.hellGlow,s*0.12,0.05,0.24,medSkull);
    var mh2=dMesh(new THREE.ConeGeometry(0.07,0.5,6),decorMats.hellDark,s*0.33,0.28,-0.02,medSkull);
    mh2.rotation.z=-s*0.8;
  });
  press.add(g); decorGroups.hell=g;
})();
/* ----- 3. ANGEL ----- */
(function(){
  var g=new THREE.Group();
  [-1,1].forEach(function(s){
    var wing=new THREE.Group(); wing.position.set(s*2.95,7.80,-1.05); g.add(wing);
    for(var fi=0;fi<7;fi++){
      var flen=0.78+(fi<3? fi*0.13 : (6-fi)*0.10);
      var fe=dMesh(new THREE.SphereGeometry(1,10,8),decorMats.feather,s*(0.34+fi*0.33),0.52-fi*0.055,-0.06*fi,wing);
      fe.scale.set(0.15,flen,0.045);
      fe.rotation.z=-s*(0.28+fi*0.13);
    }
    var post1=dMesh(new THREE.OctahedronGeometry(0.23),decorMats.crystal,s*3.15,7.95,-0.85,g);
    machineFx.angel.floats.push(post1);
    var post2=dMesh(new THREE.OctahedronGeometry(0.27),decorMats.crystal,s*3.15,4.45,0.38,g);
    machineFx.angel.floats.push(post2);
    [1.15,6.58].forEach(function(y){
      var trim=dMesh(new THREE.TorusGeometry(0.40,0.05,8,22),decorMats.gold,s*3.15,y,-0.85,g);
      trim.rotation.x=Math.PI/2;
    });
  });
  var halo=dMesh(new THREE.TorusGeometry(0.85,0.06,10,40),decorMats.gold,0,8.80,-0.85,g);
  halo.rotation.x=0.35; machineFx.angel.halo=halo; machineFx.angel.haloY=8.80;
  var crown=dMesh(new THREE.OctahedronGeometry(0.34),decorMats.crystal,0,8.22,-0.30,g);
  machineFx.angel.floats.push(crown);
  var big=dMesh(new THREE.OctahedronGeometry(0.55),decorMats.crystal,0,1.15,3.30,g);
  machineFx.angel.floats.push(big);
  dMesh(new THREE.ConeGeometry(0.30,0.55,4),decorMats.gold,0,0.30,3.30,g);
  var bedRingA=dMesh(new THREE.TorusGeometry(3.56,0.06,10,56),decorMats.gold,0,BED_Y+0.03,0,g);
  bedRingA.rotation.x=Math.PI/2;
  g.add(glowDisc(0x4dc3ff,0.14,5.6));
  g.add(glowDisc(0x9b7bff,0.07,7.0));
  /* --- ANGEL frame cladding: pearl-and-gold post trim with cyan
     light strips, GOLD VINES spiralling both front posts with
     crystal buds, a pearl beam fascia with a magenta neon accent,
     gold + cyan rings on the cylinder housing, and a pearl base
     skirt carrying the big central gem crest in a gold claw mount
     on its front plate - every piece bracketed to the frame --- */
  POST_XS.forEach(function(x){
    POST_ZS.forEach(function(z){
      [1.25,3.45,5.55].forEach(function(y){
        var gc=dMesh(new THREE.TorusGeometry(0.42,0.055,8,22),decorMats.gold,x,y,z,g);
        gc.rotation.x=Math.PI/2;
      });
    });
    /* cyan light strip down the front face of each front post */
    var strip=dMesh(new THREE.BoxGeometry(0.09,3.4,0.04),decorMats.angelGlow,x,3.4,-0.50,g);
    /* gold vine helix around the front post, y 0.8 to 6.1 */
    var vpts=[], vi3;
    for(vi3=0;vi3<=44;vi3++){
      var vt=vi3/44, va=vt*Math.PI*5.5+(x>0?0.8:2.2);
      vpts.push(new THREE.Vector3(x+Math.cos(va)*0.46,0.8+vt*5.3,-0.85+Math.sin(va)*0.46));
    }
    var vine=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vpts),72,0.035,6),decorMats.gold);
    vine.castShadow=true; g.add(vine);
    for(var vb=5;vb<44;vb+=9){
      dMesh(new THREE.OctahedronGeometry(0.075),decorMats.crystal,vpts[vb].x,vpts[vb].y,vpts[vb].z,g);
    }
  });
  var fasciaA=dMesh(new THREE.BoxGeometry(7.54,0.62,0.16),decorMats.pearl,0,7.35,0.06,g);
  var trimA=dMesh(new THREE.BoxGeometry(7.54,0.07,0.18),decorMats.gold,0,7.02,0.06,g);
  dMesh(new THREE.OctahedronGeometry(0.19),decorMats.crystal,0,7.35,0.22,g);
  [-2.6,-1.3,1.3,2.6].forEach(function(x){
    dMesh(new THREE.OctahedronGeometry(0.10),decorMats.crystal,x,7.35,0.17,g);
  });
  var neonA=dMesh(new THREE.BoxGeometry(5.6,0.05,0.05),decorMats.magentaGlow,0,6.78,0.10,g);
  var hRingA=dMesh(new THREE.TorusGeometry(1.00,0.05,8,36),decorMats.gold,0,6.62,-0.1,g);
  hRingA.rotation.x=Math.PI/2;
  var hRingA2=dMesh(new THREE.TorusGeometry(1.00,0.035,8,36),decorMats.angelGlow,0,6.48,-0.1,g);
  hRingA2.rotation.x=Math.PI/2;
  var sigilA=new THREE.Mesh(new THREE.CircleGeometry(0.40,28),new THREE.MeshBasicMaterial({color:0x66d9ff,transparent:true,opacity:0.55,blending:THREE.AdditiveBlending,depthWrite:false}));
  sigilA.position.set(0,6.58,0.86); g.add(sigilA);
  var skirtA=dMesh(new THREE.CylinderGeometry(3.95,4.10,0.34,44),decorMats.pearl,0,0.12,-0.1,g); /* y 0.12: top cap below bed top, see skirtD note */
  var skirtTrim=dMesh(new THREE.TorusGeometry(3.98,0.05,8,56),decorMats.gold,0,0.30,-0.1,g); /* lowered with the skirt so the trim stays seated on its top edge */
  skirtTrim.rotation.x=Math.PI/2;
  dMesh(new THREE.BoxGeometry(1.0,1.05,0.16),decorMats.pearl,0,0.52,3.86,g); /* crest plate, bolted to the skirt */
  var crest=dMesh(new THREE.OctahedronGeometry(0.46),decorMats.crystal,0,0.62,4.02,g);
  crest.scale.set(0.8,1.25,0.55); /* mounted in the claw frame below - it does NOT float or bob */
  [-1,1].forEach(function(s){
    var claw1=dMesh(new THREE.ConeGeometry(0.06,0.30,5),decorMats.gold,s*0.30,0.98,3.98,g);
    claw1.rotation.z=s*0.5; claw1.rotation.x=0.4;
    var claw2=dMesh(new THREE.ConeGeometry(0.06,0.30,5),decorMats.gold,s*0.30,0.28,3.98,g);
    claw2.rotation.z=s*0.5; claw2.rotation.x=2.7;
  });
  press.add(g); decorGroups.angel=g;
})();
/* ----- Platen undersides: each machine presses with its own face ----- */
var platenRig=new THREE.Group(); platenRig.position.set(0,platenY,-0.1); press.add(platenRig);
(function(){
  var pd=new THREE.Group();
  var ring=dMesh(new THREE.TorusGeometry(PLATEN_R+0.03,0.07,10,48),decorMats.lava,0,-0.30,0,pd);
  ring.rotation.x=Math.PI/2;
  for(var i=0;i<8;i++){
    var a=i/8*Math.PI*2;
    var sp=dMesh(new THREE.ConeGeometry(0.07,0.30,6),decorMats.dragonScale,Math.cos(a)*(PLATEN_R-0.22),-0.47,Math.sin(a)*(PLATEN_R-0.22),pd);
    sp.rotation.x=Math.PI;
  }
  platenRig.add(pd); platenDecor.dragon=pd;
  var ph=new THREE.Group();
  var ringH=dMesh(new THREE.TorusGeometry(PLATEN_R+0.03,0.06,10,48),decorMats.hellGlow,0,-0.30,0,ph);
  ringH.rotation.x=Math.PI/2;
  var runeP=new THREE.Mesh(new THREE.CircleGeometry(1.6,36),new THREE.MeshBasicMaterial({map:pentagramTexture(),transparent:true,opacity:0.95,depthWrite:false,side:THREE.DoubleSide}));
  runeP.rotation.x=Math.PI/2; runeP.position.y=-0.365; ph.add(runeP);
  platenRig.add(ph); platenDecor.hell=ph;
  var pa=new THREE.Group();
  var ringA=dMesh(new THREE.TorusGeometry(PLATEN_R+0.03,0.06,10,48),decorMats.gold,0,-0.30,0,pa);
  ringA.rotation.x=Math.PI/2;
  var ringA2=dMesh(new THREE.TorusGeometry(PLATEN_R-0.35,0.045,10,48),decorMats.angelGlow,0,-0.37,0,pa);
  ringA2.rotation.x=Math.PI/2;
  for(var j=0;j<6;j++){
    var a2=j/6*Math.PI*2;
    dMesh(new THREE.OctahedronGeometry(0.11),decorMats.crystal,Math.cos(a2)*(PLATEN_R-0.18),-0.45,Math.sin(a2)*(PLATEN_R-0.18),pa);
  }
  platenRig.add(pa); platenDecor.angel=pa;
})();

/* ---------- Seamless cat geometry: one fused SDF mesh, no parts ---------- */
var FORMS=CatMascot.forms,sdfCat=CatMascot.sdf;
/* ---------- Seeded RNG: every generated cat gets ONE seed ----------
   The seed drives that cat's crack network layout AND its Voronoi
   fracture cells, so a burst opens along the same random pattern the
   cracks grew in - and no two generated cats ever crack or break the
   same way. (Research note: this is the three-pinata model - Voronoi
   cells seeded per object, fracture solved once at burst time - kept
   as a tiny self-written solver so the single file stays light on
   phones, instead of importing a WASM physics engine.) */
function mulberry32(seed){
  var a=seed|0;
  return function(){
    a=a+0x6D2B79F5|0;
    var t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
/* ---------- Per-cat physics: Mochi, Pudding and Soda are NOT the
   same body with different paint. One shared soft-body spring solver
   (XPBD-style: stiff spring + volume-keeping squash-and-stretch),
   but each cat feeds it a different body:
   - Mochi (round): mid stiffness, LOW damping, strong volume keeping
     and the bounciest slide - it squashes evenly, bulges round,
     rebounds high and keeps wobbling after a poke.
   - Pudding (flat): soft but HEAVILY damped, spreads sideways 55%
     more, loses volume instead of rebounding, high bed friction -
     it flops wide, stays flat, barely bounces or rolls.
   - Soda (tall): springy with a weak BEND - it leans and curves
     under the platen before it flattens, its head lags, it rolls
     and tumbles far when flung, and its fracture cells run long
     down its height.
   Fracture style per cat: Mochi breaks into round 3D Voronoi cells,
   Pudding into flat 2.5D plates, Soda into tall vertical cells.
   Gen cat jitters stiff/damp by +-15% per cat on top of this table
   (see setHero), so even two Mochis in a row feel slightly alive. */
var FORM_PHYS={
  mochi:  {stiff:64, damp:4.2, volKeep:1.00, spread:1.00, wobbleAmp:1.00, fric:0.30, bounce:0.52, bend:0.15, cells:12, cellPolar:[0.12,1.45], fragN:1.00, fragBounce:0.50, mass:1.00, comp:1.00},
  pudding:{stiff:38, damp:9.5, volKeep:0.82, spread:1.55, wobbleAmp:0.45, fric:0.62, bounce:0.16, bend:0.05, cells:9,  cellPolar:[0.65,1.60], fragN:0.85, fragBounce:0.15, mass:1.25, comp:1.50},
  soda:   {stiff:52, damp:3.4, volKeep:0.92, spread:0.80, wobbleAmp:1.25, fric:0.34, bounce:0.38, bend:1.00, cells:15, cellPolar:[0.15,1.30], fragN:1.10, fragBounce:0.42, mass:0.85, comp:1.15}
};
FORM_PHYS.tabby=Object.assign({},FORM_PHYS.mochi,{stiff:90,damp:5.5,bounce:0.25});
function formPhys(type){ return FORM_PHYS[type]||FORM_PHYS.mochi; }
var geoCache={};
/* Flat normals on a coarse continuous SDF surface create actual gem facets. */
var facetCache={};
function facetedCatGeometry(type){
 if(facetCache[type])return facetCache[type];
 var indexed=catGeometry(type,true),g=indexed.toNonIndexed();indexed.dispose();g.computeVertexNormals();facetCache[type]=g;return g;
}
function catGeometry(type,coarse){
  if(!coarse&&geoCache[type])return geoCache[type];
  var geo=CatMascot.geometry(THREE,type,coarse,isMobilePerf);
  if(!coarse)geoCache[type]=geo;return geo;
}
/* irregular jelly chunk geometry for the pieces: multi-frequency noise so
   a torn fragment reads as a ripped lump of gel, never a neat ball */
function blobGeometry(seed){
  var geo=isMobilePerf? new THREE.SphereGeometry(1,16,12) : new THREE.SphereGeometry(1,22,18);
  var pos=geo.attributes.position, v=new THREE.Vector3();
  for(var i=0;i<pos.count;i++){
    v.set(pos.getX(i),pos.getY(i),pos.getZ(i));
    var n=1
      +0.20*Math.sin(v.x*4.1+seed)+0.15*Math.cos(v.y*5.3+seed*1.7)+0.13*Math.sin(v.z*6.2+seed*0.6)
      +0.09*Math.sin((v.x+v.y)*9.5+seed*2.3)+0.06*Math.cos((v.y-v.z)*12.0+seed*3.1);
    v.multiplyScalar(n);
    pos.setXYZ(i,v.x*(1+0.14*Math.sin(seed*3.0)),v.y*0.72,v.z*(1+0.12*Math.cos(seed*2.0)));
  }
  geo.computeVertexNormals(); return geo;
}
var blobGeos=[blobGeometry(1.3),blobGeometry(4.1),blobGeometry(7.7),blobGeometry(11.2),blobGeometry(15.9),blobGeometry(21.4),blobGeometry(26.8),blobGeometry(33.5),blobGeometry(41.9),blobGeometry(52.3)];
/* jagged shard geometry for crumbs: an icosahedron whose vertices are
   pushed in and out by a position hash (shared vertices move together, so
   the shard stays watertight) - sharp, uneven little gel fragments */
function shardGeometry(seed){
  var geo=new THREE.IcosahedronGeometry(1,1);
  var pos=geo.attributes.position, v=new THREE.Vector3();
  for(var i=0;i<pos.count;i++){
    v.set(pos.getX(i),pos.getY(i),pos.getZ(i));
    var h=Math.sin(v.x*12.9898+v.y*78.233+v.z*37.719+seed*17.31)*43758.5453;
    var j=0.70+(h-Math.floor(h))*0.58;
    v.multiplyScalar(j);
    pos.setXYZ(i,v.x,v.y*0.62,v.z);
  }
  geo.computeVertexNormals(); return geo;
}
var shardGeos=[shardGeometry(2.2),shardGeometry(5.6),shardGeometry(9.4),shardGeometry(13.8),shardGeometry(18.7),shardGeometry(24.9),shardGeometry(31.6)];
/* GLASS fragments: thin flat tetrahedra - window-pane shards, almost
   no thickness, sharp points, clear material does the rest. Nothing
   like a crystal and nothing like a jelly blob. */
function glassShardGeometry(seed){
  var geo=new THREE.TetrahedronGeometry(1,0);
  var pos=geo.attributes.position, v=new THREE.Vector3();
  for(var i=0;i<pos.count;i++){
    v.set(pos.getX(i),pos.getY(i),pos.getZ(i));
    var h=Math.sin(v.x*17.17+v.y*9.31+v.z*23.7+seed*11.3)*43758.5453;
    var j=0.82+(h-Math.floor(h))*0.4;
    pos.setXYZ(i,v.x*1.45*j,v.y*0.16,v.z*0.95*j);
  }
  geo.computeVertexNormals(); return geo;
}
var glassShardGeos=[glassShardGeometry(1.7),glassShardGeometry(4.9),glassShardGeometry(8.3),glassShardGeometry(13.1),glassShardGeometry(19.7)];
/* MINECRAFT DIAMOND fragments: elongated octahedron crystals - the
   gem silhouette from the game, two pyramids base to base, flat
   shaded cyan. They tumble and stand like little crystals, never
   like flat glass panes. */
function mcCrystalGeometry(sx,sy,sz){
  var geo=new THREE.OctahedronGeometry(1,0);
  geo.scale(sx,sy,sz);
  geo.computeVertexNormals(); return geo;
}
var mcCrystalGeos=[mcCrystalGeometry(0.60,1.30,0.60),mcCrystalGeometry(0.52,1.05,0.66),mcCrystalGeometry(0.68,1.5,0.55),mcCrystalGeometry(0.58,0.9,0.58)];
/* one shared unit sphere for all droplets - scaled per droplet instead
   of allocating a new geometry for every droplet at every burst */
var dropletGeo=new THREE.SphereGeometry(1,8,8);

/* ---------- Surface materials: 7 genuinely different materials ----------
   glass / iron / diamond / jelly / brick / water ball / lego. Each one
   differs in gloss, transparency, tint AND surface pattern - a profile
   of physical parameters plus its own procedural canvas pattern:
   - glass:   near-clear, mirror-smooth, pale tint, faint streaks
   - iron:    fully metallic, brushed grain, grey-steel tint, opaque
   - diamond: MINECRAFT diamond - fixed bright cyan, blocky pixel
     facets, iridescent shimmer, blocky-cut geometry (see below)
   - jelly:   the classic translucent gel, saturated cat colour, bubbles
   - brick:   matte terracotta, real brick courses with mortar, bumpy
   - water:   clear blue water ball, bubbles and wave highlights
   - lego:    glossy plastic, saturated colour, seams and studs       */
var texCache={};
var currentTex='jelly';
var MAT_PROFILES={
  glass:  {transmission:0.94,roughness:0.02,metalness:0.0,ior:1.52,thickness:0.5, clearcoat:1.0,clearcoatRoughness:0.02,env:1.5, spec:1.2, opacity:0.30,flat:false,tint:0xf7fcfd,tintAmt:0.93,atten:2.8,bump:0.0,repeat:1.5},
  iron:   {transmission:0.0, roughness:0.38,metalness:1.0,ior:1.50,thickness:0.0, clearcoat:0.25,clearcoatRoughness:0.4, env:1.35,spec:0.9, opacity:1.0, flat:false,tint:0x8a8f96,tintAmt:0.62,atten:1.0,bump:0.012,repeat:1.5},
  diamond:{transmission:0.18,roughness:0.07,metalness:0.0,ior:2.35,thickness:0.7, clearcoat:1.0,clearcoatRoughness:0.05,env:2.6, spec:1.7, opacity:0.97,flat:true, tint:0xb7b9ff,tintAmt:1.0, atten:1.2,bump:0.0,repeat:1.0,irid:0.18,emiss:0.055},
  jelly:  {transmission:0.5, roughness:0.13,metalness:0.0,ior:1.38,thickness:1.15,clearcoat:1.0,clearcoatRoughness:0.08,env:0.75,spec:1.0, opacity:0.92,flat:false,tint:0xffffff,tintAmt:0.0, atten:0.85,bump:0.0,repeat:1.5},
  brick:  {transmission:0.0, roughness:0.92,metalness:0.0,ior:1.45,thickness:0.0, clearcoat:0.0,clearcoatRoughness:0.9, env:0.25,spec:0.35,opacity:1.0, flat:false,tint:0xb5502f,tintAmt:0.78,atten:1.0,bump:0.05,repeat:2.0},
  water:  {transmission:0.94,roughness:0.02,metalness:0.0,ior:1.33,thickness:0.8, clearcoat:1.0,clearcoatRoughness:0.02,env:1.45,spec:1.2, opacity:0.45,flat:false,tint:0x59b7e8,tintAmt:0.55,atten:1.8,bump:0.0,repeat:1.5},
  lego:   {transmission:0.0, roughness:0.30,metalness:0.0,ior:1.46,thickness:0.0, clearcoat:0.65,clearcoatRoughness:0.25,env:0.7, spec:0.9, opacity:1.0, flat:false,tint:0xffffff,tintAmt:0.0, atten:1.0,bump:0.02,repeat:2.2}
};
function profileFor(kind){ return MAT_PROFILES[kind]||MAT_PROFILES.jelly; }
/* ---------- Press physics per material ----------
   A surface is not just a look: each material has its own press
   behaviour for the whole cat AND for every fragment it breaks into.
   - heroMax:    how far the cat itself can flatten (diamond barely dents)
   - heroSpread: how much it bulges sideways while pressed
   - pressSlow:  platen speed factor once in contact (iron/diamond fight back)
   - burstRaw:   platen penetration (fraction of height) needed to break it
   - jiggle:     surface ripple / wobble amount (0 = rigid, no jiggle at all)
   - pressMul:   pressure gauge multiplier (hard materials spike the gauge)
   - grav/bounce/fric/spin/wobble: fragment fall speed, restitution,
     ground friction, tumble and wobble per material
   - splitS:     raw squash a fragment needs before it breaks again
   - pieceSquash: how far a fragment of this material can itself flatten */
/* SIMULATOR RULE: hard materials are RIGID SOLIDS, not soft bodies.
   Glass, iron, diamond, brick and toy brick barely dent at all
   (heroMax 0.02-0.07 of height, almost no sideways bulge), never
   wobble (jiggle 0, critically damped in the main loop, clamped so
   they cannot rebound below zero), and the platen stalls against
   them: burstRaw is now the small real penetration at which the
   accumulated pressure (see the rigid pressure model in animate)
   fractures them. Only jelly (jiggle 1) and the water ball
   (jiggle 0.55) are soft. Fragments inherit the same rigidity:
   pieceSquash is a shallow dent and splitS is the raw penetration
   at which a hard fragment cracks apart instead of squashing. */
var MAT_PHYS={
  glass:  {heroMax:0.055,heroSpread:0.030,pressSlow:0.55,burstRaw:0.075,jiggle:0,   pressMul:1.30,grav:0.90,bounce:0.10,fric:0.30,wobble:0,   spin:0.70,splitS:0.22,pieceSquash:0.12},
  iron:   {heroMax:0.038,heroSpread:0.015,pressSlow:0.30,burstRaw:0.060,jiggle:0,   pressMul:1.70,grav:1.55,bounce:0.06,fric:0.15,wobble:0,   spin:0.35,splitS:0.97,pieceSquash:0.07},
  diamond:{heroMax:0.022,heroSpread:0.008,pressSlow:0.20,burstRaw:0.045,jiggle:0,   pressMul:2.20,grav:1.30,bounce:0.22,fric:0.30,wobble:0,   spin:0.60,splitS:0.45,pieceSquash:0.06},
  jelly:  {heroMax:0.94,heroSpread:1.02,pressSlow:1.00,burstRaw:9,   jiggle:1,   pressMul:1.00,grav:1.00,bounce:0.50,fric:0.24,wobble:1,   spin:1.00,splitS:0.58,pieceSquash:0.80},
  brick:  {heroMax:0.065,heroSpread:0.040,pressSlow:0.45,burstRaw:0.095,jiggle:0,   pressMul:1.20,grav:1.25,bounce:0.05,fric:0.10,wobble:0,   spin:0.40,splitS:0.28,pieceSquash:0.14},
  water:  {heroMax:0.80,heroSpread:1.50,pressSlow:0.90,burstRaw:0.70,jiggle:0.55,pressMul:0.70,grav:1.05,bounce:0.30,fric:0.50,wobble:0.45,spin:0.80,splitS:0.99,pieceSquash:0.85},
  lego:   {heroMax:0.048,heroSpread:0.025,pressSlow:0.40,burstRaw:0.070,jiggle:0,   pressMul:1.30,grav:1.10,bounce:0.34,fric:0.28,wobble:0,   spin:0.90,splitS:0.30,pieceSquash:0.10}
};
function physFor(kind){ return MAT_PHYS[kind]||MAT_PHYS.jelly; }
/* ---------- Required pressure, density, mass and hardness ----------
   Every material states the pressure (bar) a press must actually reach
   to break it, for a size-1 cat at 100% density. The live requirement
   scales with the cat's volume (size) and with the user-set density:
   a bigger, denser cat is heavier, harder and needs more pressure.
   Density also feeds the fragment physics in applyPhys (heavier fall,
   lower bounce) and the fragment count at burst time. */
var MAT_REQ={ water:70, jelly:95, glass:150, lego:180, brick:220, iron:350, diamond:490 };
var MAT_DENS={ water:1.0, jelly:1.05, glass:2.5, lego:1.05, brick:1.9, iron:7.8, diamond:3.5 };
var density=1;        /* user slider, 0.5 to 2.0 */
var machineMax=400;   /* user slider, 100 to 600 bar */
var machineBroken=false, brokenT=0, strainT=0, pressShake=0, pressShakeT=0, platenRecoil=false;
/* ---------- Machines, money and the crumb economy ----------
   Crumbs are worth money: a fragment's price is its material's unit
   value x its volume (radius cubed) x the density it was pressed at,
   so bigger, denser, rarer-material pieces pay much more. Money buys
   better presses in the backpack. There are EXACTLY THREE machines,
   the three fantasy presses from the user's asset sheet, and each is
   a different build - its own decor group, platen underside, aura
   light and effects (see the decor builders above), plus its own
   stats: a pressure BONUS added on top of the Machine slider and a
   platen SPEED multiplier.
   - dragon (Fire Dragon): blackened-bronze frame, molten orange
     aura, +250 bar, x1.15 speed. The starter machine, owned free.
   - hell: black-purple frame, violet aura, +450 bar, x1.30 speed.
   - angel: white-and-gold frame, cyan-violet aura, +750 bar,
     x1.50 speed - the strongest press money can buy here. */
var MACHINES=[
  {id:'studio',cost:0,bonus:0,speed:.7,frame:0x26343f,steel:0x8198a2,dark:0x3b515c,aura:0xffffff,auraI:0,swatch:'#98b8b2'},
  {id:'dragon', cost:0,    bonus:250, speed:1.15, frame:0x2c2527, steel:0x9a6a3a, dark:0x2a0f06, aura:0xff5a1e, auraI:34, swatch:'#ff5a1e'},
  {id:'hell',   cost:450,  bonus:450, speed:1.30, frame:0x14101f, steel:0x5f4a78, dark:0x120a1e, aura:0x9b30ff, auraI:32, swatch:'#9b30ff'},
  {id:'angel',  cost:1100, bonus:750, speed:1.50, frame:0xe9e0cc, steel:0xd9b45c, dark:0xa8853c, aura:0x4dc3ff, auraI:36, swatch:'#4dc3ff'}
];
var ownedMachines={studio:true,dragon:true}, activeMachine='studio';
var money=0, vacuumedCount=0, vacuumedEarned=0;
function curMachine(){
  for(var i=0;i<MACHINES.length;i++) if(MACHINES[i].id===activeMachine) return MACHINES[i];
  return MACHINES[0];
}
function machineCap(){ return machineMax+curMachine().bonus; }
var MAT_PRICE={jelly:1,water:0,brick:2,lego:3,glass:4,iron:6,diamond:25};
function pieceValue(p){
  var price=MAT_PRICE[p.texKind||'jelly'];
  if(price===undefined) price=1;
  var vol=Math.pow(Math.max(0.05,(p.r||0.2))/0.4,3);
  return Math.max(1,Math.round(price*vol*density*(p.mini?1.6:1)));
}
function applyMachineTheme(){
  var m=curMachine();
  inkMetal.color.set(m.frame); steel.color.set(m.steel); steelDark.color.set(m.dark);
  if(auraLight){ auraLight.color.set(m.aura); auraLight.intensity=m.auraI; }
  /* swap the whole machine, not just its colours: only the active
     machine's frame decor and platen underside exist in the scene */
  for(var dk in decorGroups) decorGroups[dk].visible=(dk===m.id);
  for(var pk in platenDecor) platenDecor[pk].visible=(pk===m.id);
}
var crackLevel=0, lastCrackToastAt=0;
/* Cumulative damage (fatigue): grows under load, NEVER resets while
   this cat lives - not on release, not on a machine explosion. Only a
   fresh cat (setHero) starts undamaged. See the main loop. */
var heroDamage=0, lastCrackSndLevel=0, lastCrackSndAt=0;
function sizeVolume(){ return Math.pow((typeof catSize!=='undefined'&&catSize)?catSize:1,3); }
function requiredPressure(kind){
  var base=MAT_REQ[kind]||MAT_REQ.jelly;
  return Math.round(base*(0.55+0.45*Math.pow((typeof catSize!=='undefined'&&catSize)?catSize:1,2))*(0.45+0.55*density));
}
function catMassKg(kind){
  return Math.round(((MAT_DENS[kind]||1)*4.6*sizeVolume()*density)*10)/10;
}
function hardnessIndex(kind){
  var mp=physFor(kind);
  return Math.round((1/Math.max(0.05,mp.heroMax))*density*10)/10;
}
/* density-adjusted press physics for the hero: denser = harder to
   flatten, slower platen, pieces dent less */
function physEff(kind){
  var mp=physFor(kind), out={}, k;
  for(k in mp) out[k]=mp[k];
  var hardF=0.65+0.35*density; /* 0.83 at 50%, 1.0 at 100%, 1.35 at 200% */
  out.heroMax=Math.max(0.05,mp.heroMax/hardF);
  out.pressSlow=mp.pressSlow/(0.8+0.2*density);
  out.pieceSquash=Math.max(0.08,mp.pieceSquash/hardF);
  out.grav=mp.grav*(0.8+0.25*density);
  out.bounce=Math.max(0.02,mp.bounce/(0.7+0.3*density));
  return out;
}
/* ---------- Insufficient-pressure highlight ----------
   When the machine cannot reach the pressure this material (at this
   size and density) needs, the ONE control that fixes it - the Machine
   pressure slider group, plus the "Needs N bar" stat pill - pulses
   gently for a few seconds so the user knows exactly what to raise.
   It is temporary by design: it clears the moment the state stops
   being insufficient, and otherwise fades out on its own timer even
   if the user changed something else first. Re-entering the
   insufficient state (or straining / blowing the press) re-arms it. */
var needFlashTimer=null, wasInsufficient=false;
function needTargets(){
  var out=[];
  var g=document.getElementById('machGroup'); if(g) out.push(g);
  var s=document.getElementById('matStats'); if(s) out.push(s);
  return out;
}
function clearNeedHighlight(){
  if(needFlashTimer){ clearTimeout(needFlashTimer); needFlashTimer=null; }
  needTargets().forEach(function(el){ el.classList.remove('needs-change'); });
}
function flashNeedHighlight(ms){
  var dur=ms||4500;
  needTargets().forEach(function(el){ el.classList.add('needs-change'); });
  if(needFlashTimer) clearTimeout(needFlashTimer);
  needFlashTimer=setTimeout(function(){ needFlashTimer=null;
    needTargets().forEach(function(el){ el.classList.remove('needs-change'); });
  },dur);
}
function checkInsufficient(force){
  var req=requiredPressure((typeof currentTex!=='undefined')?currentTex:'jelly');
  var insuff=req>machineCap();
  if(!insuff){ wasInsufficient=false; clearNeedHighlight(); return false; }
  if(force || !wasInsufficient) flashNeedHighlight(4500);
  wasInsufficient=true;
  return true;
}
function updateMatStats(){
  /* The stat lines (Needs / Mass / Hardness / Machine max) are gone
     from the UI by design - the numbers still drive the physics and
     this hook now only maintains the insufficient-pressure highlight
     on the Machine slider, the one control that fixes it. */
  checkInsufficient(false);
}
function applyPhys(p,kind){
  var mp=physEff(kind);
  p.gravF=mp.grav; p.fricBase=mp.fric; p.wobbleF=mp.wobble; p.spinF=mp.spin;
  p.bounce=Math.max(0.02,mp.bounce*(0.8+Math.random()*0.45));
  /* XPBD rigid-body mass: material density x fragment volume x the
     density the cat was pressed at. An iron chunk is ~8x heavier than
     a same-size jelly blob, diamond ~3.5x, glass ~2.5x - and invMass
     drives every contact impulse below, so heavy pieces shove light
     ones aside instead of bouncing off them like equals. */
  var rV=Math.max(0.10,p.r||0.3);
  p.mass=(MAT_DENS[kind]||1)*rV*rV*rV*density*22;
  p.invMass=1/Math.max(0.05,p.mass);
}
function displayColor(kind,color){
  var p=profileFor(kind);
  /* GLASS is colourless: the cat's own colour is washed out almost
     completely, leaving only the faintest cool tint of real glass.
     DIAMOND is Minecraft diamond: a fixed bright cyan gem colour -
     the cat's colour NEVER tints it, so it can never be mistaken
     for pale glass again. */
  if(kind==='diamond') return new THREE.Color(0xb7b9ff);
  if(kind==='glass'){ var gc=new THREE.Color(color); gc.lerp(new THREE.Color(0xf7fcfd),0.93); return gc; }
  var c=new THREE.Color(color);
  if(kind==='brick'){ c.lerp(new THREE.Color(0xb5502f),0.78); return c; }
  if(p.tintAmt>0) c.lerp(new THREE.Color(p.tint),p.tintAmt);
  if(kind==='lego'){ var hsl={}; c.getHSL(hsl); c.setHSL(hsl.h,Math.min(1,hsl.s+0.18),Math.min(0.62,hsl.l+0.03)); }
  return c;
}
function patternTexture(kind,color){
  if(!kind) return null;
  var key=kind+'-'+color;
  if(texCache[key]) return texCache[key];
  var p=profileFor(kind);
  var base=displayColor(kind,color);
  var cv=document.createElement('canvas'); cv.width=256; cv.height=256;
  var cx=cv.getContext('2d');
  cx.fillStyle='#'+base.getHexString(); cx.fillRect(0,0,256,256);
  var i,x,y;
  if(kind==='glass'){
    // Unbroken glass has no painted cracks. Stress ribbons provide damage.
  } else if(kind==='iron'){
    /* brushed metal: many fine horizontal grain lines, scratches, speckle */
    for(i=0;i<210;i++){
      y=Math.random()*256;
      cx.strokeStyle=Math.random()<0.5?'rgba(255,255,255,'+(0.04+Math.random()*0.13)+')':'rgba(10,12,16,'+(0.05+Math.random()*0.15)+')';
      cx.lineWidth=Math.random()<0.85?1:2;
      cx.beginPath(); cx.moveTo(0,y); cx.lineTo(256,y+(Math.random()-0.5)*3); cx.stroke();
    }
    cx.strokeStyle='rgba(230,236,242,0.35)';
    for(i=0;i<9;i++){ cx.lineWidth=1; cx.beginPath(); var sy=Math.random()*256; cx.moveTo(Math.random()*120,sy); cx.lineTo(140+Math.random()*116,sy+(Math.random()-0.5)*22); cx.stroke(); }
    cx.fillStyle='rgba(20,22,26,0.35)';
    for(i=0;i<130;i++) cx.fillRect(Math.random()*256,Math.random()*256,1.6,1.6);
  } else if(kind==='diamond'){
    // Facets come from geometry and lighting, never a painted pixel grid.
  } else if(kind==='jelly'){
    // Optical colour comes from attenuation, not painted-on bubble rings.
  } else if(kind==='brick'){
    // Fired clay pores: no wallpaper-like mortar grid on the mascot.
    var clayRng=mulberry32(3187);
    for(i=0;i<4000;i++){var shade=clayRng()>.5?'255,216,176':'47,17,12';cx.fillStyle='rgba('+shade+','+(.03+clayRng()*.14)+')';cx.fillRect(clayRng()*256,clayRng()*256,1+clayRng()*2,1+clayRng()*2);}
  } else if(kind==='water'){
    // Clear elastic shell; internal inclusions are 3D geometry.
  } else if(kind==='lego'){
    /* toy brick plastic: block seams and raised studs in a grid */
    var cell=64;
    for(y=0;y<4;y++) for(x=0;x<4;x++){
      cx.fillStyle='rgba(255,255,255,0.10)'; cx.fillRect(x*cell,y*cell,cell,cell);
      cx.beginPath(); cx.arc(x*cell+cell/2,y*cell+cell/2,17,0,6.29);
      cx.fillStyle='rgba(255,255,255,0.20)'; cx.fill();
      cx.lineWidth=3; cx.strokeStyle='rgba(0,0,0,0.16)'; cx.stroke();
      cx.beginPath(); cx.arc(x*cell+cell/2-5,y*cell+cell/2-6,6,0,6.29); cx.fillStyle='rgba(255,255,255,0.5)'; cx.fill();
    }
    cx.strokeStyle='rgba(0,0,0,0.30)'; cx.lineWidth=3;
    for(i=0;i<=4;i++){ cx.beginPath(); cx.moveTo(i*cell,0); cx.lineTo(i*cell,256); cx.stroke(); cx.beginPath(); cx.moveTo(0,i*cell); cx.lineTo(256,i*cell); cx.stroke(); }
  }
  var tex=new THREE.CanvasTexture(cv);
  tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(p.repeat,p.repeat);
  if(THREE.SRGBColorSpace!==undefined) tex.colorSpace=THREE.SRGBColorSpace;
  texCache[key]=tex; return tex;
}

/* ---------- Material factory: one profile per surface kind ---------- */
function jellyMat(color,op,texKind){
  var kind=texKind||'jelly';
  var p=profileFor(kind);
  var tex=patternTexture(kind,color);
  var disp=displayColor(kind,color);
  var params={
    color:0xffffff, map:tex,
    roughness:p.roughness, metalness:p.metalness,
    clearcoat:p.clearcoat, clearcoatRoughness:p.clearcoatRoughness,
    envMapIntensity:p.env, specularIntensity:p.spec,
    flatShading:!!p.flat
  };
  if(useTransmission && p.transmission>0){
    params.transmission=p.transmission; params.thickness=p.thickness; params.ior=p.ior;
    params.attenuationColor=disp.clone(); params.attenuationDistance=p.atten;
  } else {
    if(p.opacity<1 || (op!==undefined && op<1)){ params.transparent=true; params.opacity=(op!==undefined?op:p.opacity); }
    if(p.transmission>0 && !useTransmission){ params.transparent=true; params.opacity=p.opacity; }
  }
  if(kind==='jelly'||kind==='water'){params.roughness=.24;params.clearcoat=.55;params.clearcoatRoughness=.16;params.ior=1.38;params.thickness=1.8;if(!useTransmission){params.transparent=false;params.opacity=1;params.color=disp.clone();params.map=null;}}
  if(p.irid){ /* diamond only: a light rainbow shimmer over the cyan facets */
    params.iridescence=p.irid; params.iridescenceIOR=1.8; params.iridescenceThicknessRange=[120,420];
  }
  if(kind==='diamond'){ params.emissive=new THREE.Color(0x6c66bc); params.emissiveIntensity=.055; }
  if(p.bump>0){ params.bumpMap=tex; params.bumpScale=p.bump; }
  var m=new THREE.MeshPhysicalMaterial(params);
  m.userData.uTime={value:Math.random()*20}; m.userData.uJiggle={value:0.25}; m.userData.uPhase={value:Math.random()*6.28};
  m.onBeforeCompile=function(shader){
    shader.uniforms.uTime=m.userData.uTime; shader.uniforms.uJiggle=m.userData.uJiggle; shader.uniforms.uPhase=m.userData.uPhase;
    shader.vertexShader="uniform float uTime; uniform float uJiggle; uniform float uPhase;\n"+shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nfloat rip=sin(position.y*6.5+uPhase-uTime*10.0)*cos(position.x*5.5+uPhase+uTime*7.3)+0.6*sin(position.z*8.0-uTime*12.0+uPhase); transformed+=normal*rip*uJiggle*0.016;");
  };
  m.customProgramCacheKey=function(){ return "jellypress-"+kind; };
  return m;
}
function faceDepth(f,x,y){var lo=0,hi=2;for(var i=0;i<22;i++){var mid=(lo+hi)/2;if(sdfCat(f,x,y,mid)<0)lo=mid;else hi=mid;}return (lo+hi)/2;}
var eyeMat=new THREE.MeshPhysicalMaterial({color:0x2a0e1e,roughness:0.15,clearcoat:1,envMapIntensity:1.0});
var noseMat=new THREE.MeshPhysicalMaterial({color:0xe8254f,roughness:0.2,clearcoat:1,envMapIntensity:1.0});
var glintMat=new THREE.MeshBasicMaterial({color:0xffffff});
var bubbleMat=new THREE.MeshPhysicalMaterial({color:0xd8fff4,roughness:0.05,clearcoat:1,transparent:true,opacity:0.55,envMapIntensity:1.2});

function buildCatMesh(type){
  var f=FORMS[type];
  var g=new THREE.Group();
  var inner=new THREE.Group(); g.add(inner);
  var bodyG=new THREE.Group(); bodyG.scale.setScalar(f.scale); inner.add(bodyG);
  var mat=jellyMat(f.color,undefined,currentTex);
  var jelly=new THREE.Mesh(currentTex==='diamond'? facetedCatGeometry(type) : ((currentTex==='jelly'||currentTex==='water')?catGeometry(type).clone():catGeometry(type)),mat);
  jelly.castShadow=true; jelly.receiveShadow=true; bodyG.add(jelly);
  [-1,1].forEach(function(side){
    var eye=new THREE.Mesh(new THREE.SphereGeometry(0.135,18,14),eyeMat);
    eye.scale.set(1,1.06,0.42); eye.position.set(side*f.eyeX,f.eyeY,faceDepth(f,side*f.eyeX,f.eyeY)+.025);eye.userData.eye=true; bodyG.add(eye);
    var glint=new THREE.Mesh(new THREE.SphereGeometry(0.03,8,8),glintMat);
    glint.userData.glint=true;glint.position.set(side*f.eyeX+0.026,f.eyeY+0.04,faceDepth(f,side*f.eyeX,f.eyeY)+.095); bodyG.add(glint);
  });
  var nose=new THREE.Mesh(new THREE.SphereGeometry(0.07,12,10),noseMat);
  nose.scale.set(1.35,0.8,0.6); nose.position.set(0,f.noseY,faceDepth(f,0,f.noseY)+.02); bodyG.add(nose);
  var mouthPoints=[];
  for(var mi=0;mi<=16;mi++){var mx=(mi/16-.5)*.26,my=f.noseY-.15+.09*Math.pow(mx/.13,2);mouthPoints.push(new THREE.Vector3(mx,my,faceDepth(f,mx,my)+.025));}
  bodyG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouthPoints),16,.014,5,false),eyeMat));
  if(currentTex==='jelly'||currentTex==='water'){
    for(var i=0;i<9;i++){
      var b=new THREE.Mesh(new THREE.SphereGeometry(0.05+Math.random()*0.07,8,8),bubbleMat);
      var attempts=0;do{b.position.set((Math.random()-.5)*1.2,.35+Math.random()*(f.height-.7),(Math.random()-.5)*1.0);}while(sdfCat(f,b.position.x,b.position.y,b.position.z)>-.18&&++attempts<40);if(attempts<40)bodyG.add(b);else b.geometry.dispose();
    }
  }
  [-1,1].forEach(function(side){
    var cheek=new THREE.Mesh(new THREE.SphereGeometry(.14,14,10),noseMat);cheek.scale.set(1.5,.5,.16);var x=side*(f.eyeX+.15),y=f.eyeY-.2;cheek.position.set(x,y,faceDepth(f,x,y)+.025);bodyG.add(cheek);
  });
  g.userData.inner=inner; g.userData.mat=mat; g.userData.jelly=jelly; g.userData.bodyG=bodyG;
  return g;
}


/* Cage and every visible attachment use the same tetrahedral coordinates. */
var selectedPreset='auto';
CatSoftBody.presets.liquid={edge:.00018,bulk:.000000001,damping:5,friction:.25,density:1,restitution:.14,failure:.5,recovery:.8};
function initSoftHero(h){
  if(currentTex!=='jelly'&&currentTex!=='water')return;
  var cage=catGeometry(currentType,true), f=h.form;
  var preset=Object.assign({},CatSoftBody.presets[selectedPreset==='auto'?currentType:selectedPreset]);
  if(currentTex==='water'||selectedPreset==='liquid'){preset.edge*=1.6;preset.bulk*=0.6;preset.failure=0.5;}
  var solver=new CatSoftBody(Array.from(cage.attributes.position.array),Array.from(cage.index.array),[0,f.oy,0],preset);
  cage.dispose();h.soft=solver;h.bindings=[];
  var body=h.mesh.userData.bodyG;
  h.mesh.updateMatrixWorld(true);
  var invBody=body.matrixWorld.clone().invert(),point=new THREE.Vector3();
  body.traverse(function(o){
    if(!o.isMesh)return;
    var transform=new THREE.Matrix4().multiplyMatrices(invBody,o.matrixWorld), inverse=transform.clone().invert();
    var attr=o.geometry.attributes.position,points=new Float64Array(attr.array.length);
    for(var i=0;i<attr.count;i++){point.fromBufferAttribute(attr,i).applyMatrix4(transform);points[i*3]=point.x;points[i*3+1]=point.y;points[i*3+2]=point.z;}
    h.bindings.push({mesh:o,binding:solver.embed(points),out:new Float64Array(points.length),inverse:inverse});
  });
  h.physicsMs=0;h.lifecycle='INTACT';h.simCompression=0;
}
function deformHeroSurfaces(h,squashNow,time){
  if(!h.soft)return;
  var point=new THREE.Vector3();
  h.bindings.forEach(function(b){
    var attr=b.mesh.geometry.attributes.position;
    h.soft.deform(b.binding,b.out);
    for(var i=0;i<attr.count;i++){
      point.fromArray(b.out,i*3);var sc=h.form.scale*catSize,wx=point.x*sc+h.mesh.position.x,wz=point.z*sc+h.mesh.position.z;var low=Math.hypot(wx,wz)<3.55?0:-BED_Y/sc,high=Math.hypot(wx,wz+.1)<PLATEN_R?(platenBottom()-BED_Y)/sc:Infinity;point.y=Math.max(low,Math.min(high,point.y));point.applyMatrix4(b.inverse);attr.setXYZ(i,point.x,point.y,point.z);
    }
    if(b.mesh.userData.eye&&!reduced){var phase=time%4.8,blink=phase>4.62?Math.max(.08,Math.abs(phase-4.71)/.09):1;blink*=Math.max(.25,1-squashNow*1.2);var cy=0;for(var ei=0;ei<attr.count;ei++)cy+=attr.getY(ei);cy/=attr.count;for(var ei=0;ei<attr.count;ei++)attr.setY(ei,cy+(attr.getY(ei)-cy)*blink);}
    if(b.mesh.userData.glint&&!reduced)b.mesh.visible=time%4.8<4.64||time%4.8>4.78;
    attr.needsUpdate=true;b.mesh.geometry.computeVertexNormals();b.mesh.geometry.computeBoundingSphere();
  });
}
function disposeHero(h){
  if(!h)return;
  var shared=Object.values(geoCache).concat(Object.values(facetCache));
  var seen=new Set();
  h.mesh.traverse(function(o){if(o.geometry&&shared.indexOf(o.geometry)<0&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}});
  if(h.crack)h.crack.traverse(function(o){if(o.material&&!seen.has(o.material)){seen.add(o.material);o.material.dispose();}});
  h.mat.dispose();scene.remove(h.mesh);
}

/* ---------- Cracks: damage shows BEFORE anything breaks ----------
   Crack ribbons are solved onto the cat's actual SDF surface (see
   surfacePointFromDir / crackRibbonGeo below): they hug the curvature
   everywhere, originate at the platen contact crown and creep down
   over the ears, cheeks and belly as the strain ratio (platen
   penetration vs what the material can take, and pressure vs required
   pressure) climbs. Each material cracks in its own colour: glass and
   diamond crack bright white, iron dark, brick deep brown, toy brick
   dark seams. Jelly does not crack - it gets pale tear sheens. A water
   ball never cracks at all: it leaks and spills instead (see the
   puddle system below). */
var CRACK_COLORS={glass:0xf4feff,diamond:0xf1dfff,iron:0x101216,brick:0x2e1408,lego:0x241505,jelly:0xffffff,water:0xffffff};
/* Surface points come from the SAME signed-distance field that built
   the cat mesh, so a crack point is on the real surface by
   construction - not on an invented plane in front of the cat. A ray
   direction from the cat centre (0, form.oy, 0) is binary-searched to
   the exact SDF zero crossing, exactly like catGeometry does. */
function surfacePointFromDir(form,dir){
  var lo=0.05, hi=3.9, mid, i;
  for(i=0;i<20;i++){
    mid=(lo+hi)*0.5;
    if(sdfCat(form,dir.x*mid,form.oy+dir.y*mid,dir.z*mid)<0) lo=mid; else hi=mid;
  }
  var r=(lo+hi)*0.5;
  return new THREE.Vector3(dir.x*r,form.oy+dir.y*r,dir.z*r);
}
function sdfNormal(form,p){
  var e=0.035;
  var gx=sdfCat(form,p.x+e,p.y,p.z)-sdfCat(form,p.x-e,p.y,p.z);
  var gy=sdfCat(form,p.x,p.y+e,p.z)-sdfCat(form,p.x,p.y-e,p.z);
  var gz=sdfCat(form,p.x,p.y,p.z+e)-sdfCat(form,p.x,p.y,p.z-e);
  var n=new THREE.Vector3(gx,gy,gz);
  if(n.lengthSq()<1e-8) n.set(0,0,1);
  return n.normalize();
}
/* One crack branch as a flat ribbon strip glued to the surface: every
   vertex is offset only 0.016 along the true SDF surface normal -
   close enough that it can neither float visibly above the skin nor
   sink into the body - and the strip follows the surface curvature
   (over the ears, around the cheeks, down the belly) because each of
   its points was solved on the SDF. Width tapers toward the tip like
   a real fracture line. */
function crackRibbonGeo(form,pts,width0,rng){
  rng=rng||Math.random;
  var n=pts.length, positions=new Float32Array(n*2*3), indices=[], i;
  var lifted=[], normals=[];
  for(i=0;i<n;i++){
    var nrm=sdfNormal(form,pts[i]);
    normals.push(nrm);
    lifted.push(pts[i].clone().addScaledVector(nrm,0.016));
  }
  for(i=0;i<n;i++){
    var pPrev=lifted[Math.max(0,i-1)], pNext=lifted[Math.min(n-1,i+1)];
    var tan=pNext.clone().sub(pPrev);
    if(tan.lengthSq()<1e-8) tan.set(1,0,0); tan.normalize();
    var side=new THREE.Vector3().crossVectors(tan,normals[i]);
    if(side.lengthSq()<1e-8) side.set(1,0,0); side.normalize();
    var taper=1-i/Math.max(1,n-1);
    var halfW=width0*(0.25+0.75*taper)*(0.85+rng()*0.3);
    var L=lifted[i].clone().addScaledVector(side,halfW);
    var R=lifted[i].clone().addScaledVector(side,-halfW);
    positions.set([L.x,L.y,L.z,R.x,R.y,R.z],i*6);
    if(i<n-1){
      var a=i*2;
      indices.push(a,a+1,a+2, a+1,a+3,a+2);
    }
  }
  var geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geo.setIndex(indices);
  geo.setDrawRange(0,0);
  return geo;
}
function buildCrackGroup(kind,form,type,seed){
  /* ONE seed per generated cat drives the whole crack layout: branch
     origins, wander, sub-branches and the Voronoi cells below all
     come from this RNG, so the pattern is unique to this cat and the
     burst later opens along these very cells */
  var rng=mulberry32((seed===undefined?1234567:seed)^0x9e3779b9);
  var fp=formPhys(type);
  var grp=new THREE.Group();
  grp.userData.branches=[];
  grp.userData.surfacePts=[]; /* every on-surface crack point, kept so a
     burst can seed fragments along the lines that actually cracked */
  grp.userData.maxOpacity=(kind==='jelly')?0.38:0.96;
  if(kind==='water'){ grp.visible=false; return grp; }
  var soft=(kind==='jelly');
  var formBranchF=(type==='pudding')?0.8:((type==='soda')?1.25:1.0);
  var branchCount=Math.max(4,Math.round((soft?6:(kind==='iron'?11:(kind==='lego'?10:(kind==='brick'?13:15))))*formBranchF));
  if(kind==='glass')branchCount=22;if(kind==='brick')branchCount=8;if(kind==='diamond')branchCount=6;
  var width0=kind==='glass'?.009:kind==='brick'?.04:kind==='diamond'?.012:soft?.016:.021;
  function addBranch(polar0,az0,steps,stepSize,delay,wMul){
    var pts=[], polar=polar0, az=az0, s, dir;
    for(s=0;s<=steps;s++){
      dir=new THREE.Vector3(Math.sin(polar)*Math.sin(az),Math.cos(polar),Math.sin(polar)*Math.cos(az));
      pts.push(surfacePointFromDir(form,dir));
      /* the fracture creeps DOWN the surface from the platen contact
         zone at the crown, wandering sideways as real cracks do */
      polar+=stepSize*(0.75+rng()*0.5);
      az+=kind==='diamond'?0:kind==='brick'?(s%2===0?.25:-.25):(rng()-.5)*(kind==='glass'?.55:.3);
      if(polar>2.6) break;
    }
    if(pts.length<2) return null;
    for(var pp=0;pp<pts.length;pp++) grp.userData.surfacePts.push(pts[pp]);
    var geo=crackRibbonGeo(form,pts,width0*wMul,rng);
    var mat=new THREE.MeshBasicMaterial({color:CRACK_COLORS[kind]||0xffffff,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
    var mesh=new THREE.Mesh(geo,mat);
    mesh.renderOrder=4;
    grp.add(mesh);
    var br={geo:geo,mat:mat,seg:pts.length-1,delay:delay};
    grp.userData.branches.push(br);
    return pts;
  }
  /* crack RUN SHAPE follows the cat's body: Pudding's cracks run
     wide and flat (few long horizontal steps), Soda's run long down
     its height (many short vertical steps), Mochi's spread evenly */
  var stepBase=(type==='pudding')?0.24:((type==='soda')?0.115:0.16);
  var stepsBase=(type==='pudding')?4:((type==='soda')?8:6);
  var stepsVar=(type==='pudding')?2:((type==='soda')?4:3);
  var polarBase=(type==='pudding')?0.50:0.16;
  for(var b=0;b<branchCount;b++){
    /* origins ring the crown where the platen bears down; azimuth 0
       faces the camera (+Z) so the front of the cat cracks visibly */
    var az=(b/branchCount)*Math.PI*2+rng()*0.45;
    var polar=polarBase+rng()*0.38;
    var steps=stepsBase+Math.floor(rng()*stepsVar);
    var pts=addBranch(polar,az,steps,stepBase+rng()*0.06,(b%3)*0.05,1);
    /* sub-branches split off mid-way, thinner and later, like real
       branching fractures - they start from an on-surface point of
       the parent branch, so they stay glued to the surface too */
    if(pts && !soft && rng()<(kind==='diamond'?.25:kind==='brick'?.35:.85)){
      var startIdx=2+Math.floor(rng()*Math.max(1,pts.length-3));
      var sp=pts[startIdx];
      var dx=sp.x, dy=sp.y-form.oy, dz=sp.z;
      var rr=Math.max(0.001,Math.sqrt(dx*dx+dy*dy+dz*dz));
      var p0=Math.acos(Math.max(-1,Math.min(1,dy/rr)));
      var a0=Math.atan2(dx,dz)+(rng()<0.5?-1:1)*(0.45+rng()*0.4);
      addBranch(p0,a0,2+Math.floor(rng()*3),0.11+rng()*0.07,0.30+rng()*0.2,0.55);
    }
  }
  /* ---- Coverage branches: the HEAD cracks too ----
     The random crown branches alone left the ears, forehead, face and
     cheeks almost untouched - the head looked pristine while the body
     was webbed. These branches are aimed at named features of the form
     (both ear tips, the forehead, both cheeks, the muzzle, both
     flanks): each starts ON that feature's surface point and walks
     down over it, on the same SDF, so the whole cat - head included -
     is covered. Their delays sit mid-range, so head cracks arrive as
     damage grows instead of all at the first touch. */
  function dirTo(x,y,z){
    var v=new THREE.Vector3(x,y-form.oy,z), l=v.length()||1;
    return v.divideScalar(l);
  }
  function addZoneBranch(dir,delay){
    var polar=Math.acos(Math.max(-1,Math.min(1,dir.y)));
    var az=Math.atan2(dir.x,dir.z);
    addBranch(polar,az,4+Math.floor(rng()*3),0.15+rng()*0.07,delay,1.15);
  }
  var earL=form.parts[2], earR=form.parts[3], muz=form.parts[4];
  var zoneDirs=[
    dirTo(earL[0],earL[1]+earL[4]*0.75,earL[2]),
    dirTo(earR[0],earR[1]+earR[4]*0.75,earR[2]),
    dirTo(0,form.eyeY+0.42,form.eyeZ+0.30),
    dirTo(-(form.eyeX+0.36),form.eyeY-0.30,form.eyeZ+0.14),
    dirTo( (form.eyeX+0.36),form.eyeY-0.30,form.eyeZ+0.14),
    dirTo(muz[0],muz[1],muz[2]+0.18),
    dirTo(-0.85,form.height*0.55,0.55),
    dirTo( 0.85,form.height*0.55,0.55)
  ];
  for(var zi=0;zi<(kind==='diamond'?3:kind==='brick'?4:zoneDirs.length);zi++) addZoneBranch(zoneDirs[zi],0.10+zi*0.04);
  /* ---- Voronoi fracture cells for THIS cat, from the same seed ----
     Cells are seeded ON the surface starting at the platen contact
     rim on the crown (the first third sit in the contact ring) and
     spreading down over the head and body. Their distribution is the
     cat's own: Mochi round and even, Pudding low and wide (2.5D
     plates), Soda high-count and vertical. At burst time fragments
     are spawned AT these cells, so the cat visibly breaks apart
     along the Voronoi pattern its cracks grew in - seeded, so it is
     never the same pattern twice. */
  var cells=[], nCells=fp.cells;
  for(var ci2=0;ci2<nCells;ci2++){
    var caz=rng()*Math.PI*2;
    var cpol=fp.cellPolar[0]+rng()*(fp.cellPolar[1]-fp.cellPolar[0]);
    if(ci2<Math.ceil(nCells/3)) cpol=0.18+rng()*0.30; /* the platen rim ring */
    var cdir=new THREE.Vector3(Math.sin(cpol)*Math.sin(caz),Math.cos(cpol),Math.sin(cpol)*Math.cos(caz));
    cells.push(surfacePointFromDir(form,cdir));
  }
  grp.userData.voroCells=cells;
  grp.visible=false;
  return grp;
}
function setCrackVisual(grp,level){
  if(!grp || !grp.userData.branches) return;
  if(level<=0.03){ grp.visible=false; return; }
  var any=false, maxOp=grp.userData.maxOpacity||0.96;
  grp.userData.branches.forEach(function(L){
    var local=Math.max(0,Math.min(1,(level-L.delay)*1.3));
    var segs=Math.floor(local*L.seg);
    L.geo.setDrawRange(0,segs*6);
    L.mat.opacity=segs>0? Math.min(maxOp,maxOp*local*1.5) : 0;
    if(segs>0) any=true;
  });
  grp.visible=any;
}

/* ---------- Material dust: real debris, not a generic puff ----------
   Pressing a cracking material shakes loose dust of THAT material:
   glass dust is pale and glinting, iron dust is dark grey metal,
   diamond dust is white sparkle, brick dust is terracotta, toy-brick
   dust is coloured plastic, jelly sheds gel specks in the cat colour.
   Dust flies out, drifts down slowly, and SETTLES on the bed and the
   floor, where it stays as specks until it slowly fades. */
var dustUnitGeo=new THREE.BoxGeometry(1,1,1);
var dusts=[];
var DUST_COLORS={glass:0xdff4ff,iron:0x60656c,diamond:0x4df5dd,brick:0xa85a38,spark:0xffb52e,smoke:0x8d8578};
function dustColor(kind,color){
  if(DUST_COLORS[kind]!==undefined) return DUST_COLORS[kind];
  return color; /* jelly and toy brick shed dust in the cat's own colour */
}
function spawnDust(n,x,y,z,kind,color,power){
  for(var i=0;i<n;i++){
    if(dusts.length>=260){
      var old=-1;
      for(var k=0;k<dusts.length;k++) if(dusts[k].settled){ old=k; break; }
      if(old<0) return;
      scene.remove(dusts[old].mesh);dusts[old].mat.dispose(); dusts.splice(old,1);
    }
    var big=(kind==='smoke');
    var size=big? 0.22+Math.random()*0.3 : 0.02+Math.random()*0.05;
    var mat=new THREE.MeshBasicMaterial({color:dustColor(kind,color),transparent:true,opacity:big?0.4:0.95});
    var m=new THREE.Mesh(dustUnitGeo,mat);
    m.scale.setScalar(size);
    if(big) m.scale.y=size*0.6;
    var ang=Math.random()*Math.PI*2;
    m.position.set(x+Math.cos(ang)*0.3,y+Math.random()*0.3,z+Math.sin(ang)*0.3);
    scene.add(m);
    dusts.push({mesh:m,mat:mat,kind:kind,settled:false,settleT:0,life:big?1.6:16,
      vx:Math.cos(ang)*(0.4+Math.random()*(power||1)),vy:big?0.7+Math.random()*0.7:0.5+Math.random()*(power||1)*0.8,vz:Math.sin(ang)*(0.4+Math.random()*(power||1)),
      vrx:(Math.random()-0.5)*9,vrz:(Math.random()-0.5)*9,baseOp:big?0.4:0.95});
  }
}
function updateDusts(dt){
  for(var i=dusts.length-1;i>=0;i--){
    var d=dusts[i];
    if(d.kind==='smoke'){
      d.life-=dt;
      d.mesh.position.x+=d.vx*dt; d.mesh.position.y+=d.vy*dt; d.mesh.position.z+=d.vz*dt;
      d.mesh.scale.multiplyScalar(1+dt*1.5);
      d.mat.opacity=Math.max(0,d.baseOp*(d.life/1.6));
      if(d.life<=0){ scene.remove(d.mesh); d.mat.dispose(); dusts.splice(i,1); }
      continue;
    }
    if(d.settled){
      d.settleT+=dt;
      if(d.settleT>13){ d.mat.opacity=Math.max(0,d.baseOp*(1-(d.settleT-13)/3)); }
      if(d.settleT>16){ scene.remove(d.mesh); d.mat.dispose(); dusts.splice(i,1); }
      continue;
    }
    d.vy-=3.2*dt; /* dust drifts down slowly, it does not drop like a stone */
    var dragF=Math.pow(0.4,dt); d.vx*=dragF; d.vz*=dragF;
    d.mesh.position.x+=d.vx*dt; d.mesh.position.y+=d.vy*dt; d.mesh.position.z+=d.vz*dt;
    d.mesh.rotation.x+=d.vrx*dt; d.mesh.rotation.z+=d.vrz*dt;
    var surfY=(Math.hypot(d.mesh.position.x,d.mesh.position.z)<3.55? BED_Y:0)+0.015;
    if(d.mesh.position.y<=surfY){
      d.mesh.position.y=surfY; d.settled=true;
      d.mesh.scale.y*=0.4; d.mesh.rotation.set(0,Math.random()*3.1,0);
    }
  }
}

/* ---------- Water: a pressed water ball LEAKS, SPILLS and FLOWS ----------
   No solid chunks, ever. Under pressure it jets droplets from the
   sides and feeds a puddle on the bed; the puddle spreads as more
   water escapes, merges with nearby puddles, and when it reaches the
   bed rim it drips down and starts a floor puddle. On burst the whole
   volume becomes splash droplets plus one fast-spreading puddle. */
var puddles=[];
function puddleGeoVariant(){
  var g=new THREE.CircleGeometry(1,64);
  var pos=g.attributes.position;
  for(var i=1;i<pos.count;i++){
    var vx=pos.getX(i), vy=pos.getY(i), L=Math.hypot(vx,vy)||1, j=0.97+Math.random()*0.06;
    pos.setXY(i,vx/L*j,vy/L*j);
  }
  return g;
}
var puddleGeos=[puddleGeoVariant(),puddleGeoVariant(),puddleGeoVariant()];
var puddleMat=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms:{uTime:{value:0},uPulse:{value:0}},
  vertexShader:[
    'varying vec2 vPuddleUV;varying vec3 wetWorld;',
    'void main(){vPuddleUV=uv;wetWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'
  ].join('\n'),
  /* Soft optically thin wet film: nearly colourless centre, thin glassy
     meniscus at the edge, travelling ripples and subtle caustic glints.
     This is a surface approximation, not a volumetric fluid solver. */
  fragmentShader:[
    'varying vec2 vPuddleUV;varying vec3 wetWorld;uniform float uTime;uniform float uPulse;',
    'void main(){',
    'if(wetWorld.y>0.1 && length(wetWorld.xz)>3.55)discard;',
    'vec2 p=vPuddleUV*2.0-1.0;',
    'float a=atan(p.y,p.x);',
    'float radius=length(p);',
    'float meniscusWave=0.012*sin(a*9.0+uTime*1.1)+0.009*sin(a*17.0-uTime*1.6);',
    'float cover=1.0-smoothstep(0.92+meniscusWave,1.0+meniscusWave,radius);',
    'float rim=exp(-pow((radius-0.90-meniscusWave)*34.0,2.0));',
    'float wave=sin(radius*35.0-uTime*5.0+sin(a*4.0)*0.4)*uPulse;',
    'float caustic=sin(p.x*27.0+uTime*1.7)*sin(p.y*32.0-uTime*1.3);',
    'float glint=pow(max(0.0,sin(p.x*24.0+p.y*13.0-uTime*2.7)),14.0);',
    'float alpha=cover*(0.115+0.025*wave+0.016*caustic+0.12*rim+0.045*glint);',
    'vec3 water=mix(vec3(0.58,0.73,0.75),vec3(0.88,0.96,0.98),clamp(rim*0.8+glint*0.5,0.0,1.0));',
    'gl_FragColor=vec4(water,clamp(alpha,0.0,0.58));',
    '}'
  ].join('\n')
});
/* ---------- Water volume: EVERYTHING scales off the cat's real volume --
   A water ball holds water in proportion to its volume (cat size cubed,
   nudged by the density setting). Droplet counts, droplet sizes, puddle
   area, stream length and overflow rate all derive from this one factor,
   so an XL water cat spills visibly far more water than an S one. */
function waterVolumeFactor(){ return Math.max(0.15,sizeVolume()*(0.65+0.35*density)); }
function puddleRadiusForVolume(vol){ return Math.max(0.55,Math.min(3.3,1.5*Math.sqrt(Math.max(0.05,vol)))); }
/* one shared water material for every droplet - no per-drop allocation */
var waterDropMatShared=null;
function waterDropMat(){ if(!waterDropMatShared) waterDropMatShared=new THREE.MeshPhysicalMaterial({color:0xb2ecf6,metalness:0,roughness:0.065,clearcoat:1,clearcoatRoughness:0.02,ior:1.333,transparent:true,opacity:0.65,depthWrite:false,envMapIntensity:1.2}); return waterDropMatShared; }
function spawnWaterDroplet(x,y,z,vx,vy,vz,s,life){
  if(droplets.length>150) return null;
  var dm=new THREE.Mesh(dropletGeo,waterDropMat()); dm.scale.setScalar(s);
  dm.position.set(x,y,z); scene.add(dm);
  var d={mesh:dm,vx:vx,vy:vy,vz:vz,life:life||1.2,isWater:true};
  droplets.push(d); return d;
}
/* ---------- Flowing water: rivulets, rim waterfalls and ripples ----------
   Water does not just sit as discs and dots. Escaped water RUNS: thin
   rivulet tongues creep across the bed (and the floor), a bed puddle that
   reaches the rim pours over the edge as a short waterfall and feeds the
   floor puddle below, growing puddles throw off expanding ripple rings,
   and every droplet that lands turns back into puddle instead of
   bouncing like a marble. All three effects are capped and share
   geometries, so they stay cheap on phones. */
var streamGeoBase=new THREE.CircleGeometry(0.5,18);
var waterStreams=[];
function spawnFlowStream(x,z,ang,len,wid,onFloor,life){
  if(waterStreams.length>=22){ var oldS=waterStreams.shift(); scene.remove(oldS.grp); oldS.mat.dispose(); }
  /* Feathered, animated rivulet instead of a uniform opaque blue oval. */
  var mat=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTime:{value:0},uOpacity:{value:0.30}},
    vertexShader:[
      'varying vec2 vUV;',
      'void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'
    ].join('\n'),
    fragmentShader:[
      'varying vec2 vUV;uniform float uTime;uniform float uOpacity;',
      'void main(){',
      'vec2 p=vUV*2.0-1.0;float r=length(p);',
      'float edge=1.0-smoothstep(0.64,1.0,r);',
      'float flow=sin(vUV.x*45.0-uTime*8.0+sin(vUV.y*14.0)*0.5);',
      'float shine=pow(max(0.0,sin(vUV.x*30.0-uTime*6.0)),14.0);',
      'vec3 col=mix(vec3(0.53,0.71,0.75),vec3(0.89,0.97,0.99),clamp(shine*0.8+flow*0.12,0.0,1.0));',
      'gl_FragColor=vec4(col,edge*uOpacity*(0.62+0.14*flow+0.22*shine));',
      '}'
    ].join('\n')
  });
  var grp=new THREE.Group();
  grp.position.set(x,(onFloor?0.014:BED_Y+0.014),z);
  grp.rotation.y=-ang;
  var m=new THREE.Mesh(streamGeoBase,mat);
  m.rotation.x=-Math.PI/2; m.scale.set(0.05,wid,1);
  m.position.set(0.025,0,0); m.receiveShadow=true;
  grp.add(m); scene.add(grp);
  waterStreams.push({grp:grp,mesh:m,mat:mat,x:x,z:z,ang:ang,len:len,wid:wid,cur:0.05,onFloor:!!onFloor,life:0,maxLife:life||7,fell:false});
}
var waterfalls=[];
var fallBoxGeo=new THREE.PlaneGeometry(1,1,12,28);
function makeWaterfallMaterial(){
  return new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTime:{value:0},uPhase:{value:Math.random()*6.28},uOpacity:{value:0.45}},
    vertexShader:[
      'uniform float uTime;uniform float uPhase;varying vec2 vFUV;',
      'void main(){vFUV=uv;vec3 p=position;',
      'p.x+=0.15*sin(p.y*14.0+uTime*9.0+uPhase)*sin(uv.y*3.14159);',
      'p.z+=0.045*sin(p.y*18.0-uTime*14.0+uPhase);',
      'gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}'
    ].join('\n'),
    fragmentShader:[
      'uniform float uTime;uniform float uPhase;uniform float uOpacity;varying vec2 vFUV;',
      'void main(){float edge=smoothstep(0.0,0.18,vFUV.x)*(1.0-smoothstep(0.82,1.0,vFUV.x));',
      'float streak=sin(vFUV.x*38.0+uTime*5.0+uPhase)*sin(vFUV.y*26.0-uTime*11.0);',
      'float foam=pow(max(0.0,sin(vFUV.y*71.0-uTime*17.0+uPhase)),14.0);',
      'vec3 col=mix(vec3(0.22,0.46,0.54),vec3(0.72,0.91,0.98),clamp(0.35+0.4*streak+foam*0.45,0.0,1.0));',
      'gl_FragColor=vec4(col,edge*uOpacity*(0.65+0.3*streak+0.2*foam));}'
    ].join('\n')
  });
}
function spawnWaterfall(ang,wid){
  for(var i=0;i<waterfalls.length;i++){ var da=Math.atan2(Math.sin(waterfalls[i].ang-ang),Math.cos(waterfalls[i].ang-ang)); if(Math.abs(da)<0.35) return; }
  if(waterfalls.length>=4){ var oldW=waterfalls.shift(); scene.remove(oldW.mesh); oldW.mat.dispose(); }
  var mat=makeWaterfallMaterial();
  var m=new THREE.Mesh(fallBoxGeo,mat);
  /* The sheet is PlaneGeometry XY: scale.x controls width, not scale.z.
     Its horizontal axis follows the bed rim tangent. */
  m.rotation.y=-ang-Math.PI/2;
  m.position.set(Math.cos(ang)*3.58,BED_Y-0.02,Math.sin(ang)*3.58);
  m.scale.set(Math.max(0.12,wid),0.06,1);
  scene.add(m);
  waterfalls.push({mesh:m,mat:mat,ang:ang,life:0,maxLife:2.8,grow:0,dripAt:0,phase:Math.random()*6.28});
}
var ripples=[];
var rippleGeoBase=new THREE.RingGeometry(0.82,1,36);
function spawnRipple(x,z,maxR,onFloor){
  // Wet-film shader carries travelling highlights; no detached flat rings.
  puddleMat.uniforms.uPulse.value=1;
}
function updateWaterFx(dt,time){
  for(var i=waterStreams.length-1;i>=0;i--){
    var s=waterStreams[i]; s.life+=dt;
    s.cur+=(s.len-s.cur)*Math.min(1,dt*1.5); /* the tongue creeps outward - flowing, not teleporting */
    s.mesh.scale.x=s.cur; s.mesh.position.x=s.cur/2;
    var fadeIn=Math.min(1,s.life/0.4), fadeOut=Math.min(1,Math.max(0,(s.maxLife-s.life)/1.6));
    s.mat.uniforms.uTime.value=time;
    s.mat.uniforms.uOpacity.value=0.30*Math.min(fadeIn,fadeOut);
    if(!s.onFloor && !s.fell){
      var tipX=s.x+Math.cos(s.ang)*s.cur, tipZ=s.z+Math.sin(s.ang)*s.cur;
      if(Math.hypot(tipX,tipZ)>3.5){
        /* the rivulet reaches the rim: it pours over and starts the floor puddle */
        s.fell=true;
        var fa=Math.atan2(tipZ,tipX);
        spawnWaterfall(fa,0.16+s.wid*0.8);
        spawnPuddle(Math.cos(fa)*3.6,Math.sin(fa)*3.6,0.45,true);
      }
    }
    if(s.life>=s.maxLife){ scene.remove(s.grp); s.mat.dispose(); waterStreams.splice(i,1); }
  }
  for(var w=waterfalls.length-1;w>=0;w--){
    var f=waterfalls[w]; f.life+=dt;
    f.grow=Math.min(1,f.grow+dt*2.6); /* the fall stretches down to the floor */
    var h=BED_Y*f.grow;
    f.mesh.scale.y=Math.max(0.05,h);
    f.mesh.position.y=BED_Y-h/2;
    f.mat.uniforms.uTime.value=time; f.mat.uniforms.uOpacity.value=(0.40+0.10*Math.sin(time*26+f.phase))*Math.min(1,Math.max(0,(f.maxLife-f.life)/0.6));
    if(f.grow>=1 && time>f.dripAt){
      f.dripAt=time+0.35;
      spawnPuddle(f.mesh.position.x,f.mesh.position.z,0.30,true);
    }
    if(f.life>=f.maxLife){ scene.remove(f.mesh); f.mat.dispose(); waterfalls.splice(w,1); }
  }
  for(var r=ripples.length-1;r>=0;r--){
    var rp=ripples[r]; rp.t+=dt/1.15;
    rp.mesh.scale.setScalar(0.25+rp.t*rp.maxR);
    rp.mat.opacity=Math.max(0,(1-rp.t)*0.45);
    if(rp.t>=1){ scene.remove(rp.mesh); rp.mat.dispose(); ripples.splice(r,1); }
  }
}
function spawnPuddle(x,z,targetR,onFloor){
  var baseY=onFloor?0.012:BED_Y+0.012;
  for(var i=0;i<puddles.length;i++){
    var p=puddles[i];
    if(!!p.onFloor===!!onFloor && Math.hypot(p.mesh.position.x-x,p.mesh.position.z-z)<Math.max(p.targetR,targetR)*0.8){
      p.targetR=Math.min(3.4,Math.sqrt(p.targetR*p.targetR+targetR*targetR)); return p;
    }
  }
  if(puddles.length>=12){ var old=puddles.shift(); scene.remove(old.mesh); }
  var m=new THREE.Mesh(puddleGeos[Math.floor(Math.random()*puddleGeos.length)],puddleMat);
  m.rotation.x=-Math.PI/2; m.position.set(x,baseY+Math.random()*0.004,z);
  m.scale.setScalar(0.08); m.receiveShadow=true;
  scene.add(m);
  var np={mesh:m,targetR:targetR,onFloor:!!onFloor,life:0,dripAt:0,rippleAt:0,fingerAt:1+Math.random()*2,wobPhase:Math.random()*6.28};
  puddles.push(np); return np;
}
function updatePuddles(dt,time){
  puddleMat.uniforms.uTime.value=time;puddleMat.uniforms.uPulse.value*=Math.exp(-3*dt);
  for(var i=puddles.length-1;i>=0;i--){
    var p=puddles[i]; p.life+=dt;
    var cur=p.mesh.scale.x;
    var nxt=cur+(p.targetR-cur)*Math.min(1,dt*1.45);
    /* a living puddle: its edge breathes very slightly as water settles */
    p.mesh.scale.set(nxt*(1+0.022*Math.sin(time*1.7+p.wobPhase)),nxt*(1+0.022*Math.cos(time*1.35+p.wobPhase)),nxt);
    if(p.targetR-cur>0.06 && time>p.rippleAt){
      p.rippleAt=time+0.85;
      spawnRipple(p.mesh.position.x,p.mesh.position.z,Math.min(1.6,nxt*0.95),p.onFloor);
    }
    if(cur>0.6 && time>p.fingerAt){
      /* flow fingers: the puddle sends a rivulet creeping outward */
      p.fingerAt=time+1.7+Math.random()*2.2;
      var fa2=Math.random()*Math.PI*2;
      spawnFlowStream(p.mesh.position.x+Math.cos(fa2)*cur*0.7,p.mesh.position.z+Math.sin(fa2)*cur*0.7,fa2,0.45+Math.random()*0.65*(0.5+cur/3),0.15+Math.random()*0.13,p.onFloor,6.5);
    }
    if(!p.onFloor){
      var dc=Math.hypot(p.mesh.position.x,p.mesh.position.z);
      if(dc+nxt>3.45 && time>p.dripAt){
        /* spilling over the rim: a waterfall sheet, falling droplets and
           a floor puddle whose size follows how much is overflowing */
        p.dripAt=time+0.4;
        var oa=(dc>0.3)? Math.atan2(p.mesh.position.z,p.mesh.position.x) : Math.random()*Math.PI*2;
        var ex=Math.cos(oa)*3.55, ez=Math.sin(oa)*3.55;
        var overflow=Math.max(0.15,(dc+nxt-3.45)+p.targetR*0.12);
        spawnWaterfall(oa,0.15+overflow*0.4);
        spawnPuddle(ex,ez,0.35+overflow*0.55,true);
        for(var dI=0;dI<2;dI++){
          spawnWaterDroplet(ex+(Math.random()-0.5)*0.15,BED_Y-0.06,ez+(Math.random()-0.5)*0.15,(Math.random()-0.5)*0.8,-0.4,(Math.random()-0.5)*0.8,0.05+Math.random()*0.05,1.4);
        }
      }
    }
    if(p.life>18){ scene.remove(p.mesh); puddles.splice(i,1); }
  }
  updateWaterFx(dt,time);
}

/* ---------- Press explosion: not enough pressure = the press blows ----------
   If the machine's max pressure (slider) is below what the material
   needs (material table x size x density), sustained full-load strain
   blows the press: flash, sparks, smoke, the platen is thrown back up,
   the cat survives unburst. The press then repairs itself over a few
   seconds (banner + disabled hold) and can press again - raise the
   machine pressure and the same cat will break properly. */
function explodePress(){
  if(machineBroken) return;
  machineBroken=true; brokenT=2.8; strainT=0;
  /* REALISTIC, CALM failure - no teleporting platen, no random jitter:
     the ram recoils upward on a smooth spring (platenRecoil, eased in
     the main loop), the frame sways once on a damped sine at a small
     amplitude, a modest puff of smoke and a few sparks escape, and the
     flash is a brief soft bloom that fades out slowly. */
  pressShake=0.85; pressShakeT=0; platenRecoil=true;
  holding=false; holdBtn.classList.remove('held'); setHum(false,0);
  pressure=0;
  var fl=$('boomFlash'); fl.classList.add('on'); setTimeout(function(){ fl.classList.remove('on'); },300);
  var bn=$('brokenBanner'); bn.textContent=t('boomToast').replace('{mat}',t('tex_'+currentTex)); bn.classList.add('show');
  document.querySelector('.deck').classList.add('broken');
  var cx=hero?hero.mesh.position.x:0, cz=hero?hero.mesh.position.z:0;
  spawnDust(9,cx,BED_Y+1.6,cz,'spark',0xffb52e,1.7);
  spawnDust(13,cx,BED_Y+2.0,cz,'smoke',0x8d8578,0.45);
  spawnDust(6,cx,BED_Y+1.2,cz,currentTex,hero?hero.form.color:0xffffff,1.4);
  noiseBurst(0.32,0.26,650); tone(150,30,0.5,'sawtooth',0.16); tone(82,26,0.65,'sine',0.2);
  toast(t('boomToast').replace('{mat}',t('tex_'+currentTex)));
  flashNeedHighlight(5000); /* point at the Machine slider that fixes this */
}

/* ---------- i18n: EN primary, VI secondary, plus ES and ZH. Short dashes only. ---------- */
var I18N={
en:{subtitle:"Jelly cat pressing research",count:"Cats popped",ready:"Ready",pressing:"Pressing",playmode:"Play mode",sound:"Sound",reset:"Reset",hold:"HOLD",raise:"Raise",pressure:"Pressure",mochiSub:"strawberry round",puddingSub:"caramel flat",sodaSub:"mint tall, fizzy",texLabel:"Surface",tex_glass:"Glass",tex_iron:"Iron",tex_diamond:"Diamond",tex_jelly:"Jelly",tex_brick:"Brick",tex_water:"Water ball",tex_lego:"Toy Brick",sizeLabel:"Cat size",splitToast:"It split into smaller pieces.",cloneToast:"{name} popped into {n} mini clones at {bar} bar.",
captions:["Ready when you are.","Contact.","It is fine. It is jelly.","Getting wider.","That is a pancake now.","It is making a noise.","Please."],
subs:["Hold the red button. The cat has made its peace.","The press has opinions about this cat.","Jelly law: volume is conserved. Dignity is not.","Surface area is having a great day.","Somewhere, a physicist is nodding.","The gauge believes in you. The cat does not.","Any second now."],
playCaption:"",playSub:"",machLabel:"Machine",densLabel:"Density",genCat:"Gen cat",bagTxt:"Backpack",moneyTxt:"Money",vacTxt:"Vacuum",vacLbl:"Crumbs vacuumed",useTxt:"Use",buyTxt:"Buy",activeTxt:"Active",powerTxt:"Power",speedTxt:"Speed",vacToast:"Vacuumed {c} pieces: +${n}.",vacNone:"Nothing to vacuum yet.",boughtToast:"{name} is yours.",machines:["Fire Dragon Press","Hell Press","Angel Press"],boomToast:"The press blew up - not enough pressure for {mat}. It is repairing itself.",fixedToast:"Press repaired. Ready again.",crackToast:"It is cracking.",
verdicts:["Pawp.","Flopped.","Fizzed."],stat:"Gave up at {bar} bar and {pct}% of its height.",
poppedToast:"{name} popped at {bar} bar.",newCatToast:"{name} is on the bed. It suspects nothing.",grabToast:"Grabbed. It stretches. It forgives nothing.",resetToast:"Fresh cat, full height, no memory of the press."},
vi:{subtitle:"Nghiên cứu ép mèo jelly",count:"Mèo đã bẹp",ready:"Sẵn sàng",pressing:"Đang ép",playmode:"Chế độ chơi",sound:"Âm thanh",reset:"Làm lại",hold:"GIỮ",raise:"Nâng lên",pressure:"Áp lực",mochiSub:"dâu, tròn",puddingSub:"caramel, dẹt",sodaSub:"bạc hà, cao, có ga",texLabel:"Bề mặt",tex_glass:"Thủy tinh",tex_iron:"Sắt",tex_diamond:"Kim cương",tex_jelly:"Thạch",tex_brick:"Gạch",tex_water:"Bóng nước",tex_lego:"Gạch đồ chơi",sizeLabel:"Cỡ mèo",splitToast:"Nó tách ra thành các mảnh nhỏ hơn.",cloneToast:"{name} bẹp thành {n} mèo mini phân thân ở {bar} bar.",
captions:["Sẵn sàng khi anh sẵn sàng.","Chạm rồi.","Không sao. Nó là thạch mà.","Đang bè ra.","Giờ là bánh kếp rồi.","Nó đang kêu đấy.","Xin đấy."],
subs:["Giữ nút đỏ. Bé mèo đã chấp nhận số phận.","Máy ép có ý kiến riêng về bé này.","Luật thạch: thể tích giữ nguyên. Thể diện thì không.","Diện tích bề mặt đang rất vui.","Ở đâu đó, một nhà vật lý đang gật đầu.","Đồng hồ tin anh. Bé mèo thì không.","Sắp rồi, sắp rồi."],
playCaption:"",playSub:"",machLabel:"Máy ép",densLabel:"Độ đặc",genCat:"Gen mèo",bagTxt:"Balo",moneyTxt:"Tiền",vacTxt:"Hút vụn",vacLbl:"Vụn đã hút",useTxt:"Dùng",buyTxt:"Mua",activeTxt:"Đang dùng",powerTxt:"Áp lực",speedTxt:"Tốc độ",vacToast:"Đã hút {c} mảnh: +${n}.",vacNone:"Chưa có vụn để hút.",boughtToast:"{name} là của anh rồi.",machines:["Máy Hỏa Long","Máy Địa Ngục","Máy Thiên Thần"],boomToast:"Máy nổ - không đủ áp lực cho {mat}. Máy đang tự hồi lại.",fixedToast:"Máy đã hồi lại. Ép tiếp được rồi.",crackToast:"Nó đang nứt ra.",
verdicts:["Bẹp.","Xẹp lép.","Xì ga."],stat:"Bỏ cuộc ở {bar} bar và {pct}% chiều cao.",
poppedToast:"{name} bẹp ở {bar} bar.",newCatToast:"{name} đã lên bàn ép. Bé chưa nghi ngờ gì.",grabToast:"Đã nắm. Nó giãn ra. Nó không tha thứ đâu.",resetToast:"Mèo mới, chiều cao nguyên vẹn, không nhớ gì về máy ép."},
es:{subtitle:"Investigación del prensado de gatos de gelatina",count:"Gatos aplastados",ready:"Listo",pressing:"Prensando",playmode:"Modo juego",sound:"Sonido",reset:"Reiniciar",hold:"MANTÉN",raise:"Subir",pressure:"Presión",mochiSub:"fresa, redondo",puddingSub:"caramelo, plano",sodaSub:"menta, alto, con gas",texLabel:"Superficie",tex_glass:"Vidrio",tex_iron:"Hierro",tex_diamond:"Diamante",tex_jelly:"Gelatina",tex_brick:"Ladrillo",tex_water:"Bola de agua",tex_lego:"Ladrillo de juguete",sizeLabel:"Tamaño",splitToast:"Se partió en trozos más pequeños.",cloneToast:"{name} reventó en {n} miniclones a {bar} bar.",
captions:["Listo cuando quieras.","Contacto.","No pasa nada. Es gelatina.","Se está ensanchando.","Eso ya es una tortita.","Está haciendo un ruido.","Por favor."],
subs:["Mantén el botón rojo. El gato ya aceptó su destino.","La prensa tiene opiniones sobre este gato.","Ley de la gelatina: el volumen se conserva. La dignidad no.","El área superficial está feliz.","En algún lugar, un físico asiente.","El medidor cree en ti. El gato no.","En cualquier momento."],
playCaption:"",playSub:"",machLabel:"Máquina",densLabel:"Densidad",genCat:"Gen gato",bagTxt:"Mochila",moneyTxt:"Dinero",vacTxt:"Aspirar",vacLbl:"Migas aspiradas",useTxt:"Usar",buyTxt:"Comprar",activeTxt:"En uso",powerTxt:"Potencia",speedTxt:"Velocidad",vacToast:"{c} trozos aspirados: +${n}.",vacNone:"Aún no hay nada que aspirar.",boughtToast:"{name} ya es tuyo.",machines:["Prensa Dragón de Fuego","Prensa Infernal","Prensa Ángel"],boomToast:"La prensa explotó: presión insuficiente para {mat}. Se está reparando.",fixedToast:"Prensa reparada. Lista de nuevo.",crackToast:"Se está agrietando.",
verdicts:["Pawp.","Aplastado.","Burbujeó."],stat:"Se rindió a {bar} bar y al {pct}% de su altura.",
poppedToast:"{name} reventó a {bar} bar.",newCatToast:"{name} está en la base. No sospecha nada.",grabToast:"Agarrado. Se estira. No perdona nada.",resetToast:"Gato nuevo, altura completa, sin recuerdos de la prensa."},
zh:{subtitle:"果冻猫压制研究",count:"已压猫数",ready:"就绪",pressing:"正在压",playmode:"游玩模式",sound:"声音",reset:"重置",hold:"按住",raise:"升起",pressure:"压力",mochiSub:"草莓, 圆",puddingSub:"焦糖, 扁",sodaSub:"薄荷, 高, 带气泡",texLabel:"表面",tex_glass:"玻璃",tex_iron:"铁",tex_diamond:"钻石",tex_jelly:"果冻",tex_brick:"砖块",tex_water:"水球",tex_lego:"玩具积木",sizeLabel:"大小",splitToast:"它裂成了更小的碎块。",cloneToast:"{name} 在 {bar} bar 时爆成了 {n} 只迷你分身猫。",
captions:["随时可以开始。","接触了。","没事。它是果冻。","越来越宽了。","这已经是煎饼了。","它在发出声音。","拜托了。"],
subs:["按住红按钮。这只猫已经接受命运了。","压机对这只猫有自己的看法。","果冻定律: 体积守恒, 尊严不守恒。","表面积今天很开心。","在某个地方, 一位物理学家在点头。","仪表相信你。猫不相信。","随时都会发生。"],
playCaption:"",playSub:"",machLabel:"机器",densLabel:"密度",genCat:"生成猫",bagTxt:"背包",moneyTxt:"金钱",vacTxt:"吸走碎屑",vacLbl:"已吸碎屑",useTxt:"使用",buyTxt:"购买",activeTxt:"使用中",powerTxt:"压力",speedTxt:"速度",vacToast:"吸走 {c} 块碎屑: +${n}。",vacNone:"还没有碎屑可吸。",boughtToast:"{name} 归你了。",machines:["火龙压机","地狱压机","天使压机"],boomToast:"机器炸了 - 对 {mat} 压力不足。正在自动修复。",fixedToast:"机器已修复。可以继续压。",crackToast:"它正在开裂。",
verdicts:["啪叽。","压扁了。","滋滋冒泡。"],stat:"在 {bar} bar 和 {pct}% 高度时放弃了。",
poppedToast:"{name} 在 {bar} bar 时爆开了。",newCatToast:"{name} 已经上台了。它什么都没怀疑。",grabToast:"抓住了。它在拉伸。它什么都不原谅。",resetToast:"新猫, 完整高度, 完全不记得压机。"}
};
var lang='en';
function t(k){ return I18N[lang][k]||I18N.en[k]; }
/* Auto language: a static page cannot read the Muse account itself, so it
   follows the signed-in browser / device language - the closest signal to
   the person using it. Priority: an explicit ?lang= (or ?locale= / ?hl=)
   in the address, then navigator.languages in order, then
   navigator.language. Unsupported languages fall back to English.
   Tapping a language button overrides the auto choice for this session. */
var langManual=false;
function matchSupportedLang(raw){
  if(!raw) return null;
  var c=String(raw).toLowerCase().replace('_','-');
  if(c==='vi'||c.indexOf('vi-')===0) return 'vi';
  if(c==='es'||c.indexOf('es-')===0) return 'es';
  if(c==='zh'||c.indexOf('zh-')===0) return 'zh';
  if(c==='en'||c.indexOf('en-')===0) return 'en';
  return null;
}
function detectLang(){
  var candidates=[], i, m;
  try{
    var q=new URLSearchParams(window.location.search);
    var explicit=q.get('lang')||q.get('locale')||q.get('hl');
    if(explicit) candidates.push(explicit);
  }catch(e){}
  try{
    if(navigator.languages && navigator.languages.length) candidates=candidates.concat(navigator.languages);
    if(navigator.language) candidates.push(navigator.language);
    if(navigator.userLanguage) candidates.push(navigator.userLanguage);
  }catch(e){}
  for(i=0;i<candidates.length;i++){ m=matchSupportedLang(candidates[i]); if(m) return m; }
  return 'en';
}
function syncLangButtons(){
  document.querySelectorAll('.lang-btn').forEach(function(x){ x.classList.toggle('active',x.getAttribute('data-lang')===lang); });
  document.documentElement.lang=(lang==='zh'?'zh-CN':lang);
}

/* ---------- Procedural sound: hum, squelch, plop, pop ---------- */
var AC=null, humOsc=null, humGain=null, humFilter=null, soundOn=true, creakAt=0;
function ensureAudio(){
  if(!soundOn) return;
  try{
    if(!AC){ AC=new (window.AudioContext||window.webkitAudioContext)();
      humOsc=AC.createOscillator(); humOsc.type='sawtooth'; humOsc.frequency.value=52;
      humFilter=AC.createBiquadFilter(); humFilter.type='lowpass'; humFilter.frequency.value=220;
      humGain=AC.createGain(); humGain.gain.value=0;
      humOsc.connect(humFilter); humFilter.connect(humGain); humGain.connect(AC.destination); humOsc.start();
    }
    if(AC.state==='suspended') AC.resume();
  }catch(e){}
}
function setHum(on,pressure){
  if(!AC||!humGain) return;
  var g=on? 0.015+pressure/400*0.075 : 0;
  humGain.gain.setTargetAtTime(soundOn?g:0, AC.currentTime, 0.08);
  humOsc.frequency.setTargetAtTime(52+pressure*0.22, AC.currentTime, 0.1);
  humFilter.frequency.setTargetAtTime(220+pressure*1.4, AC.currentTime, 0.1);
}
function tone(f0,f1,dur,type,vol){
  if(!AC||!soundOn) return;
  try{ var o=AC.createOscillator(), g=AC.createGain(), now=AC.currentTime;
    o.type=type||'sine'; o.frequency.setValueAtTime(f0,now); o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),now+dur);
    g.gain.setValueAtTime(vol,now); g.gain.exponentialRampToValueAtTime(0.001,now+dur);
    o.connect(g); g.connect(AC.destination); o.start(now); o.stop(now+dur+0.02); }catch(e){}
}
function noiseBurst(dur,vol,freq){
  if(!AC||!soundOn) return;
  try{ var len=Math.floor(AC.sampleRate*dur), buf=AC.createBuffer(1,len,AC.sampleRate), d=buf.getChannelData(0);
    for(var i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    var src=AC.createBufferSource(); src.buffer=buf;
    var f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=freq||900;
    var g=AC.createGain(); g.gain.value=vol;
    src.connect(f); f.connect(g); g.connect(AC.destination); src.start(); }catch(e){}
}
function plop(v){ tone(320+(v||0)*40,90,0.16,'sine',0.14); }
function squelch(){ tone(180,420,0.12,'triangle',0.08); noiseBurst(0.08,0.05,1400); }
function popSound(){ tone(140,40,0.35,'sine',0.3); noiseBurst(0.28,0.32,2600); setTimeout(function(){ tone(700,180,0.2,'triangle',0.12); },40); }
/* ---------- Material voices: cracking and breaking sound DIFFERENT
   for every material - there is no shared crack or pop any more.
   - glass:   sharp, high, bright - band-passed snap + a high ping
   - iron:    heavy and low - a dull metallic thunk and low rumble
   - diamond: crystalline and piercing - stacked high sine pings
   - brick:   crumbly and muffled - low-passed grit, falling rubble
   - jelly:   soft and wet - a low squelch swell, no sharp edge
   - water:   a round "bup" and splashing water, never a solid crack
   - lego:    plastic "tach" plus a scatter of little clicks (clatter)
   All of it is synthesized live with the WebAudio graph above, so no
   audio files are needed and every hit can vary slightly. ---------- */
function noiseHit(dur,vol,type,freq,q,rate){
  if(!AC||!soundOn) return;
  try{ var len=Math.max(1,Math.floor(AC.sampleRate*dur)), buf=AC.createBuffer(1,len,AC.sampleRate), d=buf.getChannelData(0);
    for(var i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    var src=AC.createBufferSource(); src.buffer=buf; src.playbackRate.value=rate||1;
    var f=AC.createBiquadFilter(); f.type=type||'lowpass'; f.frequency.value=freq||900; f.Q.value=q||0.8;
    var g=AC.createGain(); g.gain.value=vol;
    src.connect(f); f.connect(g); g.connect(AC.destination); src.start(); }catch(e){}
}
function crackSound(kind,intensity){
  if(!AC||!soundOn) return;
  var v=0.05+0.12*Math.max(0,Math.min(1,intensity||0.4));
  if(kind==='glass'){
    noiseHit(0.06,v,'bandpass',3400+Math.random()*1600,6);
    tone(2600+Math.random()*900,2300,0.055,'sine',v*0.55);
  } else if(kind==='diamond'){
    tone(3300+Math.random()*800,3000,0.085,'sine',v*0.8);
    tone(4600+Math.random()*700,4300,0.06,'sine',v*0.45);
    noiseHit(0.045,v*0.6,'highpass',5400,0.7);
  } else if(kind==='iron'){
    tone(120+Math.random()*40,58,0.16,'square',v*0.55);
    tone(82,44,0.2,'sine',v*0.9);
    noiseHit(0.09,v*0.7,'lowpass',520,0.7);
  } else if(kind==='brick'){
    noiseHit(0.11,v,'lowpass',640,0.7);
    noiseHit(0.07,v*0.6,'lowpass',380,0.7,0.8);
    tone(105,58,0.1,'sine',v*0.6);
  } else if(kind==='jelly'){
    tone(260+Math.random()*60,470,0.11,'sine',v*0.75);
    noiseHit(0.09,v*0.55,'lowpass',850,0.7,0.9);
  } else if(kind==='water'){
    tone(520,170,0.09,'sine',v*0.85);
    noiseHit(0.07,v*0.5,'bandpass',950,1.6,1.1);
  } else if(kind==='lego'){
    noiseHit(0.028,v,'highpass',2500,0.7,1.2);
    tone(1150+Math.random()*250,900,0.03,'square',v*0.35);
    setTimeout(function(){ noiseHit(0.028,v*0.85,'highpass',2900,0.7,1.3); },45+Math.random()*40);
  } else {
    noiseHit(0.08,v,'bandpass',1800,1.2);
  }
}
function burstSound(kind,scale){
  if(!AC||!soundOn) return;
  var s=scale||1, i;
  if(kind==='glass'){
    /* sharp shatter: a bright crack, then individual shards tinkling */
    noiseHit(0.22,0.30*s,'bandpass',3600,2.5);
    noiseHit(0.34,0.20*s,'highpass',4800,0.7,0.9);
    [0,50,110,190].forEach(function(ms){ setTimeout(function(){ tone(2400+Math.random()*1600,2000,0.09,'sine',0.10*s); noiseHit(0.05,0.10*s,'bandpass',4200+Math.random()*1200,6); },ms); });
  } else if(kind==='diamond'){
    /* crystalline burst: a piercing snap and a cascade of high pings */
    noiseHit(0.16,0.22*s,'highpass',5200,0.7);
    [0,40,90,150,230].forEach(function(ms){ setTimeout(function(){ tone(3000+Math.random()*1800,2700,0.11,'sine',0.11*s); },ms); });
    tone(1250,900,0.16,'triangle',0.08*s);
  } else if(kind==='iron'){
    /* heavy metal break: deep boom, low clang, almost no high end */
    tone(72,28,0.5,'sine',0.34*s);
    tone(150,60,0.28,'square',0.14*s);
    noiseHit(0.3,0.26*s,'lowpass',420,0.7,0.8);
    setTimeout(function(){ tone(210,95,0.2,'square',0.08*s); },70);
  } else if(kind==='brick'){
    /* dull crumble: muffled break, then rubble chunks tumbling down */
    noiseHit(0.26,0.30*s,'lowpass',560,0.7,0.85);
    [60,140,230].forEach(function(ms,bi){ setTimeout(function(){ noiseHit(0.12,0.16*s,'lowpass',420-bi*70,0.7,0.8); },ms); });
    tone(96,46,0.24,'sine',0.2*s);
  } else if(kind==='water'){
    /* the balloon "bup": a round low pop, then open water splashing */
    tone(230,46,0.24,'sine',0.32*s);
    noiseHit(0.3,0.24*s,'lowpass',1150,0.7,1.0);
    setTimeout(function(){ noiseHit(0.34,0.16*s,'bandpass',750,1.1,0.8); },60);
    setTimeout(function(){ tone(640,300,0.12,'sine',0.07*s); },120);
  } else if(kind==='lego'){
    /* plastic snap ("tach") then hard little bricks clattering */
    noiseHit(0.07,0.26*s,'highpass',2300,0.7,1.15);
    tone(980,760,0.05,'square',0.10*s);
    for(i=0;i<6;i++){ (function(ms){ setTimeout(function(){ noiseHit(0.03,0.13*s,'highpass',2600+Math.random()*900,0.7,1.25); tone(1250+Math.random()*350,1000,0.028,'square',0.05*s); },ms); })(70+i*46+Math.random()*26); }
  } else {
    /* jelly: a soft, wet pop - low body, squelch, no sharp transient */
    tone(150,42,0.32,'sine',0.3*s);
    noiseHit(0.26,0.26*s,'lowpass',820,0.7,0.9);
    tone(300,540,0.14,'sine',0.10*s);
    setTimeout(function(){ tone(660,190,0.18,'triangle',0.10*s); },45);
  }
}

/* ---------- Game state ---------- */
var mode='ready'; /* ready | play */
var currentType='mochi',currentSeed=0;
var hero=null; /* {mesh,inner,mat,form} */
var squash=0, squashV=0, pressure=0, holding=false, raising=false;
var burstAt=0.6, popTotal=0, maxPressure=0, lastCrumbSquash=0;
var pieces=[], droplets=[];
var catSize=1; /* user-adjustable hero scale, 0.7 to 1.5, from the Size slider */
var lastSplitToastAt=0;
/* Crumb cleanup rule: debris stays put across cat changes until the 20th cat
   in a cycle pops. Only then does it fade out over 1.6s and get removed;
   once the fade finishes, the 20-cat cycle counter starts again from zero. */
var popCycle=0, crumbFadeActive=false;
var CRUMB_CYCLE=20, CRUMB_FADE_SEC=1.6;
var toastEl=$('toast'), toastTimer=null;
function toast(msg){ toastEl.textContent=msg; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(function(){ toastEl.classList.remove('show'); },1900); }

var TEX_KINDS=['glass','iron','diamond','jelly','brick','water','lego'];
function randomTex(){
  var pick=TEX_KINDS[Math.floor(Math.random()*TEX_KINDS.length)];
  if(pick===currentTex && TEX_KINDS.length>1){
    pick=TEX_KINDS[(TEX_KINDS.indexOf(pick)+1+Math.floor(Math.random()*(TEX_KINDS.length-1)))%TEX_KINDS.length];
  }
  return pick;
}
function setHero(type,keepTex,seed){
  endHold();dragHero=false;dragPiece=null;dragInfo=null;pointers={};canvas.classList.remove('grabbing');
  if(hero){ disposeHero(hero); hero=null; }
  /* Pieces and crumbs stay on the bed/floor when the cat changes - never cleared here. */
  /* keepTex: an explicit surface choice regenerates THIS cat fresh with
     that material. Without it, a fresh cat gets a random new surface. */
  currentTex=keepTex||'jelly';
  crackLevel=0; heroDamage=0; lastCrackSndLevel=0; strainT=0;
  var mesh=buildCatMesh(type);
  if(mesh.userData.bodyG) mesh.userData.bodyG.scale.setScalar(FORMS[type].scale*catSize);
  mesh.position.set(0,BED_Y,-0.1); scene.add(mesh);
  /* one fresh seed per generated cat: it lays out this cat's crack
     network and Voronoi fracture cells, and jitters this individual
     cat's stiffness and damping by +-15%, so no two cats - not even
     two Mochis in a row - press or break quite the same way */
  var heroSeed=seed===undefined?(Math.random()*2147483646)|0:seed;currentSeed=heroSeed;
  var crackGrp=buildCrackGroup(currentTex,FORMS[type],type,heroSeed);
  if(mesh.userData.bodyG) mesh.userData.bodyG.add(crackGrp);
  var jrng=mulberry32(heroSeed^0x51ab);
  var bfp=formPhys(type);
  var heroFp={stiff:bfp.stiff*(0.85+jrng()*0.3),damp:bfp.damp*(0.85+jrng()*0.3),volKeep:bfp.volKeep,spread:bfp.spread,wobbleAmp:bfp.wobbleAmp,fric:bfp.fric,bounce:bfp.bounce,bend:bfp.bend,fragN:bfp.fragN,fragBounce:bfp.fragBounce,mass:bfp.mass,comp:bfp.comp};
  hero={mesh:mesh,inner:mesh.userData.inner,mat:mesh.userData.mat,form:FORMS[type],wob:0,wobV:0,shake:0,vx:0,vz:0,held:false,tiltX:0,tiltZ:0,crack:crackGrp,dustAt:0,leakAt:0,puddleFeed:0,fp:heroFp,seed:heroSeed,lean:jrng()*Math.PI*2,voro:(crackGrp.userData.voroCells||[])};
  currentType=type; initSoftHero(hero); squash=0; squashV=0; pressure=0; maxPressure=0; lastCrumbSquash=0;
  burstAt=hero.soft?hero.soft.preset.failure:0.60; /* per the Jelly Press spec: pop at a random squash of 54-66% of height */
  mode='ready';
  setCaption(0);
  document.querySelectorAll('.tex-btn').forEach(function(c){ if(c.classList.contains('size-btn')) return; c.classList.toggle('active',c.getAttribute('data-tex')===currentTex); });
  document.querySelectorAll('[data-cat]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.cat===currentType));});
  updateMatStats();
}
function clearPieces(){
  pieces.forEach(disposePiece);
  pieces=[];
  droplets.forEach(function(d){ scene.remove(d.mesh);if(!d.isWater)d.mesh.material.dispose(); });
  droplets=[];
}
/* ---------- Vacuum: every crumb flies into the bin and becomes money ----------
   Pieces leave the physics array the moment the vacuum starts (so
   nothing fights the suction), spiral into the trash bin while
   shrinking, and only when the last one lands is the money banked:
   pieceValue() has already priced each one by material, size and
   density. Gel droplets get sucked up too, for free. */
var vacFx=[], vacuuming=false, vacPending=null;
function startVacuum(){
  if(vacuuming) return;
  if(mode!=='play'||(!pieces.length&&!droplets.length)){ toast(t('vacNone')); return; }
  ensureAudio();
  vacuuming=true;
  var total=0,count=0,i,p;
  for(i=0;i<pieces.length;i++){
    p=pieces[i]; total+=pieceValue(p); count++;
    vacFx.push({piece:p,mesh:p.mesh,mat:p.mat||null,t:-Math.random()*0.35,spin:(Math.random()-0.5)*9});
  }
  pieces=[];
  if(dragPiece){ dragPiece=null; dragInfo=null; canvas.classList.remove('grabbing'); }
  for(i=0;i<droplets.length;i++) vacFx.push({mesh:droplets[i].mesh,mat:droplets[i].mesh.material||null,t:-Math.random()*0.3,spin:0});
  droplets=[];
  vacPending={total:total,count:count};
  tone(170,760,0.55,'sawtooth',0.045); noiseHit(0.5,0.10,'bandpass',900,1.2,1.4);
}
function updateVacuum(dt){
  if(!vacFx.length){
    if(vacuuming&&vacPending){
      vacuuming=false; money+=vacPending.total; vacuumedCount+=vacPending.count; vacuumedEarned+=vacPending.total;
      toast(t('vacToast').replace('{c}',vacPending.count).replace('{n}',vacPending.total));
      vacPending=null; updateBagUI(); renderBag();
    }
    return;
  }
  for(var i=vacFx.length-1;i>=0;i--){
    var f=vacFx[i]; f.t+=dt; if(f.t<0) continue;
    f.mesh.position.lerp(BIN_POS,Math.min(1,dt*5.5));
    f.mesh.rotation.y+=f.spin*dt; f.mesh.rotation.x+=f.spin*0.6*dt;
    var sc=Math.max(0.05,1-f.t*1.5);
    if(f.mesh.scale.x>sc) f.mesh.scale.setScalar(sc);
    if(f.mesh.position.distanceTo(BIN_POS)<0.35||f.t>1.4){
      if(f.piece)disposePiece(f.piece);else{scene.remove(f.mesh);if(f.mat&&f.mat.dispose&&f.mat!==waterDropMatShared) f.mat.dispose();}
      vacFx.splice(i,1);
    }
  }
}
function setCaption(stage){
  var caps=t('captions'), subs=t('subs');
  $('caption').textContent=caps[Math.min(stage,caps.length-1)];
  $('subcaption').textContent=subs[Math.min(stage,subs.length-1)];
  var sn=$('sideNote'); if(sn) sn.classList.remove('hide');
}
function syncSideNote(){
  /* in play mode both lines are empty by design - hide the card so no
     empty box floats at the left edge */
  var sn=$('sideNote'); if(!sn) return;
  var empty=!$('caption').textContent && !$('subcaption').textContent;
  sn.classList.toggle('hide',empty);
}
function captionStage(){
  if(squash<0.02) return 0;
  if(squash<0.10) return 1;
  if(squash<0.24) return 2;
  if(squash<0.40) return 3;
  if(squash<0.54) return 4;
  if(squash<0.68) return 5;
  return 6;
}

/* ---------- Fragment shapes: every piece gets its own mould ----------
   Five archetypes - round, long, flat, sharp and warped - each jittered
   per piece, so no two fragments share a shape, size, aspect ratio or
   amount of distortion. Re-pressing a piece remorphs it (see below), so
   a piece never keeps the mould it was born with either. */
var FRAG_PROPS=[
  {kind:'round', px:1.00,py:0.88,pz:1.00,sharp:false},
  {kind:'long',  px:1.70,py:0.60,pz:0.82,sharp:false},
  {kind:'flat',  px:1.35,py:0.34,pz:1.30,sharp:false},
  {kind:'sharp', px:1.20,py:0.62,pz:0.95,sharp:true},
  {kind:'warped',px:1.25,py:0.72,pz:0.78,sharp:false},
  {kind:'sharp', px:0.85,py:0.55,pz:1.35,sharp:true},
  {kind:'long',  px:0.80,py:0.58,pz:1.75,sharp:false},
  {kind:'flat',  px:1.05,py:0.30,pz:1.55,sharp:true}
];
function pickFragProp(){
  var b=FRAG_PROPS[Math.floor(Math.random()*FRAG_PROPS.length)];
  var j=function(v,a){ return v*(1+(Math.random()*2-1)*a); };
  return {kind:b.kind,sharp:b.sharp,px:j(b.px,0.22),py:j(b.py,0.28),pz:j(b.pz,0.22)};
}
function fragGeoFor(prop){
  return prop.sharp? shardGeos[Math.floor(Math.random()*shardGeos.length)] : blobGeos[Math.floor(Math.random()*blobGeos.length)];
}
function makeFragMesh(mat,base){
  var prop=pickFragProp();
  var mesh=new THREE.Mesh(fragGeoFor(prop),mat);
  mesh.scale.set(base*prop.px,base*prop.py,base*prop.pz);
  mesh.rotation.set(Math.random()*3.1,Math.random()*3.1,Math.random()*3.1);
  mesh.castShadow=true;
  return {mesh:mesh,prop:prop,drawTop:Math.max(0.08,base*prop.py*(prop.sharp?0.66:0.80))};
}
/* ---------- Fragment shapes per material ----------
   Fragments never share one mould across materials: glass and diamond
   break into sharp transparent shards, iron into heavy metal chunks,
   brick into plain boxes (plus dust crumbs), toy brick into studded
   plastic bricks (or a loose stud when tiny), and only jelly uses the
   soft torn-blob moulds. Water makes no solid fragments at all. */
var brickBoxGeo=new THREE.BoxGeometry(1,1,1);
var studGeo=new THREE.CylinderGeometry(0.5,0.5,0.4,14);
function makeMatFrag(kind,mat,base){
  var i;
  if(kind==='brick'){
    var bm=new THREE.Mesh(brickBoxGeo,mat);
    bm.scale.set(base*1.7,base*0.8,base*1.08);
    bm.rotation.set(Math.random()*3.1,Math.random()*3.1,Math.random()*3.1);
    bm.castShadow=true;
    return {node:bm,main:bm,prop:{kind:'brickbox',sharp:false},drawTop:base*0.52};
  }
  if(kind==='lego'){
    if(base<0.17){
      var st=new THREE.Mesh(studGeo,mat);
      st.scale.set(base*0.9,base*0.9,base*0.9);
      st.rotation.set(Math.random()*3.1,Math.random()*3.1,Math.random()*3.1);
      st.castShadow=true;
      return {node:st,main:st,prop:{kind:'stud',sharp:false},drawTop:base*0.4};
    }
    var grp=new THREE.Group();
    var box=new THREE.Mesh(brickBoxGeo,mat);
    box.scale.set(base*1.55,base*0.6,base*1.02); box.castShadow=true; grp.add(box);
    var nStuds=2+Math.floor(Math.random()*3);
    for(i=0;i<nStuds;i++){
      var sd=new THREE.Mesh(studGeo,mat);
      sd.scale.set(base*0.34,base*0.30,base*0.34);
      sd.position.set((i-(nStuds-1)/2)*base*0.52,base*0.44,0);
      sd.castShadow=true; grp.add(sd);
    }
    grp.rotation.set(Math.random()*3.1,Math.random()*3.1,Math.random()*3.1);
    return {node:grp,main:box,prop:{kind:'toybrick',sharp:false},drawTop:base*0.62};
  }
  if(kind==='glass'){
    /* thin clear panes: wide, almost flat, sharp */
    var gm=new THREE.Mesh(glassShardGeos[Math.floor(Math.random()*glassShardGeos.length)],mat);
    gm.scale.setScalar(base*1.15);
    gm.rotation.set(Math.random()*3.1,Math.random()*3.1,Math.random()*3.1);
    gm.castShadow=true;
    return {node:gm,main:gm,prop:{kind:'glassshard',sharp:true},drawTop:base*0.30};
  }
  if(kind==='diamond'){
    /* chunky Minecraft crystals: tall octahedra that stand and tumble */
    var cm2=new THREE.Mesh(mcCrystalGeos[Math.floor(Math.random()*mcCrystalGeos.length)],mat);
    cm2.scale.setScalar(base*1.0);
    cm2.rotation.set(Math.random()*3.1,Math.random()*3.1,Math.random()*3.1);
    cm2.castShadow=true;
    return {node:cm2,main:cm2,prop:{kind:'mccrystal',sharp:true},drawTop:base*0.95};
  }
  if(kind==='iron'){
    var im=new THREE.Mesh(shardGeos[Math.floor(Math.random()*shardGeos.length)],mat);
    im.scale.set(base*1.15,base*0.95,base*1.05);
    im.rotation.set(Math.random()*3.1,Math.random()*3.1,Math.random()*3.1);
    im.castShadow=true;
    return {node:im,main:im,prop:{kind:'metalchunk',sharp:true},drawTop:base*0.62};
  }
  var f=makeFragMesh(mat,base);
  return {node:f.mesh,main:f.mesh,prop:f.prop,drawTop:f.drawTop};
}
/* spawn one solid fragment of a given material at a burst */
function spawnMatPiece(kind,color,base,cx,cz){
  var mat=jellyMat(color,undefined,kind);
  var g=new THREE.Group();
  var inner=new THREE.Group(); g.add(inner);
  var frag=makeMatFrag(kind,mat,base);
  inner.add(frag.node);
  var ang=Math.random()*Math.PI*2;
  g.position.set(cx+Math.cos(ang)*(0.3+Math.random()*0.5),BED_Y+0.8,cz+Math.sin(ang)*(0.3+Math.random()*0.5));
  scene.add(g);
  var mp=physFor(kind);
  var np={mesh:g,inner:inner,mat:mat,mainMesh:frag.main,shapeKind:frag.prop.kind,drawTop:frag.drawTop,permFlat:0,permWideX:0,permWideZ:0,sqSpreadX:0.40+Math.random()*0.55,sqSpreadZ:0.40+Math.random()*0.55,morphedThisPress:false,mini:false,clone:false,kind:'blob',color:color,texKind:kind,catType:currentType,baseScale:base,splitDepth:0,splitCooldown:0.4,r:Math.max(0.14,base*0.85),pressTop:0,
    vx:Math.cos(ang)*(1.6+Math.random()*2.4),vy:3.2+Math.random()*2.6,vz:Math.sin(ang)*(1.6+Math.random()*2.4),
    rx:0,rz:0,vrx:(Math.random()-0.5)*11*mp.spin,vrz:(Math.random()-0.5)*11*mp.spin,
    wob:0,wobV:(2+Math.random()*3)*mp.wobble,held:false,restY:BED_Y+base*0.5,squashP:0};
  applyPhys(np,kind);
  pieces.push(np);
  return np;
}
/* Re-press remorph: swap the geometry for a different one, pick a fresh
   archetype with new proportions, nudge the overall size, and record a
   permanent squash (permFlat) plus uneven permanent spread, so the
   piece's resting shape and size genuinely change after every press. */
function remorphPiece(p){
  if(!p||p.mini||!p.mainMesh) return;
  if(p.texKind && p.texKind!=='jelly'){
    /* hard materials keep their mould when re-pressed: only a slight
       permanent dent, never a jelly-style morph */
    p.permFlat=Math.min(0.22,(p.permFlat||0)+0.05);
    return;
  }
  var base=p.baseScale||p.r||0.3;
  var prop=pickFragProp();
  p.mainMesh.geometry=fragGeoFor(prop);
  p.mainMesh.scale.set(base*prop.px,base*prop.py,base*prop.pz);
  p.mainMesh.rotation.set(Math.random()*3.1,Math.random()*3.1,Math.random()*3.1);
  p.shapeKind=prop.kind;
  p.drawTop=Math.max(0.08,base*prop.py*(prop.sharp?0.66:0.80));
  var sizeKick=0.88+Math.random()*0.26;
  p.r=Math.max(0.10,Math.min(0.95,(p.r||base)*sizeKick));
  p.permFlat=Math.min(0.6,(p.permFlat||0)+0.14+Math.random()*0.16);
  var ang=Math.random()*Math.PI;
  var wide=0.10+Math.random()*0.22;
  p.permWideX=wide*Math.abs(Math.cos(ang))+0.04;
  p.permWideZ=wide*Math.abs(Math.sin(ang))+0.04;
  p.sqSpreadX=0.40+Math.random()*0.55;
  p.sqSpreadZ=0.40+Math.random()*0.55;
}
/* ---------- Platen collision: pieces NEVER cross the press plate ----------
   The platen is a solid disc. Any piece whose horizontal footprint
   overlaps the disc and whose top reaches the disc's underside is
   resolved back underneath it in the same frame - no matter how fast it
   was flying (a pure final-position clamp cannot tunnel) and no matter
   whether the platen is rising, holding or descending onto it. The
   piece bounces downward, gets a wobble kick, and is squirted sideways
   toward the rim; the deeper the platen presses it toward the bed, the
   harder it squirts out from under the edge. */
function collidePlaten(p){
  var dx=p.mesh.position.x, dz=p.mesh.position.z+0.1;
  var dist=Math.hypot(dx,dz);
  var effR=PLATEN_R+0.12+(p.r||0.2)*0.35;
  if(dist>=effR) return false;
  var topOff=(p.pressTop&&p.pressTop>0)? p.pressTop : (p.drawTop||(p.r||0.2)*0.9);
  var bottom=platenBottom();
  if(p.mesh.position.y+topOff<=bottom) return false;
  /* clamp underneath the plate, even if the piece had already tunnelled
     fully above it this frame */
  p.mesh.position.y=bottom-topOff-0.02;
  var impact=Math.abs(p.vy||0)+Math.abs(Math.min(0,platenVelY));
  if((p.vy||0)>Math.min(0,platenVelY)) p.vy=Math.min(0,platenVelY)-Math.abs(p.vy||0)*0.34-0.4;
  var ux,uz;
  if(dist>0.15){ ux=dx/dist; uz=dz/dist; }
  else { var ra=Math.random()*Math.PI*2; ux=Math.cos(ra); uz=Math.sin(ra); }
  var gap=bottom-((Math.hypot(p.mesh.position.x,p.mesh.position.z)<3.55? BED_Y:0)+topOff*0.6);
  var squirt=0.7+impact*0.55+(gap<topOff*1.4? 2.4:0.5);
  p.vx=(p.vx||0)+ux*squirt; p.vz=(p.vz||0)+uz*squirt;
  if(gap<topOff*1.6){
    p.mesh.position.x+=ux*squirt*0.045; p.mesh.position.z+=uz*squirt*0.045;
  }
  p.vrx=(p.vrx||0)+(Math.random()-0.5)*7; p.vrz=(p.vrz||0)+(Math.random()-0.5)*7;
  p.wobV=(p.wobV||0)+Math.min(9,2.5+impact*0.9);
  return true;
}

/* ---------- Crumbs: small jelly bits with real physics, mixed textures ---------- */
function spawnCrumbs(n,cx,cz,color,power,forceKind){
  var existing=0,i;
  for(i=0;i<pieces.length;i++) if(pieces[i].crumb) existing++;
  if(existing>=MAX_CRUMBS) return;
  n=Math.min(Math.round(n*spawnScale),MAX_CRUMBS-existing);
  for(i=0;i<n;i++){
    var kind=forceKind||TEX_KINDS[Math.floor(Math.random()*TEX_KINDS.length)];
    var size=0.08+Math.pow(Math.random(),0.6)*0.36; /* wide size spread: the big and medium ones can split again when pressed */
    var mat=jellyMat(color,undefined,kind);
    var g=new THREE.Group();
    var inner=new THREE.Group(); g.add(inner);
    var frag=makeMatFrag(kind,mat,size);
    var cm=frag.main; inner.add(frag.node);
    var ang=Math.random()*Math.PI*2, rad=0.55+Math.random()*0.75;
    g.position.set(cx+Math.cos(ang)*rad, BED_Y+0.3+Math.random()*0.35, cz+Math.sin(ang)*rad);
    scene.add(g);
    pieces.push({mesh:g,inner:inner,mat:mat,mainMesh:cm,shapeKind:frag.prop.kind,drawTop:frag.drawTop,bounce:0.40+Math.random()*0.30,permFlat:0,permWideX:0,permWideZ:0,sqSpreadX:0.40+Math.random()*0.55,sqSpreadZ:0.40+Math.random()*0.55,morphedThisPress:false,mini:false,crumb:true,kind:'crumb',color:color,texKind:kind,catType:currentType,baseScale:size,splitDepth:0,splitCooldown:0.4,r:size,
      vx:Math.cos(ang)*(1.0+Math.random()*(power+0.9)),vy:2.0+Math.random()*(power+0.7),vz:Math.sin(ang)*(1.0+Math.random()*(power+0.9)),
      rx:0,rz:0,vrx:(Math.random()-0.5)*15*physFor(kind).spin,vrz:(Math.random()-0.5)*15*physFor(kind).spin,
      wob:0,wobV:(2+Math.random()*3)*physFor(kind).wobble,held:false,restY:BED_Y+size*0.5,squashP:0});
    applyPhys(pieces[pieces.length-1],kind);
  }
}

/* ---------- Crumb cleanup: gradual opacity fade, never an instant delete ---------- */
function collectFadeMats(p){
  if(p.coherent){[p.mat,p.interior].forEach(function(m){m.userData.fadeBaseOpacity=m.opacity;m.transparent=true;m.depthWrite=false;});return [p.mat,p.interior];}
  var mats=[];
  function addMat(m){ if(m && mats.indexOf(m)<0) mats.push(m); }
  addMat(p.mat);
  p.mesh.traverse(function(o){
    if(!o.isMesh) return;
    if(o.material && o.material!==p.mat){
      /* eyes / nose on mini cats share global materials - clone per piece so
         fading one piece never fades the shared materials of other pieces */
      o.material=o.material.clone();
    }
    addMat(o.material);
  });
  mats.forEach(function(m){
    m.userData.fadeBaseOpacity=(m.opacity!==undefined? m.opacity:1);
    m.transparent=true;
    m.depthWrite=false;
    m.needsUpdate=true;
  });
  return mats;
}
function startCrumbCleanup(){
  if(crumbFadeActive) return;
  if(!pieces.length){ popCycle=0; return; }
  crumbFadeActive=true;
  pieces.forEach(function(p){
    p.fading=true; p.fadeT=0; p.held=false;
    p.fadeMats=collectFadeMats(p);
  });
  if(typeof dragPiece!=='undefined' && dragPiece && dragPiece.fading){
    dragPiece=null; dragInfo=null; canvas.classList.remove('grabbing');
  }
}

/* ---------- Recursive splitting: big and medium pieces split again ----------
   When the platen squashes a piece hard enough (handled in the play loop),
   a large piece breaks into 3 smaller ones and a medium piece into 2.
   Children keep the parent's colour, surface and - for mini clones - the
   parent cat's exact shape, only smaller, so a clone splits into smaller
   clones. Small pieces (r < 0.30) and anything past split depth 3 only
   flatten, which keeps the piece count and physics bounded. */
function buildSplitChild(p,childR,childBase,ang,i){
  var color=(p.color!==undefined?p.color:0xff4f92);
  var texKind=p.texKind||currentTex;
  var type=p.catType||currentType;
  var mat=jellyMat(color,undefined,texKind);
  var g=new THREE.Group();
  var inner=new THREE.Group(); g.add(inner);
  var isMini=!!p.mini;
  if(isMini){
    var bg=new THREE.Group(); bg.scale.setScalar(Math.max(0.18,childBase)); inner.add(bg);
    var jm=new THREE.Mesh(texKind==='diamond'? facetedCatGeometry(type) : catGeometry(type),mat); jm.castShadow=true; bg.add(jm);
    var f=FORMS[type];
    [-1,1].forEach(function(side){
      var eye=new THREE.Mesh(new THREE.SphereGeometry(0.095,10,8),eyeMat);
      eye.scale.set(1,1.06,0.42); eye.position.set(side*f.eyeX,f.eyeY,faceDepth(f,side*f.eyeX,f.eyeY)+.025);eye.userData.eye=true; bg.add(eye);
      var glint=new THREE.Mesh(new THREE.SphereGeometry(0.03,7,7),glintMat);
      glint.userData.glint=true;glint.position.set(side*f.eyeX+0.026,f.eyeY+0.04,faceDepth(f,side*f.eyeX,f.eyeY)+.095); bg.add(glint);
    });
    var nose=new THREE.Mesh(new THREE.SphereGeometry(0.07,10,8),noseMat);
    nose.scale.set(1.35,0.8,0.6); nose.position.set(0,f.noseY,faceDepth(f,0,f.noseY)+.02); bg.add(nose);
  } else {
    var fragC=makeMatFrag(texKind,mat,Math.max(0.12,childBase));
    var cm=fragC.main; inner.add(fragC.node);
  }
  g.position.set(
    p.mesh.position.x+Math.cos(ang)*0.28,
    Math.max(BED_Y+childR*0.6,p.mesh.position.y+0.12),
    p.mesh.position.z+Math.sin(ang)*0.28);
  scene.add(g);
  return {mesh:g,inner:inner,mat:mat,mainMesh:isMini?null:cm,shapeKind:isMini?null:fragC.prop.kind,drawTop:isMini?0:fragC.drawTop,bounce:0.40+Math.random()*0.30,permFlat:0,permWideX:0,permWideZ:0,sqSpreadX:0.40+Math.random()*0.55,sqSpreadZ:0.40+Math.random()*0.55,morphedThisPress:false,mini:isMini,crumb:!!p.crumb,kind:isMini?'mini':(p.crumb?'crumb':'blob'),
    color:color,texKind:texKind,catType:type,baseScale:childBase,clone:!!p.clone,
    pressTop:isMini? FORMS[type].height*Math.max(0.18,childBase) : 0,
    splitDepth:(p.splitDepth||0)+1,splitCooldown:0.55,r:childR,
    vx:Math.cos(ang)*(1.4+Math.random()*2.0),vy:2.6+Math.random()*1.9,vz:Math.sin(ang)*(1.4+Math.random()*2.0),
    rx:0,rz:0,vrx:(Math.random()-0.5)*12,vrz:(Math.random()-0.5)*12,
    wob:0,wobV:3+Math.random()*3,held:false,restY:isMini?BED_Y:BED_Y+childR*0.55,squashP:0};
}
function splitPiece(p){
  if(!p||p.fading||p.held) return false;
  if(pieces.length>MAX_PIECES) return false;
  var idx=pieces.indexOf(p); if(idx<0) return false;
  var count=p.r>=0.58?3:2;
  var factor=count===3?0.60:0.66;
  var childR=Math.max(0.15,p.r*factor);
  var parentBase=(p.baseScale!==undefined?p.baseScale:(p.mini?0.9:1));
  var childBase=parentBase*factor;
  var baseAng=Math.random()*Math.PI*2;
  pieces.splice(idx,1);
  scene.remove(p.mesh);
  if(dragPiece===p){ dragPiece=null; dragInfo=null; canvas.classList.remove('grabbing'); }
  if(p.mat&&p.mat.dispose) p.mat.dispose();
  for(var i=0;i<count;i++){
    pieces.push(buildSplitChild(p,childR,childBase,baseAng+(i/count)*Math.PI*2+Math.random()*0.4,i));
    applyPhys(pieces[pieces.length-1],p.texKind||currentTex);
  }
  /* a few tiny droplets sell the split */
  for(var d=0;d<3;d++){
    var dm=new THREE.Mesh(dropletGeo,jellyMat(p.color!==undefined?p.color:0xff4f92,undefined,p.texKind||'jelly')); dm.scale.setScalar(0.05+Math.random()*0.06);
    dm.position.set(p.mesh.position.x,BED_Y+0.5+Math.random()*0.3,p.mesh.position.z);
    scene.add(dm);
    droplets.push({mesh:dm,vx:(Math.random()-0.5)*5,vy:2.5+Math.random()*2.5,vz:(Math.random()-0.5)*5,life:0.9});
  }
  /* a splitting fragment breaks in ITS material's voice, not a jelly squelch */
  burstSound(p.texKind||'jelly',0.5); crackSound(p.texKind||'jelly',0.7);
  var nowMs=performance.now();
  if(nowMs-lastSplitToastAt>2600){ lastSplitToastAt=nowMs; toast(t('splitToast')); }
  return true;
}

function spawnCoherentFragments(h){
  while(pieces.length>MAX_PIECES-19)disposePiece(pieces.shift());
  var shell=h.mesh.userData.jelly,body=h.mesh.userData.bodyG;
  var center=h.soft?Array.from(h.soft.positions.slice(-3)):[0,h.form.oy,0];
  var groups=partitionCat(Array.from(shell.geometry.attributes.position.array),shell.geometry.index?Array.from(shell.geometry.index.array):Array.from({length:shell.geometry.attributes.position.count},function(_,i){return i;}),center,({glass:19,brick:11,diamond:9}[currentTex]||7));
  var massTotal=groups.reduce(function(sum,g){return sum+g.volume;},0);
  lastFracture={sourceVolume:massTotal,fragmentVolume:0,count:groups.length};
  body.updateWorldMatrix(true,false);
  groups.forEach(function(group){
    var geo=new THREE.BufferGeometry(),arr=Float32Array.from(group.faces),centroid=new THREE.Vector3();
    for(var i=0;i<arr.length;i+=3)centroid.add(new THREE.Vector3(arr[i],arr[i+1],arr[i+2]));
    centroid.multiplyScalar(3/arr.length);
    for(var i=0;i<arr.length;i+=3){arr[i]-=centroid.x;arr[i+1]-=centroid.y;arr[i+2]-=centroid.z;}
    geo.setAttribute('position',new THREE.BufferAttribute(arr,3));var uv=new Float32Array(arr.length/3*2),originalUV=shell.geometry.attributes.uv;for(var ui=0;ui<arr.length/3;ui++){if(ui<group.sourceIndices.length&&originalUV){uv[ui*2]=originalUV.getX(group.sourceIndices[ui]);uv[ui*2+1]=originalUV.getY(group.sourceIndices[ui]);}else{uv[ui*2]=arr[ui*3];uv[ui*2+1]=arr[ui*3+2];}}geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.computeVertexNormals();
    var sourceNormals=shell.geometry.attributes.normal,fragmentNormals=geo.attributes.normal;group.sourceIndices.forEach(function(index,i){fragmentNormals.setXYZ(i,sourceNormals.getX(index),sourceNormals.getY(index),sourceNormals.getZ(index));});
    geo.computeBoundingSphere();
    var mat=jellyMat(h.form.color,undefined,currentTex);if(currentTex!=='brick')mat.map=null;mat.color.copy(displayColor(currentTex,h.form.color));mat.userData.uJiggle.value=0;mat.needsUpdate=true;
    var innerMat=mat.clone();innerMat.map=null;innerMat.bumpMap=null;innerMat.roughness=currentTex==='glass'?.06:currentTex==='diamond'?.1:currentTex==='brick'?.98:.38;innerMat.emissive.set(h.form.color);innerMat.emissiveIntensity=(currentTex==='brick'||currentTex==='glass')?0:.16;innerMat.transmission=(mat.transmission||0)*.7;
    geo.clearGroups();geo.addGroup(0,group.outer*3,0);geo.addGroup(group.outer*3,arr.length/3-group.outer*3,1);
    var mesh=new THREE.Mesh(geo,[mat,innerMat]);mesh.scale.copy(body.getWorldScale(new THREE.Vector3()));mesh.quaternion.copy(body.getWorldQuaternion(new THREE.Quaternion()));mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.position.copy(centroid).applyMatrix4(body.matrixWorld);scene.add(mesh);
    var localIndex=h.soft?h.soft.nearest([centroid.x,centroid.y,centroid.z]):0,sv=h.soft?h.soft.velocities:new Float64Array([h.vx||0,0,h.vz||0]);
    var relative=new THREE.Vector3(centroid.x-center[0],centroid.y-center[1],centroid.z-center[2]);
    var outward=new THREE.Vector3(relative.x,0,relative.z).normalize(),release=Math.min(1.8,.35+(h.soft?h.soft.strain:.5))/Math.sqrt(h.soft?h.soft.preset.density:MAT_DENS[currentTex]);
    var angular=new THREE.Vector3().crossVectors(relative,new THREE.Vector3(sv[localIndex*3],sv[localIndex*3+1],sv[localIndex*3+2])).multiplyScalar(1/Math.max(.2,relative.lengthSq()));
    pieces.push({coherent:true,mesh:mesh,mat:mat,interior:innerMat,volume:group.volume,mass:group.volume/massTotal,
      collisionR:Math.cbrt(group.volume*3/(4*Math.PI))*h.form.scale*catSize*.65,vx:sv[localIndex*3]*h.form.scale*catSize+outward.x*release,vy:Math.min(2,sv[localIndex*3+1]*h.form.scale*catSize)+(currentTex==='brick'?.06:.3),vz:sv[localIndex*3+2]*h.form.scale*catSize+outward.z*release,
      vrx:Math.max(-4,Math.min(4,angular.x+outward.z*release)),vrz:Math.max(-4,Math.min(4,angular.z-outward.x*release)),r:geo.boundingSphere.radius*h.form.scale*catSize,held:false,restY:BED_Y,texKind:currentTex,wob:0,wobV:0});
    lastFracture.fragmentVolume+=group.volume;
  });window.dispatchEvent(new CustomEvent('catjelly:fracture',{detail:Object.assign({},lastFracture)}));
}
var dynamics=new CatDynamics(THREE,scene);
var lastFracture=null;var fracturePulse=new THREE.PointLight(0xffb9a3,0,7,2);fracturePulse.position.set(0,BED_Y+1,1);scene.add(fracturePulse);
function updateCoherentPieces(dt){
  var box=new THREE.Box3(),expired=[];
  pieces.forEach(function(p){
    if(!p.coherent||p.held)return;p.interior.emissiveIntensity*=Math.exp(-3*dt);
    if(p.fading){p.fadeT+=dt;var alpha=Math.max(0,1-p.fadeT/CRUMB_FADE_SEC);p.mat.opacity=alpha;p.interior.opacity=alpha;if(alpha<=0){expired.push(p);return;}}
    p.vy-=9.81*dt;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;
    p.mesh.rotation.x+=p.vrx*dt;p.mesh.rotation.z+=p.vrz*dt;
    p.mesh.updateMatrixWorld(true);box.setFromObject(p.mesh);
    var floorY=Math.hypot(p.mesh.position.x,p.mesh.position.z)<3.4?BED_Y:0;
    if(box.min.y<floorY){p.mesh.position.y+=floorY-box.min.y;p.vy=Math.abs(p.vy)>.5?Math.abs(p.vy)*.18:0;p.vx*=Math.exp(-5*dt);p.vz*=Math.exp(-5*dt);p.vrx*=Math.exp(-8*dt);p.vrz*=Math.exp(-8*dt);}
    if(Math.hypot(p.mesh.position.x,p.mesh.position.z+.1)<PLATEN_R-.25&&box.max.y>platenBottom()){
      p.mesh.position.y-=box.max.y-platenBottom();p.vy=Math.min(p.vy,platenVelY);
      // A settled wedge is pushed outward when its height cannot fit the gap.
      if(box.max.y-box.min.y>platenBottom()-floorY){var angle=Math.atan2(p.mesh.position.z+.1,p.mesh.position.x);p.vx+=Math.cos(angle)*dt*6;p.vz+=Math.sin(angle)*dt*6;p.mesh.position.y=Math.max(p.mesh.position.y,floorY+(box.max.y-box.min.y)/2);p.vy=Math.max(0,p.vy);}
    }
  });
  expired.forEach(function(p){var i=pieces.indexOf(p);if(i>=0)pieces.splice(i,1);disposePiece(p);});
  if(crumbFadeActive&&!pieces.some(function(p){return p.fading;})){crumbFadeActive=false;popCycle=0;}
  // ponytail: conservative per-piece spheres; replace with convex hull contacts for stacked fragments.
  for(var i=0;i<pieces.length;i++)for(var j=i+1;j<pieces.length;j++){
    var a=pieces[i],b=pieces[j];if(!a.coherent||!b.coherent)continue;
    var delta=new THREE.Vector3().subVectors(b.mesh.position,a.mesh.position),distance=delta.length(),reach=a.collisionR+b.collisionR;
    if(distance<1e-6||distance>=reach)continue;delta.multiplyScalar(1/distance);
    var wa=a.held?0:1/a.mass,wb=b.held?0:1/b.mass,total=wa+wb;if(!total)continue;
    var correction=Math.min(.035,reach-distance);
    a.mesh.position.addScaledVector(delta,-correction*wa/total);b.mesh.position.addScaledVector(delta,correction*wb/total);
    var closing=(b.vx-a.vx)*delta.x+(b.vy-a.vy)*delta.y+(b.vz-a.vz)*delta.z;
    if(closing<0){var impulse=-1.18*closing/total;a.vx-=delta.x*impulse*wa;a.vy-=delta.y*impulse*wa;a.vz-=delta.z*impulse*wa;b.vx+=delta.x*impulse*wb;b.vy+=delta.y*impulse*wb;b.vz+=delta.z*impulse*wb;}
  }

}
function disposePiece(p){
  scene.remove(p.mesh);
  if(p.coherent){p.mesh.geometry.dispose();p.mat.dispose();p.interior.dispose();}
  else {p.mat.dispose();}
}
function clearAllEffects(){
  dynamics.clear();
  clearPieces();
  [dusts,waterStreams,waterfalls,ripples,vacFx].forEach(function(list){list.forEach(function(e){if(e.piece){disposePiece(e.piece);return;}scene.remove(e.mesh||e.grp);if(e.mat&&e.mat!==waterDropMatShared)e.mat.dispose();});list.length=0;});
  puddles.forEach(function(p){scene.remove(p.mesh);});puddles=[];
  hearts.forEach(function(h){scene.remove(h);h.geometry.dispose();h.material.dispose();});hearts=[];
  vacuuming=false;vacPending=null;crumbFadeActive=false;popCycle=0;lastFracture=null;
  machineBroken=false;brokenT=0;platenRecoil=false;pressShake=0;raising=false;platenVelY=0;fracturePulse.intensity=0;$('verdict').classList.remove('show');
  $('brokenBanner').classList.remove('show');document.querySelector('.deck').classList.remove('broken');
}

/* ---------- The pop: hero becomes grabbable jelly pieces ---------- */
function burst(){
  if(!reduced){fracturePulse.color.set(hero.form.color);fracturePulse.intensity=14;fracturePulse.position.set(hero.mesh.position.x,BED_Y+1,hero.mesh.position.z+1);}
  var form=hero.form, barNow=Math.round(pressure), heightPct=Math.max(8,Math.round(100*(1-squash)));
  popTotal++; $('popCount').textContent=popTotal;
  popCycle++;
  burstSound(currentTex); setHum(false,0);
  var cx=hero.mesh.position.x, cz=hero.mesh.position.z;
  var color=form.color;
  var kind=currentTex;
  /* the crack network this cat actually grew, captured before the
     mesh goes away: the burst reuses its surface points below, so
     fragments break out along the lines that cracked */
  var crackPts=(hero.crack&&hero.crack.userData.surfacePts)?hero.crack.userData.surfacePts:[];
  /* this cat's Voronoi fracture cells and its own physics, captured
     before the mesh goes away: the burst below is seeded by the
     cat's seed and breaks along these cells, in this cat's style */
  var voroCells=(hero.voro&&hero.voro.length)?hero.voro:((hero.crack&&hero.crack.userData.voroCells)?hero.crack.userData.voroCells:[]);
  var burstFp=hero.fp||formPhys(currentType);
  var burstRng=mulberry32((hero.seed||987654)^0x77cd);
  var coherent=kind==='jelly'||kind==='glass'||kind==='brick'||kind==='diamond';
  if(coherent)spawnCoherentFragments(hero);if(kind==='brick')spawnDust(20,cx,BED_Y+.5,cz,kind,color,1.2);
  if(!reduced)dynamics.emit({x:cx,y:Math.min(platenBottom()-.1,BED_Y+1),z:cz},Math.min(3,1+(hero.soft?hero.soft.strain:.5)),color,'fracture');
  disposeHero(hero);
  /* The burst itself is material-specific - shape, weight and debris:
     - water:   no solid pieces at all, only a splash of droplets
     - glass:   sharp transparent shards, light, barely any bounce
     - iron:    a few heavy metal chunks that drop fast and thud
     - diamond: faceted crystal shards, hard and sparkly
     - brick:   brick boxes plus a spray of brick dust crumbs
     - lego:    studded toy bricks plus loose studs
     - jelly:   the classic torn gel chunks and crumbs, full wobble   */
  if(coherent){ /* closed pieces of the actual deformed source surface */ }else if(kind==='water'){
    /* the whole balloon becomes moving water, in proportion to how much
       water it actually held (volume = size cubed x density): a splash
       of droplets sized by the cat, a puddle whose AREA follows that
       volume, rivulets running outward across the bed, and ripples */
    var wVol=waterVolumeFactor();
    var wn=Math.max(16,Math.min(115,Math.round((14+34*wVol)*spawnScale)));
    for(var wd=0;wd<wn;wd++){
      var wi=Math.floor(burstRng()*(hero.soft.positions.length/3-1))*3,sp=hero.soft.positions,sv=hero.soft.velocities;
      var origin=new THREE.Vector3(sp[wi],sp[wi+1],sp[wi+2]).applyMatrix4(hero.mesh.userData.bodyG.matrixWorld);
      var drop=spawnWaterDroplet(origin.x,origin.y,origin.z,sv[wi]*form.scale*catSize+(burstRng()-.5)*3,Math.min(2,sv[wi+1])+burstRng()*2,sv[wi+2]*form.scale*catSize+(burstRng()-.5)*3,(.05+burstRng()*.08)*catSize,2.5);
      if(drop)drop.wetRadius=puddleRadiusForVolume(wVol)/Math.sqrt(wn);
    }
    var wPR=puddleRadiusForVolume(wVol);
    spawnRipple(cx,cz,Math.min(1.8,wPR),false);
    var nStreams=4+Math.round(Math.min(3,wVol));
    for(var ws=0;ws<nStreams;ws++){
      var wAng=Math.random()*Math.PI*2;
      spawnFlowStream(cx,cz,wAng,wPR*(0.65+Math.random()*0.5),0.17+Math.random()*0.15,false,8);
    }
  } else {
    for(var d=0;d<Math.round(16*spawnScale);d++){
      var dm=new THREE.Mesh(dropletGeo,jellyMat(color,undefined,kind)); dm.scale.setScalar(0.07+Math.random()*0.1);
      dm.position.set(cx, BED_Y+0.7+Math.random()*0.8, cz);
      scene.add(dm);
      droplets.push({mesh:dm,vx:(Math.random()-0.5)*7,vy:3.5+Math.random()*4,vz:(Math.random()-0.5)*7,life:1.1});
    }
    var sizesByKind={
      jelly:[1.11,0.95,0.83,0.69,0.57,0.45,0.33],
      glass:[0.58,0.50,0.44,0.38,0.31,0.24,0.18],
      iron:[0.62,0.52,0.44],
      diamond:[0.52,0.46,0.40,0.33,0.27],
      brick:[0.66,0.56,0.47,0.38],
      lego:[0.60,0.52,0.44,0.36]
    };
    /* Fragment count AND size follow the cat: a bigger cat (volume =
       size cubed) breaks into proportionally more, larger pieces; a
       small cat into fewer, smaller ones. Density adds a little more
       debris mass on top. */
    var sizes=sizesByKind[kind]||sizesByKind.jelly;
    var volF=sizeVolume();
    var countF=Math.max(0.45,Math.min(2.1,volF))*(0.75+0.25*density)*burstFp.fragN;
    var nPieces=Math.max(2,Math.round(sizes.length*countF));
    for(var pi=0;pi<nPieces;pi++){
      var sBase=sizes[Math.min(sizes.length-1,Math.floor(pi/Math.max(1,countF)))];
      var np2=spawnMatPiece(kind,color,sBase*catSize*(0.9+burstRng()*0.2),cx,cz);
      /* fragment bounce is the cat's own: Pudding plates thud and
         stay, Mochi chunks bounce, Soda pieces tumble on */
      np2.bounce=Math.max(0.03,np2.bounce*(burstFp.fragBounce/0.5));
      /* the first pieces are born AT this cat's Voronoi cells - on
         the crown rim where the platen bore down, over the ears,
         cheeks and flanks - and fly outward from their own cell, so
         the body visibly separates along its fracture pattern */
      if(voroCells.length && pi<voroCells.length){
        var vcell=voroCells[pi], vsc=form.scale*catSize;
        np2.mesh.position.set(cx+vcell.x*vsc,Math.max(BED_Y+0.35,BED_Y+vcell.y*vsc),cz+vcell.z*vsc);
        np2.vx=vcell.x*2.4; np2.vy=1.6+burstRng()*1.8; np2.vz=vcell.z*2.4;
      }
    }
    var crumbN=Math.round(({jelly:38,glass:26,diamond:14,iron:6,brick:30,lego:10}[kind]||20)*countF);
    spawnCrumbs(crumbN,cx,cz,color,3.6,kind);
    /* every burst throws off dust of the broken material itself */
    spawnDust(kind==='jelly'?10:16,cx,BED_Y+1.0,cz,kind,color,2.4);
    /* Fragments follow the crack lines: when this cat had really
       cracked (damage past ~30%), extra shards are seeded ON the
       surface points its crack branches ran through - ears, face,
       cheeks, flanks included - so the break visibly opens along the
       network that grew on it, not at random spots. */
    if(crackLevel>0.3 && (crackPts.length>4||voroCells.length>3) && kind!=='jelly'){
      var nShards=Math.min(7,3+Math.floor(crackLevel*4));
      var cellSource=voroCells.length?voroCells:crackPts;
      for(var csi=0;csi<nShards;csi++){
        if(pieces.length>=MAX_PIECES) break;
        var cpt=cellSource[csi%cellSource.length];
        var csc=form.scale*catSize;
        var shardP=spawnMatPiece(kind,color,0.15+Math.random()*0.13,cx,cz);
        shardP.mesh.position.set(cx+cpt.x*csc,Math.max(BED_Y+0.3,BED_Y+cpt.y*csc),cz+cpt.z*csc);
        shardP.vx=(Math.random()-0.5)*3.2; shardP.vy=1.2+Math.random()*2.0; shardP.vz=(Math.random()-0.5)*3.2;
      }
    }
  }
  hero=null; mode='play';
  $('caption').textContent=t('playCaption');
  $('subcaption').textContent=t('playSub');
  syncSideNote();
  var v=t('verdicts')[form.verdict];
  $('verdictWord').textContent=v;
  $('verdictStat').textContent=t('stat').replace('{bar}',barNow).replace('{pct}',heightPct);
  var vel=$('verdict'); vel.classList.add('show');
  setTimeout(function(){ vel.classList.remove('show'); },2600);
  toast(t('poppedToast').replace('{name}',form.label).replace('{bar}',barNow));
  /* Only the 20th pop in the cycle cleans up: every chunk and crumb left by
     those 20 cats now fades away gradually instead of vanishing at once.
     Pops 1-19 leave all debris exactly where it landed. */
  if(popCycle>=CRUMB_CYCLE) startCrumbCleanup();
}

/* ---------- Controls ---------- */
var holdBtn=$('holdBtn');
function startHold(e){ if(e) e.preventDefault(); if(machineBroken) return; ensureAudio(); holding=true; holdBtn.classList.add('held');if(e&&e.pointerId!==undefined){try{holdBtn.setPointerCapture(e.pointerId);}catch(error){}} }
function endHold(){ holding=false; holdBtn.classList.remove('held'); setHum(false,0); }
holdBtn.addEventListener('pointerdown',startHold);
holdBtn.addEventListener('lostpointercapture',endHold);
holdBtn.addEventListener('keydown',function(e){if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(!e.repeat)startHold();}});
holdBtn.addEventListener('keyup',function(e){if(e.code==='Space'||e.code==='Enter'){e.preventDefault();endHold();}});
window.addEventListener('pointerup',endHold);
/* Never leave the motor engaged after a canceled touch, lost focus or tab switch. */
window.addEventListener('pointercancel',endHold);
window.addEventListener('blur',endHold);
document.addEventListener('visibilitychange',function(){ if(document.hidden) endHold(); });
holdBtn.addEventListener('pointerleave',function(){ if(holding) endHold(); });
$('raiseBtn').addEventListener('click',function(){ ensureAudio(); raising=true; setTimeout(function(){ raising=false; },700); });
document.querySelectorAll('.tex-btn').forEach(function(b){
  if(b.classList.contains('size-btn')) return;
  b.addEventListener('click',function(){ ensureAudio(); applyTexture(b.getAttribute('data-tex')); });
});
function applyTexture(kind){
  /* Changing material REGENERATES a fresh, whole cat of the current
     type, right here - no need to switch to another cat first. Same
     when re-picking the current cat chip: setHero always builds a new
     full-height cat, resets the press and clears the squash. */
  setHero(currentType,kind);
  platenY=PLATEN_TOP;
  toast(t('newCatToast').replace('{name}',FORMS[currentType].label));
}
/* Cat size: presets S / M / L / XL plus a fine slider, 70% to 150%.
   Applies live to the cat on the bed (body scale, so the press contact
   height in the main loop follows), and to the next cats and their clones. */
function setCatSize(factor,fromSlider){
  catSize=Math.max(0.7,Math.min(1.5,factor||1));
  var pct=Math.round(catSize*100);
  if(!fromSlider && $('sizeRange')) $('sizeRange').value=pct;
  if(fromSlider && $('sizeRange')) $('sizeRange').value=pct;
  if($('sizeVal')) $('sizeVal').textContent=pct+'%';
  document.querySelectorAll('.size-btn').forEach(function(b){
    b.classList.toggle('active',Math.abs(parseFloat(b.getAttribute('data-size'))-catSize)<0.03);
  });
  if(hero && hero.mesh.userData.bodyG){
    hero.mesh.userData.bodyG.scale.setScalar(hero.form.scale*catSize);
    hero.wobV+=3.5; squelch();
  }
  updateMatStats();
}
document.querySelectorAll('.size-btn').forEach(function(b){
  b.addEventListener('click',function(){ ensureAudio(); setCatSize(parseFloat(b.getAttribute('data-size')),false); });
});
if($('sizeRange')) $('sizeRange').addEventListener('input',function(){ setCatSize(parseInt(this.value,10)/100,true); });
/* Machine max pressure: how much load the press itself can deliver.
   Below a material's required pressure the press strains and blows. */
if($('machRange')) $('machRange').addEventListener('input',function(){
  machineMax=parseInt(this.value,10);
  if($('machVal')) $('machVal').textContent=machineMax+' bar';
  updateMatStats();
  /* the user just changed the highlighted control: if it is enough now
     the highlight is already cleared by checkInsufficient; if it is
     still short, let the pulse wind down quickly instead of nagging */
  if(requiredPressure(currentTex)>machineCap()) flashNeedHighlight(2200);
});
/* Material density: feeds required pressure, mass, hardness, fragment
   physics and fragment count - the material's whole stat sheet. */
if($('densRange')) $('densRange').addEventListener('input',function(){
  density=parseInt(this.value,10)/100;
  if($('densVal')) $('densVal').textContent=Math.round(density*100)+'%';
  if(hero) hero.wobV+=2;
  updateMatStats();
});
/* ---------- Gen cat: the ONE action button ----------
   Rolls everything at once: a random cat type, a random surface
   (setHero randomizes it when no surface is pinned), a random size
   and a random density. The surface / size / density controls are
   then synced to the rolled values, so required pressure, mass,
   fragment physics and counts all keep computing from the real
   numbers - they just no longer need long stat rows to show them. */
function genRandomCat(){
  ensureAudio();
  var types=['mochi','pudding','soda','tabby'];
  var type=types[Math.floor(Math.random()*types.length)];
  density=Math.round((0.6+Math.random()*1.2)*10)/10; /* 60% to 180% */
  if($('densRange')) $('densRange').value=Math.round(density*100);
  if($('densVal')) $('densVal').textContent=Math.round(density*100)+'%';
  setHero(type); /* fresh cat, random surface */
  setCatSize(Math.round((0.8+Math.random()*0.7)/0.05)*0.05,false); /* 80% to 150% */
  platenY=PLATEN_TOP;
  toast(t('newCatToast').replace('{name}',FORMS[type].label));
}
$('genBtn').addEventListener('click',genRandomCat);
$('vacBtn').addEventListener('click',function(){ startVacuum(); });
/* ---------- Backpack: money, vacuumed crumbs and the machine shelf ---------- */
function updateBagUI(){ var l=$('bagLbl'); if(l) l.textContent=t('bagTxt')+' · $'+money; }
function selectMachine(id){
  activeMachine=id; applyMachineTheme(); updateMatStats(); updateBagUI(); renderBag();
}
function buyMachine(m){
  if(money<m.cost||ownedMachines[m.id]) return;
  money-=m.cost; ownedMachines[m.id]=true;
  selectMachine(m.id);
  toast(t('boughtToast').replace('{name}',t('machines')[MACHINES.indexOf(m)-1]));
}
function renderBag(){
  var moneyEl=$('bagMoney'); if(moneyEl) moneyEl.textContent='$'+money;
  var vacEl=$('bagVac'); if(vacEl) vacEl.textContent=t('vacLbl')+': '+vacuumedCount+' · +$'+vacuumedEarned;
  var list=$('bagList'); if(!list) return;
  list.innerHTML='';
  var names=t('machines');
  MACHINES.forEach(function(m,idx){
    var row=document.createElement('div'); row.className='bag-row'+(activeMachine===m.id?' active':'');
    var sw=document.createElement('span'); sw.className='bag-swatch'; sw.style.background=m.swatch||'#999'; sw.style.color=m.swatch||'#999'; row.appendChild(sw);
    var info=document.createElement('div');
    var nm=document.createElement('div'); nm.className='bag-name'; nm.textContent=idx===0?({en:'Studio',vi:'Phòng thí nghiệm',es:'Estudio',zh:'实验室'}[lang]):names[idx-1];
    var st=document.createElement('div'); st.className='bag-stats'; st.textContent=t('powerTxt')+' +'+m.bonus+' bar · '+t('speedTxt')+' x'+m.speed;
    info.appendChild(nm); info.appendChild(st);
    var btn=document.createElement('button'); btn.className='bag-act';
    if(activeMachine===m.id){ btn.textContent=t('activeTxt'); btn.disabled=true; }
    else if(ownedMachines[m.id]){ btn.textContent=t('useTxt'); btn.addEventListener('click',function(){ selectMachine(m.id); }); }
    else { btn.textContent=t('buyTxt')+' $'+m.cost; btn.disabled=money<m.cost; btn.addEventListener('click',function(){ buyMachine(m); }); }
    row.appendChild(info); row.appendChild(btn); list.appendChild(row);
  });
}
$('bagBtn').addEventListener('click',function(){
  var p=$('bagPanel'); p.hidden=!p.hidden; if(!p.hidden) renderBag();
});
$('bagClose').addEventListener('click',function(){ $('bagPanel').hidden=true; });
renderBag(); updateBagUI(); applyMachineTheme();
$('resetBtn').addEventListener('click',function(){ ensureAudio(); endHold(); clearAllEffects(); setHero(currentType,currentTex,currentSeed); platenY=PLATEN_TOP; toast(t('resetToast')); });
$('soundBtn').addEventListener('click',function(){
  soundOn=!soundOn; this.classList.toggle('on',soundOn);
  if(!soundOn) setHum(false,0); else ensureAudio();
});
document.querySelectorAll('.lang-btn').forEach(function(b){
  b.addEventListener('click',function(){
    langManual=true;
    lang=b.getAttribute('data-lang'); document.documentElement.lang=(lang==='zh'?'zh-CN':lang);
    document.querySelectorAll('.lang-btn').forEach(function(x){ x.classList.toggle('active',x===b); });
    applyLang();
  });
});
function applyLang(){
  applyLabLang();
  $('subtitle').textContent=t('subtitle'); $('countLbl').textContent=t('count');
  $('soundLbl').textContent=t('sound'); $('resetLbl').textContent=t('reset');
  holdBtn.textContent=t('hold'); $('raiseBtn').textContent=t('raise'); $('barLbl').textContent=t('pressure');
  $('genBtn').textContent=t('genCat');
  $('vacBtn').textContent=t('vacTxt');
  $('bagTitle').textContent=t('bagTxt'); $('bagMoneyLbl').textContent=t('moneyTxt');
  updateBagUI(); renderBag();
  $('texLbl').textContent=t('texLabel');
  if($('sizeLbl')) $('sizeLbl').textContent=t('sizeLabel');
  if($('machLbl')) $('machLbl').textContent=t('machLabel');
  if($('densLbl')) $('densLbl').textContent=t('densLabel');
  updateMatStats();
  document.querySelectorAll('.tex-btn').forEach(function(b){ if(b.classList.contains('size-btn')) return; b.textContent=t('tex_'+b.getAttribute('data-tex')); });
  if(mode==='play'){ $('caption').textContent=t('playCaption'); $('subcaption').textContent=t('playSub'); syncSideNote(); }
  else setCaption(captionStage());
}
window.addEventListener('keydown',function(e){
  if(e.key==='Escape'){document.body.classList.remove('photo');return;}
  if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;
  if(e.code==='Space'||e.code==='ArrowDown'){ e.preventDefault(); if(!holding) startHold(); }
  if(e.code==='ArrowUp'){ e.preventDefault(); raising=true; setTimeout(function(){ raising=false; },500); }
  if(e.code==='KeyR') $('resetBtn').click();
});
window.addEventListener('keyup',function(e){ if(e.code==='Space'||e.code==='ArrowDown') endHold(); });

/* ---------- Pointer: orbit camera + grab and fling pieces ---------- */
var ray=new THREE.Raycaster(), mouseV=new THREE.Vector2();
var pointers={}, dragPiece=null, dragHero=false, dragInfo=null;
var dragPlane=new THREE.Plane(), dragHit=new THREE.Vector3();
function castRay(e){
  var r=canvas.getBoundingClientRect();
  mouseV.x=((e.clientX-r.left)/r.width)*2-1; mouseV.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(mouseV,camera);
}
function pickPiece(e){
  castRay(e);
  var targets=[];
  pieces.forEach(function(p){ p.mesh.traverse(function(o){ if(o.isMesh){ o.userData.pieceRef=p; targets.push(o); } }); });
  if(hero) hero.mesh.traverse(function(o){ if(o.isMesh){ o.userData.heroRef=true; targets.push(o); } });
  var hits=ray.intersectObjects(targets,false);
  if(!hits.length) return null;
  if(hits[0].object.userData.pieceRef) return {piece:hits[0].object.userData.pieceRef,point:hits[0].point};
  if(hits[0].object.userData.heroRef) return {hero:true,point:hits[0].point};
  return null;
}
canvas.addEventListener('pointerdown',function(e){
  ensureAudio();
  pointers[e.pointerId]={x:e.clientX,y:e.clientY,t:performance.now()};
  if(Object.keys(pointers).length===1){
    var hit=pickPiece(e);
    if(hit && hit.piece){
      var p=hit.piece; p.held=true; p.vy=0; p.sleeping=false; p.sleepT=0;
      dragPlane.set(new THREE.Vector3(0,0,1),0);
      /* drag on a camera-facing plane through the grab point */
      var n=camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-1);
      dragPlane.setFromNormalAndCoplanarPoint(n,hit.point);
      dragInfo={id:e.pointerId,off:new THREE.Vector3().subVectors(p.mesh.position,hit.point),lastX:e.clientX,lastY:e.clientY,lastT:performance.now(),vx:0,vz:0,moved:false};
      dragPiece=p; p.wobV+=3; squelch();
      canvas.classList.add('grabbing');
    } else if(hit && hit.hero && hero){
      if(squash>0.3){ hero.wobV+=9; plop(1); spawnHearts(hero.mesh.position); }
      else {
        dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),hit.point);
        if(hero.soft){
          hero.mesh.updateMatrixWorld(true);
          var local=hero.mesh.userData.bodyG.worldToLocal(hit.point.clone());
          hero.soft.grab={index:hero.soft.nearest([local.x,local.y,local.z]),target:[local.x,local.y,local.z]};
          dragInfo={id:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false,vx:0,vz:0};
          dragHero=true;hero.held=true;canvas.classList.add('grabbing');
        }

      }
    }
  }
  if(Object.keys(pointers).length===2){
    if(dragPiece){ dragPiece.held=false; dragPiece=null; dragInfo=null; canvas.classList.remove('grabbing'); }
    if(dragHero&&hero){ if(hero.soft)hero.soft.grab=null;hero.held=false; hero.vx=0; hero.vz=0; dragHero=false; dragInfo=null; canvas.classList.remove('grabbing'); }
  }
  try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
});
canvas.addEventListener('pointermove',function(e){
  if(!pointers[e.pointerId]) return;
  var prev=pointers[e.pointerId];
  var dx=e.clientX-prev.x, dy=e.clientY-prev.y;
  pointers[e.pointerId]={x:e.clientX,y:e.clientY,t:performance.now()};
  if(dragPiece && dragInfo && dragInfo.id===e.pointerId){
    dragInfo.moved=true;
    castRay(e);
    if(ray.ray.intersectPlane(dragPlane,dragHit)){
      var target=dragHit.clone().add(dragInfo.off);
      target.y=Math.max(dragPiece.restY,target.y);
      var now=performance.now(), dtm=Math.max(16,now-dragInfo.lastT);
      dragInfo.vx=(target.x-dragPiece.mesh.position.x)/(dtm/1000)*0.55;
      dragInfo.vz=(target.z-dragPiece.mesh.position.z)/(dtm/1000)*0.55;
      dragInfo.lastT=now;
      dragPiece.mesh.position.lerp(target,0.55);
      dragPiece.wobV+=Math.hypot(dx,dy)*0.02;
    }
    return;
  }
  if(dragHero && hero && dragInfo && dragInfo.id===e.pointerId){
    if(Math.hypot(e.clientX-dragInfo.startX,e.clientY-dragInfo.startY)>6) dragInfo.moved=true;
    castRay(e);
    if(ray.ray.intersectPlane(dragPlane,dragHit)){
      if(hero.soft&&hero.soft.grab){
        var local=hero.mesh.userData.bodyG.worldToLocal(dragHit.clone());
        hero.soft.grab.target=[Math.max(-2.2,Math.min(2.2,local.x)),Math.max(.12,Math.min(5,local.y)),Math.max(-2.2,Math.min(2.2,local.z))];
      }

    }
    return;
  }
  if(!dragPiece&&!dragHero&&Object.keys(pointers).length===1){camHome.theta-=dx*.005;camHome.phi=Math.max(.6,Math.min(1.45,camHome.phi+dy*.003));}
});
function endPointer(e){
  if(dragPiece && dragInfo && dragInfo.id===e.pointerId){
    dragPiece.held=false;
    dragPiece.vx=Math.max(-11,Math.min(11,dragInfo.vx));
    dragPiece.vz=Math.max(-11,Math.min(11,dragInfo.vz));
    dragPiece.vy=1.5; dragPiece.wobV+=5;
    dragPiece=null; dragInfo=null; canvas.classList.remove('grabbing');
  }
  if(dragHero && hero && dragInfo && dragInfo.id===e.pointerId){
    hero.held=false;if(hero.soft){hero.soft.grab=null;if(!dragInfo.moved)hero.soft.impulse([0,hero.form.eyeY,hero.form.eyeZ],[0,3,1]);}
    if(!dragInfo.moved){ hero.wobV+=9; plop(1); spawnHearts(hero.mesh.position); hero.vx=0; hero.vz=0; }
    else { hero.vx=Math.max(-8,Math.min(8,dragInfo.vx)); hero.vz=Math.max(-8,Math.min(8,dragInfo.vz)); hero.wobV+=4+(hero.shake||0)*7; }
    dragHero=false; dragInfo=null; canvas.classList.remove('grabbing');
  }
  delete pointers[e.pointerId];
}
window.addEventListener('blur',function(){if(hero&&hero.soft)hero.soft.grab=null;dragHero=false;dragPiece=null;dragInfo=null;pointers={};canvas.classList.remove('grabbing');});
canvas.addEventListener('lostpointercapture',endPointer);
canvas.addEventListener('pointerup',endPointer);
canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('wheel',function(e){ e.preventDefault();camHome.dist=Math.max(10,Math.min(23,camHome.dist+e.deltaY*.008)); },{passive:false});
/* camera locked: no orbit, no pinch zoom, no double-click reset */

/* hearts on poke */
var hearts=[];
function spawnHearts(pos){
  if(hearts.length>=40)return;
  if(typeof qLevel!=='undefined' && qLevel>=3) return;
  for(var i=0;i<6;i++){
    var h=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,8),new THREE.MeshBasicMaterial({color:0xe5322d,transparent:true,opacity:0.95}));
    h.scale.set(1,0.9,0.5); h.position.set(pos.x,pos.y+2.2,pos.z);
    h.userData.v=new THREE.Vector3((Math.random()-0.5)*2,1.5+Math.random(),(Math.random()-0.5)*2);
    h.userData.life=1; scene.add(h); hearts.push(h);
  }
}

/* ---------- Gauge dial ---------- */
var CIRC=2*Math.PI*51, dialVal=$('dialVal'), dialRed=$('dialRed'), dialSvg=$('dialSvg');
dialVal.style.strokeDasharray=CIRC; dialVal.style.strokeDashoffset=CIRC;
dialRed.style.strokeDasharray=CIRC; dialRed.style.strokeDashoffset=CIRC*(1-0.25*0.75);
function setGauge(bar){
  var frac=Math.max(0,Math.min(1,bar/Math.max(600,machineCap())));
  dialVal.style.strokeDashoffset=CIRC*(1-frac*0.75);
  $('barNum').textContent=Math.round(bar);
  dialSvg.setAttribute('aria-valuenow',Math.round(bar));
}

/* ---------- Resize ---------- */
function resize(){
  renderer.setSize(window.innerWidth,window.innerHeight,false);
  camera.aspect=window.innerWidth/window.innerHeight;camera.fov=window.innerWidth<681?53:40;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize); resize();

/* ---------- Adaptive quality governor ----------
   Measures real fps over ~1.25s windows. If it stays under ~42fps it
   steps quality down (and never back up mid-session, so it cannot
   oscillate): L1 lower pixel ratio, L2 smaller shadow map + fewer
   spawned crumbs, L3 shadows off + lowest pixel ratio. */
var qLevel=0, fpsFrames=0, fpsTime=0;
function applyQuality(level){
  qLevel=level;
  var dpr=window.devicePixelRatio||1;
  if(level===1){
    renderer.setPixelRatio(Math.min(dpr, isMobilePerf?1.0:1.3));
  } else if(level===2){
    renderer.setPixelRatio(Math.min(dpr, isMobilePerf?0.9:1.1));
    spawnScale=Math.min(spawnScale,0.55);
    sun.shadow.mapSize.set(1024,1024);
    if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map=null; }
  } else if(level>=3){
    renderer.setPixelRatio(Math.min(dpr,.8));
    spawnScale=Math.min(spawnScale,0.4);
    sun.castShadow=false;
  }
}
function governQuality(dt){
  if($('quality').value!=='auto')return;
  fpsFrames++; fpsTime+=dt;
  if(fpsTime>=1.25){
    var fps=fpsFrames/Math.max(0.001,fpsTime);
    fpsFrames=0; fpsTime=0;
    if(fps<42 && qLevel<3) applyQuality(qLevel+1);
  }
}

/* ---------- Main loop ---------- */
var clock=new THREE.Clock();
var lastCaptionStage=-1;
function animate(){
  requestAnimationFrame(animate);
  /* dt is floored, never exactly 0: THREE.Clock returns 0 on its very
     first getDelta(), and the XPBD hero solver below divides by dt^2 -
     a single zero-dt frame used to push squash to NaN, and NaN scale
     made the hero cat vanish silently for the whole session. */
  var realDt=Math.max(clock.getDelta(),1/1000),dt=Math.min(realDt,.1)*($('slowMotion').checked?.35:1),time=clock.elapsedTime;
  camTheta+=(camHome.theta-camTheta)*Math.min(1,dt*8);camPhi+=(camHome.phi-camPhi)*Math.min(1,dt*8);camDist+=(camHome.dist-camDist)*Math.min(1,dt*8);
  applyCam(); backdrop.position.copy(camera.position);

  /* press motion */
  var pressingNow=holding && !raising && !machineBroken;
  /* explosion aftermath: the frame shudders, then the press repairs
     itself and re-enables - the cat on the bed is untouched */
  if(pressShake>0.01){
    /* one smooth damped sway of the frame, NOT per-frame random jitter:
       a heavy machine rocks a little and settles, it does not vibrate */
    pressShakeT+=dt;
    var swayAmp=0.030*pressShake;
    press.position.x=Math.sin(pressShakeT*26)*swayAmp;
    press.position.y=Math.sin(pressShakeT*31+1.2)*swayAmp*0.55;
    pressShake*=Math.pow(0.10,dt);
    if(pressShake<=0.01){ press.position.x=0; press.position.y=0; }
  } else { press.position.x=0; press.position.y=0; }
  if(machineBroken){
    brokenT-=dt;
    if(brokenT<=0){
      machineBroken=false;
      $('brokenBanner').classList.remove('show');
      document.querySelector('.deck').classList.remove('broken');
      toast(t('fixedToast'));
    }
  }
  var prevPlatenY=platenY;
  if(platenRecoil){
    /* explosion recoil: the ram is thrown back up on an eased spring
       instead of teleporting to the top in a single frame */
    platenY+=(PLATEN_TOP-platenY)*Math.min(1,dt*8.5);
    if(PLATEN_TOP-platenY<0.03){ platenY=PLATEN_TOP; platenRecoil=false; }
  } else if(pressingNow){
    /* hard materials fight the press: once the platen is in contact with
       a glass / iron / diamond / brick / toy-brick cat it descends slower,
       and a RIGID cat stalls the ram almost completely as the penetration
       approaches its fracture depth - the ram creeps, pressure builds
       (rigid pressure model below), cracks creep across the surface,
       and only then does the material let go. No more platen sinking
       through a solid cat as if it were gel. */
    var pressSlowF=(mode==='ready'&&hero&&squash>0.015)? physEff(currentTex).pressSlow : 1;
    if(mode==='ready'&&hero&&pressSlowF<1&&physFor(currentTex).jiggle<=0){
      var catTopPre=BED_Y+hero.form.height*hero.form.scale*catSize;
      var rawPre=catTopPre>0? Math.max(0,(catTopPre-platenBottom())/(hero.form.height*hero.form.scale*catSize)) : 0;
      if(rawPre>0.004) pressSlowF*=Math.max(0.10,1-Math.min(1,rawPre/Math.max(0.02,physFor(currentTex).burstRaw))*0.85);
    }
    var targetDrive=-(mode==='ready'?2.15:2.9)*pressSlowF*curMachine().speed;platenVelY+=(targetDrive-platenVelY)*(1-Math.exp(-8*dt));platenY=Math.max(PLATEN_MIN,platenY+platenVelY*dt);
    if(AC && soundOn && time>creakAt && pressure>300){ creakAt=time+1.2+Math.random()*1.5; tone(90+Math.random()*60,60,0.3,'sawtooth',0.03); }
  } else {
    platenVelY+=((raising?5.2:2.6)-platenVelY)*(1-Math.exp(-10*dt));platenY=Math.min(PLATEN_TOP,platenY+Math.max(0,platenVelY)*dt);
  }
  platenVelY=dt>0? (platenY-prevPlatenY)/dt : 0;
  layoutPlaten();

  /* fantasy machine life: each press breathes in its own way - dragon
     flames flicker fast and uneven, hell wisps pulse slow and deep,
     the angel halo bobs while its crystals slowly orbit and spin,
     and the aura light follows the same rhythm per machine */
  if(!reduced){
    var mfx=machineFx[activeMachine], fi2;
    if(mfx){
      if(mfx.flames) for(fi2=0;fi2<mfx.flames.length;fi2++){
        var flS=1+Math.sin(time*23+fi2*1.7)*0.16+Math.sin(time*41+fi2*2.9)*0.09;
        mfx.flames[fi2].scale.set(flS,1+Math.sin(time*29+fi2*2.3)*0.30,flS);
      }
      if(mfx.wisps) for(fi2=0;fi2<mfx.wisps.length;fi2++){
        var wS=0.85+0.35*Math.sin(time*2.6+fi2*2.1);
        mfx.wisps[fi2].scale.set(wS,0.8+0.45*Math.sin(time*3.1+fi2*1.4),wS);
      }
      if(mfx.halo){ mfx.halo.position.y=mfx.haloY+Math.sin(time*1.6)*0.09; mfx.halo.rotation.z=Math.sin(time*0.7)*0.12; }
      if(mfx.floats) for(fi2=0;fi2<mfx.floats.length;fi2++){
        var fc=mfx.floats[fi2];
        if(fc.userData.y0===undefined) fc.userData.y0=fc.position.y;
        fc.position.y=fc.userData.y0+Math.sin(time*1.8+fi2*1.3)*0.08;
        fc.rotation.y+=dt*1.1; fc.rotation.x+=dt*0.4;
      }
    }
    if(auraLight && curMachine().auraI>0){
      var aPulse=activeMachine==='dragon'? (0.85+0.22*Math.sin(time*23)+0.10*Math.sin(time*47))
        : activeMachine==='hell'? (0.78+0.32*Math.sin(time*2.6))
        : (0.90+0.16*Math.sin(time*3.4));
      auraLight.intensity=curMachine().auraI*aPulse;
    }
  }

  if(mode==='ready' && hero){
    var form=hero.form;
    var fp=hero.fp||formPhys(currentType);
    /* cat slide physics after a fling: friction and a soft bounce at
       the bed edge - both are the CAT's own numbers: Pudding's high
       friction stops it almost dead, Mochi slides far and bounces
       off the rim, Soda rolls on with medium grip */
    if(!hero.held && (Math.abs(hero.vx)>0.02||Math.abs(hero.vz)>0.02)){
      hero.mesh.position.x+=hero.vx*dt; hero.mesh.position.z+=hero.vz*dt;
      var dampF=Math.pow(fp.fric>=0.5?0.02:(fp.fric<=0.35?0.10:0.055),dt/(fp.mass||1)); hero.vx*=dampF; hero.vz*=dampF; /* inertia: heavy Pudding keeps its slide, light Soda checks up sooner per unit friction */
      var bx=hero.mesh.position.x, bz=hero.mesh.position.z+0.1, bd=Math.hypot(bx,bz), maxR=2.35;
      if(bd>maxR){
        hero.mesh.position.x=bx/bd*maxR; hero.mesh.position.z=-0.1+bz/bd*maxR;
        var nx2=bx/bd, nz2=bz/bd, dot2=hero.vx*nx2+hero.vz*nz2;
        if(dot2>0){ hero.vx-=(1+fp.bounce)*dot2*nx2; hero.vz-=(1+fp.bounce)*dot2*nz2; if(dot2>1.2){ hero.wobV+=3; plop(dot2); } }
      }
    }
    if(!hero.held){ hero.tiltX+=(0-hero.tiltX)*Math.min(1,dt*6); hero.tiltZ+=(0-hero.tiltZ)*Math.min(1,dt*6); }
    var catTop0=BED_Y+form.height*form.scale*catSize;
    var contactY=catTop0-squash*(form.height*form.scale*catSize)*0.92;
    var dCenter=Math.hypot(hero.mesh.position.x,hero.mesh.position.z+0.1);
    var contactF=dCenter<=1.5?1:Math.max(0,1-(dCenter-1.5)/1.2);
    /* per-material press response: rawSquash is how far the platen has
       travelled into the cat's height; the visible squash is capped by
       the material (jelly flattens almost fully, diamond barely dents) */
    var phys=physEff(currentTex);
    var rawSquash=0;
    if(platenBottom()<catTop0){
      rawSquash=Math.max(0,Math.min(0.98,(catTop0-platenBottom())/(form.height*form.scale*catSize)))*contactF;
    }
    var targetSquash=Math.min(rawSquash,phys.heroMax);
    /* spring toward the press target: overshoot on release is the wobble.
       Rigid materials get a much stiffer, heavily damped spring - they
       dent a little and stop, with no jelly oscillation. Soft bodies run
       on the CAT's own spring (see FORM_PHYS): Pudding's heavy damping
       (damp ~9.5, x2.3 under load) kills any rebound so it stays flat,
       Mochi's light damping lets it spring back and ring, Soda sits
       between with the springiest wobble of the three. */
    var isRigid=(phys.jiggle<=0);
    /* ---- XPBD HERO SOLVER (deep rework, replaces the old single-step
       spring) ---- The cat is solved in 4 substeps. Each substep:
       (1) PREDICT - velocity integrates the elastic force toward the
       platen-driven target; (2) SOLVE - an XPBD constraint projects
       squash onto that target with compliance alpha from the material
       and the cat (rigid bodies: alpha ~ 0, an almost inextensible
       constraint, PLUS an inequality clamp - a solid dents to its cap
       and stops, and can never rebound past its rest shape);
       (3) velocity is RECOVERED from the positions (v = dx/dt) and
       damped with the cat's own damping - which is why one solver
       makes Mochi ring, Pudding die flat and Soda wobble longest. */
    var disp,softMetrics;
    if(hero.soft){
      var tick=performance.now(), bodyScale=form.scale*catSize;
      var ceiling=contactF>0.99?Math.max(0.12,(platenBottom()-BED_Y)/bodyScale):Infinity;
      hero.soft.preset.density=CatSoftBody.presets[selectedPreset==='auto'?currentType:selectedPreset].density*density;
      var ceilingAt=function(x,z){return Math.hypot(x*bodyScale+hero.mesh.position.x,z*bodyScale+hero.mesh.position.z+.1)<PLATEN_R?ceiling:Infinity;};
      var floorAt=function(x,z){return Math.hypot(x*bodyScale+hero.mesh.position.x,z*bodyScale+hero.mesh.position.z)<3.55?0:-BED_Y/bodyScale;};
      var prior=hero.soft.metrics(),impactSpeed=0;
      for(var vi=1;vi<hero.soft.velocities.length;vi+=3)impactSpeed=Math.max(impactSpeed,-hero.soft.velocities[vi]*bodyScale);
      hero.soft.advance(dt,ceilingAt,9.81/bodyScale,floorAt);
      hero.physicsMs=performance.now()-tick;softMetrics=hero.soft.metrics();
      if(!reduced&&prior.minY>.025&&softMetrics.minY<=.005&&impactSpeed>1.3){
        var point=new THREE.Vector3(0,BED_Y+.06,-.1),arr=hero.soft.positions,low=1e9;
        for(var pi=0;pi<arr.length;pi+=3)if(arr[pi+1]<low){low=arr[pi+1];point.x=arr[pi]*bodyScale;point.z=arr[pi+2]*bodyScale-.1;}
        dynamics.emit(point,Math.min(2.5,impactSpeed*.3),form.color,'impact');
      }
      if(!reduced&&softMetrics.contact>0&&!(hero.previousContact>0)){dynamics.emit({x:hero.mesh.position.x,y:platenBottom()-.04,z:hero.mesh.position.z+.6},.6,form.color,'contact');}
      hero.previousContact=softMetrics.contact;
      var previousCompression=hero.simCompression;
      hero.simCompression=Math.max(0,1-softMetrics.height/hero.soft.restHeight);
      squash=hero.simCompression;squashV=(squash-previousCompression)/Math.max(dt,1e-6);disp=squash;
      hero.inner.scale.set(1,1,1);hero.inner.rotation.set(0,0,0);
      hero.mat.userData.uTime.value=time;hero.mat.userData.uJiggle.value=0;
      var nextLifecycle=softMetrics.contact>0.0001?(squash>burstAt*.7?'STRESSED':'DEFORMING'):'INTACT';if(nextLifecycle!==hero.lifecycle){hero.lifecycle=nextLifecycle;window.dispatchEvent(new CustomEvent('catjelly:state',{detail:{state:nextLifecycle,strain:softMetrics.strain}}));}
      deformHeroSurfaces(hero,disp,time);
    }else{
    var Kxp=isRigid?190:fp.stiff*(pressingNow?1.35:1), Dxp=isRigid?34:fp.damp*(pressingNow?2.3:1);
    var alphaXPBD=isRigid? 1e-7 : (fp.comp||1)/(fp.stiff*140);
    var SUBN=4, sdt=dt/SUBN, lambdaS=0;
    for(var xs=0;xs<SUBN;xs++){
      var prevSquash=squash;
      squashV+=(-Kxp*(squash-targetSquash))*sdt;
      squash+=squashV*sdt;
      var alphaT=alphaXPBD/(sdt*sdt);
      var dLam=(-(squash-targetSquash)-alphaT*lambdaS)/(1+alphaT);
      squash+=dLam; lambdaS+=dLam;
      if(isRigid) squash=Math.max(0,Math.min(phys.heroMax*1.05,squash));
      else squash=Math.max(-0.06,Math.min(0.95,squash));
      squashV=(squash-prevSquash)/sdt;
      squashV*=Math.exp(-Dxp*sdt);
    }
    /* belt and braces: a non-finite squash must never reach the mesh
       scale - reset to rest instead of rendering nothing */
    if(!isFinite(squash)||!isFinite(squashV)){ squash=0; squashV=0; }
    var idleWob=(reduced||isRigid)?0:Math.sin(time*2.2)*0.012;
    var disp=Math.max(-0.05,squash)+idleWob;
    /* volume behaviour is the cat's own too: Mochi keeps its volume
       (height lost becomes width), Pudding loses volume and spreads
       widest, Soda keeps most of its height-loss narrow */
    var sy=Math.max(0.1,1-disp*0.92*(phys.jiggle>0?(2-fp.volKeep):1));
    var sxz=1+Math.max(0,disp)*phys.heroSpread*(phys.jiggle>0?fp.spread:1);
    if(phys.jiggle>0 && disp>0.005){
      /* XPBD VOLUME constraint, Newton-solved every frame:
         C = sy*sxz^2 - Vtarget = 0. Vtarget is the cat's own -
         Mochi 1.00 (volume conserved: height lost becomes width),
         Pudding slides to 0.82 (a flat body sheds volume instead of
         bulging), Soda 0.92. The correction gain carries volKeep as
         the constraint's compliance: the lower it is, the more volume
         the solve is allowed to let go. */
      var vT=1-(1-fp.volKeep)*Math.min(1,disp*1.5);
      for(var vi=0;vi<2;vi++){
        var cV=sy*sxz*sxz-vT;
        if(Math.abs(cV)<0.002) break;
        sxz+=-cV/(2*sy*sxz)*(0.35+0.65*fp.volKeep);
        sxz=Math.max(0.6,Math.min(2.6,sxz));
      }
    }
    hero.inner.scale.set(sxz,sy,sxz);
    deformHeroSurfaces(hero,disp,time);
    hero.inner.rotation.z=Math.sin(time*1.7)*0.008+hero.tiltZ+(pressingNow? Math.sin(time*31)*disp*0.02:0);
    hero.inner.rotation.x=hero.tiltX;
    hero.mat.userData.uTime.value=time;
    /* hero spring wobble: pokes, drags and shakes all feed this spring. It
       drives the gel surface ripple AND a volume-conserving squash-stretch,
       so a shaken cat visibly sloshes instead of moving like a rigid lump.
       Low damping (4.6) lets the jiggle ring for about a second. */
    hero.wobV+=(-(36+fp.stiff*0.45)*hero.wob-fp.damp*hero.wobV)*dt; hero.wob+=hero.wobV*dt;
    hero.shake=Math.max(0,(hero.shake||0)-dt*0.65);
    /* surface ripple is a SOFT-body effect: rigid materials get exactly
       zero - a glass or iron cat never ripples, sloshes or jiggles */
    hero.mat.userData.uJiggle.value=(0.22+Math.min(2.0,Math.abs(squashV)*0.8)+disp*1.4+Math.min(1.5,Math.abs(hero.wob)*1.15)+hero.shake*1.35)*(phys.jiggle<=0?0:phys.jiggle);
    if(!pressingNow && phys.jiggle>0){
      var wobAmp=(hero.wob*0.11+Math.sin(time*23)*hero.shake*0.055)*phys.jiggle*fp.wobbleAmp;
      var wyF=1+wobAmp;
      hero.inner.scale.y*=wyF;
      var wxzF=1/Math.sqrt(Math.max(0.55,wyF));
      hero.inner.scale.x*=wxzF; hero.inner.scale.z*=wxzF;
      hero.inner.rotation.z+=hero.wob*0.045+Math.sin(time*17)*hero.shake*0.028;
    }
    /* tall-body bend: Soda (bend 1.0) visibly leans and curves under
       load toward its own lean direction before it ever flattens -
       you see the tall body give sideways first. Mochi (0.15) barely
       tilts; Pudding (0.05) just sinks. */
    if(phys.jiggle>0 && fp.bend>0.1 && disp>0.02){
      var bendAmt=fp.bend*disp*0.30;
      hero.inner.rotation.z+=Math.cos(hero.lean||0)*bendAmt;
      hero.inner.rotation.x+=Math.sin(hero.lean||0)*bendAmt*0.7;
    }
    }
    /* pressure model: contact load scaled per cat and per material.
       Rigid materials barely squash, so their load follows the platen's
       penetration instead - the gauge spikes hard against iron and
       pegs near the top against diamond. */
    var pBasis=phys.jiggle>0? squash : rawSquash;
    var targetPressure;
    if(phys.jiggle>0){
      targetPressure=pressingNow&&pBasis>0.01? (pBasis*pBasis*1.6+pBasis*0.55)*400*form.pressScale*phys.pressMul : 0;
      if(hero.soft&&softMetrics.contact<1e-6)targetPressure=0;
    } else {
      /* RIGID pressure model: the ram is stalled against a solid, so
         pressure is driven by how much of the fracture depth has been
         forced (blocked ratio), rising steeply toward the material's
         required pressure - not by how much the body squashed, because
         a solid barely squashes at all. This is what lets a diamond
         cat peg the gauge and burst (or blow the press) after denting
         only a couple of percent. */
      var blockedR=Math.min(1.15,rawSquash/Math.max(0.02,physFor(currentTex).burstRaw));
      targetPressure=(pressingNow&&blockedR>0.02)? Math.min(machineCap()*1.3,Math.pow(blockedR,1.25)*requiredPressure(currentTex)*1.18*form.pressScale + Math.sin(time*27)*blockedR*6) : 0;
    }
    pressure+=(targetPressure-pressure)*Math.min(1,dt*9);
    pressure=Math.min(machineCap(),Math.max(0,pressure)); /* the machine cannot deliver more than slider + its own bonus */
    if(pressingNow) maxPressure=Math.max(maxPressure,pressure);
    setHum(pressingNow&&squash>0.01,pressure);
    var st=captionStage();
    if(st!==lastCaptionStage && pressingNow){ lastCaptionStage=st; setCaption(st); }
    if(!pressingNow && squash<0.02 && lastCaptionStage!==0){ lastCaptionStage=0; setCaption(0); }
    /* debris squeezes out from the cat's sides while pressing: gel and
       water shed gel crumbs, brick and glass shed small chips, iron,
       diamond and toy brick shed nothing until they break */
    /* soft bodies shed debris by visible squash; rigid bodies barely
       squash, so their side debris is driven by blocked strain instead */
    var crumbBasis=phys.jiggle>0? squash : Math.min(1,rawSquash/Math.max(0.02,physFor(currentTex).burstRaw))*0.55;
    if(pressingNow && crumbBasis>0.14 && crumbBasis>lastCrumbSquash+0.06){
      lastCrumbSquash=crumbBasis;
      if(currentTex==='jelly'){ /* conserved intact cage: no decorative solid crumbs */ }
      else if(currentTex==='water'){ /* intact shell */ }
      else if(currentTex==='brick'||currentTex==='glass') spawnCrumbs(2,hero.mesh.position.x,hero.mesh.position.z,form.color,1.2,currentTex);
    }
    if(crumbBasis<lastCrumbSquash-0.05) lastCrumbSquash=crumbBasis;
    /* ---- Cracks, dust and leaks: damage builds BEFORE the break ----
       Strain ratio combines platen penetration against the material's
       breaking depth with pressure against the required pressure. The
       crack network on the cat spreads as the ratio climbs, and past
       30% strain the material sheds its own dust at the contact zone. */
    var reqNow=requiredPressure(currentTex);
    var strainRatio=(currentTex==='jelly')
      ? (hero.soft?hero.soft.strain/.65:squash/Math.max(0.2,burstAt))
      : Math.max(rawSquash/Math.max(0.1,physFor(currentTex).burstRaw), reqNow>0? pressure/reqNow : 0);
    /* ---- CUMULATIVE DAMAGE: fatigue is never forgotten ----
       One press that cannot quite crack or break the cat still WEARS
       it: heroDamage grows under any meaningful load and is never
       handed back - releasing the platen, and even a machine
       explosion, leaves every bit of it in place. The crack network
       follows the damage, so the next press starts from the old crack
       front (head and ears included) and pushes it further. A weaker
       press therefore DOES break the cat - it just needs more presses,
       exactly like real fatigue failure. */
    if(pressingNow){
      crackLevel=Math.max(crackLevel,Math.min(1,strainRatio));
      var srC=Math.min(1.15,strainRatio);
      if(srC>0.32 && currentTex!=='water'){
        heroDamage=Math.min(1,heroDamage+dt*0.15*Math.pow(srC,1.7)*(reqNow>machineCap()?1.4:1.0));
      }
      crackLevel=Math.max(crackLevel,Math.min(1,heroDamage*1.12));
      /* crack SOUND follows real crack growth, in this material's voice */
      if(crackLevel>lastCrackSndLevel+0.045 && performance.now()-lastCrackSndAt>130){
        lastCrackSndLevel=crackLevel; lastCrackSndAt=performance.now();
        crackSound(currentTex,crackLevel);
      }
    }
    setCrackVisual(hero.crack,crackLevel);
    /* Fatigue also WEAKENS the material: the pressure this cat still
       needs falls as its damage grows (up to 45% lower fully worn), so
       a machine that was too weak for the fresh cat can finish the
       damaged one, and stops exploding once the cat gives way enough. */
    var reqEff=reqNow*(1-0.45*heroDamage);
    if(pressingNow && crackLevel>0.45 && performance.now()-lastCrackToastAt>5000){
      lastCrackToastAt=performance.now(); toast(t('crackToast'));
    }
    if(pressingNow && crackLevel>0.28 && currentTex!=='water' && time>(hero.dustAt||0)){
      hero.dustAt=time+0.14;
      spawnDust(currentTex==='jelly'?1:2,hero.mesh.position.x+(Math.random()-0.5)*1.4,BED_Y+0.5+Math.random()*0.8,hero.mesh.position.z+(Math.random()-0.5)*1.4,currentTex,form.color,1.1);
    }
    /* The liquid-filled body remains a closed elastic shell until rupture. */
    /* ---- Machine overload: not enough pressure = the press blows ----
       The cat can only break if the machine can actually reach the
       pressure this material, at this size and density, requires. If
       it cannot, full-load strain builds while the gauge is pinned at
       the machine's max - hold it there and the press explodes, then
       repairs itself; the cat survives, cracked but whole. */
    if(pressingNow && reqEff>machineCap() && pressure>=machineCap()*0.97 && (phys.jiggle>0? rawSquash>0.06 : rawSquash>=physFor(currentTex).burstRaw*0.65)){
      strainT+=dt;
      /* while the machine strains at its limit, point at the Machine
         pressure slider - the exact parameter that has to go up */
      if(strainT>0.2 && !needFlashTimer) flashNeedHighlight(4500);
      if(strainT>0.28 && Math.random()<0.22) spawnDust(1,hero.mesh.position.x,BED_Y+2.2,hero.mesh.position.z,'spark',0xffb52e,1.2);
      if(strainT>=0.85) explodePress();
    } else strainT=Math.max(0,strainT-dt*1.5);
    /* burst check: jelly pops at its planned squash threshold as before;
       every other material breaks only when the platen has forced its
       way deep enough against the material's resistance (diamond last,
       at very high penetration and pressure) - and only when the
       machine could actually deliver the required pressure */
    if(pressingNow && !machineBroken){
      if(heroDamage>=1){ burst(); } /* worn out over several presses: it finally gives */
      else if(reqEff<=machineCap()){
        if(hero.soft||currentTex==='jelly'){ if(squash>=burstAt && (!hero.soft||hero.soft.strain>.24) && pressure>=reqEff*0.55) burst(); }
        else if(rawSquash>=physFor(currentTex).burstRaw && squash>=phys.heroMax*0.82 && pressure>=reqEff*0.82) burst();
      }
    }
  } else if(mode==='play'){
    /* pressing pieces: platen squashes any chunk under it */
    var anyUnder=false;
    pieces.forEach(function(p){
      if(p.coherent)return;
      if(p.splitCooldown>0) p.splitCooldown-=dt;
      var d=Math.hypot(p.mesh.position.x,p.mesh.position.z+0.1);
      var under=d<PLATEN_R-0.2;
      var target=0;
      /* Contact height must match what is actually drawn. A mini clone cat
         stands form.height x its body scale tall - several times r*0.9 - so
         the old r-only height let the platen sink straight through the
         minis and only start squashing them once it was almost on the bed:
         they looked completely unpressable. pressTop stores the real drawn
         height for minis (and their split children); blobs and crumbs,
         whose drawn top really is about r*0.9 above their centre, keep
         the r-based height. */
      var topOff=(p.pressTop&&p.pressTop>0)? p.pressTop : (p.drawTop||p.r*0.9);
      var topY=p.mesh.position.y+topOff;
      var pPhys=physFor(p.texKind||'jelly');
      if(under && platenBottom()<topY){
        target=Math.max(0,Math.min(0.8,(topY-platenBottom())/Math.max(0.3,topOff)));
        p.rawSquashP=target;
        /* a fragment flattens only as far as its own material allows:
           an iron chunk dents a little, a jelly chunk pancakes */
        target=Math.min(target,pPhys.pieceSquash);
        anyUnder=true;
        if(target>0){ p.sleeping=false; p.sleepT=0; }
      } else p.rawSquashP=0;
      p.squashP+=(target-p.squashP)*Math.min(1,dt*10);
      /* Re-press remorph: once per press, past a real squash, the piece
         changes mould - new geometry, new proportions, a size nudge and
         a little more permanent flatness - instead of springing back to
         exactly the shape it had before. Small pieces that only flatten
         still deform permanently a little each press. */
      if(pressingNow && target>0.45 && !p.morphedThisPress && !p.fading){
        p.morphedThisPress=true;
        remorphPiece(p);
      }
      if(target<0.05) p.morphedThisPress=false;
      /* a re-pressed fragment sheds its own material's dust as it
         strains - and water pieces only splash droplets, never dust */
      if(pressingNow && target>0.32 && (p.texKind||'jelly')!=='water' && time>(p.dustAt2||0)){
        p.dustAt2=time+0.22;
        spawnDust(1,p.mesh.position.x,p.mesh.position.y+0.25,p.mesh.position.z,p.texKind||'jelly',p.color!==undefined?p.color:0xffffff,0.9);
      }
      if(pressingNow && target>0.25 && !p.mini){
        var jellyPiece=(p.texKind||'jelly')==='jelly';
        p.permFlat=Math.min(jellyPiece?0.6:0.22,(p.permFlat||0)+dt*(jellyPiece?0.22:0.05));
        /* fragments fatigue too: damage from earlier presses is kept,
           so a piece that survived one press splits more easily next time */
        p.dmg=Math.min(1,(p.dmg||0)+dt*(jellyPiece?0.35:0.22));
      }
    });
    /* Recursive splitting: a large or medium piece squashed past 0.58
       under the platen breaks into smaller pieces (large into 3, medium
       into 2). Small pieces only flatten. At most 3 splits per frame. */
    if(pressingNow){
      var toSplit=[];
      pieces.forEach(function(p){
        var sp=physFor(p.texKind||'jelly');
        if(!p.coherent&&!p.held&&!p.fading&&(p.splitCooldown||0)<=0&&(p.splitDepth||0)<3&&p.r>=0.30&&(p.rawSquashP||0)>sp.splitS*(1-0.45*(p.dmg||0))&&p.squashP>sp.pieceSquash*0.7) toSplit.push(p);
      });
      toSplit.sort(function(a,b){ return b.r-a.r; });
      for(var si=0;si<Math.min(3,toSplit.length);si++) splitPiece(toSplit[si]);
    }
    var targetPressure2=anyUnder? 160+Math.random()*60 : 0;
    pressure+=(targetPressure2-pressure)*Math.min(1,dt*8);
    setHum(pressingNow&&anyUnder,pressure);
  }
  dynamics.update(dt);
  fracturePulse.intensity*=Math.exp(-8*dt);
  setGauge(Math.max(0,pressure));
  bedRim.material.emissive.set(0x67d9bb);bedRim.material.emissiveIntensity=Math.min(.65,pressure/600);
  contactShadow.visible=!!hero;if(hero){contactShadow.position.x=hero.mesh.position.x;contactShadow.position.z=hero.mesh.position.z;contactShadow.material.opacity=hero.soft?Math.max(.1,1-hero.soft.metrics().minY*.4):1;contactShadow.scale.setScalar(1+squash*.35);}


  /* pieces physics: gravity, floor, walls, mutual push, wobble */
  updateCoherentPieces(dt);
  var fadedDone=[];
  for(var i=0;i<pieces.length;i++){
    var p=pieces[i];
    if(p.coherent)continue;
    if(p.sleeping && !p.held && !p.fading){
      /* sleeping pieces cost almost nothing: no gravity, no integration,
         no pair checks. They wake when the platen comes down near them,
         when a moving piece knocks them (pair loop), when the cleanup
         fade starts, or when the user grabs them. */
      var wakeNow=false;
      if(pressingNow){
        var wd=Math.hypot(p.mesh.position.x,p.mesh.position.z+0.1);
        if(wd<PLATEN_R+0.35 && platenBottom()<p.mesh.position.y+(p.drawTop||p.r*0.9)+0.6) wakeNow=true;
      }
      if(!wakeNow) continue;
      p.sleeping=false; p.sleepT=0;
    }
    if(!p.held){
      p.vy-=13.5*(p.gravF||1)*dt; /* per-material weight: iron falls fast, glass shards flutter down slower */
      /* mild air drag only - pieces travel, tumble and scatter further */
      var airD=Math.pow(0.55,dt); p.vx*=airD; p.vz*=airD;
      p.mesh.position.x+=p.vx*dt; p.mesh.position.y+=p.vy*dt; p.mesh.position.z+=p.vz*dt;
      var floorY=(Math.hypot(p.mesh.position.x,p.mesh.position.z)<3.55? BED_Y:0)+ (p.mini?0:p.r*0.55);
      p.restY=floorY;
      if(p.mesh.position.y<floorY){
        p.mesh.position.y=floorY;
        if(Math.abs(p.vy)>1.1){
          /* springier landing: per-piece restitution, a sideways scatter
             kick, a spin kick and a big wobble pump */
          var imp=Math.abs(p.vy);
          p.vy=-p.vy*(p.bounce||0.5);
          p.vx+=(Math.random()-0.5)*imp*0.35; p.vz+=(Math.random()-0.5)*imp*0.35;
          p.vrx+=(Math.random()-0.5)*imp*1.6*(p.spinF||1); p.vrz+=(Math.random()-0.5)*imp*1.6*(p.spinF||1);
          p.wobV+=Math.min(12,imp*1.7)*(p.wobbleF!==undefined?p.wobbleF:1); plop(imp);
        }
        else p.vy=0;
        /* ground friction per material: brick grips and stops, jelly
           slides and rolls, plastic skids in between */
        var fr=Math.pow(p.fricBase!==undefined?p.fricBase:0.24,dt); p.vx*=fr; p.vz*=fr;
        var frs=Math.pow(0.38,dt); p.vrx*=frs; p.vrz*=frs;
      }
      if(p.mesh.position.y<=floorY+0.002 && (Math.abs(p.vx)>0.15||Math.abs(p.vz)>0.15)){
        var roll=1/Math.max(0.14,p.r);
        p.vrx=Math.max(-15,Math.min(15,p.vz*roll*0.9));
        p.vrz=Math.max(-15,Math.min(15,-p.vx*roll*0.9));
      }
      var rr=Math.hypot(p.mesh.position.x,p.mesh.position.z);
      if(rr>8.2){ p.mesh.position.x*=8.2/rr; p.mesh.position.z*=8.2/rr; p.vx*=-0.55; p.vz*=-0.55; p.wobV+=3; }
      p.mesh.rotation.x+=p.vrx*dt; p.mesh.rotation.z+=p.vrz*dt;
      if(p.mini && p.mesh.position.y<=floorY+0.02){
        /* Mini cats settle back upright on the bed instead of staying
           tipped over, so their drawn height keeps matching the pressTop
           the press checks against - a sideways mini reads as far shorter
           than it looks and squashes at the wrong moment. */
        var wx=Math.atan2(Math.sin(p.mesh.rotation.x),Math.cos(p.mesh.rotation.x));
        var wz=Math.atan2(Math.sin(p.mesh.rotation.z),Math.cos(p.mesh.rotation.z));
        var easeU=Math.min(1,dt*5);
        p.mesh.rotation.x-=wx*easeU; p.mesh.rotation.z-=wz*easeU;
        p.vrx*=0.8; p.vrz*=0.8;
      }
      /* sleep entry: resting on a surface, slow, barely wobbling and not
         being pressed - freeze it until something disturbs it */
      var spdAll=Math.abs(p.vx)+Math.abs(p.vy)+Math.abs(p.vz)+Math.abs(p.vrx)+Math.abs(p.vrz);
      if(p.mesh.position.y<=floorY+0.01 && spdAll<0.55 && Math.abs(p.wob)<0.25 && (p.squashP||0)<0.03 && !pressingNow){
        p.sleepT=(p.sleepT||0)+dt;
        if(p.sleepT>0.55){ p.sleeping=true; p.vx=0; p.vy=0; p.vz=0; p.vrx=0; p.vrz=0; }
      } else p.sleepT=0;
    }
    /* mutual collision: positional separation PLUS a velocity impulse,
       so pieces knock each other rolling and wobbling instead of just
       sliding apart silently */
    for(var j=i+1;j<pieces.length;j++){
      var q=pieces[j];
      if(q.coherent)continue;
      if(q.sleeping && p.sleeping) continue;
      var dx=q.mesh.position.x-p.mesh.position.x, dz=q.mesh.position.z-p.mesh.position.z;
      var minD=(p.r+q.r)*0.8;
      var d2=dx*dx+dz*dz;
      if(d2>minD*minD || d2<1e-6) continue;
      var dd=Math.sqrt(d2);
      {
        if(q.sleeping){ q.sleeping=false; q.sleepT=0; } /* knocked awake */
        var ux=dx/dd, uz=dz/dd;
        /* XPBD rigid contact solve: inverse-mass weighted positional
           correction first (a heavy iron chunk barely moves when a
           jelly crumb runs into it - the crumb takes almost all of
           the push), then a velocity impulse with the pair's own
           restitution and a Coulomb-clamped friction impulse along
           the tangent, so pieces roll, skid and settle by mass. */
        var imP=p.held?0:(p.invMass||0.05), imQ=q.held?0:(q.invMass||0.05), imSum=imP+imQ;
        if(imSum>0){
          var pen=minD-dd;
          if(!p.held){ p.mesh.position.x-=ux*pen*(imP/imSum); p.mesh.position.z-=uz*pen*(imP/imSum); }
          if(!q.held){ q.mesh.position.x+=ux*pen*(imQ/imSum); q.mesh.position.z+=uz*pen*(imQ/imSum); }
          var rvx=q.vx-p.vx, rvz=q.vz-p.vz;
          var relN=rvx*ux+rvz*uz;
          if(relN<0){
            var ePair=Math.min(p.bounce||0.3,q.bounce||0.3);
            var jn=-(1+ePair)*relN/imSum;
            var txN=-uz, tzN=ux;
            var relT=rvx*txN+rvz*tzN;
            var jt=Math.max(-0.45*jn,Math.min(0.45*jn,-relT/imSum));
            if(!p.held){ p.vx-=(ux*jn+txN*jt)*imP; p.vz-=(uz*jn+tzN*jt)*imP; p.wobV+=Math.min(6,jn*imP*1.2); }
            if(!q.held){ q.vx+=(ux*jn+txN*jt)*imQ; q.vz+=(uz*jn+tzN*jt)*imQ; q.wobV+=Math.min(6,jn*imQ*1.2); }
          }
        }
      }
    }
    /* solid platen: applied to every piece, held or not, after all
       movement - nothing renders above or inside the press plate */
    collidePlaten(p);
    /* springier, longer-ringing wobble: stiffer spring, much less damping */
    p.wobV+=(-72*p.wob-2.9*p.wobV)*dt; p.wob+=p.wobV*dt;
    var wobS=reduced?0:p.wob*0.24*(p.wobbleF!==undefined?p.wobbleF:1); /* hard materials: zero wobble, rigid */
    var sq=p.squashP||0;
    /* dynamic shape while alive: uneven spread under the press along the
       piece's own spread axes, permanent flattening kept from previous
       presses, and a velocity stretch while flying fast */
    var permF=p.permFlat||0;
    var spd2=Math.hypot(p.vx||0,p.vy||0,p.vz||0);
    var airStretch=reduced?0:Math.min(0.30,Math.max(0,(p.vy||0))*0.028);
    p.inner.scale.set(
      1+wobS+sq*(p.sqSpreadX||0.65)+(p.permWideX||0),
      Math.max(0.26,1-wobS-sq*0.6-permF*0.55+airStretch),
      1+wobS+sq*(p.sqSpreadZ||0.65)+(p.permWideZ||0));
    p.mat.userData.uTime.value=time;
    p.mat.userData.uJiggle.value=(0.22+Math.min(2.2,Math.abs(p.wob)*1.9)+sq*1.3+Math.min(0.5,spd2*0.05))*(p.wobbleF!==undefined?p.wobbleF:1); /* rigid fragments (wobbleF 0) get zero gel ripple */
    /* cleanup fade: opacity eases from full to zero over CRUMB_FADE_SEC,
       and the piece is only removed once it is fully transparent */
    if(p.fading && p.fadeMats){
      p.fadeT+=dt;
      var fp=Math.min(1,p.fadeT/CRUMB_FADE_SEC);
      var fadeOp=(1-fp)*(1-fp*0.35);
      p.fadeMats.forEach(function(m){ m.opacity=(m.userData.fadeBaseOpacity||1)*Math.max(0,fadeOp); });
      if(fp>=1) fadedDone.push(p);
    }
  }
  if(fadedDone.length){
    fadedDone.forEach(function(p){
      var idx=pieces.indexOf(p);
      if(idx>=0) pieces.splice(idx,1);
      scene.remove(p.mesh);
      if(p.fadeMats) p.fadeMats.forEach(function(m){ if(m.dispose) m.dispose(); });
      else if(p.mat && p.mat.dispose) p.mat.dispose();
      if(typeof dragPiece!=='undefined' && dragPiece===p){ dragPiece=null; dragInfo=null; canvas.classList.remove('grabbing'); }
    });
    var anyFading=false;
    for(var fi=0;fi<pieces.length;fi++) if(pieces[fi].fading) anyFading=true;
    if(crumbFadeActive && !anyFading){
      /* cleanup finished - start counting the next 20-cat cycle from zero */
      crumbFadeActive=false;
      popCycle=0;
    }
  }
  /* droplets */
  for(var di=droplets.length-1;di>=0;di--){
    var dr=droplets[di]; dr.life-=dt;
    dr.vy-=12*dt; dr.mesh.position.x+=dr.vx*dt; dr.mesh.position.y+=dr.vy*dt; dr.mesh.position.z+=dr.vz*dt;
    if(dr.isWater){
      var dropSpeed=Math.hypot(dr.vx,dr.vy,dr.vz);
      dr.mesh.scale.y=dr.mesh.scale.x*(1+Math.min(1.25,dropSpeed*0.075));
      dr.mesh.rotation.z=Math.atan2(-dr.vx,Math.abs(dr.vy)+0.01)*0.4;
    }
    /* droplets are blocked by the platen too - never above the plate */
    var ddx=dr.mesh.position.x, ddz=dr.mesh.position.z+0.1;
    if(Math.hypot(ddx,ddz)<PLATEN_R+0.12 && dr.mesh.position.y+0.08>platenBottom()){
      dr.mesh.position.y=platenBottom()-0.10;
      dr.vy=-Math.abs(dr.vy)*0.3;
      var dl=Math.hypot(ddx,ddz)||0.2; dr.vx+=ddx/dl*1.6; dr.vz+=ddz/dl*1.6;
    }
    /* the landing surface depends on where the droplet actually is:
       on the bed disc it is BED_Y, off the bed it falls to the floor */
    var surfY=(Math.hypot(dr.mesh.position.x,dr.mesh.position.z)<3.55? BED_Y:0);
    if(dr.mesh.position.y<surfY+0.07){
      if(dr.isWater){
        /* water does not bounce like a marble: it lands, spreads and
           becomes part of the puddle on that surface */
        spawnPuddle(dr.mesh.position.x,dr.mesh.position.z,dr.wetRadius||(.16+dr.mesh.scale.x*1.6),surfY===0);
        scene.remove(dr.mesh); droplets.splice(di,1); continue;
      }
      dr.mesh.position.y=surfY+0.07; dr.vy*=-0.3; dr.vx*=0.7; dr.vz*=0.7;
    }
    if(dr.life<=0){ scene.remove(dr.mesh);if(!dr.isWater)dr.mesh.material.dispose(); droplets.splice(di,1); }
  }
  /* hearts */
  for(var hi=hearts.length-1;hi>=0;hi--){
    var hh=hearts[hi]; hh.userData.life-=dt*0.9;
    hh.position.addScaledVector(hh.userData.v,dt); hh.material.opacity=Math.max(0,hh.userData.life);
    if(hh.userData.life<=0){ scene.remove(hh);hh.geometry.dispose();hh.material.dispose(); hearts.splice(hi,1); }
  }
  updateDusts(dt);
  updateVacuum(dt);
  updatePuddles(dt,time);
  governQuality(realDt);updateLabDiagnostics(realDt);
  renderer.render(scene,camera);
}

var LAB_TEXT={
 en:{materials:'Materials & physics',specimen:'SPECIMEN',settings:'Laboratory settings',preset:'Gel formulation',natural:'Character default',quality:'Quality',adaptive:'Adaptive',scene:'Scene',studio:'Studio',workshop:'Workshop',slow:'Slow motion',diagnostics:'Diagnostics',photo:'Photo mode · Esc to exit',INTACT:'Ready',DEFORMING:'In contact',STRESSED:'Under stress',FRAGMENTED:'Fragments'},
 vi:{materials:'Vật liệu & vật lý',specimen:'MẪU THỬ',settings:'Thiết lập phòng thí nghiệm',preset:'Công thức thạch',natural:'Theo nhân vật',quality:'Chất lượng',adaptive:'Tự động',scene:'Bối cảnh',studio:'Phòng chụp',workshop:'Xưởng',slow:'Chuyển động chậm',diagnostics:'Thông số',photo:'Chụp ảnh · Esc để thoát',INTACT:'Sẵn sàng',DEFORMING:'Đang tiếp xúc',STRESSED:'Chịu lực',FRAGMENTED:'Mảnh vỡ'},
 es:{materials:'Materiales y física',specimen:'ESPÉCIMEN',settings:'Ajustes del laboratorio',preset:'Fórmula de gel',natural:'Según personaje',quality:'Calidad',adaptive:'Adaptativa',scene:'Escena',studio:'Estudio',workshop:'Taller',slow:'Cámara lenta',diagnostics:'Diagnóstico',photo:'Modo foto · Esc para salir',INTACT:'Listo',DEFORMING:'En contacto',STRESSED:'Bajo presión',FRAGMENTED:'Fragmentos'},
 zh:{materials:'材质与物理',specimen:'试验样本',settings:'实验室设置',preset:'果冻配方',natural:'角色默认',quality:'画质',adaptive:'自适应',scene:'场景',studio:'摄影棚',workshop:'工坊',slow:'慢动作',diagnostics:'诊断数据',photo:'拍照模式 · Esc 退出',INTACT:'就绪',DEFORMING:'接触中',STRESSED:'受压',FRAGMENTED:'碎片'}
};
function applyLabLang(){if(!LAB_TEXT)return;var text=LAB_TEXT[lang]||LAB_TEXT.en;document.querySelectorAll('[data-lab]').forEach(function(el){el.textContent=text[el.dataset.lab];});}
var measuredFPS=0,frameSample=0,frameElapsed=0;
function updateLabDiagnostics(dt){
  frameSample++;frameElapsed+=dt;if(frameElapsed>.75){measuredFPS=frameSample/frameElapsed;frameSample=0;frameElapsed=0;}
  var state=hero?hero.lifecycle:'FRAGMENTED',status=(LAB_TEXT[lang]||LAB_TEXT.en)[state];
  if($('simStatus').textContent!==status)$('simStatus').textContent=status;
  if(!$('diagnostics').hidden)$('diagnostics').textContent=measuredFPS.toFixed(1)+' FPS / '+(1000/Math.max(1,measuredFPS)).toFixed(1)+' ms\n'+renderer.info.render.calls+' calls / '+renderer.info.render.triangles+' triangles\n'+pieces.length+' pieces / '+droplets.length+' drops\n'+(hero?hero.physicsMs||0:0).toFixed(2)+' ms physics / WebGL '+THREE.REVISION;
}
document.querySelectorAll('[data-cat]').forEach(function(button){button.addEventListener('click',function(){endHold();setHero(button.dataset.cat,currentTex);platenY=PLATEN_TOP;});});
$('gelPreset').addEventListener('change',function(){selectedPreset=this.value;endHold();setHero(currentType,selectedPreset==='liquid'?'water':'jelly');platenY=PLATEN_TOP;});
$('showDiagnostics').addEventListener('change',function(){$('diagnostics').hidden=!this.checked;});
$('photoMode').addEventListener('click',function(){document.body.classList.add('photo');});
$('studioScene').addEventListener('change',function(){var studio=this.value==='studio';floor.material.map=studio?null:workshopFloorMap;floor.material.color.set(studio?0x101e26:0xd9c8a4);floor.material.needsUpdate=true;floorRing.visible=!studio;backdrop.visible=!studio;selectMachine(studio?'studio':'dragon');});
$('quality').addEventListener('change',function(){
  var levels={low:.75,balanced:1,high:1.5,ultra:2},ratio=levels[this.value]||basePixelRatio;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,ratio));
  renderer.shadowMap.enabled=!isSoftwareGL&&this.value!=='low';sun.castShadow=renderer.shadowMap.enabled;
  spawnScale=this.value==='low'?.4:this.value==='ultra'?1:.7;qLevel=0;
});
window.catJelly={snapshot:function(){return {type:currentType,material:currentTex,mode:mode,pressure:pressure,platen:platenBottom(),holding:holding,pressState:machineBroken?'FAILURE':holding?(hero&&hero.soft&&hero.soft.contact>0?'COMPRESSING':'DESCENDING'):(platenY<PLATEN_TOP-.02?'RETRACTING':'IDLE'),lifecycle:hero?hero.lifecycle:'FRAGMENTED',grabbed:!!(hero&&hero.soft&&hero.soft.grab),physics:hero&&hero.soft?hero.soft.metrics():null,physicsMs:hero?hero.physicsMs:0,fps:measuredFPS,quality:$('quality').value,pieces:pieces.length,glints:dynamics.active,droplets:droplets.length,puddles:puddles.length,streams:waterStreams.length,waterfalls:waterfalls.length,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fracture:lastFracture,backend:'WebGL '+THREE.REVISION};}};
/* ---------- Boot ---------- */
lang=detectLang();
syncLangButtons();
setCatSize(1,false);
setHero('mochi');
applyLang();
setTimeout(function(){ toast(t('newCatToast').replace('{name}',FORMS.mochi.label)); },600);
requestAnimationFrame(animate);
})();
