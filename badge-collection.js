/* Shared, read-only Crilo badge collection presentation logic.
 * Uses database metadata; never awards badges or changes gameplay rules. */
(() => {
  'use strict';
  const rarityOrder=['trash','common','uncommon','rare','epic','anomaly','mythic'];
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
  const active=badges=>(badges||[]).filter(b=>b && b.category!=='legacy_score');
  const key=id=>String(id);
  const earnedMap=rows=>new Map((rows||[]).map(x=>[key(x.badge_id),x]));
  const rarity=badge=>{
    const name=String(badge?.requirement?.rarity||'common').toLowerCase();
    return Object.hasOwn(rank,name)?name:'common';
  };
  // Rarity tier is the primary difficulty order. Compare numeric simulated
  // odds only if both badges have comparable probabilities in their metadata.
  // Otherwise do not pretend one same-tier badge is statistically harder.
  const probability=badge=>{
    const raw=badge?.requirement?.probability_percent;
    const n=Number(raw);
    return raw==null||raw===''||!Number.isFinite(n)||n<0?null:n;
  };
  function compareDifficulty(a,b){
    const tier=rank[rarity(b)]-rank[rarity(a)];
    if(tier)return tier;
    const pa=probability(a),pb=probability(b);
    if(pa!==null&&pb!==null&&pa!==pb)return pa-pb;
    return 0;
  }
  // Single source of markup for the collection grid and profile badge detail.
  // Every badge uses its database key, rarity, description, and earned state.
  function tileHTML(badge,owned,escapeHTML,options={}){
    const esc=value=>escapeHTML(String(value??''));
    const hidden=Boolean(badge.is_secret)&&!owned;
    const tier=rarity(badge);
    const title=hidden?'Hidden badge':String(badge.name||'');
    const status=owned?tier:'Locked · '+(hidden?'Secret':tier);
    const description=hidden?'Unlock to reveal this secret achievement.':
      String(badge.description||badge.requirement?.rule?.condition||'Complete this achievement to unlock it.');
    const expanded=Boolean(options.expanded);
    const interactive=options.interactive!==false;
    return '<article class="collection-tile'+(owned?'':' locked')+(expanded?' expanded':'')+
      '" data-badge-rarity="'+esc(tier)+'" data-badge-key="'+esc(badge.badge_key||'')+
      '" title="'+esc(description)+'"'+
      (interactive?' tabindex="0" role="button" aria-expanded="'+String(expanded)+
      '" aria-label="'+esc(title+'. '+status+'. '+description+' Tap to expand.')+'"':'')+'>'+
      '<b>'+esc(title)+'</b><small>'+esc(status)+'</small>'+
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
          // Collection sets are a progression ladder: Trash (below Common),
          // Common, Uncommon, Rare, Epic, Anomaly, Mythic.
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
  window.CriloBadgeCollection={active,earnedMap,rarity,compareDifficulty,bestEarned,sets,tileHTML,rarityOrder};
})();