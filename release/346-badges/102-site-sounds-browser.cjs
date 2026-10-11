'use strict';
/* Audio never uses real speakers: stub WebAudio and inspect actual trusted
 * browser UI events on desktop, iPad and iPhone viewports. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const code=fs.readFileSync('site-sounds.js','utf8');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let cases=0;
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:820}});
   await page.setContent('<!doctype html><html><body>'+
    '<button id="spinButton">Spin</button>'+
    '<button id="bugBeetle">Beetle</button>'+
    '<button class="duck-unlocked">Duck</button>'+
    '<button class="leader-tab">Today</button>'+
    '<button class="mini-wheel">Wheel</button>'+
    '<button class="avatar-color-swatch">Color</button>'+
    '<button id="friendBellBtn">Notifications</button>'+
    '<button id="soundBtn">Sound</button>'+
    '<a href="#next" id="link">Navigate</a>'+
    '<details><summary>Badge set</summary><p>Badges</p></details>'+
    '<details class="hidden" id="newBadgePanel"><summary>Unlocked</summary>'+
      '<button class="new-badge-item">First badge</button></details>'+
    '<div id="next"></div></body></html>');
   await page.evaluate(()=>{
    window.__notes=0;window.__started=0;window.__contexts=0;window.__sfxSetting='on';
    Object.defineProperty(window,'localStorage',{configurable:true,value:{
     getItem:()=>window.__sfxSetting,
     setItem:(_k,v)=>{window.__sfxSetting=v}
    }});
    class FakeAC{
     constructor(){window.__contexts++;this.state='running';this.currentTime=0;this.destination={}}
     resume(){return Promise.resolve()}
     createDynamicsCompressor(){return{threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){}}}
     createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}
     createOscillator(){
      window.__notes++;
      return{type:'sine',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},
       connect(){},start(){window.__started++},stop(){}}
     }
    }
    window.AudioContext=FakeAC;
    window.Crilo={profile:{sound_enabled:true}};
   });
   await page.addScriptTag({content:code});
   const stats=()=>page.evaluate(()=>({n:window.__notes,started:window.__started,c:window.__contexts}));
   assert.deepEqual(await stats(),{n:0,started:0,c:0},width+'px must start silent');
   await page.locator('#spinButton').click();
   assert.deepEqual(await stats(),{n:0,started:0,c:1},width+'px spin must unlock without double playing wheel sound');
   await page.locator('#bugBeetle').click();
   await page.locator('.duck-unlocked').click();
   assert.equal((await stats()).n,0,width+'px own bespoke sounds remain isolated');
   await page.locator('.leader-tab').click();
   assert.ok((await stats()).n>=2,width+'px category tab did not play');
   const before=await stats();
   await page.locator('.mini-wheel').click();
   assert.ok((await stats()).n>before.n,width+'px mini wheel must play unique flourish');
   const middle=await stats();
   await page.locator('summary').first().click();
   await page.locator('.avatar-color-swatch').click();
   await page.locator('#friendBellBtn').click();
   assert.ok((await stats()).n>middle.n,width+'px selection and notification sounds did not play');
   const prev=await stats();
   await page.evaluate(()=>{
    const badge=document.getElementById('newBadgePanel');
    badge.classList.remove('hidden');badge.open=true;
   });
   await page.waitForFunction(n=>window.__notes>n,prev.n);
   assert.ok((await stats()).n>=prev.n+4,width+'px freshly earned badge sparkle');
   await page.evaluate(()=>{window.__sfxSetting='off'});
   const muted=(await stats()).n;
   await page.locator('#link').click();
   assert.equal((await stats()).n,muted,width+'px mute must silence navigation');
   await page.evaluate(()=>{window.__sfxSetting='on';window.Crilo.profile.sound_enabled=false});
   await page.locator('#soundBtn').click();
   assert.equal((await stats()).n,muted,width+'px saved account setting must mute');
   await page.evaluate(()=>{window.Crilo.profile.sound_enabled=true});
   await page.locator('#link').click();
   assert.ok((await stats()).n>muted,width+'px unmute should restore sounds');
   assert.equal((await stats()).c,1,width+'px one shared audio context');
   cases++;
   console.log('PASS Site SFX UI '+width+'px: no autoplay, gestures, badge, independent audio, mute and restore');
   await page.close();
  }
  console.log('SITE_SOUNDS_BROWSER_PASS '+cases+' viewport scenarios');
 }finally{await browser.close()}
})().catch(e=>{console.error('SITE_SOUNDS_BROWSER_FAIL',e);process.exitCode=1});
