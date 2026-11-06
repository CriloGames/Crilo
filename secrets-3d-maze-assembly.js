import {buildMazeWalls} from "./secrets-3d-maze-walls.js?v=2";

// A stationary ivory disk and one fully connected raised-wall geometry.
// Wheel animation and puzzle save data remain owned by the game.
export function sculptMaze({THREE,plate,C,ring,mat,materials,
 openEdges,key,sectors,rings,innerRadius,pitch,startAngle}){
 const {darkMetal,brass,steel,ebony}=materials;
 const face=mat(0xf0e6d5,.48,.32);
 const ink=mat(0x27231f,.29,.61);
 const bevel=mat(0xc9b99e,.41,.36);
 const goalMetal=mat(0xe1b16b,.40,.31);
 const goalLit=mat(0xffd991,.30,.20);
 goalLit.emissive.setHex(0xa66b25);goalLit.emissiveIntensity=.92;
 for(const a of [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4])
  C(plate,.016,.077,Math.cos(a)*.327,Math.sin(a)*.327,.076,steel);
 C(plate,.365,.034,0,0,.112,darkMetal);
 C(plate,.354,.024,0,0,.143,face);
 C(plate,.334,.012,0,0,.160,face);
 ring(plate,.358,.007,0,0,.161,brass);
 ring(plate,.375,.006,0,0,.132,steel);
 ring(plate,.389,.005,0,0,.124,brass);
 const relief=buildMazeWalls({THREE,plate,openEdges,key,sectors,rings,
  innerRadius,pitch,startAngle,bevel,ink});
 const goalSector=sectors/2;
 const sectorWidth=2*Math.PI/sectors;
 // The connected wall cheeks create an opening 24% wider than one sector.
 const centerMouthWidth=1.24*sectorWidth;
 const centerMouthAngle=startAngle+goalSector*sectorWidth;
 const goalCollarGap=4.1*sectorWidth;
 const goalSocket=new THREE.Mesh(new THREE.TorusGeometry(
  .027,.003,9,72,2*Math.PI-goalCollarGap),goalMetal);
 goalSocket.rotation.z=centerMouthAngle+goalCollarGap/2;
 goalSocket.position.z=.175;plate.add(goalSocket);
 C(plate,.021,.008,0,0,.171,ebony);
 const entry=new THREE.Mesh(new THREE.ConeGeometry(.009,.017,3),
  goalMetal);
 entry.position.set(0,-.332,.179);plate.add(entry);
 for(let i=0;i<4;i++){
  const a=(i+.5)*Math.PI/2;
  C(plate,.009,.009,.378*Math.cos(a),.378*Math.sin(a),.147,steel);
 }
 return {mazeWallCount:relief.wallRuns,mazeRelief:relief,
  goalSocket,goalMetal,goalLit,centerMouthWidth,goalCollarGap,
  goalSector,added:20};
}
