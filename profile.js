(() => {const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);let target=params.get('id');const trophyIcon='<svg class="crilo-badge-svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5h14v8c0 6-3 9-7 9s-7-3-7-9V5Z"/><path d="M9 8H5v4c0 4 2 6 6 6M23 8h4v4c0 4-2 6-6 6M16 22v5m-6 1h12"/></svg>';
const duckIcon='<svg class="crilo-badge-svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 18c0-4 3-7 7-7 2 0 4 1 5 2 0-5 3-8 7-8 3 0 5 2 5 5 0 2-1 3-2 4l4 2-4 2c-1 6-6 10-13 10-6 0-10-4-10-9 0-2 0-3 1-4Z"/><path d="M9 18c2 3 5 4 9 3"/><circle cx="24" cy="10" r="1" fill="currentColor" stroke="none"/></svg>';
// Distinct, achievement-specific monochrome outline pictograms.
// Icons are assigned by badge meaning, never by milestone number or category symbol.
const badgeIconNames={
 duck_1:'bird',duck_2:'heart-handshake',duck_3:'users-round',duck_4:'party-popper',duck_5:'glasses',duck_7:'plane',duck_10:'shield',duck_15:'route',
 duck_first:'egg',duck_last:'moon-star',duck_back2:'footprints',duck_sandwich:'sandwich',duck_upgrade:'wand-sparkles',duck_double:'origami',duck_lifetime100:'warehouse',
 double_final:'flag-triangle-right',double_zero:'circle-off',double_1000:'banknote',double_5000:'landmark',double_back2:'copy',double_back3:'layers-3',
 spinplus_saved:'life-buoy',seq_repeat2:'repeat-2',seq_repeat3:'refresh-cw',seq_repeat4:'orbit',seq_special3:'shapes',seq_special5:'sparkles',seq_variety5:'palette',seq_all_specials:'aperture',seq_numbers_only:'binary',seq_bookends:'book-open',seq_palindrome:'flip-horizontal',
 wheel_dejavu:'history',wheel_full_circle:'circle-dot',wheel_lucky_seven:'clover',wheel_mirror:'scan-face',wheel_groundhog:'sunrise',wheel_perfect_match:'puzzle',wheel_collector:'archive',wheel_against_odds:'dice-5',wheel_one_each:'grid-2x2',wheel_long_way:'milestone',wheel_quack_attack:'swords',wheel_comeback:'trending-up',wheel_slow_starter:'snail',wheel_no_ducks:'gauge',wheel_duck_dynasty:'crown',wheel_small_beginnings:'sprout',wheel_minimalist:'minus',wheel_chosen_one:'crosshair',
 secret_404:'file-question',secret_42:'telescope',secret_69:'yin-yang',secret_777:'dices',secret_1337:'terminal',secret_zero:'ban',secret_close:'target',secret_first:'medal',secret_ducks:'feather',secret_double:'chevrons-up',secret_pattern:'fingerprint',secret_blank:'square-dashed',secret_clock:'alarm-clock',secret_impossible:'rocket',secret_owner:'key-round',
 social_profile:'contact-round',social_friend1:'handshake',social_friend5:'messages-square',social_friend25:'network',daily_draw:'paintbrush',
 score_common:'leaf',score_uncommon:'gem',score_rare:'diamond',score_epic:'award',score_legendary:'swords',score_mythic:'atom',rarity_legendary:'star',
};
const iconPool=('bird heart-handshake users-round party-popper glasses plane shield route egg moon-star footprints sandwich wand-sparkles origami warehouse flag-triangle-right circle-off banknote landmark copy layers-3 life-buoy repeat-2 refresh-cw orbit shapes sparkles palette aperture binary book-open flip-horizontal history circle-dot clover scan-face sunrise puzzle archive dice-5 grid-2x2 milestone swords trending-up snail gauge crown sprout minus crosshair file-question telescope yin-yang dices terminal ban target medal feather chevrons-up fingerprint square-dashed alarm-clock rocket key-round contact-round handshake messages-square network paintbrush leaf gem diamond award atom star trophy mountain waves anchor compass flame bolt lightbulb sunrise sunset cloud-rain umbrella snowflake wind hourglass calendar-days calendar-check calendar-heart clock timer watch notebook pen-tool pencil ruler scissors paint-bucket brush music headphones radio microphone camera video film clapperboard monitor smartphone tablet laptop keyboard mouse hard-drive cpu database server wifi satellite radar scan search zoom-in eye eye-off lock unlock key-round door-open house building-2 castle tent tree-pine flower-2 cherry apple citrus carrot pizza coffee cup-soda utensils cake gift balloon heart heart-pulse activity dumbbell bike car bus train ship sailboat fish turtle rabbit cat dog squirrel bug butterfly worm paw-print footprint bone shell shellfish crab bee ant spider octagon triangle pentagon hexagon circle square diamond pentagon chart-column chart-pie chart-line chart-no-axes-combined coins wallet receipt credit-card shopping-cart store briefcase graduation-cap school library book-marked bookmark scroll-newspaper newspaper file-text folder-open folder-heart inbox mail send message-circle speech headphones megaphone bell bell-ring flag bookmark-check check-check circle-check badge-check thumbs-up thumbs-down hand hand-heart hand-coins hand-metal hand-peace hand-pointing-up accessibility person-standing user-round user-check user-plus users user-round-search smile frown laugh angry meh ghost skull alien antenna bot brain fingerprint scan-qr-code qr-code barcode tag tags ticket tickets stamp seal-check ribbon bow-arrow arrow-up-right arrow-down-left arrow-left-right arrow-up-down move-diagonal rotate-ccw rotate-cw recycle infinity link unlink chain chains shuffle split merge git-branch git-merge workflow network nodes chart-scatter scatter-chart candlestick-chart signal signal-high radio-tower satellite-dish globe earth map map-pin navigation locate map-pinned waypoints orbit circle-gauge circle-power power plug plug-zap battery-full battery-charging flashlight lamp desk-lamp lightbulb moon stars sun cloud-sun cloud-moon rainbow cloud-lightning tornado volcano mountain-snow tree-deciduous trees cactus wheat flower rose').split(' ');
const assignedIcons=new Map();
const prepareBadgeIcons=badges=>{
 const used=new Set();
 // Reserve all specifically assigned symbols before filling the rest.
 const keys=new Set(badges.map(b=>b.badge_key));
 const reserved=new Set(Object.entries(badgeIconNames).filter(([key])=>keys.has(key)).map(([,icon])=>icon));
 for(const b of badges){
  const key=b.badge_key||'';
  let icon=badgeIconNames[key];
  if(!icon||used.has(icon)){
   const text=(b.name+' '+b.description).toLowerCase();
   const themes=[/duck|quack|pond/,/score|points/,/upgrade/,/double|twice/,/spin|wheel/,/friend|social/,/daily|day|streak/,/leaderboard|rank|top/,/rare|odds/,/secret|hidden/];
   const groups=[['bird','egg','feather','waves','fish','shell'],['coins','chart-line','wallet','receipt','chart-pie','banknote'],['arrow-up-right','trending-up','rocket','mountain','bolt'],['copy','layers-3','repeat-2','chevrons-up'],['aperture','orbit','rotate-cw','timer','gauge'],['handshake','users-round','network','heart'],['calendar-check','sunrise','clock','calendar-days'],['trophy','medal','crown','flag'],['dice-5','gem','diamond','sparkles'],['eye','key-round','fingerprint','telescope']];
   const group=themes.findIndex(t=>t.test(text));
   const candidates=group>=0?groups[group]:[];
   icon=candidates.find(x=>!used.has(x)&&!reserved.has(x));
   if(!icon)icon=iconPool.find(x=>!used.has(x)&&!reserved.has(x));
   if(!icon)icon='circle-dot';
  }
  used.add(icon);assignedIcons.set(b.id,icon);
 }
};
// Bespoke illustrations for the duck milestones; no unrelated library symbols.
const duckDrawing=(x,y,scale=1)=>'<g transform="translate('+x+' '+y+') scale('+scale+')"><path d="M3 19c-1-4 1-8 6-9 3-1 6 0 8 2 0-5 3-8 7-8 4 0 7 3 7 7 0 2-1 3-2 4l5 2-5 2c-2 6-7 9-14 9C8 28 4 25 3 19Z"/><path d="M8 18c3 3 7 4 11 2"/><circle cx="25" cy="10" r="1.1" fill="currentColor" stroke="none"/></g>';
const duckMilestoneArt={
 duck_1:duckDrawing(7,6,.85),
 duck_2:duckDrawing(0,10,.62)+duckDrawing(19,0,.62),
 duck_3:duckDrawing(0,2,.55)+duckDrawing(18,2,.55)+duckDrawing(9,20,.55),
 duck_4:duckDrawing(7,10,.8)+'<path d="m27 14 3-10 5 10M26 14h10M8 9l-2-3m34 8 3-2M8 32l-4 2M36 33l4 3"/><path d="m5 5 2 1m31-1 2 2M5 27l2 2"/>',
 duck_5:duckDrawing(6,8,.84)+'<path d="M20 18h3m-18-2h4"/><circle cx="12" cy="17" r="5"/><circle cx="28" cy="17" r="5"/>',
 duck_7:'<path d="M2 30q10-14 21-12t23-13M4 35q13-10 25-5t17-3"/>'+duckDrawing(1,7,.45)+duckDrawing(20,3,.45)+duckDrawing(24,24,.45),
 duck_10:duckDrawing(5,13,.84)+'<path d="M10 14V5l8-4 8 4v9M10 7h16M18 2v8"/><path d="m34 6 6 3v7l-6 4-6-4V9Z"/>',
 duck_15:'<path d="M0 35q10-8 23 0t25-3M2 40q10-7 23 1t21-2"/><circle cx="38" cy="6" r="5"/>'+duckDrawing(0,15,.4)+duckDrawing(15,10,.4)+duckDrawing(29,14,.4)
};
const bespokeDuckIcon=b=>{
 const art=duckMilestoneArt[b.badge_key];if(!art)return null;
 return '<span class="crilo-achievement-symbol" role="img" aria-label="'+Crilo.esc(b.name)+'"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+art+'</svg></span>';
};
// Every badge is illustrated from its actual requirement and name, using a
// semantic scene rather than selecting the next unrelated icon in a pool.
const sceneIcon=(name,x=12,y=12,size=24)=>'<svg x="'+x+'" y="'+y+'" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><use href="#crilo-line-'+name+'"/></svg>';
const lineArt={
 duck:'<path d="M3 15c0-4 4-6 8-5 0-5 3-7 6-6 3 1 4 3 3 6l3 2-4 2c-1 5-5 7-10 7-4 0-6-2-6-6Z"/><circle cx="17" cy="8" r="1" fill="currentColor" stroke="none"/><path d="m4 14 5 2 4-1"/>',
 wheel:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7m0 4v7M3 12h7m4 0h7m-15-6 5 5m2 2 5 5m0-12-5 5m-2 2-5 5"/>',
 points:'<path d="M4 20V11h4v9M10 20V6h4v14M16 20V3h4v17M2 21h20"/>',
 up:'<path d="M12 21V4m-7 7 7-7 7 7M4 21h16"/>',
 double:'<path d="M3 6h12l-4-4m4 4-4 4M21 18H9l4-4m-4 4 4 4M3 18h3M18 6h3"/>',
 spins:'<path d="M20 11a8 8 0 1 0-3 7M20 4v7h-7"/><path d="M12 7v10m-5-5h10"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 10h18M8 15l2 2 5-5"/>',
 rank:'<path d="M4 21v-8h5v8m0 0V7h6v14m0 0v-5h5v5M2 21h20"/><path d="m12 2 1 2 2 .4-1.5 1.3.4 2L12 6.7l-2 1 .4-2L9 4.4l2-.4Z"/>',
 friend:'<circle cx="8" cy="7" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2 21v-3c0-5 12-5 12 0v3M15 15c5-1 7 2 7 5v1"/>',
 secret:'<path d="M4 10V7a8 8 0 0 1 16 0v3M4 10h16v12H4z"/><path d="M12 14v4"/><circle cx="12" cy="13" r="1"/>',
 rarity:'<path d="m7 3 10 0 5 7-10 12L2 10Z"/><path d="M2 10h20M7 3l5 7 5-7M12 10v12"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 trophy:'<path d="M6 3h12v9a6 6 0 0 1-12 0V3ZM6 6H3v4c0 4 3 5 5 5m10-9h3v4c0 4-3 5-5 5M12 18v3m-5 0h10"/>',
 pen:'<path d="m4 20 5-1 12-12-4-4L5 15l-1 5ZM14 6l4 4M4 22h17"/>',
 sequence:'<path d="M4 7h16m-16 5h16m-16 5h16M7 4l-3 3 3 3m10-1 3 3-3 3"/>',
 mystery:'<path d="M8 9a4 4 0 1 1 7 3c-2 1-3 2-3 4M12 20h.01"/><circle cx="12" cy="12" r="10"/>',
};
const semanticBase=b=>{
 const k=b.badge_key||'',t=(b.name+' '+b.description).toLowerCase();
 if(k.startsWith('duck_')||/duck|quack|pond/.test(t))return 'duck';
 if(k.startsWith('upgrade_')||/upgrade/.test(t))return 'up';
 if(k.startsWith('double_')||/doubl|twice|×2/.test(t))return 'double';
 if(k.startsWith('spinplus_')||k.startsWith('spins_')||/extra spin/.test(t))return 'spins';
 if(k.startsWith('score_')||/score|points/.test(t))return 'points';
 if(k.startsWith('rank_')||/leaderboard|rank|place|podium/.test(t))return 'rank';
 if(k.startsWith('rarity_')||/rarity|rare|odds|mythic/.test(t))return 'rarity';
 if(k.startsWith('daily_')||k.startsWith('runs_')||/daily|consecutive day|streak/.test(t))return 'calendar';
 if(k.startsWith('social_')||/friend/.test(t))return 'friend';
 if(/draw|paint|art/.test(t))return 'pen';
 if(k.startsWith('seq_')||/sequence|consecutive spin|in a row/.test(t))return 'sequence';
 if(/clock|minute|time/.test(t))return 'clock';
 if(/match|same|exact|perfect|mirror/.test(t))return 'target';
 if(k.startsWith('secret_')||k.startsWith('wheel_'))return 'mystery';
 return 'trophy';
};
const semanticAccent=b=>{
 const k=b.badge_key||'',t=(b.name+' '+b.description).toLowerCase();
 if(/party|celebrat/.test(t))return 'party';
 if(/army|soldier|battle/.test(t))return 'shield';
 if(/flock|migration/.test(t))return 'flight';
 if(/first|begin|start/.test(t))return 'start';
 if(/last|final|end/.test(t))return 'finish';
 if(/zero|nothing|blank|none|no /.test(t))return 'empty';
 if(/consecutive|streak|row|repeat/.test(t))return 'streak';
 if(/friend|together|social/.test(t))return 'friends';
 if(/lucky|odds|chance|rare/.test(t))return 'luck';
 if(/win|champion|leader|top/.test(t))return 'win';
 if(/doubl|twice/.test(t))return 'times';
 if(/upgrade|increase|rise|more/.test(t))return 'rise';
 if(/mirror|reverse|palindrome/.test(t))return 'mirror';
 if(/clock|time|minute/.test(t))return 'time';
 if(/draw|picture|paint/.test(t))return 'drawing';
 if(/collection|collector|all|every/.test(t))return 'collect';
 if(/secret|hidden|mystery/.test(t))return 'hidden';
 return 'mark';
};
const accentArt={
 party:'<path d="m28 12 8-9 5 12-13-3ZM8 8l2-3m29 19 4-2M6 27l-3 3M36 35l4 4"/><circle cx="39" cy="5" r="1.5"/>',
 shield:'<path d="m32 2 11 5v11c0 7-6 11-11 14-5-3-11-7-11-14V7Z"/>',
 flight:'<path d="M4 30q11-18 24-11t17-12M3 37q14-11 25-2t17-1"/>',
 start:'<path d="M6 3v39M7 5h18l-5 7 5 7H7"/>',
 finish:'<path d="M40 4v39M22 6h18v13H22zM23 10h6m4 0h6m-12 5h7"/>',
 empty:'<circle cx="34" cy="12" r="10"/><path d="m27 19 14-14"/>',
 streak:'<path d="M27 38c-9-6-5-14 0-19 0 5 5 6 5 0 8 9 10 17 1 20-3 1-5 0-6-1Z"/>',
 friends:'<circle cx="32" cy="10" r="5"/><circle cx="41" cy="13" r="4"/><path d="M23 29v-5c0-9 18-9 18 0v5"/>',
 luck:'<path d="M32 5c-9-6-13 6-5 11-9 3-3 15 5 9 7 7 15-2 8-9 7-8-1-16-8-11Z"/>',
 win:'<path d="M26 3h16v12c0 12-16 12-16 0V3ZM34 26v7m-7 0h14"/>',
 times:'<path d="m26 7 15 15m0-15L26 22"/>',
 rise:'<path d="M24 24 42 6M32 6h10v10"/>',
 mirror:'<path d="M33 3v36m-8-28 5-5m-5 18 5 5m11-18-5-5m5 18-5 5"/>',
 time:'<circle cx="33" cy="14" r="11"/><path d="M33 7v7l5 3"/>',
 drawing:'<path d="m27 29 12-20 5 4-12 20-7 3Z"/>',
 collect:'<path d="M24 8h20v28H24zM28 13h12M28 20h12M28 27h12"/>',
 hidden:'<path d="M26 13q8-9 17 0-9 9-17 0Z"/><circle cx="35" cy="13" r="3"/>',
 mark:'<path d="m28 8 4-5 4 5 6 2-6 3-4 6-4-6-6-3Z"/>'
};
const sceneLabel=b=>{
 const k=b.badge_key||'',n=k.match(/_(\d+)$/);
 if(n)return n[1];
 if(/404|777|1337/.test(k))return k.split('_').pop();
 return '';
};
const sceneArt=b=>{
 const base=semanticBase(b),accent=semanticAccent(b);
 const id=b.badge_key||b.name;
 // Custom duck milestones are drawn separately, above.
 const art='<svg x="3" y="8" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+lineArt[base]+'</svg>';
 const marker=accentArt[accent];
 const label=sceneLabel(b);
 const extra=label?'<rect x="25" y="29" width="21" height="14" rx="5" fill="white" stroke="currentColor" stroke-width="1.5"/><text x="35.5" y="38.5" font-size="'+(label.length>4?6:8)+'" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui" font-weight="700">'+label+'</text>':'';
 return '<span class="crilo-achievement-symbol" role="img" aria-label="'+Crilo.esc(b.name)+'"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+art+'<g transform="translate(19 0) scale(.58)">'+marker+'</g>'+extra+'</svg></span>';
};
// Individually composed line illustrations for named achievements.
// Unlike the old system, these scenes do not use category glyphs or numerical stamps.
const drawnScenes={
 duck_first:'<path d="M8 30q4-20 17-20t15 20M8 30h32M16 23l4 4 4-4 4 4 4-4"/><path d="M20 9q4-6 8 0"/>',
 duck_last:'<path d="M5 6h17l-5 6 5 6H5zM5 6v35"/>'+duckDrawing(19,21,.58),
 duck_back2:duckDrawing(0,13,.56)+duckDrawing(20,13,.56)+'<path d="m13 8 6-5 6 5"/>',
 duck_sandwich:'<path d="M5 8q19-12 38 0l-2 5H7ZM6 32q18 9 36 0l-2 6H8Z"/>'+duckDrawing(10,12,.55),
 duck_upgrade:duckDrawing(3,17,.65)+'<path d="M35 38V7m-7 7 7-7 7 7M29 22h12"/>',
 duck_double:duckDrawing(2,14,.64)+'<path d="m30 8 6 6-6 6m8-12 6 6-6 6M30 32h13"/>',
 duck_lifetime100:'<path d="M5 39V18l19-11 19 11v21ZM13 39V25h22v14M19 25v14m10-14v14"/>'+duckDrawing(13,9,.4),
 double_final:'<path d="M6 4v39m0-37h22l-6 7 6 7H6"/><path d="M32 25h10m-5-5v10M30 39h14"/>',
 double_zero:'<circle cx="18" cy="25" r="12"/><path d="M10 33 26 17m6-7h12m-6-6v12"/>',
 double_1000:'<path d="M5 12h38v25H5zM9 18h30M9 31h30"/><circle cx="24" cy="25" r="5"/><path d="M22 22h4m-4 6h4"/>',
 double_5000:'<path d="m5 17 19-11 19 11M7 19h34M10 22v15m9-15v15m10-15v15m9-15v15M5 40h38"/>',
 double_back2:'<path d="M6 8h24l-6-5m6 5-6 5M42 39H18l6-5m-6 5 6 5"/><path d="M13 19h22v10H13z"/>',
 double_back3:'<path d="M6 9h35l-6-5m6 5-6 5M6 24h35l-6-5m6 5-6 5M6 39h35l-6-5m6 5-6 5"/>',
 spinplus_saved:'<circle cx="23" cy="24" r="17"/><path d="M23 7v9m0 16v9M6 24h9m16 0h9M17 19l6 5 8-11"/>',
 seq_repeat2:'<path d="M5 11h27l-6-6m6 6-6 6M43 35H16l6-6m-6 6 6 6"/><circle cx="10" cy="35" r="4"/>',
 seq_repeat3:'<path d="M10 12a17 17 0 0 1 27 0l4-2-1 10-10-4 4-2M38 36a17 17 0 0 1-27 0l-4 2 1-10 10 4-4 2"/>',
 seq_repeat4:'<path d="M8 12h32M8 20h32M8 28h32M8 36h32M34 6l6 6-6 6M14 14l-6 6 6 6M34 22l6 6-6 6M14 30l-6 6 6 6"/>',
 seq_special3:'<path d="M5 36 14 8l10 28 10-28 9 28M5 36h38"/><circle cx="14" cy="7" r="3"/><circle cx="34" cy="7" r="3"/>',
 seq_special5:'<path d="m24 3 4 13 13-4-9 11 9 11-13-4-4 13-4-13-13 4 9-11-9-11 13 4Z"/>',
 seq_variety5:'<circle cx="12" cy="12" r="6"/><rect x="27" y="5" width="12" height="12" rx="2"/><path d="m12 29 8 13H4zM30 27h11v12H30zM24 21l-4 4 4 4 4-4z"/>',
 seq_all_specials:'<circle cx="24" cy="24" r="20"/><path d="M24 4v40M4 24h40m-34-14 28 28m0-28L10 38"/><circle cx="24" cy="24" r="4"/>',
 seq_numbers_only:'<path d="M6 8h36v32H6zM12 17h8m-4-4v13M29 13h7v13h-7v-13M12 32h8m9 0h7"/>',
 seq_bookends:'<path d="M5 6h10v35H5zM33 6h10v35H33zM15 14h18M15 33h18"/><path d="M9 11v24m28-24v24"/>',
 seq_palindrome:'<path d="M24 3v42M8 10l10 8-10 8m32-16-10 8 10 8M9 35h9m12 0h9"/>',
 wheel_dejavu:'<path d="M8 16a18 18 0 1 1-2 14M8 7v10h10"/><path d="M23 12v13l8 5"/>',
 wheel_full_circle:'<circle cx="24" cy="24" r="19"/><circle cx="24" cy="24" r="9"/><path d="M24 5v8m0 22v8M5 24h8m22 0h8"/>',
 wheel_lucky_seven:'<path d="M7 8h34l-21 34M7 8v8"/><path d="m32 27 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z"/>',
 wheel_mirror:'<path d="M24 4v40M7 12l11 8-11 8m34-16-11 8 11 8M9 37h9m12 0h9"/>',
 wheel_groundhog:'<path d="M5 36h38M9 36a15 15 0 0 1 30 0M24 4v7M7 12l6 6m28-6-6 6"/><path d="M17 36q7-14 14 0"/>',
 wheel_perfect_match:'<path d="M4 9h17v10h-5a4 4 0 0 0 0 8h5v12H4V9ZM25 9h19v30H25V27h5a4 4 0 0 0 0-8h-5Z"/>',
 wheel_collector:'<path d="M5 12h38v29H5zM3 6h42v6H3zM18 22h12v7H18zM24 29v8"/>',
 wheel_against_odds:'<rect x="7" y="7" width="34" height="34" rx="6"/><circle cx="16" cy="16" r="2"/><circle cx="32" cy="16" r="2"/><circle cx="24" cy="24" r="2"/><circle cx="16" cy="32" r="2"/><circle cx="32" cy="32" r="2"/>',
 wheel_one_each:'<circle cx="13" cy="13" r="8"/><path d="M27 5h15v16H27zM5 27h16v16H5zM35 27l9 16H26z"/>',
 wheel_long_way:'<path d="M4 39q13-30 25-16T44 7M4 39l8-3m-8 3 3-8M44 7l-9 1m9-1-4 9"/><path d="M6 6h14M6 12h9"/>',
 wheel_quack_attack:duckDrawing(1,14,.7)+'<path d="m30 8 12 6-12 6 4-6Z"/><path d="m30 29 12 6-12 6 4-6Z"/>',
 wheel_comeback:'<path d="M5 40h38M8 35l12-12 7 6L41 8M31 8h10v10"/><path d="M7 10h11m-11 6h7"/>',
 wheel_slow_starter:'<path d="M5 38h38M7 32h9v6m3-13h9v13m3-23h10v23"/><path d="M6 12h11m-11 6h7"/>',
 wheel_no_ducks:'<circle cx="24" cy="24" r="19"/>'+duckDrawing(10,13,.65)+'<path d="M10 38 38 10"/>',
 wheel_duck_dynasty:duckDrawing(7,17,.8)+'<path d="m13 16-3-11 9 5 6-8 6 8 9-5-3 11Z"/>',
 wheel_small_beginnings:'<path d="M24 43V19m0 11Q6 30 7 13q17 0 17 17Zm0-7Q40 23 41 8q-17 0-17 15Z"/><path d="M15 43h18"/>',
 wheel_minimalist:'<path d="M8 10h32M8 19h32M8 28h32M8 37h32"/><circle cx="24" cy="6" r="2"/>',
 wheel_chosen_one:'<circle cx="24" cy="24" r="19"/><circle cx="24" cy="24" r="12"/><circle cx="24" cy="24" r="5"/><path d="M24 1v13M24 34v13M1 24h13m20 0h13"/>',
 secret_404:'<path d="M7 7h34v34H7zM13 16h8m-4-4v12M28 12h8v12h-8zM13 32h8m-4-4v8M28 32h8"/>',
 secret_42:'<path d="M5 9h38v30H5zM12 16v12h10m-4-16v20M28 15h11l-11 10h11v7"/>',
 secret_69:'<circle cx="16" cy="16" r="9"/><path d="M25 16v15q0 8-9 8"/><circle cx="34" cy="32" r="9"/><path d="M25 32V17q0-8 9-8"/>',
 secret_777:'<path d="M5 9h38v30H5zM9 15h8l-5 16m6-16h9l-5 16m6-16h10l-6 16"/>',
 secret_1337:'<path d="M5 7h38v34H5zM12 15v18m7-18h7l-7 9h7m5-9h7l-7 9h7"/>',
 secret_zero:'<circle cx="24" cy="24" r="17"/><path d="M13 35 35 13"/>',
 secret_close:'<path d="M5 39h38M8 39l10-12 9 4 12-23M34 8h5v5"/><path d="M27 8h8"/>',
 secret_first:'<path d="M24 5 8 14v18l16 11 16-11V14Z"/><path d="M24 13v22m-5-17 5-5 5 5"/>',
 secret_ducks:duckDrawing(0,15,.5)+duckDrawing(16,6,.5)+duckDrawing(24,22,.5),
 secret_double:'<path d="M5 11h38l-7-7m7 7-7 7M5 35h38l-7-7m7 7-7 7"/>',
 secret_pattern:'<path d="M5 9h38M5 19h38M5 29h38M5 39h38"/><path d="m12 5 5 8-5 8 5 8-5 8m19-32-5 8 5 8-5 8 5 8"/>',
 secret_blank:'<rect x="5" y="5" width="38" height="38" rx="3" stroke-dasharray="4 4"/>',
 secret_clock:'<circle cx="24" cy="24" r="19"/><path d="M24 11v14l11 5M16 2h16"/>',
 secret_impossible:'<path d="M7 40 40 7M23 7h17v17M6 18l8-8m-8 8 8 8m-8-8h14"/><path d="M27 40h14"/>',
 secret_owner:'<path d="M6 18 12 6l12 10L36 6l6 12-4 20H10Z"/><circle cx="24" cy="26" r="3"/>',
 social_profile:'<rect x="6" y="5" width="36" height="38" rx="4"/><circle cx="19" cy="18" r="6"/><path d="M10 34c0-11 18-11 18 0M32 15h6m-6 6h6m-6 6h6"/>',
 social_friend1:'<path d="M3 24 14 13l10 7 10-7 11 11-13 13-8-5-8 5Z"/><path d="m17 25 7 7 7-7"/>',
 social_friend5:'<circle cx="24" cy="9" r="5"/><circle cx="9" cy="20" r="5"/><circle cx="39" cy="20" r="5"/><path d="M15 40c0-13 18-13 18 0M2 37c0-8 10-10 13-6m31 6c0-8-10-10-13-6"/>',
 social_friend25:'<circle cx="24" cy="7" r="4"/><circle cx="8" cy="22" r="4"/><circle cx="40" cy="22" r="4"/><circle cx="14" cy="41" r="4"/><circle cx="34" cy="41" r="4"/><path d="M20 10 11 19m17-9 9 9M9 26l5 11m25-11-5 11m-16 4h12"/>',
 daily_draw:'<path d="M7 40h34M11 33 34 6l8 7-23 27H9zM29 11l8 7M11 33l8 7"/>',
 score_uncommon:'<path d="M5 35q20-32 38 0M5 35h38M24 13v20"/><path d="m19 17 5-7 5 7"/>',
 score_rare:'<path d="m24 3 20 17-20 25L4 20Z"/><path d="M4 20h40M24 3l-8 17 8 25 8-25Z"/>',
 score_epic:'<path d="M10 5h28v30L24 44 10 35Z"/><path d="m24 10 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1Z"/>',
 score_legendary:'<path d="m5 14 10 6 9-15 9 15 10-6-5 24H10Z"/><path d="M10 42h28M15 29h18"/>',
 score_mythic:'<circle cx="24" cy="24" r="17"/><path d="m24 3 5 14 15 7-15 5-5 16-5-16L4 24l15-7Z"/>',
 rarity_legendary:'<path d="M24 3 30 18l15 6-15 6-6 15-6-15-15-6 15-6Z"/><circle cx="24" cy="24" r="5"/>'
};
const individualBadgeArt=b=>{
 const key=b.badge_key||'';
 const drawing=drawnScenes[key];
 if(!drawing)return null;
 return '<span class="crilo-achievement-symbol" role="img" aria-label="'+Crilo.esc(b.name)+'"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+drawing+'</svg></span>';
};
// Score Milestones: distinct silhouette and visual concept for every threshold.
// No number stamps, reused base pictograms, or generated variations.
const scoreIllustrations={"score_001":"<rect x=\"6\" y=\"7\" width=\"36\" height=\"34\" rx=\"2\"/><path d=\"M6 15h36M13 24h7m-7 7h7M28 24h7m-7 7h7\"/><path d=\"m27 11 3 3 6-6\"/>","score_100":"<path d=\"M10 8h28v11q0 17-14 23Q10 36 10 19Z\"/><path d=\"M15 12v8q0 11 9 15 9-4 9-15v-8\"/><circle cx=\"18\" cy=\"9\" r=\"6\" fill=\"white\"/><circle cx=\"29\" cy=\"7\" r=\"6\" fill=\"white\"/><path d=\"M16 9h4m-2-2v4M27 7h4m-2-2v4\"/>","score_250":"<path d=\"M5 39q9-3 13-12t13-9 12-12\"/><path d=\"M36 6h7v7M5 39l10 3\"/><path d=\"M7 29h10M18 19h9M30 11h8\"/><circle cx=\"5\" cy=\"39\" r=\"2\"/>","score_500":"<path d=\"M5 40h38M8 40V8h32v32M13 13h22M13 19h22\"/><path d=\"M24 8v32M13 30h8m6 0h8\"/><path d=\"M17 5h14\"/>","score_750":"<path d=\"M9 9h30v30H9z\"/><path d=\"m15 25 6 6 13-15\"/><path d=\"M9 17H4m5 14H4m40-14h-5m5 14h-5\"/>","score_1000":"<path d=\"M4 37h40M8 35V11h32v24M13 15h22M13 21h22M13 27h22\"/><path d=\"M19 35v-8m10 8v-8M17 7h14\"/><path d=\"m19 5 5-3 5 3\"/>","score_1500":"<circle cx=\"24\" cy=\"24\" r=\"19\"/><circle cx=\"24\" cy=\"24\" r=\"3\"/><path d=\"M24 5v16M24 27v16M5 24h16m6 0h16M11 11l10 10m6 6 10 10M37 11 27 21m-6 6L11 37\"/><path d=\"m38 5 6 3-3 6\"/>","score_2000":"<path d=\"M7 39V13l9-6 9 6v26M25 39V13l9-6 9 6v26M4 39h40\"/><path d=\"M12 19h8m-8 7h8m-8 7h8m18-14h8m-8 7h8m-8 7h8\"/>","score_3000":"<path d=\"M10 43V16l14-10 14 10v27M6 43h36\"/><path d=\"M15 20h18v16H15zM20 36v7m8-7v7\"/><path d=\"m19 25 5 4 5-4\"/>","score_4000":"<path d=\"M5 35h38v9H5zM10 39h8m14 0h8\"/><path d=\"M8 24h29q0 11-14 11T8 24ZM37 26l9-7\"/><path d=\"M16 19q-4-4 0-8t0-7M24 19q-4-4 0-8t0-7M32 19q-4-4 0-8\"/>","score_5000":"<path d=\"M7 10h34v24H7zM11 14h26v16H11z\"/><circle cx=\"24\" cy=\"22\" r=\"6\"/><path d=\"M24 17v10m-3-8h6m-6 6h6M5 38h38\"/><path d=\"m12 6 3-3m21 3-3-3\"/>","score_7500":"<path d=\"M10 11q-8 10-3 20t18 11q17 0 17-17t-15-19\"/><path d=\"M15 16q-4 6 0 12m8-18q7-6 13 1\"/><path d=\"M19 30q6 5 12-1\"/><path d=\"M13 3h7m-3-3v7\"/>","score_10000":"<path d=\"M7 39h34V9H7zM13 15h22M13 21h22M13 27h22M13 33h22\"/><path d=\"M19 9V3h10v6M4 39h40\"/>","score_15000":"<path d=\"M8 7h32v35H8zM8 15h32M14 23h20M14 29h20M14 35h13\"/><path d=\"M15 4h18M18 4V2m12 2V2\"/><path d=\"m31 34 3 3 7-9\"/>","score_20000":"<circle cx=\"23\" cy=\"28\" r=\"15\"/><circle cx=\"23\" cy=\"28\" r=\"3\"/><path d=\"M23 13v12M23 31v12M8 28h12m6 0h12\"/><path d=\"M28 7q5-6 10 0l-4 3 7 3-6 4M12 9l-5 6 7 1 4-5\"/><path d=\"M34 4 38 1l4 4-3 4\"/>","score_30000":"<path d=\"M8 9h32v25H24l-10 9v-9H8z\"/><path d=\"M18 17q0-6 6-6t6 6q0 4-6 6v4M24 30h.01\"/><path d=\"M4 7l-2-3m42 3 2-3\"/>","score_50000":"<path d=\"M9 8h30v32H9z\"/><path d=\"M16 16h16M16 22h16M16 28h16\"/><path d=\"M24 32v6m-4-3h8\"/><path d=\"M4 4l6 6m34-6-6 6M4 44l6-6m34 6-6-6\"/>","score_75000":"<path d=\"M5 40h38M9 33h8v7m4-16h8v16m4-27h8v27\"/><path d=\"m6 25 12-9 8 3L43 3M35 3h8v8\"/>","score_100000":"<path d=\"M9 38V11l15-8 15 8v27M5 38h38M14 16h20M14 23h20M14 30h20\"/><path d=\"M21 38v-8h6v8\"/><path d=\"m16 8 8-5 8 5\"/>","score_250000":"<path d=\"M8 6h32v36H8zM14 13h20M14 19h20M14 25h20M14 31h10\"/><circle cx=\"34\" cy=\"34\" r=\"7\" fill=\"white\"/><path d=\"M34 30v8m-3-6h6m-6 4h6\"/><path d=\"M11 3h26\"/>"};
const scoreBadgeIcon=b=>{
 const art=scoreIllustrations[b.badge_key];if(!art)return null;
 return '<span class="crilo-achievement-symbol" role="img" aria-label="'+Crilo.esc(b.name)+'"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+art+'</svg></span>';
};
// Literal illustrations take priority over milestone-based designs.
// Match the displayed badge name, not the threshold or category.
const namedBadgeScenes={
 'pocket change':'<path d="M8 7h32v12c0 14-7 23-16 23S8 33 8 19Z"/><path d="M13 10v9c0 10 4 16 11 16s11-6 11-16v-9"/><circle cx="19" cy="9" r="7" fill="white"/><circle cx="30" cy="7" r="6" fill="white"/><path d="M17 6h4m-2-2v9M28 5h4m-2-2v8"/>',
 'cooking':'<path d="M5 31h38v12H5zM11 37h7m13 0h7"/><path d="M9 24h26q0 10-13 10T9 24ZM35 25l10-6"/><path d="M16 19q-4-4 0-8t0-7M24 19q-4-4 0-8t0-7M32 19q-4-4 0-8"/>'
};
const namedBadgeIcon=b=>{
 const name=(b.name||'').trim().toLowerCase();
 const art=namedBadgeScenes[name];if(!art)return null;
 return '<span class="crilo-achievement-symbol" role="img" aria-label="'+Crilo.esc(b.name)+'"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+art+'</svg></span>';
};
const badgeSymbol=b=>namedBadgeIcon(b)||scoreBadgeIcon(b)||bespokeDuckIcon(b)||individualBadgeArt(b)||sceneArt(b);


const renderBadgeIcons=()=>{if(window.lucide?.createIcons)window.lucide.createIcons({attrs:{'stroke-width':1.65}})};

async function load(){if(!target)target=Crilo.user?.id;if(!target){$('profileName').textContent='Sign in to see your statistics';return}const [{data:p},{data:stats,error:statsError},{data:metrics,error:metricsError},{data:badges,error:badgesError},{data:earned,error:earnedError},{data:featured},{data:domainScores}]=await Promise.all([criloDB.from('profiles').select('id,username,name_color,account_code').eq('id',target).maybeSingle(),criloDB.rpc('get_crilo_player_stats',{target_user:target}),criloDB.rpc('crilo_profile_metrics',{p_user:target}),criloDB.from('badges').select('id,badge_key,name,description,category,is_secret,sort_order').order('sort_order'),criloDB.from('user_badges').select('badge_id,earned_at').eq('user_id',target),criloDB.from('featured_badges').select('badge_id,position').eq('user_id',target).order('position'),criloDB.from('game_scores').select('score').eq('user_id',target).eq('game_key','domain').order('score',{ascending:false}).limit(5)]);if(!p){$('profileName').textContent='Player not found';return}$('profileName').textContent=p.username;$('profileName').style.color=p.name_color||'';$('avatar').textContent=(p.username||'C')[0].toUpperCase();$('profileCode').textContent=target===Crilo.user?.id?`Account code: ${p.account_code||'—'}`:'Crilo player';const s=metricsError?(stats?.[0]||{}):(metrics||{});
const {data:rarestOfficial,error:rarestError}=await criloDB.from('daily_runs')
 .select('score,spins,upgrades,doubles,ducks,extra_spins,best_roll_points,best_roll_label,daily_period,rarity_label,drawing')
 .eq('user_id',target).eq('is_test',false).order('score',{ascending:false}).limit(1).maybeSingle();
if(rarestError)console.warn('Could not load official rarest run',rarestError);const rareScore=Number(rarestOfficial?.score??s.best_score??0);const rareTier=!(statsError&&metricsError)&&Number(s.official_runs||0)>0&&window.CriloRarity?CriloRarity.classify(rareScore):null;if(metricsError)console.warn('Updated player statistics unavailable; run profile-metrics-and-featured-badges.sql',metricsError);if(statsError&&metricsError)console.error('Player statistics unavailable',statsError);const vals=[['Official Dailies',statsError&&metricsError?'—':s.official_runs??0],['Best Score',statsError&&metricsError?'—':Number(s.best_score||0).toLocaleString()],['Average Score',statsError&&metricsError?'—':Number(s.average_score||0).toLocaleString()],['Current Streak',s.current_streak||0],['Longest Streak',s.longest_streak||0],['Total Spins',Number(s.total_spins||0).toLocaleString()],['Upgrades',Number(s.total_upgrades||0).toLocaleString()],['Doubles',Number(s.total_doubles||0).toLocaleString()],['Total Ducks',Number(s.total_ducks||0).toLocaleString()],['Extra Spins',Number(s.total_extra_spins||0).toLocaleString()],['Best Roll',Number(s.best_roll_points||0).toLocaleString()],['Rarest Run',rareTier?((rareTier.probability*100).toFixed(rareTier.probability<0.01?3:rareTier.probability<0.1?2:1)+'%'):'—'],['Best Daily Rank',s.best_daily_rank?`#${s.best_daily_rank}`:'—'],['Daily Wins',s.daily_wins||0],['Podiums',s.podium_finishes||0],['Top 10s',s.top_10_finishes||0]];$('statsGrid').innerHTML=vals.map(([k,v])=>`<div class="stat-tile ${k==='Rarest Run'&&rareTier?'stat-rarity stat-rarity-'+rareTier.color:'' } ${k==='Rarest Run'&&rarestOfficial?'stat-rarity-clickable':''}" ${k==='Rarest Run'&&rarestOfficial?'role="button" tabindex="0" aria-label="View rarest official Daily run details"':''}><b>${v}</b><span>${k}</span>${k==='Rarest Run'&&rareTier?'<small class="stat-rarity-tier">'+Crilo.esc(rareTier.label)+'</small>':''}${k==='Rarest Run'&&rarestOfficial?'<small class="stat-rarity-hint">View run ↗</small>':''}</div>`).join('');const statDescriptions={
 'Official Dailies':'Number of official Daily games you completed. Private owner test runs do not count.',
 'Best Score':'Your highest score in a single official Daily.',
 'Average Score':'Your average score across all completed official Dailies.',
 'Current Streak':'Consecutive Daily periods you have played, including the current period if you have already completed it.',
 'Longest Streak':'Your longest consecutive streak of official Daily periods played.',
 'Total Spins':'Total wheel spins across all your official Dailies.',
 'Upgrades':'Total upgrade slices landed across all your official Dailies.',
 'Doubles':'Total double slices landed across all your official Dailies.',
 'Total Ducks':'Total ducks collected across all your official Dailies, not your single-day record.',
 'Extra Spins':'Total bonus spins earned from the extra-spins wheel slice across official Dailies.',
 'Best Roll':'Highest number of points earned from a single scoring spin across official Dailies.',
 'Rarest Run':'Your highest-scoring official Daily, with its estimated score rarity. Select to see its full run details.',
 'Best Daily Rank':'Your best final position on a completed Daily leaderboard. The current Daily does not count until reset.',
 'Daily Wins':'Number of completed Daily leaderboards where your official score finished tied for 1st or alone in 1st. Today is excluded until reset.',
 'Podiums':'Number of completed Daily leaderboards where you finished in the top 3, including ties. Today is excluded until reset.',
 'Top 10s':'Number of completed Daily leaderboards where you finished in the top 10, including ties. Today is excluded until reset.'
};
if(rarestOfficial){
 const modal=$('rarestRunModal'),open=()=>{
  const run=rarestOfficial,tier=window.CriloRarity?.classify(Number(run.score));
  $('rarestRunTitle').textContent='Your rarest official Daily';
  $('rarestRunScore').textContent=Number(run.score).toLocaleString()+' points';
  $('rarestRunRarity').textContent=tier?tier.label+' · About '+(tier.probability*100).toFixed(tier.probability<0.01?3:tier.probability<0.1?2:1)+'% of runs reach this score or higher':'';
  $('rarestRunDate').textContent='Daily: '+String(run.daily_period||'—');
  const items=[['Spins',run.spins],['Upgrades',run.upgrades],['Doubles',run.doubles],['Ducks',run.ducks],['Extra spins',run.extra_spins],['Best roll',run.best_roll_points]];
  $('rarestRunDetails').innerHTML=items.map(([label,value])=>'<div class="rarest-run-detail"><b>'+Number(value||0).toLocaleString()+'</b><span>'+label+'</span></div>').join('');
  $('rarestRunDrawing').classList.toggle('hidden',!run.drawing);
  if(run.drawing)$('rarestRunDrawing').src=run.drawing;
  modal.classList.remove('hidden');
 };
 const tile=$('statsGrid').querySelector('.stat-rarity-clickable');
 tile?.addEventListener('click',open);
 tile?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
 $('rarestRunClose').onclick=()=>modal.classList.add('hidden');
 modal.onclick=e=>{if(e.target===modal)modal.classList.add('hidden')};
}
$('statsGrid').querySelectorAll('.stat-tile').forEach((tile,index)=>{
 const [name,value]=vals[index];
 if(name==='Rarest Run'&&rarestOfficial)return;
 tile.classList.add('stat-explained');tile.tabIndex=0;tile.setAttribute('role','button');
 tile.setAttribute('aria-label','About '+name);
 const open=()=>{
  $('statInfoTitle').textContent=name;
  $('statInfoValue').textContent=String(value);
  $('statInfoDescription').textContent=statDescriptions[name]||'Official Daily statistic.';
  $('statInfoModal').classList.remove('hidden');
 };
 tile.addEventListener('click',open);
 tile.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
});
$('statInfoClose').onclick=()=>$('statInfoModal').classList.add('hidden');
$('statInfoModal').onclick=e=>{if(e.target===$('statInfoModal'))$('statInfoModal').classList.add('hidden')};
const em=new Map((earned||[]).map(x=>[x.badge_id,x]));const badgeDataReady=!badgesError&&!earnedError;const badgeCatalog=new Set((badges||[]).map(b=>b.id));const earnedCount=[...em.keys()].filter(id=>badgeCatalog.has(id)).length;$('badgeProgress').textContent=badgeDataReady?`${earnedCount} / ${(badges||[]).length}`:'Badge data unavailable';if(!badgeDataReady){$('badgeGrid').textContent='Badges could not be loaded. Please refresh to try again.';$('featuredBadges').textContent='Featured badges are temporarily unavailable.';return;}const groupInfo={score:['#','Score Milestones','Reach new personal score heights'],upgrade:['↑','Upgrade Mastery','Grow your wheel and multiply values'],double:['×2','Double Trouble','Make the most of ×2'],duck:[duckIcon,'Duck Encounters','A little luck with your feathered friends'],extra_spins:['+2','Bonus Spins','Keep the wheel turning'],rarity:['✦','Rare Moments','Beat the odds'],sequence:['↻','Wheel Combos','Make unusual things happen in one run'],daily:['◷','Daily Dedication','Show up and play'],leaderboard:[trophyIcon,'Leaderboard Legends','Climb the rankings'],social:['☺','Social Circle','Make connections'],secret:['?','Hidden Wonders','Discover the unexpected']};const groups=new Map();for(const b of badges||[]){const key=b.category||'other';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b)}prepareBadgeIcons(badges||[]);const badgeSymbols=new Map((badges||[]).map(b=>[b.id,badgeSymbol(b)]));const cards=list=>list.map(b=>{const e=em.get(b.id),secret=b.is_secret&&!e;return `<article class="badge-card ${e?'':'locked'} ${secret?'secret':''}"><div class="badge-icon">${secret?'?':badgeSymbols.get(b.id)}</div><b>${secret?'???':Crilo.esc(b.name)}</b><p>${Crilo.esc(secret?'Unlock to reveal this badge.':b.description)}</p>${e?`<p>Unlocked ${new Date(e.earned_at).toLocaleDateString()}</p>`:''}</article>`}).join('');$('badgeGrid').innerHTML=[...groups].map(([key,list])=>{const count=list.filter(b=>em.has(b.id)).length,info=groupInfo[key]||['★',key.replace(/_/g,' ').replace(/\\b\\w/g,x=>x.toUpperCase()),'Collect badges in this set'];return `<details class="badge-set"><summary class="badge-set-head"><span class="badge-set-icon">${info[0]}</span><span class="badge-set-label"><strong>${Crilo.esc(info[1])}</strong><small>${Crilo.esc(info[2])}</small></span><span class="badge-set-count"><b>${count}/${list.length}</b><small>${Math.round(100*count/list.length)}%</small></span><span class="badge-set-chevron">⌄</span><span class="badge-set-track"><i style="width:${100*count/list.length}%"></i></span></summary><div class="badge-set-items">${cards(list)}</div></details>`}).join('');renderBadgeIcons();const bm=new Map((badges||[]).map(b=>[b.id,b]));
const mine=target===Crilo.user?.id;
const featuredIds=new Map((featured||[]).map(f=>[f.position,f.badge_id]));
const featuredCard=(position)=>{
 const id=featuredIds.get(position),b=id&&em.has(id)?bm.get(id):null;
 return '<button type="button" class="featured-slot '+(mine?'featured-editable':'')+'" data-position="'+position+'" '+(mine?'title="Choose an earned badge for this slot"':'disabled')+'>'+(b?'<div class="badge-icon">'+badgeSymbols.get(b.id)+'</div><b>'+Crilo.esc(b.name)+'</b>':mine?'<span>+ Choose badge</span>':'<span>Empty badge slot</span>')+'</button>';
};
$('featuredBadges').innerHTML=Array.from({length:5},(_,i)=>featuredCard(i+1)).join('');
if(mine){
 const dialog=$('featuredPicker');
 const options=()=>'<option value="">Empty slot</option>'+[...bm.values()].filter(b=>em.has(b.id)).map(b=>'<option value="'+Crilo.esc(b.id)+'">'+Crilo.esc(b.name)+'</option>').join('');
 $('featuredBadges').querySelectorAll('[data-position]').forEach(btn=>btn.addEventListener('click',()=>{
  const pos=Number(btn.dataset.position);
  $('featuredSlotNumber').textContent=pos;
  $('featuredBadgeSelect').innerHTML=options();
  $('featuredBadgeSelect').value=featuredIds.get(pos)||'';
  $('featuredStatus').textContent='';
  dialog.dataset.position=pos;
  dialog.classList.remove('hidden');
 }));
 $('featuredCancel').onclick=()=>dialog.classList.add('hidden');
 $('featuredSave').onclick=async()=>{
  const position=Number(dialog.dataset.position),id=$('featuredBadgeSelect').value||null;
  $('featuredSave').disabled=true;
  const {error}=await criloDB.rpc('crilo_set_featured_badge',{p_position:position,p_badge_id:id?Number(id):null});
  $('featuredSave').disabled=false;
  if(error){$('featuredStatus').textContent='Could not save: '+error.message;return}
  if(id)featuredIds.set(position,id);else featuredIds.delete(position);
  $('featuredBadges').innerHTML=Array.from({length:5},(_,i)=>featuredCard(i+1)).join('');
  dialog.classList.add('hidden');
  load();
 };
}
let local=[];if(target===Crilo.user?.id){try{local=JSON.parse(localStorage.getItem('crilo_domain_top5')||'[]')}catch{}}const ds=(domainScores||[]).map(x=>x.score);const top=[...ds,...local].sort((a,b)=>b-a).slice(0,5);$('domainTop').innerHTML=top.length?top.map((v,i)=>`<div class="domain-score"><span class="domain-rank">${i+1}</span><span class="domain-score-main"><span class="domain-score-title">${i===0?'Personal best':'Run '+(i+1)}</span><span class="domain-score-bar"><i style="width:${Math.min(100,Math.max(0,Number(v)/5000*100))}%"></i></span></span><strong class="domain-score-number">${Number(v).toLocaleString()}<small> / 5,000</small></strong></div>`).join(''):'<span class="muted">No Domain scores yet.</span>'}
window.addEventListener('crilo-auth-ready',load)})();
