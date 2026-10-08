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
const scoreIllustrations={"score_001":"<rect x=\"7\" y=\"8\" width=\"34\" height=\"33\" rx=\"3\" fill=\"#f8e7c7\"/><path d=\"M7 16h34M14 24h10M14 30h7\"/><path d=\"m28 30 5 5 8-13\" stroke=\"#9bcdb5\" stroke-width=\"3\"/><path d=\"M15 8V4m18 4V4\"/>","score_100":"<path d=\"M9 15h30l-3 19q-2 8-12 9-10-1-12-9Z\" fill=\"#c5e1f2\"/><path d=\"M9 15h30M13 20v12q2 8 11 9 9-1 11-9V20\"/><circle cx=\"19\" cy=\"12\" r=\"6\" fill=\"#f5dbab\"/><circle cx=\"31\" cy=\"11\" r=\"6\" fill=\"#f5dbab\"/><path d=\"M19 8v8m-3-5h6M31 7v8m-3-5h6\"/><path d=\"M12 17h24\"/>","score_250":"<path d=\"M5 42h38\" stroke=\"#a3c9b7\" stroke-width=\"2.5\"/><path d=\"M7 42V32h12v10M19 42V23h12v19M31 42V14h12v28\" fill=\"#cce5d7\"/><path d=\"M7 32h12m0-9h12m0-9h12\"/><circle cx=\"14\" cy=\"18\" r=\"4\" fill=\"#f5d8bb\"/><path d=\"M14 22v9m0-5-5 4m5-4 5 4m-5 1-4 6m4-6 5 6\" stroke=\"#30343c\" stroke-width=\"1.9\"/><path d=\"M35 14V4m0 0h10l-3 4 3 4H35\" fill=\"#f4c7bf\"/>","score_500":"<path d=\"M10 7h28l-4 30q-.7 6-10 6t-10-6Z\" fill=\"#f4f8fb\"/><path d=\"M12.5 25h23L34 37q-.7 6-10 6t-10-6Z\" fill=\"#b8dced\"/><path d=\"M10 7h28l-4 30q-.7 6-10 6t-10-6Z\"/><path d=\"M12.5 25h23\" stroke=\"#79b5d3\" stroke-width=\"1.7\"/>","score_750":"<path d=\"M7 15q0-7 8-7h19q8 0 8 7v24H7Z\" fill=\"#d5e6d9\"/><path d=\"M7 39h35\"/><path d=\"M15 24q3-3 6 0m7 0q3-3 6 0M18 31q7 6 13 0\"/><path d=\"m10 8-4-5m33 5 4-5\"/><path d=\"M15 14q9-6 18 0\" stroke=\"#e5b5a5\"/><path d=\"m34 32 4 3 6-8\" stroke=\"#9acbb4\" stroke-width=\"2.5\"/>","score_1000":"<circle cx=\"7\" cy=\"14\" r=\"4.5\" fill=\"#f5d8bd\"/><circle cx=\"18\" cy=\"14\" r=\"4.5\" fill=\"#c6e2d3\"/><circle cx=\"30\" cy=\"14\" r=\"4.5\" fill=\"#dcd5f1\"/><circle cx=\"41\" cy=\"14\" r=\"4.5\" fill=\"#f4d2cb\"/><path d=\"M2 39V27q0-6 5-6t5 6v12M13 39V27q0-6 5-6t5 6v12M25 39V27q0-6 5-6t5 6v12M36 39V27q0-6 5-6t5 6v12\" fill=\"#c8dfee\"/><path d=\"M7 30v13m11-13v13m12-13v13m11-13v13\"/>","score_1500":"<circle cx=\"24\" cy=\"24\" r=\"19\" fill=\"#f6e1b9\"/><path d=\"M24 24V5A19 19 0 0 1 40.5 14.5Z\" fill=\"#c7e5d4\"/><path d=\"M24 24 40.5 14.5A19 19 0 0 1 40.5 33.5Z\" fill=\"#cbdff2\"/><path d=\"M24 24 40.5 33.5A19 19 0 0 1 24 43Z\" fill=\"#e4d8f1\"/><path d=\"M24 24V43A19 19 0 0 1 7.5 33.5Z\" fill=\"#f3cfc7\"/><path d=\"M24 24 7.5 33.5A19 19 0 0 1 7.5 14.5Z\" fill=\"#f6e1b9\"/><path d=\"M24 24 7.5 14.5A19 19 0 0 1 24 5Z\" fill=\"#d9e7f2\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#fff9e9\"/><path d=\"m21 1 3 5 3-5\" fill=\"#f0aeb1\"/>","score_2000":"<g transform=\"translate(2 6) scale(.84)\"><path d=\"M3 19 8 16 20 12Q26 10 26 17L25 26Q24 30 18 32L9 35 3 31Z\" fill=\"#333842\"/><path d=\"M5 20 10 17 20 14Q23 13 23 17L22 25Q21 28 17 29L10 32 5 29Z\" fill=\"#4b535e\"/><path d=\"M3 27 9 30 17 27 17 32 9 35 3 32Z\" fill=\"#fff9ee\"/><path d=\"m5 29 2 2m2-1 2 2m2-3 2 1\" stroke-width=\"1.5\"/><path d=\"M7 35v8m12-12v10m5-16v10\" stroke-width=\"2.3\"/></g><g transform=\"translate(25 6) scale(.84)\"><path d=\"M3 19 8 16 20 12Q26 10 26 17L25 26Q24 30 18 32L9 35 3 31Z\" fill=\"#333842\"/><path d=\"M5 20 10 17 20 14Q23 13 23 17L22 25Q21 28 17 29L10 32 5 29Z\" fill=\"#4b535e\"/><path d=\"M3 27 9 30 17 27 17 32 9 35 3 32Z\" fill=\"#fff9ee\"/><path d=\"m5 29 2 2m2-1 2 2m2-3 2 1\" stroke-width=\"1.5\"/><path d=\"M7 35v8m12-12v10m5-16v10\" stroke-width=\"2.3\"/></g>","score_3000":"<path d=\"M15 5h18l-4 15H19Z\" fill=\"#c8e1f0\"/><path d=\"M15 5h8l-1 15h-3ZM25 5h8l-4 15h-7Z\" fill=\"#e1d6f0\"/><circle cx=\"24\" cy=\"30\" r=\"13\" fill=\"#f5dcab\"/><path d=\"m18 30 4 4 8-9\" stroke=\"#789f83\" stroke-width=\"3\"/><circle cx=\"24\" cy=\"30\" r=\"9\" stroke=\"#d5b978\" stroke-width=\"1.2\"/>","score_4000":"<path d=\"M6 26h30q0 13-15 13T6 26Z\" fill=\"#bcd9eb\"/><path d=\"M36 29h10\" stroke-width=\"4\"/><ellipse cx=\"21\" cy=\"25\" rx=\"11\" ry=\"7\" fill=\"#fff9e9\"/><circle cx=\"21\" cy=\"25\" r=\"4\" fill=\"#f4d18a\"/><path d=\"M14 13q-3-4 1-8M23 13q-3-4 1-8M32 13q-3-4 1-8\" stroke=\"#e8b2a7\" stroke-width=\"1.8\"/><path d=\"M6 26h30q0 13-15 13T6 26Z\"/>","score_5000":"<circle cx=\"22\" cy=\"20\" r=\"13\" fill=\"#f6d9a7\"/><circle cx=\"22\" cy=\"20\" r=\"9\" fill=\"#fff0cb\"/><path d=\"M22 13v14m-4-11h6q5 0 0 4h-4q-5 0 0 4h6\" stroke=\"#b18b50\" stroke-width=\"1.7\"/><path d=\"M9 33h13v7H9Z\" fill=\"#c9dff2\"/><circle cx=\"12\" cy=\"43\" r=\"3.5\" fill=\"#e5d5f1\"/><circle cx=\"21\" cy=\"43\" r=\"3.5\" fill=\"#e5d5f1\"/><path d=\"m24 33 8 6 6-6\" stroke=\"#30343c\" stroke-width=\"2\"/><circle cx=\"31\" cy=\"43\" r=\"3.5\" fill=\"#e5d5f1\"/><circle cx=\"40\" cy=\"43\" r=\"3.5\" fill=\"#e5d5f1\"/><path d=\"M29 39h13\" stroke-width=\"2.5\"/>","score_7500":"<circle cx=\"24\" cy=\"25\" r=\"17\" fill=\"#f6d9c8\"/><path d=\"M15 21q3-3 6 0m6 0q3-3 6 0M17 30q7 6 14 0\"/><path d=\"M9 8 4 3m35 5 5-5M24 5V2\" stroke=\"#e7b6ac\" stroke-width=\"2.3\"/><path d=\"M13 11q11-8 22 0\" stroke=\"#30343c\" stroke-width=\"2\"/><path d=\"M33 32q4 3 8-1\" stroke=\"#a6d0ba\" stroke-width=\"2.5\"/>","score_10000":"<circle cx=\"6\" cy=\"14\" r=\"3.6\" fill=\"#f6d9c0\"/><circle cx=\"15\" cy=\"14\" r=\"3.6\" fill=\"#c6e2d3\"/><circle cx=\"24\" cy=\"14\" r=\"3.6\" fill=\"#dcd5f1\"/><circle cx=\"33\" cy=\"14\" r=\"3.6\" fill=\"#f3d0c9\"/><circle cx=\"42\" cy=\"14\" r=\"3.6\" fill=\"#f5dfac\"/><path d=\"M2 38V25q0-5 4-5t4 5v13M11 38V25q0-5 4-5t4 5v13M20 38V25q0-5 4-5t4 5v13M29 38V25q0-5 4-5t4 5v13M38 38V25q0-5 4-5t4 5v13\" fill=\"#c9dff0\"/><path d=\"M6 30v12m9-12v12m9-12v12m9-12v12m9-12v12\"/>","score_15000":"<rect x=\"7\" y=\"17\" width=\"34\" height=\"25\" rx=\"3\" fill=\"#c9dff0\"/><path d=\"M18 17v-5q0-4 4-4h4q4 0 4 4v5\" fill=\"none\"/><path d=\"M7 26q17 10 34 0\" fill=\"#b5d2e5\"/><path d=\"M22 25h4v6h-4Z\" fill=\"#f5deb0\"/><path d=\"M24 8v-5\" stroke=\"#30343c\"/><path d=\"m21 5 3-3 3 3\" fill=\"#f3d2c7\"/>","score_20000":"<circle cx=\"24\" cy=\"27\" r=\"15\" fill=\"#c9e4ef\"/><path d=\"M24 12v30M9 27h30M13 17l22 20M35 17 13 37\" stroke=\"#9dbedc\" stroke-width=\"1.8\"/><circle cx=\"24\" cy=\"27\" r=\"4\" fill=\"#f8e4b9\"/><path d=\"M10 16 15 5l7 7 6-8 7 8 5-7 2 11Z\" fill=\"#ded2f1\"/><path d=\"M13 17h25\" stroke=\"#30343c\" stroke-width=\"1.5\"/><path d=\"m36 9 3-4m-29 4L7 5\" stroke=\"#e8c4a8\" stroke-width=\"2\"/>","score_30000":"<path d=\"M5 9h38v27H21l-10 8v-8H5Z\" fill=\"#d1e7db\"/><path d=\"M17 19q0-7 7-7t7 7q0 5-7 8v3\" stroke-width=\"2.8\"/><circle cx=\"24\" cy=\"35\" r=\"1.6\" fill=\"#30343c\"/>","score_50000":"<path d=\"M11 10h26v27H11Z\" fill=\"#f8e5c5\"/><path d=\"M14 16h20m-20 6h20m-20 6h13\" stroke=\"#b8a88f\"/><path d=\"M8 6h32v6H8Z\" fill=\"#f1c4c1\"/><path d=\"M7 39h34\" stroke-width=\"2.5\"/><path d=\"m31 31 5-6 7 6\" fill=\"#f3c5c5\"/><path d=\"M35 25v15\" stroke-width=\"2.3\"/>","score_75000":"<path d=\"M5 42h37M9 42V31h9v11\" fill=\"#f5ddba\"/><path d=\"M20 42V24h9v18\" fill=\"#c7e4d3\"/><path d=\"M31 42V17h9v25\" fill=\"#dcd3f1\"/><path d=\"M8 34 18 27 27 21 37 8\" stroke=\"#30343c\" stroke-width=\"2.5\"/><path d=\"m31 8 6 0 0 6\" stroke=\"#30343c\" stroke-width=\"2.5\"/><path d=\"M36 5v-3m5 7h4\" stroke=\"#e8b5a9\" stroke-width=\"2\"/>","score_100000":"<circle cx=\"7\" cy=\"12\" r=\"3.3\" fill=\"#f6d9bf\"/><circle cx=\"14\" cy=\"12\" r=\"3.3\" fill=\"#c9e3d5\"/><circle cx=\"21\" cy=\"12\" r=\"3.3\" fill=\"#ded5f0\"/><circle cx=\"28\" cy=\"12\" r=\"3.3\" fill=\"#f3d0c9\"/><circle cx=\"35\" cy=\"12\" r=\"3.3\" fill=\"#f5dfac\"/><circle cx=\"42\" cy=\"12\" r=\"3.3\" fill=\"#c9dff0\"/><path d=\"M4 20h6v17H4Zm7 0h6v17h-6Zm7 0h6v17h-6Zm7 0h6v17h-6Zm7 0h6v17h-6Zm7 0h6v17h-6Z\" fill=\"#d0e4ee\"/><path d=\"M7 28v14m7-14v14m7-14v14m7-14v14m7-14v14m7-14v14\"/>","score_250000":"<path d=\"M7 13h17v27H7Z\" fill=\"#c9dff0\"/><path d=\"M9 18h13v8H9Z\" fill=\"#f8f4e8\"/><path d=\"M12 31h7m-7 4h7\" stroke=\"#a2bfd4\"/><path d=\"M20 21q3-6 10-6h8q4 0 4 4v15q0 4-4 4h-8q-7 0-10-6\" fill=\"#f5d8bc\"/><path d=\"M25 20q5-5 10 0m-10 13q5 5 10 0\"/><path d=\"M31 25h6m-3-3v6\" stroke=\"#ad936d\" stroke-width=\"1.6\"/><path d=\"M13 13V7q0-4 4-4t4 4v6\" stroke-width=\"2\"/>"};
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
// Individually composed pastel artwork, keyed by exact achievement title/identity.
const customTitleScenes={"daily_1":"<circle cx=\"24\" cy=\"26\" r=\"17\" fill=\"#f8dcaf\"/><path d=\"M24 9v34M7 26h34M12 14l24 24m0-24L12 38\" stroke=\"#bc9970\" stroke-width=\"1.6\"/><circle cx=\"24\" cy=\"26\" r=\"5\" fill=\"#c9e4d5\"/><path d=\"M10 7q-5-4-7 1m35-1q5-4 7 1\" stroke=\"#30343c\" stroke-width=\"2\"/><path d=\"m4 4 5 5m30 0 5-5\" stroke-width=\"1.6\"/>","daily_3":"<path d=\"M8 11h27v28H8Z\" fill=\"#c9dff0\"/><path d=\"M8 18h27M15 7v8m13-8v8\"/><path d=\"M13 23h7v7h-7zM23 23h7v7h-7z\" fill=\"#f6d8b8\"/><path d=\"m14 26 2 2 3-4m5 2 2 2 3-4\" stroke=\"#85b99f\" stroke-width=\"1.6\"/><path d=\"M39 18q7 9-1 17\" stroke=\"#30343c\" stroke-width=\"2.5\"/><path d=\"m34 32 4 4 5-3\" stroke=\"#30343c\" stroke-width=\"2.5\"/>","daily_7":"<rect x=\"5\" y=\"9\" width=\"38\" height=\"32\" rx=\"3\" fill=\"#f7e5bf\"/><path d=\"M5 17h38M13 5v8m22-8v8\"/><path d=\"M10 22h7v6h-7zM20 22h7v6h-7zM30 22h7v6h-7zM10 31h7v6h-7zM20 31h7v6h-7zM30 31h7v6h-7z\" fill=\"#c8e5d6\"/><path d=\"m11 25 2 2 3-4m5 2 2 2 3-4m5 2 2 2 3-4m-23 11 2 2 3-4m5 2 2 2 3-4m5 2 2 2 3-4\" stroke=\"#669f83\" stroke-width=\"1.25\"/>","daily_14":"<path d=\"M9 40V19q0-11 15-11t15 11v21Z\" fill=\"#cde5d5\"/><path d=\"M9 40h30M16 40V24q0-8 8-8t8 8v16\" fill=\"#f7e1bb\"/><path d=\"M24 16v24M16 29h16\"/><path d=\"M14 12q10-13 20 0\" stroke=\"#83b89b\" stroke-width=\"2.3\"/><path d=\"m5 7 4 4m34-4-4 4\" stroke=\"#e6bdab\" stroke-width=\"2\"/>","daily_30":"<path d=\"M7 23 24 8l17 15v19H7Z\" fill=\"#f4d7c8\"/><path d=\"M4 23 24 5l20 18\" stroke-width=\"2.5\"/><path d=\"M19 42V28h10v14\" fill=\"#c9e1f0\"/><path d=\"M11 26h6v7h-6zM32 26h6v7h-6z\" fill=\"#f8e7bf\"/><path d=\"M24 19q-5-7-9 0 0 5 9 10 9-5 9-10-4-7-9 0Z\" fill=\"#e9aeb1\" stroke-width=\"1.3\"/>","daily_50":"<path d=\"M5 30q18-30 38 0M5 30h38M10 37h28\"/><path d=\"M13 27q11-14 22 0\" stroke=\"#9ebfdc\" stroke-width=\"5\"/><path d=\"m5 20-3-3m41 3 3-3\"/>","daily_100":"<path d=\"M12 42V17l12-11 12 11v25\" fill=\"#d3d7f2\"/><path d=\"M7 42h34M18 25h12M18 32h12M24 6v36\"/><path d=\"m17 8 7-5 7 5\"/>","daily_365":"<path d=\"M6 12h36v28H6z\" fill=\"#d6eddf\"/><path d=\"M6 19h36M14 8v8m20-8v8\"/><path d=\"m15 30 6 6 13-14\" stroke=\"#8dbbb0\" stroke-width=\"3\"/><path d=\"M35 4q7 1 7 8\"/>","runs_25":"<path d=\"M8 40V8h31v32H8z\" fill=\"#f4e5c8\"/><path d=\"M14 15h19M14 22h19M14 29h13\"/><path d=\"m29 33 4 4 8-10\" stroke=\"#a5c6a4\" stroke-width=\"3\"/>","runs_50":"<circle cx=\"24\" cy=\"24\" r=\"18\" fill=\"#e5d8f4\"/><path d=\"M24 6v36M6 24h36M11 11l26 26m0-26L11 37\"/><path d=\"m36 3 8 1-3 8\"/>","runs_100":"<path d=\"M9 42V12l15-8 15 8v30\" fill=\"#e4c7b4\"/><path d=\"M5 42h38M15 20h18M15 27h18M20 42v-9h8v9\"/><path d=\"M24 4v12\"/>","runs_250":"<path d=\"M10 41 6 12l18-8 18 8-4 29Z\" fill=\"#bcd8e6\"/><path d=\"M13 17h22M16 26h16M19 34h10\"/><path d=\"m8 8-5-3m37 3 5-3\"/>","runs_500":"<path d=\"M24 4 6 19l18 25 18-25Z\" fill=\"#f5dfb9\"/><circle cx=\"24\" cy=\"21\" r=\"9\" fill=\"#b6d9d4\"/><path d=\"M24 12v18m-9-9h18\"/>","runs_1000":"<path d=\"M10 42V13h28v29\" fill=\"#ead3b8\"/><path d=\"M7 42h34M14 21h20M14 29h20\"/><path d=\"M17 13V7h14v6M20 7V3h8v4\"/><path d=\"M20 42v-8h8v8\"/>","daily_draw":"<path d=\"M9 38V11h29v27Z\" fill=\"#f4e7d5\"/><path d=\"m13 32 9-11 6 6 5-13\"/><path d=\"M5 42h38M32 6l7-4 4 6-7 4Z\" fill=\"#f6c4bb\"/><path d=\"m35 12-7 13\"/>","double_1":"<path d=\"M6 10h20v29H6z\" fill=\"#c6def4\"/><path d=\"M22 16h20v26H22z\" fill=\"#f5c8d6\"/><path d=\"m13 21 6 7m0-7-6 7m17-2 6 7m0-7-6 7\"/>","double_2":"<path d=\"M8 8h15v32H8z\" fill=\"#d7e9cc\"/><path d=\"M25 8h15v32H25z\" fill=\"#d7e9cc\"/><path d=\"M13 18h5m-2-3v8m14-5h5m-2-3v8\"/><path d=\"M13 30h5m12 0h5\"/>","double_3":"<path d=\"M6 40V11h35v29\" fill=\"#f7e5c7\"/><path d=\"M6 18h35M14 24h8m-8 7h8M29 24h7m-7 7h7\"/><path d=\"M18 11V5h11v6\"/>","double_4":"<path d=\"M6 39 17 28 26 18 40 5\" stroke=\"#b6d9bd\" stroke-width=\"5\"/><path d=\"m31 5 9 0 0 9\"/><path d=\"M5 43h38M8 34l8 8m3-16 8 9\"/>","double_5":"<path d=\"M6 9h36v31H6z\" fill=\"#f4dfd0\"/><path d=\"M6 17h36M18 17v23M30 17v23M6 25h36M6 33h36\"/><path d=\"m10 12 3 3m0-3-3 3\"/>","double_6":"<path d=\"M9 8h30v32H9z\" fill=\"#cfe9e8\"/><path d=\"M15 15h18M15 22h18M15 29h18\"/><path d=\"m20 36 4-4 4 4\"/>","double_7":"<rect x=\"10\" y=\"6\" width=\"28\" height=\"37\" rx=\"3\" fill=\"#cbd9ed\"/><path d=\"M15 12h18v8H15zM15 26h4m6 0h4m-14 7h4m6 0h4m6-7h3m-3 7h3\"/><path d=\"M15 38h18\"/>","double_8":"<circle cx=\"18\" cy=\"32\" r=\"11\" fill=\"#dbe8f5\"/><circle cx=\"31\" cy=\"18\" r=\"8\" fill=\"#dbe8f5\"/><circle cx=\"36\" cy=\"9\" r=\"4\" fill=\"#dbe8f5\"/><path d=\"M13 29h10m-7 5h7\"/>","double_10":"<path d=\"m18 42 6-18 6 18-6-5Z\" fill=\"#f4d1bc\"/><path d=\"M18 29 12 17l12-13 12 13-6 12\" fill=\"#c9dcf4\"/><circle cx=\"24\" cy=\"17\" r=\"5\" fill=\"#f7e4bd\"/><path d=\"m14 39-6 5m26-5 6 5\"/>","double_back2":"<path d=\"M8 9h32v30H8z\" fill=\"#e9d9f4\"/><path d=\"m14 17 7 7-7 7m12-14 7 7-7 7\"/><path d=\"M9 4h30\"/>","double_back3":"<path d=\"M7 40 15 9l9 12 9-12 8 31Z\" fill=\"#f3d4c5\"/><path d=\"M7 40h34M15 9l9 12 9-12\"/><circle cx=\"15\" cy=\"8\" r=\"3\" fill=\"#eac77b\"/><circle cx=\"33\" cy=\"8\" r=\"3\" fill=\"#eac77b\"/>","double_zero":"<circle cx=\"21\" cy=\"24\" r=\"14\" fill=\"#d7e4ee\"/><path d=\"M11 34 31 14\"/><path d=\"M34 9h10m-5-5v10M34 39h10\"/>","double_1000":"<path d=\"M7 12h34v26H7z\" fill=\"#cbe5d4\"/><circle cx=\"24\" cy=\"25\" r=\"9\" fill=\"#f2d5a2\"/><path d=\"M24 19v12m-4-9h8m-8 6h8\"/><path d=\"m7 8 4-4m30 4-4-4\"/>","double_5000":"<path d=\"M5 41V17L24 6l19 11v24\" fill=\"#f5d3b9\"/><path d=\"M5 41h38M10 22h28M14 24v14m10-14v14m10-14v14\"/><path d=\"M24 6v-4\"/>","double_final":"<path d=\"M8 5v38M8 8h24l-7 8 7 8H8\" fill=\"#f1d6bc\"/><path d=\"M31 31h13m-7-7v14\"/><circle cx=\"37\" cy=\"31\" r=\"9\" fill=\"#d4e8dc\"/>","duck_1":"<path d=\"M7 34q-2-10 9-12 4-13 13-10 8 2 6 13l9 5-9 5q-7 10-19 4Z\" fill=\"#f8e2ab\"/><circle cx=\"30\" cy=\"20\" r=\"2\" fill=\"#30343c\"/><path d=\"M17 42h16\"/>","duck_2":"<path d=\"M4 31q0-12 12-12l5-8q8-3 10 7l7 5-7 5q-4 9-14 7Z\" fill=\"#f6deb3\"/><path d=\"M17 38q2-12 12-12l4-8q7-2 9 7l5 5-6 4q-7 9-16 7Z\" fill=\"#c7dff1\"/><circle cx=\"27\" cy=\"18\" r=\"1.5\"/><circle cx=\"39\" cy=\"26\" r=\"1.5\"/>","duck_3":"<path d=\"M5 33q0-13 11-12l4-9q9-2 10 8l6 4-6 5q-6 10-17 7Z\" fill=\"#f6e3b3\"/><path d=\"M18 41q1-12 11-12l4-8q8-2 9 7l5 5-6 4q-8 8-16 5Z\" fill=\"#d7d0f1\"/><path d=\"M6 13q7-9 15-3\" stroke=\"#b8d9c4\"/><circle cx=\"27\" cy=\"20\" r=\"1.5\"/><circle cx=\"39\" cy=\"29\" r=\"1.5\"/>","duck_4":"<path d=\"M4 35q20-11 40 0\" stroke=\"#a7d6e8\" stroke-width=\"5\"/><path d=\"M8 25q-3-10 5-12l3-5q7 0 7 7l4 4-4 3q-8 7-15 3Z\" fill=\"#f7e0b4\"/><path d=\"M25 28q-2-10 6-12l3-6q7 0 7 7l5 4-5 3q-8 7-16 4Z\" fill=\"#f5cbd5\"/><path d=\"m17 5 3-3m15 3 3-3\"/>","duck_5":"<path d=\"M6 41V19h36v22\" fill=\"#e8d4ef\"/><path d=\"M12 19q0-12 9-12l4 5 4-5q9 0 9 12\"/><path d=\"M14 31q0-8 8-8l3-5q7 0 7 8l5 3-5 3q-7 8-15 4Z\" fill=\"#f6dfae\"/><path d=\"M9 41h30\"/>","duck_7":"<path d=\"M4 34q10-12 20-4 10-8 20 4\" stroke=\"#b3d9e8\" stroke-width=\"4\"/><path d=\"m6 17 7-7 7 7m4-8 7-6 7 6m-24 18 7-6 7 6m9-6 6-6 4 6\" stroke=\"#f0c2ae\" stroke-width=\"3\"/><path d=\"M5 41h38\"/>","duck_10":"<path d=\"M7 41V15l17-10 17 10v26\" fill=\"#d7e8c7\"/><path d=\"M5 41h38M14 21h20M14 29h20\"/><path d=\"M17 36q0-8 7-8l4-5q6 0 6 7l5 3-5 3q-7 8-17 5Z\" fill=\"#f6ddac\"/>","duck_15":"<path d=\"M5 40q18-6 38 0\" stroke=\"#b9dcec\" stroke-width=\"4\"/><path d=\"m5 12 8-7 8 7m3 5 8-7 8 7M12 28l8-7 8 7m7-1 5-5 5 5\" stroke=\"#a6b8db\" stroke-width=\"3\"/><path d=\"M19 34q5-8 10 0\" stroke=\"#e9bba7\"/>","duck_first":"<path d=\"M6 37h36M10 37V17l14-10 14 10v20\" fill=\"#c7e1d1\"/><path d=\"M15 30q0-7 7-7l3-5q7 0 7 7l5 3-5 3q-7 7-15 4Z\" fill=\"#f8dfa8\"/>","duck_last":"<path d=\"M6 7v35m0-35h22l-6 8 6 8H6\" fill=\"#f3cfba\"/><path d=\"M19 34q0-8 8-8l3-6q7 0 7 8l6 4-6 3q-9 7-18 2Z\" fill=\"#f6e0ad\"/>","duck_sandwich":"<path d=\"M5 12q19-14 38 0l-3 7H8Z\" fill=\"#f3d5ae\"/><path d=\"M5 36q19 11 38 0l-3 7H8Z\" fill=\"#f3d5ae\"/><path d=\"M8 27h32\" stroke=\"#a6c9a1\" stroke-width=\"5\"/><path d=\"M14 28q0-8 9-8l4-5q6 0 6 7l5 3-5 3q-9 7-18 3Z\" fill=\"#f8dfaa\"/>","duck_back2":"<path d=\"M5 33q0-9 8-9l4-7q7 0 7 8l5 3-5 3q-7 8-17 4Z\" fill=\"#f5deb1\"/><path d=\"M21 37q0-9 8-9l4-7q7 0 7 8l6 3-6 3q-8 8-17 4Z\" fill=\"#d3e4f2\"/><path d=\"m14 9 10-6 10 6\"/>","duck_upgrade":"<path d=\"M6 34q0-10 9-10l4-7q8 0 8 8l5 4-5 4q-9 8-18 4Z\" fill=\"#f6e0b5\"/><path d=\"M36 41V8m-7 7 7-7 7 7\" stroke=\"#9dcbb3\" stroke-width=\"4\"/>","duck_double":"<path d=\"M5 34q0-10 9-10l4-7q8 0 8 8l5 4-5 4q-9 8-18 4Z\" fill=\"#f6dfa9\"/><path d=\"m32 11 5 6-5 6m7-12 5 6-5 6\" stroke=\"#b8c7ee\" stroke-width=\"3\"/>","duck_lifetime100":"<path d=\"M5 41V18L24 7l19 11v23\" fill=\"#cfe7d8\"/><path d=\"M5 41h38M12 25h24M15 41V25m18 16V25\"/><path d=\"M18 21q0-7 7-7l3-5q5 0 5 7l5 3-5 3q-6 7-14 4Z\" fill=\"#f7e1af\"/>","spinplus_1":"<path d=\"M8 35h32M13 35V15h22v20\" fill=\"#d6e8f5\"/><path d=\"M18 15v-7h12v7\" fill=\"#f5d5ad\"/><path d=\"m21 26 5-6 3 6\" stroke=\"#a6cfae\" stroke-width=\"3\"/><path d=\"M5 42h38m-30-7 4 7m18-7-4 7\"/>","spinplus_2":"<path d=\"M6 39q7-11 19-9t17-10\" stroke=\"#b5d8e8\" stroke-width=\"4\"/><path d=\"M10 38 18 9l13 16-13 3Z\" fill=\"#f5d7b7\"/><path d=\"m18 9 2-5m8 19 12-11M6 43h37\"/><path d=\"m36 9 6 3-3 6\"/>","spinplus_3":"<path d=\"M6 38h36M10 38V28l13-10 13 10v10\" fill=\"#d9e8ce\"/><path d=\"M23 18V5m-6 6 6-6 6 6\" stroke=\"#9dcbb5\" stroke-width=\"3\"/><path d=\"M16 34h14\"/><path d=\"m35 10 7-3\"/>","spinplus_5":"<path d=\"M10 39q-5-17 9-22 13-4 18 10l-2 12Z\" fill=\"#c9e7cf\"/><path d=\"M17 18q-6-12 3-15 8 0 7 13\" fill=\"#f4d8b6\"/><path d=\"M10 39h30M19 29q6 5 12 0\"/><circle cx=\"29\" cy=\"23\" r=\"1.5\" fill=\"#30343c\"/>","spins_10":"<path d=\"M5 14h38v28H5z\" fill=\"#e3d5f4\"/><path d=\"M5 21h38M14 28h20M14 35h13\"/><path d=\"M12 8h24M19 4h10\"/>","spins_15":"<path d=\"M6 39q1-29 18-34 17 5 18 34\" fill=\"#d2e7f5\"/><path d=\"M6 39h36M12 31h24M17 22h14\"/><path d=\"M24 5v10m-5-5h10\"/>","spins_20":"<path d=\"M7 9h34v33H7z\" fill=\"#f3d8c7\"/><path d=\"M14 16h20M14 23h20M14 30h12\"/><path d=\"M29 36q4-8 9 0\"/><path d=\"M11 5l-5-3m31 3 5-3\"/>","spins_25":"<path d=\"M8 39V9h32v30\" fill=\"#d5d5f2\"/><path d=\"M5 39h38M15 16h18M15 23h18M15 30h18\"/><path d=\"m21 5 3-4 3 4\"/>","spins_30":"<circle cx=\"24\" cy=\"26\" r=\"17\" fill=\"#d6e4f6\"/><path d=\"M24 14v12l9 7M24 5v4m0 34v3M3 26h5m34 0h4\"/><path d=\"M12 5h8M28 5h8\"/><path d=\"m38 8 5 3-3 6\"/>","spinplus_saved":"<path d=\"M6 8h36v33H6z\" fill=\"#f5d5b9\"/><path d=\"M6 16h36M14 22h20M14 29h20\"/><path d=\"M21 5h6M24 3v5\"/><path d=\"m30 35 5 5 9-13\" stroke=\"#9ecbb3\" stroke-width=\"3\"/>","rank_100":"<path d=\"M7 7h34v34H7z\" fill=\"#c9dff1\"/><path d=\"M13 14h22M13 21h22M13 28h22M13 35h14\"/><path d=\"m31 33 4 4 8-9\" stroke=\"#a4cdb2\" stroke-width=\"3\"/>","rank_50":"<path d=\"M6 9h36v31H6z\" fill=\"#f4d7be\"/><path d=\"M6 24h36M13 16h22M13 32h22\"/><path d=\"m20 7 4-4 4 4\"/>","rank_25":"<path d=\"M5 40h38M9 40V20h11v20m4 0V12h11v28m4 0V26h4v14\" fill=\"#c8e3d6\"/><path d=\"M14 15h17M14 8h17\"/><path d=\"m8 8 3-4\"/>","rank_10":"<path d=\"M7 41h34M12 41V12h24v29\" fill=\"#d9d2f3\"/><path d=\"M17 18h14M17 25h14M17 32h14\"/><path d=\"m21 8 3-5 3 5\"/>","rank_5":"<path d=\"M8 31q-2-15 9-19 7-3 11 5 12-6 14 5 2 13-12 17H18Z\" fill=\"#d0e9d4\"/><path d=\"M15 29q10-9 20 0M18 35h12\"/><path d=\"m8 9 5-4\"/>","rank_3":"<path d=\"M5 41h38M8 29h10v12H8z\" fill=\"#e4c6a9\"/><path d=\"M19 18h10v23H19z\" fill=\"#f4dba4\"/><path d=\"M30 25h10v16H30z\" fill=\"#c8d8eb\"/><path d=\"m22 11 2-6 2 6\"/>","rank_2":"<path d=\"M6 41h36M11 28h12v13H11z\" fill=\"#c9dbe8\"/><path d=\"M25 18h12v23H25z\" fill=\"#f4d9a9\"/><path d=\"m12 10 5-5 5 5m10-6 4-4\"/>","rank_1":"<path d=\"M6 12h36v27H6z\" fill=\"#c8e3dc\"/><circle cx=\"24\" cy=\"25\" r=\"9\" fill=\"#f6dfac\"/><circle cx=\"24\" cy=\"25\" r=\"4\"/><path d=\"M13 12l4-7h14l4 7M9 39h30\"/><path d=\"m4 7 4-4m32 0 4 4\"/>","rank_wins_5":"<path d=\"M7 41h34M12 41V16h24v25\" fill=\"#d8d1f0\"/><path d=\"M18 23h12M18 30h12\"/><path d=\"m17 11 7-8 7 8\"/>","rank_wins_25":"<path d=\"M24 3 6 14v20l18 11 18-11V14Z\" fill=\"#f4d8b5\"/><path d=\"M6 14 24 25l18-11M24 25v20\"/><path d=\"m18 17 6-7 6 7\" stroke=\"#b7c9e6\"/>","rarity_10":"<path d=\"M7 10h34v31H7z\" fill=\"#f2dfc9\"/><path d=\"M13 17h22M13 24h22M13 31h13\"/><path d=\"m30 33 5 5 8-11\"/>","rarity_25":"<path d=\"M6 40q18-34 36 0\" fill=\"#cde7e3\"/><path d=\"M6 40h36M14 32q10-16 20 0\"/><path d=\"M24 7v12m-5-6h10\"/>","rarity_100":"<path d=\"M8 10h32v29H8z\" fill=\"#d5d9f1\"/><path d=\"M15 20q0-8 9-8t9 8q0 6-9 9v4M24 36h.01\"/><path d=\"m5 7-3-4m41 4 3-4\"/>","rarity_250":"<path d=\"M6 39q5-22 18-22t18 22\" fill=\"#f2d9c8\"/><path d=\"M12 16q12-16 24 0M15 29h5m8 0h5\"/><path d=\"m5 7 7-4m31 4-7-4\"/>","rarity_500":"<path d=\"M8 42V9h32v33\" fill=\"#d3e5d8\"/><path d=\"M8 18h32M15 25h18M15 32h18\"/><path d=\"m19 5 5-4 5 4\"/>","rarity_1000":"<path d=\"M24 4 8 13v22l16 9 16-9V13Z\" fill=\"#c7dcef\"/><path d=\"M8 13 24 22l16-9M24 22v22\"/><path d=\"m18 9 6-5 6 5\"/>","rarity_2500":"<path d=\"M6 38q18-10 36 0\" stroke=\"#d9c3eb\" stroke-width=\"5\"/><path d=\"M13 33V14l11-9 11 9v19\" fill=\"#f2d7bf\"/><path d=\"m19 23 5 5 5-5\"/>","rarity_5000":"<path d=\"M6 10h36v30H6z\" fill=\"#d2e8e1\"/><path d=\"M13 17h22M13 24h22M13 31h22\"/><path d=\"m9 6 6-4m24 4-6-4\"/>","rarity_10000":"<path d=\"M9 9h30v33H9z\" fill=\"#f4d5d8\"/><path d=\"M15 16h18M15 23h18M15 30h12\"/><path d=\"m28 34 5 5 9-12\" stroke=\"#a7d4b7\" stroke-width=\"3\"/>","rarity_25000":"<path d=\"M6 42h36M10 42V11h28v31\" fill=\"#d8e1f1\"/><path d=\"M16 18h16M16 25h16M16 32h16\"/><path d=\"m18 7 6-5 6 5\"/>","rarity_100000":"<path d=\"M8 9h32v31H8z\" fill=\"#f1e2c7\"/><path d=\"M14 16h20M14 23h20M14 30h20\"/><path d=\"M24 35v4m-3-2h6\"/>","rarity_1000000":"<path d=\"M24 3 7 17l17 28 17-28Z\" fill=\"#d7cdec\"/><circle cx=\"24\" cy=\"22\" r=\"9\" fill=\"#f8dfb5\"/><path d=\"m20 22 3 3 6-7\"/>","rarity_10000000":"<path d=\"M7 41 13 7l11 15L35 7l6 34Z\" fill=\"#c6e1e3\"/><path d=\"M7 41h34M13 7l11 15L35 7\"/><path d=\"M24 22v19\"/>","rarity_100000000":"<path d=\"M5 40h38M9 40V8h30v32\" fill=\"#f1cfd5\"/><path d=\"M15 15h18M15 22h18M15 29h18\"/><path d=\"m24 3 5 5-5 5\"/>","rarity_legendary":"<path d=\"M24 4 8 14v20l16 10 16-10V14Z\" fill=\"#f5e0b4\"/><circle cx=\"24\" cy=\"24\" r=\"10\" fill=\"#d5d3f2\"/><path d=\"m19 24 5-8 5 8-5 8Z\"/>","score_uncommon":"<path d=\"M8 40V11h32v29\" fill=\"#d0e7d8\"/><path d=\"M5 40h38M15 19h18M15 27h18\"/><path d=\"m19 7 5-5 5 5\"/>","score_rare":"<path d=\"M24 4 7 17l17 27 17-27Z\" fill=\"#cce1f4\"/><path d=\"M7 17h34M24 4l-8 13 8 27 8-27Z\"/>","score_epic":"<path d=\"M8 40 15 8l9 10 9-10 7 32Z\" fill=\"#e1d1f4\"/><path d=\"M8 40h32M15 8l9 10 9-10\"/><path d=\"m24 4 3-3\"/>","score_legendary":"<path d=\"M6 39 13 9l11 10 11-10 7 30Z\" fill=\"#f4dfb2\"/><path d=\"M6 39h36M24 19v20\"/><circle cx=\"24\" cy=\"10\" r=\"4\" fill=\"#f2cda5\"/>","score_mythic":"<path d=\"M24 3 5 17l7 25h24l7-25Z\" fill=\"#ead1ed\"/><path d=\"M5 17h38M12 42l12-25 12 25M24 3v14\"/>","wheel_dejavu":"<path d=\"M9 12h30v28H9z\" fill=\"#d6d2f2\"/><path d=\"M15 18h18M15 25h18M15 32h18\"/><path d=\"m9 7 7-4m23 4-7-4\"/>","wheel_full_circle":"<circle cx=\"24\" cy=\"24\" r=\"19\" fill=\"#f6d8b9\"/><path d=\"M24 5v38M5 24h38\"/><path d=\"m13 11 7 0-2 7m17 19-7 0 2-7\" stroke=\"#a5c9af\" stroke-width=\"3\"/>","wheel_lucky_seven":"<path d=\"M10 10h28v30H10z\" fill=\"#d8e9d4\"/><path d=\"M16 17h16l-10 16\"/><path d=\"m7 7-3-3m40 3-3-3M24 3v4\"/>","wheel_mirror":"<path d=\"M24 4v40\" stroke=\"#9bbad8\" stroke-width=\"4\"/><path d=\"M6 13h12v23H6z\" fill=\"#f5d6b9\"/><path d=\"M30 13h12v23H30z\" fill=\"#f5d6b9\"/><path d=\"m11 20 5 8m0-8-5 8m26-8-5 8m0-8 5 8\"/>","wheel_groundhog":"<path d=\"M7 39q-3-15 8-20 3-11 12-10 10 0 10 13 7 7 3 17Z\" fill=\"#f2d3b9\"/><circle cx=\"19\" cy=\"22\" r=\"2\"/><circle cx=\"31\" cy=\"22\" r=\"2\"/><path d=\"M21 29q5 5 9 0M7 39h35\"/><path d=\"M10 11h7\"/>","wheel_perfect_match":"<path d=\"M5 11h38v27H5z\" fill=\"#f4d8df\"/><path d=\"m11 22 7-7 7 7-7 7Z\" fill=\"#d0e7f1\"/><path d=\"m26 22 7-7 7 7-7 7Z\" fill=\"#d0e7f1\"/><path d=\"M14 34h20\"/>","wheel_collector":"<path d=\"M7 11h34v30H7z\" fill=\"#e6d8f3\"/><path d=\"M12 18h24M12 26h24M12 34h24\"/><circle cx=\"17\" cy=\"18\" r=\"3\" fill=\"#f5d9a5\"/><circle cx=\"31\" cy=\"26\" r=\"3\" fill=\"#c7e4d1\"/>","wheel_against_odds":"<path d=\"M5 39 24 7l19 32Z\" fill=\"#d5e8e2\"/><path d=\"M5 39h38M15 33h18\"/><path d=\"m24 17 0 10m0 5v1\"/>","wheel_one_each":"<circle cx=\"24\" cy=\"24\" r=\"19\" fill=\"#f5e3bf\"/><path d=\"M24 5v38M5 24h38m-26-13 14 26m0-26L17 37\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#c3ddec\"/>","wheel_long_way":"<path d=\"M5 38q10-28 22-14t16-17\" stroke=\"#b5d6c3\" stroke-width=\"5\"/><path d=\"M6 43h37M35 7h8v8\"/><path d=\"m11 19 5-5\"/>","wheel_quack_attack":"<path d=\"M5 35q0-12 11-12l4-7q7 0 7 8l6 4-6 4q-8 10-20 5Z\" fill=\"#f5dfab\"/><path d=\"m33 12 5-5 5 5m-9 7 7-3m-8 13 8 4\" stroke=\"#e5a9a4\" stroke-width=\"3\"/><circle cx=\"23\" cy=\"24\" r=\"1.5\"/>","wheel_comeback":"<path d=\"M5 39h38M8 39V30h10v9m4 0V21h10v18m4 0V9h7v30\" fill=\"#d1e6d8\"/><path d=\"m8 23 12 5 9-11 13-12\" stroke=\"#e4b4a2\" stroke-width=\"3\"/>","wheel_slow_starter":"<path d=\"M6 39h36M10 39V26h27v13\" fill=\"#d8e1f3\"/><path d=\"M12 22h23M16 16h15M21 10h7\"/><path d=\"m32 6 6-3 5 6\"/>","wheel_no_ducks":"<path d=\"M7 40V17h34v23\" fill=\"#f3d4bf\"/><path d=\"M4 40h40M12 23h24M12 31h24\"/><path d=\"m13 9 8 8m0-8-8 8\" stroke=\"#b7c8e8\" stroke-width=\"3\"/>","wheel_duck_dynasty":"<path d=\"M8 40V16L24 5l16 11v24\" fill=\"#d9d0ed\"/><path d=\"M5 40h38M14 23h20\"/><path d=\"M16 32q0-7 8-7l3-4q6 0 6 7l5 3-5 3q-8 6-16 2Z\" fill=\"#f4e0ae\"/>","wheel_small_beginnings":"<path d=\"M7 39q6-22 17-19t17-15\" stroke=\"#9dcbb2\" stroke-width=\"4\"/><path d=\"M5 43h38M8 32h9m8-10h9M34 8h9\"/><path d=\"m35 4 8 1-1 8\"/>","wheel_minimalist":"<path d=\"M8 8h32v32H8z\" fill=\"#f3eee2\"/><path d=\"M17 17h14v14H17z\" fill=\"#d2e5e1\"/>","wheel_chosen_one":"<path d=\"M24 4 6 18l18 26 18-26Z\" fill=\"#f3dfb6\"/><circle cx=\"24\" cy=\"21\" r=\"8\" fill=\"#d4d5f1\"/><path d=\"m20 21 3 3 6-7\"/>"};
const customTitleIcon=b=>{
 const art=customTitleScenes[b.badge_key];if(!art)return null;
 return '<span class="crilo-achievement-symbol" role="img" aria-label="'+Crilo.esc(b.name)+'"><svg viewBox="0 0 48 48" fill="none" stroke="#30343c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+art+'</svg></span>';
};
const badgeSymbol=b=>customTitleIcon(b)||scoreBadgeIcon(b)||namedBadgeIcon(b)||bespokeDuckIcon(b)||individualBadgeArt(b)||sceneArt(b);


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
