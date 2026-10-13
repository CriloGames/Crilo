/* Authentication email must stay portable across Gmail / Apple Mail / Outlook.
 * Radial CSS gradients and CSS-only table wedges are not supported reliably.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const wheelUrl='https://cdn.jsdelivr.net/gh/CriloGames/Crilo@main/emails/crilo-wheel-all-pastel.png';
for(const file of ['magic-link.html','confirm-signup.html','invite-user.html']){
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
 assert.equal((html.match(/<img\b/g)||[]).length,0,
  'Preview should never show a broken <img> fallback icon: '+file);
 assert.ok(html.includes('background="'+wheelUrl+'"'),
  'Email-safe table background URL must serve a real wheel: '+file);
 assert.ok(html.includes("background-image:url('"+wheelUrl+"'),radial-gradient("),
  'Preview must render gradient sectors if the remote image is blocked: '+file);
 assert.ok(html.includes('conic-gradient(from -15deg at 50% 52%'),
  'Wheel preview must retain pastel wedge sectors: '+file);
 assert.ok(html.includes('width="96" height="96" align="center" background="'+wheelUrl+'"'),
  'Centered table with fixed dimensions is required for Gmail and Supabase: '+file);
 assert.ok(html.includes('width:96px;height:96px;min-width:96px;max-width:96px'),
  'Wheel dimensions must remain stable in restrictive email clients: '+file);
 assert.ok(html.includes('valign="top"')&&html.includes('&#9660;'),
  'The wheel must have its centered black pointer in CSS-only preview: '+file);
 for(const color of ['#ffd86b','#9bd9ef','#ffb8d2','#c8f4bd','#dfc8f6'])
  assert.ok(html.includes(color),'Wheel preview palette missing '+color+': '+file);
 assert.ok(!/<script\b|<iframe\b|@import|data:image\/|cid:/i.test(html),
  'No scripts or insecure data-image URLs: '+file);
 assert.ok(html.includes("Didn't request this email?"),'Security notice missing: '+file);
 assert.ok(html.length<25000,'Template too large: '+file);
}
const invite=fs.readFileSync(path.join(__dirname,'invite-user.html'),'utf8');
assert.ok(invite.includes("You're invited to Crilo.")&&invite.includes('Accept invitation'),
 'Invitation must use the Crilo-specific title and action');
assert.ok(invite.includes('one-time invitation link')&&invite.includes('Open your invitation link'),
 'Invitation fallback and privacy text must reflect the correct action');
assert.ok(!invite.includes('Confirm email &amp; play'),
 'Invitation must not pretend to be a signup confirmation');
console.log('PASS: Magic Link, signup and invitation emails preserve the branded pastel wheel, accessible CTA and valid Supabase confirmation links.');
