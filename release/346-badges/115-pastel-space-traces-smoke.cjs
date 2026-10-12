'use strict';
/* Decorative SVGs must remain inside wide-screen margins, with no controls
   or other app logic affected. This guards light/dark SVG pairs and CSS. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('play-accents.css');
for(const [p,expectedCount,viewBox] of [
 ['pastel-space-traces.svg',8,'0 0 1600 1120'],
 ['pastel-space-traces-night.svg',8,'0 0 1600 1120'],
 ['pastel-play-traces.svg',5,'0 0 900 1180'],
 ['pastel-play-traces-night.svg',5,'0 0 900 1180']
]){
 const svg=read(p);
 assert.ok(svg.includes('viewBox="'+viewBox+'"'),p+' dimensions changed');
 assert.match(svg,/fill="none"/,p+' must be line art, not solid fills');
 assert.match(svg,/stroke-linecap="round"/,p+' must have smooth ends');
 assert.doesNotMatch(svg,/<(?:script|foreignObject|image|use|animate)\b/i,
  p+' should be static, dependency-free, and inert');
 assert.equal((svg.match(/<path\b/g)||[]).length,expectedCount,p+' accent count');
 const paths=[...svg.matchAll(/<path\s+d="([^"]+)"/g)].map(m=>m[1]);
 const width=Number(viewBox.split(' ')[2]);
 for(const d of paths){
  const first=/^M(-?\d+)/.exec(d);
  assert.ok(first,p+' must use an absolute starting point');
  const x=Number(first[1]);
  assert.ok(x<=width*.16||x>=width*.84,p+' line originates inside gutter');
  // All control points must remain in the same outside strip: a curve
  // starting at the edge could otherwise sweep across a button or heading.
  const coordinates=d.match(/-?\d+/g).map(Number);
  for(let i=0;i<coordinates.length;i+=2){
   const px=coordinates[i];
   const strip=width===900?.13:.085;
   assert.ok(px<=width*strip||px>=width*(1-strip),
    p+' control point enters main content: '+px);
  }
 }
}
assert.match(css,/@media \(min-width:1480px\)/,'Gutter art must not appear on narrow pages');
assert.match(css,/@media \(min-width:980px\) and \(max-width:1479px\)/,
 'Play-only ornaments must stay in the spacious medium desktop layout');
assert.ok(css.includes('background-repeat:repeat-y')&&css.includes('background-repeat:no-repeat'),
 'Large side art repeats vertically, while Play-only art does not');
assert.ok(css.includes('html[data-theme="dark"] body:has(.topbar)')&&
 css.includes('html[data-theme="dark"] body:has(#wheelWrap)'),
 'Use muted night variants');
assert.ok(css.includes(':not(:has(.pastel-world))'),'Support scene remains untouched');
assert.ok(!css.includes('position:fixed'),'No floating decorative hitboxes');
console.log('PASTEL_SPACE_TRACES_PASS: curved side-gutter art, 4 safe SVGs, muted night colors, desktop-only placement');
