const assert=require('node:assert/strict');
const THREE=require('../vendor/three.min.js');
const SoftBody=require('../src/soft-body.js');
function body(preset='mochi'){
 const g=new THREE.SphereGeometry(1,16,12);g.translate(0,1,0);
 return new SoftBody(Array.from(g.attributes.position.array),Array.from(g.index.array),[0,1,0],SoftBody.presets[preset]);
}
for(const preset of Object.keys(SoftBody.presets)){
 const b=body(preset),rest=b.metrics();
 for(let i=0;i<240;i++)b.advance(1/120,Infinity);
 const idle=b.metrics();
 assert([...b.positions].every(Number.isFinite));
 for(let i=0;i<240;i++)b.advance(1/120,2-i/240*.8);
 const compressed=b.metrics();
 console.log('PASS '+preset+': volume ratio '+compressed.volumeRatio.toFixed(3)+', lateral spread '+(compressed.width/rest.width).toFixed(3));
 assert(compressed.maxY<=1.204,'plate contact');assert(compressed.minY>=0,'floor contact');
 assert(compressed.width>rest.width*1.05,'compression must spread laterally');
 assert(compressed.volumeRatio>.85,'volume preservation');assert.equal(compressed.inverted,0,'no inverted cells');
 for(let i=0;i<480;i++)b.advance(1/120,Infinity);
 assert(b.metrics().height>compressed.height*1.3,'elastic recovery');
}
const a=body(),b=body();
for(let i=0;i<60;i++)a.advance(1/30,1.5);
for(let i=0;i<288;i++)b.advance(1/144,1.5);
assert.equal(a.steps,b.steps);
assert(Math.max(...a.positions.map((v,i)=>Math.abs(v-b.positions[i])))<1e-8,'frame rate independence');
const original=a.positions.slice(),binding=a.embed(original),out=new Float64Array(original.length);a.deform(binding,out);
// Rest-space embedding is exact at initialization; exercise with fresh body.
const fresh=body(),map=fresh.embed(fresh.rest);fresh.deform(map,out);
assert(Math.max(...fresh.rest.map((v,i)=>Math.abs(v-out[i])))<1e-8);
a.advance(100,1);assert(a.accumulator<1/120,'bounded accumulator');
console.log('PASS volumetric constraints, contact, recovery, embedding, fixed timestep');

// Exercise the exact production SDF cage, not only an ideal sphere.
const mascot=require('../src/mascot.js');
for(const type of Object.keys(mascot.forms)){
 const g=mascot.geometry(THREE,type,true,false),form=mascot.forms[type];
 const b=new SoftBody(Array.from(g.attributes.position.array),Array.from(g.index.array),[0,form.oy,0],SoftBody.presets[type]);
 for(let i=0;i<240;i++)b.advance(1/120,b.restHeight*(1-i/240*.52));
 const compressed=b.metrics();
 assert.equal(compressed.inverted,0,type+' compression without inverted cells');
 assert(compressed.volumeRatio>.9,type+' volume preservation before fracture');
 for(let i=0;i<480;i++)b.advance(1/120,Infinity);
 assert(b.metrics().strain<.13,type+' rest shape recovery (orientation is free)');
 b.grab={index:b.nearest([0,form.eyeY,1]),target:[1,4,1]};
 for(let i=0;i<120;i++)b.advance(1/120,Infinity);
 assert.equal(b.metrics().inverted,0,type+' local grab');assert(b.metrics().minY>.1,type+' can be lifted');
 b.grab=null;for(let i=0;i<360;i++)b.advance(1/120,Infinity);
 assert([...b.positions].every(Number.isFinite));assert.equal(b.metrics().inverted,0);
 console.log('PASS '+type+': production cage compression, recovery, lift and drop');
}
