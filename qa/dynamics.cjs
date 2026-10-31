const assert=require('node:assert/strict'),T=require('../vendor/three.min.js'),Dynamics=require('../src/dynamics.js');
const scene=new T.Scene(),d=new Dynamics(T,scene);
for(let i=0;i<200;i++)d.emit({x:0,y:.4,z:0},3,0xffaacc,'fracture');
d.update(1/120);assert.equal(d.pool.length,64);assert(d.active<=64&&d.active>0);assert(d.pool.every(p=>Number.isFinite(p.y)&&p.y>=.35));
d.update(1);assert.equal(d.active,0);d.emit({x:0,y:1,z:0},2,0xffffff,'impact');d.clear();assert.equal(d.active,0);assert.equal(scene.children.length,1);
console.log('PASS fixed glint pool, finite trajectories, floor contact, expiry and reset');
