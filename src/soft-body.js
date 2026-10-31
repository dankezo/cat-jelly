/* Cat Jelly volumetric XPBD. Original implementation, MIT.
   Macklin et al., XPBD (2016): compliance / h², accumulated multipliers.
   A star tetrahedral cage is suitable for the existing radial SDF cats.
   ponytail: no surface self-collision; stop before severe fold-over. */
(function(root){
'use strict';
const PRESETS = {
  mochi: {edge:0.00010, bulk:0.000000002, damping:3.2, friction:.3, density:1, restitution:.28, failure:.56, recovery:1},
  pudding:{edge:0.00024, bulk:0.000000004, damping:7, friction:.6, density:1.15, restitution:.12, failure:.56, recovery:.65},
  soda:{edge:0.000065, bulk:0.000000002, damping:2.5, friction:.34, density:.85, restitution:.38, failure:.53, recovery:1.2},
  tabby:{edge:0.000035, bulk:0.000000001, damping:4, friction:.4, density:1.1, restitution:.2, failure:.44, recovery:1.4}
};
function determinant(a,b,c){return a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);}
function sub(p,a,b){return [p[a*3]-p[b*3],p[a*3+1]-p[b*3+1],p[a*3+2]-p[b*3+2]];}
function volume(p,t){return determinant(sub(p,t[1],t[0]),sub(p,t[2],t[0]),sub(p,t[3],t[0]))/6;}
class SoftBody {
  constructor(positions, triangles, center, preset=PRESETS.mochi){
    this.preset={...preset};
    const nodes=[], lookup=new Map(), remap=[];
    for(let i=0;i<positions.length;i+=3){
      const key=positions.slice(i,i+3).map(x=>Math.round(x*1e5)).join(',');
      if(!lookup.has(key)){lookup.set(key,nodes.length/3);nodes.push(...positions.slice(i,i+3));}
      remap.push(lookup.get(key));
    }
    const c=nodes.length/3;nodes.push(...center);
    this.rest=Float64Array.from(nodes);this.positions=this.rest.slice();this.previous=this.rest.slice();
    this.velocities=new Float64Array(nodes.length);this.tets=[];this.edges=[];
    const edges=new Set();
    for(let i=0;i<triangles.length;i+=3){
      let t=[c,remap[triangles[i]],remap[triangles[i+1]],remap[triangles[i+2]]];
      if(new Set(t).size!==4||Math.abs(volume(this.rest,t))<1e-8)continue;
      if(volume(this.rest,t)<0)[t[2],t[3]]=[t[3],t[2]];
      this.tets.push(t);
      for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)edges.add([Math.min(t[a],t[b]),Math.max(t[a],t[b])].join(','));
    }
    this.edges=[...edges].map(s=>s.split(',').map(Number));
    this.lengths=Float64Array.from(this.edges,e=>Math.hypot(...sub(this.rest,e[0],e[1])));
    this.volumes=Float64Array.from(this.tets,t=>volume(this.rest,t));
    this.edgeLambda=new Float64Array(this.edges.length);this.volumeLambda=new Float64Array(this.tets.length);
    this.restVolume=this.volumes.reduce((a,b)=>a+b,0);
    this.accumulator=0;this.contact=0;this.strain=0;this.grab=null;this.steps=0;
    this.grad=new Float64Array(12);
    this.restHeight=Math.max(...nodes.filter((_,i)=>i%3===1));
  }
  embed(points){
    const ids=new Uint16Array(points.length/3*4),weights=new Float64Array(ids.length);
    for(let i=0;i<points.length;i+=3){
      let best=Infinity, bestT, bestW;
      for(const t of this.tets){
        const a=t[0]*3, q=[points[i]-this.rest[a],points[i+1]-this.rest[a+1],points[i+2]-this.rest[a+2]];
        const b=sub(this.rest,t[1],t[0]),c=sub(this.rest,t[2],t[0]),d=sub(this.rest,t[3],t[0]);
        const det=determinant(b,c,d);
        const w1=determinant(q,c,d)/det,w2=determinant(b,q,d)/det,w3=determinant(b,c,q)/det;
        const w=[1-w1-w2-w3,w1,w2,w3], score=w.reduce((s,x)=>s+Math.max(0,-x),0);
        if(score<best){best=score;bestT=t;bestW=w;if(score<1e-8)break;}
      }
      if(!bestT)throw new Error('Empty tetrahedral cage');
      ids.set(bestT,i/3*4);weights.set(bestW,i/3*4);
    }
    return {ids,weights};
  }
  deform(binding,out){
    const p=this.positions,{ids,weights}=binding;
    for(let i=0;i<out.length/3;i++)for(let k=0;k<3;k++){
      let value=0;for(let j=0;j<4;j++)value+=p[ids[i*4+j]*3+k]*weights[i*4+j];
      out[i*3+k]=value;
    }
  }
  nearest(point){
    let best=Infinity,index=0;
    for(let i=0;i<this.positions.length;i+=3){const d=(this.positions[i]-point[0])**2+(this.positions[i+1]-point[1])**2+(this.positions[i+2]-point[2])**2;if(d<best){best=d;index=i/3;}}
    return index;
  }
  impulse(point,impulse){
    const index=this.nearest(point)*3;for(let k=0;k<3;k++)this.velocities[index+k]+=impulse[k];
  }
  advance(dt,ceiling=Infinity,gravity=9.81,floor=0){
    this.accumulator=Math.min(this.accumulator+Math.max(0,dt),.1);
    const h=1/120;let n=0;
    while(this.accumulator+1e-10>=h&&n++<12){this.step(h,ceiling,gravity,floor);this.accumulator-=h;}
  }
  step(h,ceiling,gravity,floor=0){
    const p=this.positions,v=this.velocities,prev=this.previous,ps=this.preset;
    prev.set(p);this.edgeLambda.fill(0);this.volumeLambda.fill(0);this.contact=0;
    const invMass=1/ps.density;
    for(let i=0;i<p.length;i+=3){v[i+1]-=gravity*h;for(let k=0;k<3;k++)p[i+k]+=v[i+k]*h;}
    for(let iteration=0;iteration<12;iteration++){
      const ae=ps.edge/(h*h*ps.recovery),av=ps.bulk/(h*h);
      for(let e=0;e<this.edges.length;e++){
        const [a,b]=this.edges[e],ia=a*3,ib=b*3;
        const dx=p[ia]-p[ib],dy=p[ia+1]-p[ib+1],dz=p[ia+2]-p[ib+2],len=Math.hypot(dx,dy,dz);
        if(len<1e-9)continue;
        const dl=(-(len-this.lengths[e])-ae*this.edgeLambda[e])/(2*invMass+ae);this.edgeLambda[e]+=dl;
        const gain=dl*invMass/len;
        p[ia]+=dx*gain;p[ia+1]+=dy*gain;p[ia+2]+=dz*gain;p[ib]-=dx*gain;p[ib+1]-=dy*gain;p[ib+2]-=dz*gain;
      }
      for(let t=0;t<this.tets.length;t++){
        const ids=this.tets[t],a=ids[0]*3,b=ids[1]*3,c=ids[2]*3,d=ids[3]*3,g=this.grad;
        const bx=p[b]-p[a],by=p[b+1]-p[a+1],bz=p[b+2]-p[a+2];
        const cx=p[c]-p[a],cy=p[c+1]-p[a+1],cz=p[c+2]-p[a+2];
        const dx=p[d]-p[a],dy=p[d+1]-p[a+1],dz=p[d+2]-p[a+2];
        g[3]=(cy*dz-cz*dy)/6;g[4]=(cz*dx-cx*dz)/6;g[5]=(cx*dy-cy*dx)/6;
        g[6]=(dy*bz-dz*by)/6;g[7]=(dz*bx-dx*bz)/6;g[8]=(dx*by-dy*bx)/6;
        g[9]=(by*cz-bz*cy)/6;g[10]=(bz*cx-bx*cz)/6;g[11]=(bx*cy-by*cx)/6;
        for(let k=0;k<3;k++)g[k]=-g[3+k]-g[6+k]-g[9+k];
        let denom=av;for(let k=0;k<12;k++)denom+=invMass*g[k]*g[k];
        const vol=bx*g[3]+by*g[4]+bz*g[5];
        const dl=(-(vol-this.volumes[t])-av*this.volumeLambda[t])/denom;this.volumeLambda[t]+=dl;
        for(let j=0;j<4;j++)for(let k=0;k<3;k++)p[ids[j]*3+k]+=invMass*dl*g[j*3+k];
      }
      if(this.grab){
        const i=this.grab.index*3;
        for(let k=0;k<3;k++)p[i+k]+=(this.grab.target[k]-p[i+k])*.35;
      }
      for(let i=0;i<p.length;i+=3){
        const low=typeof floor==='function'?floor(p[i],p[i+2]):floor,high=typeof ceiling==='function'?ceiling(p[i],p[i+2]):ceiling;
        if(p[i+1]<low)p[i+1]=low;
        if(p[i+1]>high){this.contact+=p[i+1]-high;p[i+1]=high;}
      }
    }
    let strain=0;
    for(let e=0;e<this.edges.length;e++){
      const [a,b]=this.edges[e],len=Math.hypot(p[a*3]-p[b*3],p[a*3+1]-p[b*3+1],p[a*3+2]-p[b*3+2]);
      strain=Math.max(strain,Math.abs(len/this.lengths[e]-1));
    }
    this.strain=strain;
    const damping=Math.exp(-ps.damping*h);
    for(let i=0;i<p.length;i+=3){
      const low=typeof floor==='function'?floor(p[i],p[i+2]):floor, impact=v[i+1];
      for(let k=0;k<3;k++){
      v[i+k]=(p[i+k]-prev[i+k])/h*damping;
      if(p[i+1]<low+.001&&k!==1)v[i+k]*=Math.exp(-(ps.friction||.3)*25*h);
      }
      if(p[i+1]<=low+.001&&prev[i+1]>low+.001&&impact<-1)v[i+1]=Math.max(v[i+1],-impact*ps.restitution);
    }
    this.steps++;
  }
  metrics(){
    let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity,inverted=0,vol=0;
    for(let i=0;i<this.positions.length;i+=3){const p=this.positions;minY=Math.min(minY,p[i+1]);maxY=Math.max(maxY,p[i+1]);minX=Math.min(minX,p[i]);maxX=Math.max(maxX,p[i]);}
    for(const t of this.tets){const v=volume(this.positions,t);vol+=v;if(v<=0)inverted++;}
    return {volume:vol,volumeRatio:vol/this.restVolume,height:maxY-minY,width:maxX-minX,minY,maxY,inverted,strain:this.strain,contact:this.contact,particles:this.positions.length/3,steps:this.steps};
  }
}
SoftBody.presets=PRESETS;
if(typeof module!=='undefined')module.exports=SoftBody;else root.CatSoftBody=SoftBody;
})(typeof globalThis!=='undefined'?globalThis:this);
