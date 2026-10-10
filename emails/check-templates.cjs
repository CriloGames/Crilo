/* Authentication email must stay portable across Gmail / Apple Mail / Outlook.
 * Radial CSS gradients and CSS-only table wedges are not supported reliably.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const wheelUrl='https://raw.githubusercontent.com/CriloGames/Crilo/main/emails/crilo-wheel.png';
for(const file of ['magic-link.html','confirm-signup.html']){
 const html=fs.readFileSync(path.join(__dirname,file),'utf8');
 assert.ok(html.startsWith('<!doctype html>'),'Complete HTML document: '+file);
 assert.ok(html.includes('name="viewport"'),'Mobile-friendly viewport: '+file);
 assert.ok(html.includes('max-width:520px'),'Bounded email card: '+file);
 assert.equal((html.match(/href="{{ \.ConfirmationURL }}"/g)||[]).length,2,
  'Both links must preserve the unique Supabase token: '+file);
 assert.ok(/<a href="{{ \.ConfirmationURL }}"[^>]+style="[^"]*padding:21px 12px;[^"]*font-size:19px;/.test(html),
  'Large clickable sign-in button missing: '+file);
 assert.ok(html.includes('bgcolor="#ffe38a"')&&html.includes('border:2px solid #1b1d26'),
  'High-contrast yellow sign-in CTA missing: '+file);
 for(const pastel of ['#ffd86b','#9bd9ef','#ffb8d2','#c8f4bd'])
  assert.ok(html.includes(pastel),'Crilo accent missing '+pastel+': '+file);
 assert.ok(html.includes('width="520" align="center" style="margin:0 auto;'),
  'Email card must be centered: '+file);
 assert.ok(html.includes('width="100%" align="center" style="margin:0 auto;width:100%;max-width:390px;'),
  'Sign-in CTA must be centered: '+file);
 assert.ok(!html.includes('conic-gradient(')&&!html.includes('radial-gradient('),
  'Email body must not depend on unsupported gradient CSS: '+file);
 assert.equal((html.match(/<img\b/g)||[]).length,1,
  'Exactly one wheel image, no tracking pixels: '+file);
 assert.ok(html.includes('src="'+wheelUrl+'"'),
  'Use publicly hosted Crilo PNG image: '+file);
 assert.ok(html.includes('width="82" height="82" alt="Crilo pastel prize wheel"'),
  'Wheel must be size-bounded and accessible: '+file);
 assert.ok(html.includes('display:block;width:82px;height:82px;'),
  'Wheel image must preserve size in restrictive email apps: '+file);
 assert.ok(!/<script\b|<iframe\b|@import|data:image\/|cid:/i.test(html),
  'No scripts, embedded data URIs, or unsupported CID attachments: '+file);
 assert.ok(html.includes("Didn't request this email?"),'Security notice missing: '+file);
 assert.ok(html.length<25000,'Template too large: '+file);
}
console.log('PASS: Magic Link and signup email contain one real PNG wheel, safe Supabase links, pastel accents and oversized centered button.');
