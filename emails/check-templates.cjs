/* Ensures Supabase email bodies retain a working, touch-friendly magic link. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
for(const file of ['magic-link.html','confirm-signup.html']){
 const html=fs.readFileSync(path.join(__dirname,file),'utf8');
 assert.ok(html.startsWith('<!doctype html>'),'Email must contain a complete HTML document: '+file);
 assert.ok(html.includes('<meta name="viewport"'),'Email must support narrow mobile screens: '+file);
 assert.ok(html.includes('max-width:520px'),'Email must keep a mobile-friendly card width: '+file);
 assert.equal((html.match(/href="{{ \.ConfirmationURL }}"/g)||[]).length,2,
  'Main CTA and fallback must use the correct Supabase one-time link: '+file);
 assert.ok(/<a href="{{ \.ConfirmationURL }}"[^>]+style="[^"]*padding:21px 12px;[^"]*font-size:19px;/.test(html),
  'The entire large button should be clickable and at least 19px text: '+file);
 assert.ok(html.includes('bgcolor="#ffe38a"')&&html.includes('border:2px solid #1b1d26'),
  'Large pastel yellow CTA needs strong ink contrast and a visible border: '+file);
 for(const pastel of ['#ffd86b','#9bd9ef','#ffb8d2','#c8f4bd'])
  assert.ok(html.includes(pastel),'Crilo wheel accent color missing '+pastel+': '+file);
 assert.ok(html.includes("Didn't request this email?"),'Missing unsolicited email safety text: '+file);
 assert.ok(!/<img\b|<script\b|<iframe\b|@import|src="https?:/i.test(html),
  'Self-contained email must not depend on hosted images, scripts or CSS: '+file);
 assert.ok(html.includes('aria-label="Crilo pastel prize wheel"'),
  'Crilo wheel must have an accessible label: '+file);
 assert.ok(html.includes('width="520" align="center" style="margin:0 auto;'),
  'Entire email card must be centered: '+file);
 assert.ok(html.includes('width="82" align="center" style="margin:0 auto;'),
  'Yellow wheel tile must be centered: '+file);
 assert.ok(html.includes('width="60" align="center" style="width:60px;margin:0 auto;'),
  'Pointer and wheel nested table must be centered: '+file);
 assert.ok(html.includes('display:block;margin:0 auto;width:58px;height:58px;'),
  'Circle must be centered within the yellow square: '+file);
 assert.ok(html.includes('width="100%" align="center" style="margin:0 auto;width:100%;max-width:390px;'),
  'Large sign-in button must be centered: '+file);
 assert.ok(html.includes('background-image:conic-gradient(')&&html.includes('background-color:#ffd86b;'),
  'Wheel segments and compatible solid-color fallback must both be present: '+file);
 assert.ok(html.includes('&#9660;')&&html.includes('border:4px solid #17191e'),
  'Wheel must have its dark pointer and outer ring: '+file);
 assert.ok(html.includes('width:20px;height:20px;box-sizing:border-box;background-color:#ffffff;'),
  'Wheel must have the centered white hub: '+file);
 assert.ok(!html.includes('&#127922;'),'Old dice emoji must be gone: '+file);
 assert.ok(html.length<25000,'Email too long to render reliably: '+file);
}
console.log('PASS: magic link and signup email templates keep their token URLs, large CTA, self-contained wheel and Crilo pastels.');
