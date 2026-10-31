/* Closed surface partition: exterior triangles are never replaced with random blobs.
   Each region owns a wedge of the same deformed, star-shaped source volume.
   Shared boundary edges receive matching interior triangles through the cage centre. */
(function(root){
'use strict';
function partition(positions,indices,center,count=7){
  const seeds=[];
  for(let i=0;i<count;i++){
    const y=1-2*(i+.5)/count,r=Math.sqrt(1-y*y),a=i*2.399963229728653;
    seeds.push([Math.cos(a)*r,y,Math.sin(a)*r]);
  }
  const groups=Array.from({length:count},()=>({faces:[],sourceIndices:[],outer:0,volume:0})),edges=new Map();
  const keys=[];for(let i=0;i<positions.length;i+=3)keys.push(positions.slice(i,i+3).map(v=>Math.round(v*1e5)).join(','));
  function point(i){return positions.slice(i*3,i*3+3);}
  for(let i=0;i<indices.length;i+=3){
    const tri=indices.slice(i,i+3),a=point(tri[0]),b=point(tri[1]),c=point(tri[2]);
    const normal=[(a[0]+b[0]+c[0])/3-center[0],(a[1]+b[1]+c[1])/3-center[1],(a[2]+b[2]+c[2])/3-center[2]];
    let best=-Infinity,region=0;seeds.forEach((s,j)=>{const score=s[0]*normal[0]+s[1]*normal[1]+s[2]*normal[2];if(score>best){best=score;region=j;}});
    groups[region].faces.push(...a,...b,...c);groups[region].sourceIndices.push(...tri);groups[region].outer++;
    const u=a.map((v,k)=>v-center[k]),v=b.map((v,k)=>v-center[k]),w=c.map((v,k)=>v-center[k]);
    groups[region].volume+=Math.abs(u[0]*(v[1]*w[2]-v[2]*w[1])+u[1]*(v[2]*w[0]-v[0]*w[2])+u[2]*(v[0]*w[1]-v[1]*w[0]))/6;
    for(let e=0;e<3;e++){
      const ia=tri[e],ib=tri[(e+1)%3];if(keys[ia]===keys[ib])continue;
      const key=[keys[ia],keys[ib]].sort().join('|');
      if(!edges.has(key))edges.set(key,[]);edges.get(key).push({region,a:point(ia),b:point(ib)});
    }
  }
  for(const boundary of edges.values()){
    if(boundary.length===2&&boundary[0].region!==boundary[1].region){
      for(const e of boundary)groups[e.region].faces.push(...center,...e.b,...e.a);
    }
  }
  return groups.filter(g=>g.outer>0);
}
if(typeof module!=='undefined')module.exports=partition;else root.partitionCat=partition;
})(globalThis);
