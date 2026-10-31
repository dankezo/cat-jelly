/* Event-driven optical glints. Fixed pool, no invented solid fragment mass. */
(function(root){
'use strict';
class Dynamics {
 constructor(THREE,scene){
  this.THREE=THREE;this.pool=Array.from({length:64},()=>({life:0}));this.cursor=0;
  this.mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.65,depthWrite:false}),64);
  this.mesh.frustumCulled=false;this.transform=new THREE.Object3D();this.color=new THREE.Color();this.tint=new THREE.Color(0xffe8c5);scene.add(this.mesh);
  this.update(0);
 }
 emit(point,energy,color,kind){
  const n=Math.min(24,Math.max(4,Math.round(energy*8))),random=()=>{this.seed=(Math.imul(this.seed||13,1664525)+1013904223)|0;return (this.seed>>>0)/4294967296;};
  for(let i=0;i<n;i++){
   const p=this.pool[this.cursor++%64],angle=i/n*Math.PI*2+random()*.4,speed=(.4+random())*Math.min(3,energy);
   Object.assign(p,{x:point.x,y:point.y,z:point.z,vx:Math.cos(angle)*speed,vy:.4+random()*energy,vz:Math.sin(angle)*speed,life:.35+random()*.4,maxLife:.75,size:.025+random()*.05,color,kind});
  }
 }
 clear(){for(const p of this.pool)p.life=0;this.update(0);}
 update(dt){
  let count=0;
  this.pool.forEach((p,i)=>{
   p.life=Math.max(0,p.life-dt);
   if(p.life>0){
    p.vy-=4*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
    const floor=Math.hypot(p.x,p.z)<3.55?.35:.01;
    if(p.y<floor){p.y=floor;p.vy=Math.abs(p.vy)*.15;p.vx*=.8;p.vz*=.8;}
    this.transform.position.set(p.x,p.y,p.z);const fade=p.life/p.maxLife;
    this.transform.scale.set(p.size*fade,p.size*fade*(p.kind==='fracture'?2.5:1),p.size*fade);this.transform.rotation.set(p.life*4,i,0);
    this.color.set(p.color).lerp(this.tint,.25);count++;
   }else{this.transform.scale.setScalar(0);this.color.set(0);}
   this.transform.updateMatrix();this.mesh.setMatrixAt(i,this.transform.matrix);this.mesh.setColorAt(i,this.color);
  });
  this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;this.active=count;
 }
}
if(typeof module!=='undefined')module.exports=Dynamics;else root.CatDynamics=Dynamics;
})(globalThis);
