/* Beetle trick-lab and main-page poop timing regression.
 * Static, read-only check of real site HTML/CSS/JS with layout timing arithmetic. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const demo=fs.readFileSync(path.join(root,'beetle-tricks.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const js=fs.readFileSync(path.join(root,'bug-beetle.js'),'utf8');
const kinds=['backflip','barrel','frontflip','doublehop','wiggle'];
assert.ok(html.includes('style.css?v=80'),'Live homepage must load new footer styles');
assert.ok(demo.includes('style.css?v=80'),'Lab must share actual live beetle CSS');
assert.equal((demo.match(/viewBox="0 0 112 60"/g)||[]).length,6,
 'Show six actual beetles at once: five specials and normal control');
assert.equal((demo.match(/class="beetle-demo-stage"/g)||[]).length,6);
assert.equal((demo.match(/class="crilo-beetle-dropping"/g)||[]).length,6,
 'Poop should exist in markup but be hidden for special turns');
for(const kind of kinds){
 assert.ok(demo.includes('beetle-right-'+kind+' beetle-left-'+kind),
  'Lab should demonstrate both wall turns for '+kind);
 assert.ok(css.includes('.crilo-beetle-track.walking.beetle-right-'+kind),
  'The demo should use actual production animation CSS for '+kind);
 assert.ok(css.includes('.crilo-beetle-track.walking.beetle-left-'+kind));
}
assert.ok(demo.includes('id="replayAll"')&&demo.includes('id="pauseAll"'),
 'Replay and pause test controls must work');
assert.ok(demo.includes('animation-delay:-6.4s!important'),
 'All five rare-turn previews must start together close to their first wall');
assert.ok(css.includes('[class*="beetle-right-"] .crilo-beetle-dropping')&&
 css.includes('[class*="beetle-left-"] .crilo-beetle-dropping'),
 'All five special animations on either wall must suppress poop');
assert.ok(css.includes('animation:none!important;opacity:0!important}'),
 'Poop cannot appear during special turns');
assert.ok(css.includes('0%,74.2%{opacity:0')&&css.includes('74.6%,88%{opacity:1'),
 'Poop should appear precisely when the returning beetle clears it');
for(const [width,beetleWidth,offset] of [
 [320,65,40],[375,65,40],[768,74,46],[1440,74,46],[1494,74,46]]){
 const start=width-beetleWidth-8;
 const xAtDrop=start+(8-start)*(74.6-50)/(96-50);
 const rear=xAtDrop+beetleWidth;
 const drop=.4674*width+offset;
 const gap=drop-rear;
 assert.ok(gap>=0&&gap<12,
   'Drop must land within 12px BEHIND beetle, not far away, at '+width+'px; gap '+gap);
}
assert.ok(css.includes('width:100%;height:61px')&&css.includes('overflow:visible'),
 'Footer should be tighter and keep Report a Bug tooltip unclipped');
assert.ok(css.includes('height:59px')&&css.includes('--beetle-width:65px'),
 'Mobile footer also needs a tighter gap');
assert.ok(js.includes('Math.random()<1/15'),'Rare 1-in-15 chance must remain unchanged');
assert.ok(js.includes("'/functions/v1/report-bug'"),'Bug report endpoint must remain intact');
console.log('PASS: all five simultaneous demo tricks, no special poop, corrected normal timing at four viewport widths, tighter footer, reporting unchanged.');
