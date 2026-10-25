import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const url='http://127.0.0.1:4173/secrets.html?classic=1';
const sample=()=>page.evaluate(()=>{
 const button=document.querySelector('#ncZoomIn');
 const zoom=document.querySelector('#ncZoomAmount');
 const css=[...document.styleSheets].filter(s=>s.href?.includes('cube-physical.css')).map(s=>s.href);
 return {theme:document.documentElement.dataset.theme,
  body:document.body.className,
  matched:button?.matches('html[data-theme="dark"] body.nc-page .nc-inspection-controls .nc-zoom-controls button'),
  css,buttonBackground:button?getComputedStyle(button).backgroundColor:null,
  buttonColor:button?getComputedStyle(button).color:null,
  zoomColor:zoom?getComputedStyle(zoom).color:null,
  html:button?.outerHTML};
});
try{
 await page.addInitScript(()=>localStorage.setItem('crilo_theme','dark'));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('#ncZoomIn').waitFor();
 let state=await sample();
 console.log('Dark theme initial:',JSON.stringify(state));
 assert(state.css.length,'Physical stylesheet not linked or loaded');
 assert.equal(state.theme,'dark','Theme bridge did not honor saved dark preference');
 assert(state.matched,'Dark controls CSS selector does not match the actual DOM');
 assert.equal(state.buttonBackground,'rgb(48, 64, 71)','Dark zoom button remains white');
 assert.equal(state.zoomColor,'rgb(219, 233, 229)','Dark zoom value has unreadable text');
 await page.evaluate(()=>{
   localStorage.setItem('crilo_theme','light');
   document.documentElement.dataset.theme='light';
 });
 state=await sample();
 console.log('Theme restored to light:',JSON.stringify(state));
 assert.notEqual(state.buttonBackground,'rgb(48, 64, 71)','Theme is stuck in dark mode');
 console.log('PASS: mobile toolbar loads, persisted dark color renders, and light mode restores');
}finally{await browser.close()}
