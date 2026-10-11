'use strict';
const a=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('official-daily-total.js','utf8'),
 sql=fs.readFileSync('release/346-badges/079-official-daily-total-and-drawing-validation.sql','utf8'),
 css=fs.readFileSync('official-daily-total.css','utf8');
a.match(html,/class="crilo-daily-total"/);
a.match(html,/id="criloOfficialDailyTotal"/);
a.match(html,/id="criloOfficialDailyToday"/);
a.match(html,/>TODAY</);
a.match(html,/>ALL-TIME</);
a.match(html,/official-daily-total\.js\?v=2/);
a.match(html,/official-daily-total\.css\?v=2/);
a.match(js,/rpc\('crilo_public_daily_completion_counts'\)/);
a.match(js,/Official Daily saved/);
a.doesNotMatch(js,/\.from\('daily_runs'\)/);
a.match(sql,/verified_spin_session_id IS NOT NULL/);
a.match(sql,/u\.is_anonymous IS FALSE/);
a.match(sql,/email_confirmed_at IS NOT NULL/);
a.match(sql,/AFTER INSERT ON public\.daily_runs/);
a.match(sql,/AFTER DELETE ON public\.daily_runs/);
a.match(sql,/FROM PUBLIC,anon,authenticated/);
a.match(sql,/data:image\/webp;base64,/);
a.match(sql,/NEW\.drawing_is_blank IS DISTINCT FROM TRUE/);
a.match(css,/@media\(max-width:520px\)/);
console.log('PASS: current Daily and all-time counts separately labeled, authenticated official verified runs only.');
