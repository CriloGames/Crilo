/* Crilo's voluntary tip choices must route to the correct hosted PayPal links.
   No live payments or account operations are performed. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../../support.html'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'../../style.css'),'utf8');
const urls={
  '2':'https://www.paypal.com/ncp/payment/75LUCY8GEAF84',
  '5':'https://www.paypal.com/ncp/payment/N2EFYQL27VB3Q',
  '10':'https://www.paypal.com/ncp/payment/ZK6WTGVE48JG4',
  'custom':'https://www.paypal.com/ncp/payment/K7QJM2NVLKEYU'
};
assert.ok(html.includes('id="supportPayLink"'),'Missing hosted checkout button');
assert.ok(html.includes('rel="noopener noreferrer"'),'External checkout tab must have safe rel');
assert.ok(html.includes('aria-live="polite"'),'Selected tip should be announced accessibly');
assert.ok(!html.includes('Payments aren\'t connected yet'),'Old disabled checkout notice remains');
assert.ok(!html.includes('id="customAmount"'),'Do not collect a custom amount that PayPal cannot receive');
assert.ok(style.includes('.support-checkout-link{opacity:1;cursor:pointer;'),'Checkout CTA must be visibly enabled');
const script=html.match(/<script>\(function\(\)\{[\s\S]*?\}\)\(\);<\/script>/);
assert.ok(script,'Cannot locate PayPal checkout selector script');
class Element{
  constructor(amount){this.dataset={amount};this.attributes={};this.classes=new Set();this.events={};this.href='';this.textContent='';}
  setAttribute(k,v){this.attributes[k]=v;}
  addEventListener(k,fn){this.events[k]=fn;}
  classList={toggle:(k,on)=>on?this.classes.add(k):this.classes.delete(k)};
  click(){this.events.click?.();}
}
const buttons=Object.keys(urls).map(k=>new Element(k)),summary=new Element(''),checkout=new Element('');
const document={
  querySelectorAll:(sel)=>{assert.equal(sel,'.support-amount');return buttons;},
  getElementById:(id)=>({tipSummary:summary,supportPayLink:checkout})[id]
};
vm.runInNewContext(script[0].replace(/^<script>|<\/script>$/g,''),{document});
for(const [i,amount] of Object.keys(urls).entries()){
  buttons[i].click();
  assert.equal(checkout.href,urls[amount],'Wrong hosted checkout for '+amount);
  assert.equal(buttons.filter(b=>b.attributes['aria-pressed']==='true').length,1,'Exactly one tip must be selected');
  assert.equal(buttons[i].attributes['aria-pressed'],'true');
  if(amount==='custom'){
    assert.match(summary.textContent,/choose your tip amount on PayPal/i);
    assert.doesNotMatch(summary.textContent,/\$\d/);
  }else assert.match(summary.textContent,new RegExp('\\$'+amount+'\\.00'));
}
assert.ok(html.includes('not charitable tax-deductible donations'));
assert.ok(html.includes('don\'t affect gameplay'));
console.log('PASS: All four supported tip amounts use their exact PayPal hosted checkout links.');
console.log('PASS: Custom tips are priced at PayPal; no misleading amount or disabled checkout.');
