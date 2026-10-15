'use strict';
/* Browser contract: every duck headwear SVG stays anchored at phone, tablet and
 * desktop sizes; Divine is a text-only pill with unchanged shared geometry. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {chromium}=require('playwright');

const duckSource=fs.readFileSync('ducks.js','utf8');
const badgeSource=fs.readFileSync('badge-collection.js','utf8');
const palette=fs.readFileSync('rarity-palette.css','utf8');
const layout=fs.readFileSync('style.css','utf8');
const badgeCss=fs.readFileSync('badge-collection.css','utf8');
const sql=fs.readFileSync('sql/duck-collection.sql','utf8');
const slugs=[...sql.matchAll(/\(\d+,'([^']+)','[^']+',\d+,/g)].map(m=>m[1]);
assert.equal(slugs.length,30,'Audit all 30 catalog ducks, not only screenshot examples');

const headSlugs=['cowboy','chef','wizard','royal','party','pirate',
 'astronaut','robot','angel','devil','frog'];
const ctx={window:{}};
vm.runInNewContext(duckSource,ctx,{filename:'ducks.js'});
vm.runInNewContext(badgeSource,ctx,{filename:'badge-collection.js'});
const ducks=ctx.window.DuckWorld, badges=ctx.window.CriloBadgeCollection;
assert.equal(typeof ducks.art,'function');
for(const slug of slugs){
 const art=ducks.art({slug});
 assert.match(art,/viewBox="0 0 100 90"/);
 const count=(art.match(/class="duck-head-accessory"/g)||[]).length;
 assert.equal(count,headSlugs.includes(slug)?1:0,'Head accessory selection '+slug);
 if(slug==='bee')assert.match(art,/M30 53H65/,'Body markings must not move');
}
const divine={badge_key:'v2_score_rarity_divine',name:'Divine Score',
 description:'A special earned rarity',requirement:{rarity:'divine'}};
assert.equal(badges.artHTML(divine),'','Divine renders without any medallion');
const html=badges.tileHTML(divine,true,s=>String(s),{interactive:false});
assert.match(html,/Divine Score/);
assert.doesNotMatch(html,/<svg|crilo-divine-art/,'Divine gallery uses no symbol');
assert.doesNotMatch(palette,/\.crilo-divine-art/,'Remove retired circular artifact styles');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const failures=[];
 try{
  const page=await browser.newPage();
  page.on('pageerror',e=>failures.push(e.message));
  await page.setContent('<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="badgeChecks"></div><main class="duck-page"><div id="duckGrid" class="duck-collection-grid"></div></main></body></html>');
  await page.addStyleTag({content:layout+'\n'+badgeCss+'\n'+palette+'\n.duck-collection-art svg{animation:none!important}'});
  await page.addScriptTag({content:duckSource});
  await page.evaluate(slugs=>{
   document.getElementById('duckGrid').innerHTML=slugs.map(slug=>
    '<article class="duck-collection-card"><div class="duck-collection-art">'+
    window.DuckWorld.art({slug})+'</div><b>'+slug+'</b></article>').join('');
   const types=['badge-top-chip','collection-tile','badge-card',
    'featured-slot featured-filled','badge-top-chip new-badge-item','featured-pick-option'];
   const parent=document.getElementById('badgeChecks');
   parent.innerHTML=types.map(type=>
    '<div><button class="'+type+'" data-badge-rarity="divine">Divine Score</button></div>').join('')+
    '<button class="badge-top-chip" data-badge-rarity="mythic">Divine Score</button>';
  },slugs);
  let checked=0;
  for(const width of [390,820,1280]){
   await page.setViewportSize({width,height:860});
   for(const theme of ['light','dark']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    const data=await page.evaluate(()=>{
     const score=document.querySelector('#badgeChecks [data-badge-rarity="divine"]');
     const mythic=document.querySelector('#badgeChecks [data-badge-rarity="mythic"]');
     const a=getComputedStyle(score),b=getComputedStyle(mythic);
     const divineStyles={ink:a.color,bg:a.backgroundImage,border:a.borderColor,
       height:score.getBoundingClientRect().height,padding:a.padding,
       radius:a.borderRadius,font:a.font,fontSize:a.fontSize,
       borderWidth:a.borderWidth};
     const mythicStyles={height:mythic.getBoundingClientRect().height,
       padding:b.padding,radius:b.borderRadius,font:b.font,
       fontSize:b.fontSize,borderWidth:b.borderWidth};
     const ducks=[...document.querySelectorAll('#duckGrid .duck-collection-card')];
     const headwear=ducks.map((card,index)=>{
      const svg=card.querySelector('svg');
      const group=svg.querySelector('.duck-head-accessory');
      if(!group)return null;
      const image=svg.getBoundingClientRect(),rect=group.getBoundingClientRect();
      const scaleX=image.width/100,scaleY=image.height/90;
      return {index,name:group.dataset.accessory,
       mid:(rect.left+rect.right)/2-image.left,expected:64*scaleX,
       extentX:[(rect.left-image.left)/scaleX,(rect.right-image.left)/scaleX],
       extentY:[(rect.top-image.top)/scaleY,(rect.bottom-image.top)/scaleY]};
     }).filter(Boolean);
     return {divineStyles,mythicStyles,headwear,
      allDucks:ducks.length,buttons:[...document.querySelectorAll('#badgeChecks [data-badge-rarity="divine"]')].map(el=>({
       text:el.textContent,art:el.querySelectorAll('svg,.crilo-divine-art').length,
       bg:getComputedStyle(el).backgroundImage})),
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
    });
    assert.equal(data.allDucks,30);
    assert.equal(data.headwear.length,headSlugs.length);
    for(const g of data.headwear){
     assert.ok(Math.abs(g.mid-g.expected)<=width/100*2+14,
       width+'px '+theme+' off-center '+g.name+': '+JSON.stringify(g));
     assert.ok(g.extentX[0]>=-2&&g.extentX[1]<=102,
       width+'px '+theme+' horizontally clipped '+g.name+': '+JSON.stringify(g));
     assert.ok(g.extentY[0]>=-2&&g.extentY[1]<=92,
       width+'px '+theme+' vertically clipped '+g.name+': '+JSON.stringify(g));
    }
    assert.equal(data.divineStyles.ink,'rgb(248, 246, 255)');
    assert.match(data.divineStyles.bg,/linear-gradient/);
    assert.equal(data.divineStyles.height,data.mythicStyles.height,'Shared pill height');
    for(const k of ['padding','radius','font','fontSize','borderWidth'])
     assert.equal(data.divineStyles[k],data.mythicStyles[k],'Shared pill '+k);
    assert.ok(data.buttons.every(x=>x.art===0&&x.text==='Divine Score'));
    assert.ok(data.buttons.every(x=>/linear-gradient/.test(x.bg)));
    assert.ok(data.overflow<=3,width+'px '+theme+' page overflow: '+data.overflow);
    checked++;
   }
  }
  assert.deepEqual(failures,[],'Browser exceptions');
  console.log('DIVINE_DUCK_ART_PASS 30 ducks, 11 anchored accessories, 6 card contexts, '+checked+' phone/tablet/desktop + theme checks');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
