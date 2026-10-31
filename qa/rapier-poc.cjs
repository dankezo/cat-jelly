const assert=require('node:assert/strict');
const R=require(process.env.CAT_RAPIER_PACKAGE || '@dimforge/rapier3d-compat');
(async()=>{
 await R.init();
 const world=new R.World({x:0,y:-9.81,z:0});
 const ground=world.createRigidBody(R.RigidBodyDesc.fixed());
 world.createCollider(R.ColliderDesc.cuboid(3,.1,3).setTranslation(0,-.1,0),ground);
 const desc=R.SoftBodyDesc.cuboid({x:0,y:1,z:0},{x:.5,y:.5,z:.5},3,3,3).setSoftness(8,.4).setMass(1);
 const body=world.createSoftBody(desc);
 for(let i=0;i<240;i++)world.step();
 const positions=body.particlePositions();
 assert(positions.length>0 && [...positions].every(Number.isFinite));
 console.log('Rapier',R.version(),'soft body particles',positions.length/3,'cells',body.cells().length/4,'finite after 240 steps');
 world.free();
})().catch(e=>{console.error(e);process.exit(1)});
