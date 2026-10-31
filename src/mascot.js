/* Original Cat Jelly smooth-union model; shared by renderer and physics regression tests. */
(function(root){
'use strict';
function sdEll(px,py,pz,cx,cy,cz,rx,ry,rz){
  var dx=(px-cx)/rx,dy=(py-cy)/ry,dz=(pz-cz)/rz;
  var k0=Math.sqrt(dx*dx+dy*dy+dz*dz);
  var ex=(px-cx)/(rx*rx),ey=(py-cy)/(ry*ry),ez=(pz-cz)/(rz*rz);
  var k1=Math.sqrt(ex*ex+ey*ey+ez*ez);
  return k1>1e-7? k0*(k0-1.0)/k1 : k0-1.0;
}
function smin(a,b,k){ var h=0.5+0.5*(b-a)/k; h=h<0?0:(h>1?1:h); return b+(a-b)*h-k*h*(1-h); }
var FORMS={
  mochi:{label:"Mochi",color:0xff4f92,height:2.92,scale:1.3,oy:1.15,pressScale:0.92,verdict:0,tex:"jelly",clones:3,
    eyeY:1.90,eyeX:0.28,eyeZ:0.70,noseY:1.68,noseZ:0.84,
    parts:[[0,0.92,0,1.10,0.95,1.02,0.30],[0,1.80,0.05,0.80,0.70,0.74,0.34],[-0.47,2.46,0,0.20,0.38,0.20,0.16],[0.47,2.46,0,0.20,0.38,0.20,0.16],[0,1.63,0.55,0.37,0.28,0.30,0.22],[-0.53,0.22,0.50,0.30,0.21,0.42,0.20],[0.53,0.22,0.50,0.30,0.21,0.42,0.20],[0,0.66,-1.00,0.30,0.46,0.30,0.24]]},
  pudding:{label:"Pudding",color:0xff9d1f,height:2.14,scale:1.3,oy:0.8,pressScale:1.0,verdict:1,tex:"lego",clones:1,
    eyeY:1.32,eyeX:0.30,eyeZ:0.76,noseY:1.12,noseZ:0.90,
    parts:[[0,0.60,0,1.40,0.64,1.26,0.30],[0,1.22,0.05,0.88,0.56,0.80,0.34],[-0.50,1.80,0,0.19,0.30,0.19,0.14],[0.50,1.80,0,0.19,0.30,0.19,0.14],[0,1.08,0.62,0.38,0.25,0.30,0.22],[-0.62,0.16,0.55,0.32,0.17,0.42,0.18],[0.62,0.16,0.55,0.32,0.17,0.42,0.18],[0,0.45,-1.22,0.32,0.36,0.30,0.24]]},
  soda:{label:"Soda",color:0x0ec9a4,height:3.78,scale:1.12,oy:1.55,pressScale:0.8,verdict:2,tex:"water",clones:3,
    eyeY:2.76,eyeX:0.27,eyeZ:0.68,noseY:2.55,noseZ:0.80,
    parts:[[0,1.24,0,0.94,1.32,0.90,0.30],[0,2.66,0.05,0.76,0.68,0.72,0.34],[-0.45,3.32,0,0.19,0.37,0.19,0.16],[0.45,3.32,0,0.19,0.37,0.19,0.16],[0,2.50,0.52,0.35,0.27,0.29,0.22],[-0.48,0.20,0.46,0.29,0.20,0.40,0.20],[0.48,0.20,0.46,0.29,0.20,0.40,0.20],[0,0.72,-0.92,0.28,0.48,0.28,0.24]]}
};
// Broad cheek silhouette, thick ears and a low, rounded body share one continuous skin.
FORMS.mochi.parts=[[0,.72,0,1.02,.78,.88,.36],[0,1.55,.04,1.04,.92,.87,.4],[-.69,2.28,.02,.3,.46,.28,.22],[.69,2.28,.02,.3,.46,.28,.22],[-.48,1.36,.55,.5,.4,.43,.28],[.48,1.36,.55,.5,.4,.43,.28],[-.55,.18,.4,.35,.21,.4,.25],[.55,.18,.4,.35,.21,.4,.25],[0,.6,-.78,.3,.4,.3,.25]];
Object.assign(FORMS.mochi,{color:0xf4a2b8,eyeY:1.55,eyeX:.39,noseY:1.32});
FORMS.pudding.color=0xf0b96a;FORMS.soda.color=0x75d5bb;
FORMS.tabby=Object.assign({},FORMS.mochi,{label:'Orange Tabby',color:0xf5a34f,height:3.12,oy:1.25,eyeY:2.0,noseY:1.78,parts:FORMS.mochi.parts.map(function(p){var q=p.slice();q[1]*=1.06;return q;})});

function sdfCat(form,px,py,pz){
  var d=1e9, parts=form.parts;
  for(var i=0;i<parts.length;i++){ var q=parts[i]; var e=sdEll(px,py,pz,q[0],q[1],q[2],q[3],q[4],q[5]); d=(i===0)?e:smin(d,e,q[6]); }
  return d;
}
function geometry(THREE,type,coarse,mobile){
  var form=FORMS[type];
  var geo=coarse?new THREE.SphereGeometry(1,16,12):(mobile? new THREE.SphereGeometry(1,34,24) : new THREE.SphereGeometry(1,46,34));
  var pos=geo.attributes.position, vx,vy,vz,len,lo,hi,mid,i,it;
  for(i=0;i<pos.count;i++){
    vx=pos.getX(i); vy=pos.getY(i); vz=pos.getZ(i);
    len=Math.sqrt(vx*vx+vy*vy+vz*vz)||1; vx/=len; vy/=len; vz/=len;
    lo=0.05; hi=3.9;
    for(it=0;it<22;it++){ mid=(lo+hi)*0.5; if(sdfCat(form,vx*mid,form.oy+vy*mid,vz*mid)<0) lo=mid; else hi=mid; }
    var r=(lo+hi)*0.5; pos.setXYZ(i,vx*r,form.oy+vy*r,vz*r);
  }
  geo.computeVertexNormals(); return geo;
}

var api={forms:FORMS,sdf:sdfCat,geometry:geometry};if(typeof module!=='undefined')module.exports=api;else root.CatMascot=api;
})(globalThis);
