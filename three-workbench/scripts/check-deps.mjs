// Run inside three-workbench after npm install.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import gsap from 'gsap';
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';

const pkgs = [
 ['three','0.186.1'],
 ['gsap','3.15.0'],
 ['three-mesh-bvh','0.9.16']
];
for (const [name, expected] of pkgs) {
 const actual = JSON.parse(readFileSync(new URL('../node_modules/'+name+'/package.json',import.meta.url),'utf8')).version;
 assert.equal(actual, expected, name+' version mismatch');
 console.log(name+': '+actual);
}
const geometry = new THREE.BoxGeometry(1,1,1);
assert.equal(typeof THREE.WebGLRenderer,'function');
assert.equal(typeof gsap.to,'function');
assert.equal(typeof acceleratedRaycast,'function');
assert.equal(typeof computeBoundsTree,'function');
geometry.dispose();
console.log('PASS: Three.js, GSAP, and BVH imports verified.');
