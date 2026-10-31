const assert=require('node:assert/strict');
const THREE=require('../vendor/three.min.js'),mascot=require('../src/mascot.js'),partition=require('../src/fracture.js');
for(const type of Object.keys(mascot.forms)){
 const g=mascot.geometry(THREE,type,false,false),p=Array.from(g.attributes.position.array),indices=Array.from(g.index.array);
 for(const count of [7,9,11,19]){
 const groups=partition(p,indices,[0,mascot.forms[type].oy,0],count);
 assert.equal(groups.length,count);
 assert.equal(groups.reduce((n,g)=>n+g.outer,0),indices.length/3,'every source triangle preserved once');
 let original=0;
 function volume(a,b,c){return (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}
 for(let i=0;i<indices.length;i+=3)original+=volume(...indices.slice(i,i+3).map(j=>p.slice(j*3,j*3+3)));
 let total=0;
 for(const group of groups){
   const edges=new Map();let signed=0;
   for(let i=0;i<group.faces.length;i+=9){
     const tri=[0,3,6].map(k=>group.faces.slice(i+k,i+k+3));signed+=volume(...tri);
     const keys=tri.map(a=>a.map(v=>Math.round(v*1e5)).join(','));
     if(new Set(keys).size<3)continue;
     for(let k=0;k<3;k++){const edge=[keys[k],keys[(k+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);}
   }
   assert([...edges.values()].every(n=>n===2),'closed, manifold fragment boundary');
   assert(signed>0,'outward fragment orientation');total+=signed;
 }
 assert(Math.abs(total-original)<1e-8,'interior surfaces cancel, total enclosed volume conserved');
 console.log('PASS '+type+': '+count+' closed fragments; exact exterior and volume conservation');
 }
}
