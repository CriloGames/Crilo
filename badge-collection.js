/* Shared, read-only Crilo badge collection presentation logic.
 * Uses database metadata; never awards badges or changes gameplay rules. */
(() => {
  'use strict';
  // Trash is a final-score percentile, not a badge-drop rarity.
  const rarityOrder=['common','uncommon','rare','epic','anomaly','mythic','divine'];
  const rank=Object.fromEntries(rarityOrder.map((name,index)=>[name,index]));
  const preferredCategories=[
    'Wheel combinations','Single-run challenges','Exact numbers','funny_score',
    'score','Wheel Duck','Wheel ×2','Wheel Upgrade','Wheel +2 Spins','wheel',
    'Opening & final spins','Wheel placement','Wheel gap patterns','Spin positions',
    'Number slice patterns','Single-run number variety','Four-outcome chains',
    'Lifetime milestones','Lifetime collections','Lifetime number slices',
    'Daily streaks','Leaderboard','Social','Drawing','Exploration & onboarding','Score rarity'
  ];
  const notes={
    'Wheel combinations':'Build unusual sequences on the Daily wheel',
    'Single-run challenges':'Do something special in one official Daily',
    'Exact numbers':'Reach memorable numbers in a run',
    'funny_score':'Memorable numbers and lucky scores',
    'score':'Reach new score milestones',
    'Wheel Duck':'Collect lucky duck moments',
    'Wheel ×2':'Double your score and your luck',
    'Wheel Upgrade':'Power up the number wheel',
    'Wheel +2 Spins':'Make your Daily last a little longer',
    'wheel':'Moments worth remembering on the wheel',
    'Opening & final spins':'First impressions and dramatic finishes',
    'Wheel placement':'Land on the right spot at the right time',
    'Wheel gap patterns':'Unexpected patterns between outcomes',
    'Spin positions':'Timing is everything',
    'Number slice patterns':'Discover sequences among the numbers',
    'Single-run number variety':'Use more of the number wheel',
    'Four-outcome chains':'Connect four remarkable outcomes',
    'Lifetime milestones':'Keep coming back and building your record',
    'Lifetime collections':'Collect moments across many Dailies',
    'Lifetime number slices':'Collect your favorite numbers over time',
    'Daily streaks':'Make playing Crilo a daily habit',
    'Leaderboard':'Climb the Daily rankings',
    'Social':'Make friends and play together',
    'Drawing':'Leave a little art on your wheel',
    'Exploration & onboarding':'Discover everything Crilo has to offer',
    'Score rarity':'Reach each score rarity level'
  };
  const pretty={
    'funny_score':'Memorable Scores',
    'score':'Score Milestones',
    'wheel':'Wheel Moments'
  };
  const active=badges=>(badges||[]).filter(b=>b && b.category!=='legacy_score' && b.is_active!==false && b.is_earnable!==false);
  const key=id=>String(id);
  const earnedMap=rows=>new Map((rows||[]).map(x=>[key(x.badge_id),x]));
  const probability=badge=>{
    const raw=badge?.requirement?.probability_percent;
    const n=Number(raw);
    return raw==null||raw===''||!Number.isFinite(n)||n<0||n>100?null:n;
  };
  const tierFromPercent=chance=>{
    if(chance>10)return 'common';
    if(chance>=1)return 'uncommon';
    if(chance>=.1)return 'rare';
    if(chance>=.01)return 'epic';
    if(chance>=.001)return 'anomaly';
    return 'mythic';
  };
  const rarity=badge=>{
    // Divine is an explicitly earned prestige tier, not an inferred drop percentage.
    if(String(badge?.requirement?.rarity||'').toLowerCase()==='divine')return 'divine';
    const chance=probability(badge);
    if(chance!==null)return tierFromPercent(chance);
    const name=String(badge?.requirement?.rarity||'common').toLowerCase();
    // Unmeasured challenges retain authored difficulty; Trash Score should
    // eventually be treated as a percentage-based badge (not Trash rarity).
    return Object.hasOwn(rank,name)?name:'uncommon';
  };
  // Rarity tier is the primary difficulty order. Compare numeric simulated
  // odds only if both badges have comparable probabilities in their metadata.
  // Otherwise do not pretend one same-tier badge is statistically harder.
  function compareDifficulty(a,b){
    const tier=rank[rarity(b)]-rank[rarity(a)];
    if(tier)return tier;
    const pa=probability(a),pb=probability(b);
    if(pa!==null&&pb!==null&&pa!==pb)return pa-pb;
    return 0;
  }

  // Five individually drawn SVG emblems; no emoji or generic rarity icon reuse.
  // Ink remains near-black on the pale medallion; the containing Divine tile is obsidian.
  const divineScenes={
    v2_score_rarity_divine:'<circle cx="24" cy="24" r="19" fill="#e1eafd"/><path d="M13 33l11-19 11 19H13Z" fill="#b9d4f4"/><path d="M18 29l6-10 6 10" fill="none"/><path d="M24 3v6M6 19l5 2m31-2-5 2"/>',
    divine_beyond_mythic:'<path d="M5 39l10-15 7 8 10-21 11 28H5Z" fill="#d4d0f0"/><path d="m32 11 3 8-4 5-4-5Z" fill="#eff5ff"/><path d="m13 9 2 4 4 1-4 1-2 4-1-4-4-1 4-1Z" fill="#eedbb4"/>',
    divine_touched_by_wheel:'<circle cx="22" cy="24" r="17" fill="#d9e9f1"/><path d="M22 7v34M5 24h34M10 12l24 24M10 36l24-24"/><circle cx="22" cy="24" r="5" fill="#f4e4b6"/><path d="M37 8v8m-4-4h8" stroke="#a5bde5"/><path d="m33 34 7-10 3 4-8 11" fill="#d9c8e8"/>',
    divine_heavenly_momentum:'<path d="M6 38h36" stroke="#a5bed8"/><path d="M8 33l12-12 8 5L41 7" fill="none" stroke-width="3"/><path d="m31 7 10 0 0 10" fill="none"/><path d="m13 9 3 6 6 2-6 2-3 6-3-6-6-2 6-2Z" fill="#f3dfb2"/>',
    divine_fourfold_fortune:'<rect x="3" y="18" width="18" height="18" rx="3" fill="#d9e3f7"/><rect x="13" y="9" width="19" height="18" rx="3" fill="#e6d5f0"/><rect x="27" y="18" width="18" height="18" rx="3" fill="#d9e3f7"/><path d="m17 34 7 8 7-8" fill="#f7e5bb"/><path d="M9 23h6m-3-3v6M18 15h9m-5-4v8M33 24h7m-3-4v8" stroke="#36445b" stroke-width="1.7"/><path d="m24 3 2 3 3 1-3 1-2 3-1-3-3-1 3-1Z" fill="#f0dca6"/>',
    divine_royal_flock:'<path d="M13 11l4-7 6 5 5-5 5 7-2 7H15Z" fill="#f5dbad"/><path d="M16 14h16" stroke-width="2.3"/><path d="M5 30q3-10 9-7 4 1 5 7l4 2-4 3q-5 7-12 2Z" fill="#f8e1ac"/><path d="M27 30q3-10 9-7 4 1 5 7l4 2-4 3q-5 7-12 2Z" fill="#f8e1ac"/><path d="M11 39q7 5 13 0 6 5 13 0" stroke="#9dbcd7"/><circle cx="13" cy="27" r="1" fill="#2b2e3c"/><circle cx="35" cy="27" r="1" fill="#2b2e3c"/>',
    divine_perpetual_bonus:'<path d="M7 24q7-18 17 0t17 0q-7 18-17 0T7 24Z" fill="#dbe6f5" stroke-width="2.2"/><path d="m8 15 0-8 8 2m24 24 0 8-8-2" stroke="#b9c4ec" stroke-width="2.7"/><path d="m16 24 4-5-1 5 4 0-6 7 1-7Z" fill="#eed6a7"/><path d="m30 24 4-5-1 5 4 0-6 7 1-7Z" fill="#eed6a7"/>',
    divine_fifth_ascension:'<path d="M4 41h10V33h9v-8h9v-8h10" fill="#d6e8e5"/><path d="M4 41h38M14 33v8m9-16v16m9-24v24" stroke="#96bbb2" stroke-width="2.1"/><path d="m38 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#f6dba9"/><path d="m8 24 5-7 5 7" fill="none" stroke="#b4abd9" stroke-width="2.3"/>',
    divine_sixfold_echo:'<circle cx="24" cy="24" r="19" fill="#dbe5f6"/><circle cx="24" cy="24" r="14" stroke="#adc8eb"/><circle cx="24" cy="24" r="9" stroke="#bfaee6"/><circle cx="24" cy="24" r="4" fill="#f4dbb6"/><path d="m3 12 6-3-2 6m38 21-6 3 2-6" stroke="#687da1" stroke-width="2.1"/><path d="m7 7 6 5m28 29-6-5" stroke="#92bdb1"/>',
    divine_great_migration:'<path d="M4 8q10 6 19 14 10 8 21 17" stroke="#9abbcb" stroke-width="1.6" stroke-dasharray="2 4"/><path d="m8 29 6-5 4 4 4-4M26 17l5-5 4 4 5-5" fill="none" stroke="#353d4c" stroke-width="2.4"/><path d="m14 34 6-5 4 4 4-4" stroke="#353d4c" stroke-width="2.4"/><path d="m4 39 4-8 4 8-4 5Z" fill="#efd9ab"/><path d="m35 4 5 3-1 5" stroke="#a3cbb8"/>',
    divine_celestial_jackpot:'<rect x="9" y="12" width="30" height="31" rx="4" fill="#d8e4f4"/><rect x="13" y="17" width="22" height="15" rx="2" fill="#f4e5bc"/><path d="M19 17v15m10-15v15M13 37h22" stroke="#819dbd"/><path d="m24 20 2 4 4 1-4 1-2 4-2-4-4-1 4-1Z" fill="#c8afd9"/><path d="M39 20h5v12h-5" fill="none"/><circle cx="44" cy="19" r="3" fill="#b6d4b9"/><path d="m24 4 1 4 4 2-4 1-1 4-2-4-4-1 4-2Z" fill="#f4d89f"/>',
    divine_perfect_orbit:'<ellipse cx="24" cy="24" rx="19" ry="12" transform="rotate(-35 24 24)" fill="none" stroke="#a7bcdf" stroke-width="2.3"/><circle cx="24" cy="24" r="8" fill="#e8d8f0"/><path d="m20 24 3 3 6-7" stroke="#78ab9c" stroke-width="2.6"/><circle cx="9" cy="34" r="3" fill="#f2d5ac"/><circle cx="17" cy="11" r="3" fill="#c0d5ef"/><circle cx="35" cy="14" r="3" fill="#b8d8c4"/><circle cx="39" cy="30" r="3" fill="#f2d5ac"/><path d="m6 21 3-5 3 5" fill="none" stroke="#7d89ab"/>',
    divine_cosmic_alignment:'<circle cx="10" cy="24" r="6" fill="#ebd2ee"/><circle cx="23" cy="24" r="9" fill="#cde7f1"/><circle cx="39" cy="24" r="5" fill="#f1dfb0"/><path d="M2 24h44M23 4v9m0 22v9" stroke="#6e86ac" stroke-width="2"/><path d="m7 8 3 3 3-3m22 30 3 3 3-3" fill="none" stroke="#b7c4df"/><ellipse cx="23" cy="24" rx="18" ry="13" transform="rotate(-25 23 24)" stroke="#b6abd9" fill="none"/>',
    divine_twenty_thousand_suns:'<circle cx="24" cy="22" r="12" fill="#f4dcb0" stroke="#303943" stroke-width="1.8"/><path d="M24 4v4M24 36v4M6 22h4m28 0h4M11 9l3 3m20 20 3 3M37 9l-3 3M14 32l-3 3M17 4l1 4m12-4-1 4M5 15l5 2m33-2-5 2M5 29l5-2m33 2-5-2" stroke="#d9b887" stroke-width="1.8"/><path d="M3 42q21-11 42 0" fill="none" stroke="#9bbfc1" stroke-width="3"/>',
    divine_consistency:'<rect x="6" y="12" width="36" height="30" rx="4" fill="#e0ecf5"/><path d="M6 20h36M15 6v11m18-11v11"/><path d="m12 28 2 2 3-4m2 8 2 2 3-4m3-4 2 2 3-4m3 8 2 2 3-4" stroke="#89bda9" stroke-width="2"/><circle cx="24" cy="4" r="2" fill="#e9cf9e"/>'
  };
  const artHTML=badge=>{
    const scene=divineScenes[String(badge?.badge_key||'')];
    return scene?'<span class="crilo-divine-art" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="#111318" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+scene+'</svg></span>':'';
  };

  // Single source of markup for the collection grid and profile badge detail.
  // Every badge uses its database key, rarity, description, and earned state.
  function tileHTML(badge,owned,escapeHTML,options={}){
    const esc=value=>escapeHTML(String(value??''));
    const hidden=Boolean(badge.is_secret)&&!owned;
    const tier=rarity(badge);
    const title=hidden?'Hidden badge':String(badge.name||'');
    const status=owned?tier:'Locked · '+(hidden?'Secret':tier);
    const chance=probability(badge);
    const oddsNote=chance===null?'':(' · about '+Number(chance.toPrecision(5))+'% per Daily');
    const description=hidden?'Unlock to reveal this secret achievement.':
      String(badge.description||badge.requirement?.rule?.condition||'Complete this achievement to unlock it.');
    const expanded=Boolean(options.expanded);
    const interactive=options.interactive!==false;
    return '<article class="collection-tile'+(owned?'':' locked')+(expanded?' expanded':'')+
      '" data-badge-rarity="'+esc(tier)+'" data-badge-key="'+esc(badge.badge_key||'')+
      '" title="'+esc(description)+'"'+
      (interactive?' tabindex="0" role="button" aria-expanded="'+String(expanded)+
      '" aria-label="'+esc(title+'. '+status+'. '+description+' Tap to expand.')+'"':'')+'>'+
      artHTML(badge)+'<b>'+esc(title)+'</b><small>'+esc(status+oddsNote)+'</small>'+
      '<p class="collection-tile-description">'+esc(description)+'</p></article>';
  }
  function bestEarned(badges,earnedRows,max=50){
    const earned=earnedMap(earnedRows);
    return active(badges).filter(b=>earned.has(key(b.id))).sort((a,b)=>{
      const harder=compareDifficulty(a,b);
      if(harder!==0)return harder;
      const timeA=Date.parse(earned.get(key(a.id))?.earned_at)||0;
      const timeB=Date.parse(earned.get(key(b.id))?.earned_at)||0;
      if(timeB!==timeA)return timeB-timeA;
      return String(a.name||'').localeCompare(String(b.name||''));
    }).slice(0,max);
  }
  function sets(badges,earnedRows){
    const earned=earnedMap(earnedRows),grouped=new Map();
    for(const badge of active(badges)){
      const category=String(badge.category||'Other');
      if(!grouped.has(category))grouped.set(category,[]);
      grouped.get(category).push(badge);
    }
    return [...grouped].map(([category,items])=>{
      const total=items.length;
      const unlocked=items.filter(item=>earned.has(key(item.id))).length;
      return {category,name:pretty[category]||category,description:notes[category]||'Complete this badge collection',
        total,unlocked,percent:total?Math.round(unlocked/total*100):0,
        complete:total>0&&unlocked===total,
        badges:items.slice().sort((a,b)=>{
          // Badge ladder: Common, Uncommon, Rare, Epic, Anomaly, Mythic.
          // Trash is a final-score tier, not an individual badge rarity.
          // Keep the profile preview's best-first ranking unchanged.
          const easier=compareDifficulty(b,a);
          if(easier!==0)return easier;
          const ar=earned.has(key(a.id)),br=earned.has(key(b.id));
          if(ar!==br)return ar?-1:1;
          return Number(a.sort_order||0)-Number(b.sort_order||0)||
            String(a.name||'').localeCompare(String(b.name||''));
        })};
    }).sort((a,b)=>{
      const aPos=preferredCategories.indexOf(a.category),bPos=preferredCategories.indexOf(b.category);
      if(aPos!==bPos)return (aPos<0?999:aPos)-(bPos<0?999:bPos);
      return a.name.localeCompare(b.name);
    });
  }
  window.CriloBadgeCollection={active,earnedMap,rarity,compareDifficulty,bestEarned,sets,tileHTML,artHTML,rarityOrder};
})();