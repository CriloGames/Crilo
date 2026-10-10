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
 assert.equal((html.match(/<img\b/g)||[]).length,1,
  'Exactly one brand wheel image in each email: '+file);
 assert.ok(html.includes('src="https://crilo.fun/emails/crilo-wheel.png"')&&
  html.includes('alt="Crilo colorful prize wheel"'),
  'Crilo email wheel must have its fixed same-site HTTPS source and accessible alt: '+file);
 assert.ok(!html.includes('&#127922;'),'Old dice emoji must be gone: '+file);
 assert.ok(!/<script\b|<iframe\b|@import|src="https?:\/\/(?!crilo\.fun\/emails\/crilo-wheel\.png)/i.test(html),
  'No external scripts or tracking-image sources allowed: '+file);
 assert.ok(html.length<25000,'Email too long to render reliably: '+file);
}
console.log('PASS: magic link and signup email templates keep their token URLs, large CTA, wheel icon and Crilo pastels.');
