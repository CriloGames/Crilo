/* Read-only Collection Progress: dynamic badge sets from the live catalog. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>Crilo.esc(String(value??''));
  const model=window.CriloBadgeCollection;
  const requestedId=new URLSearchParams(location.search).get('id');
  let loadToken=0;
  const getRarity=badge=>model.rarity(badge);
  // The small badge-info legend is intentionally optional and read-only.
  const info=$('collectionInfo');
  document.addEventListener?.('keydown',event=>{
    if(event.key==='Escape'&&info?.open){
      info.open=false;
      info.querySelector('summary')?.focus();
      event.preventDefault();
    }
  });
  document.addEventListener?.('click',event=>{
    if(info?.open&&!info.contains(event.target))info.open=false;
  });

  async function load(){
    const token=++loadToken;
    const userId=requestedId||Crilo.user?.id||null;
    const back=$('collectionBack');
    back.href=userId?'profile.html?id='+encodeURIComponent(userId):'profile.html';
    $('collectionNotice').textContent='Loading badge progress…';
    try{
      const requests=[
        criloDB.from('badges').select('id,badge_key,name,description,category,requirement,is_secret,sort_order').order('sort_order')
      ];
      if(userId){
        requests.push(criloDB.from('user_badges').select('badge_id,earned_at').eq('user_id',userId));
      }else requests.push(Promise.resolve({data:[],error:null}));
      const [catalog,earnedResponse]=await Promise.all(requests);
      if(token!==loadToken)return;
      if(catalog.error)throw catalog.error;
      if(earnedResponse.error)throw earnedResponse.error;

      const badgeRows=model.active(catalog.data||[]);
      const earned=earnedResponse.data||[];
      const earnedIds=model.earnedMap(earned);
      const sets=model.sets(badgeRows,earned);
      const completed=sets.filter(set=>set.complete).length;
      const unlocked=badgeRows.filter(b=>earnedIds.has(String(b.id))).length;
      $('setsCompleted').textContent=completed+' / '+sets.length;
      $('collectionNotice').textContent=userId?
        unlocked+' / '+badgeRows.length+' badges collected':
        'Sign in to see your own progress. Browse all '+badgeRows.length+' badges below.';
      if(!sets.length){
        $('collectionSets').innerHTML='<p class="collection-loading">No badge sets are available right now.</p>';
        return;
      }
      $('collectionSets').innerHTML=sets.map(set=>{
        const tiles=set.badges.map(b=>{
          const owned=earnedIds.has(String(b.id)),secret=b.is_secret&&!owned;
          const rarity=getRarity(b);
          const title=secret?'Hidden badge':String(b.name||'');
          const subtitle=owned?rarity:'Locked · '+(secret?'Secret':rarity);
          const description=secret?'Unlock to reveal this secret achievement.':
            String(b.description||b.requirement?.rule?.condition||'Complete this achievement to unlock it.');
          return '<article class="collection-tile'+(owned?'':' locked')+'" data-badge-rarity="'+rarity+
            '" title="'+esc(description)+'" tabindex="0" role="button" aria-expanded="false"'+
            ' aria-label="'+esc(title+'. '+subtitle+'. '+description+' Tap to expand.')+'">'+
            '<b>'+esc(title)+'</b><small>'+esc(subtitle)+'</small>'+
            '<p class="collection-tile-description">'+esc(description)+'</p></article>';
        }).join('');
        return '<details class="collection-card">'+
          '<summary><span class="collection-set-copy"><strong>'+esc(set.name)+'</strong>'+
          '<small>'+esc(set.description)+'</small></span>'+
          '<span class="collection-set-count"><strong>'+set.unlocked+' / '+set.total+'</strong>'+
          '<small>'+set.percent+'%</small></span>'+
          '<span class="collection-chevron" aria-hidden="true"></span>'+
          '<span class="collection-set-track"><i style="width:'+set.percent+'%"></i></span>'+
          '</summary><div class="collection-tile-grid">'+tiles+'</div></details>';
      }).join('');

      // An intentional expand is an actual exploration interaction, not page-load progress.
      $('collectionSets').querySelectorAll('details').forEach(set=>{
        set.addEventListener('toggle',()=>{
          if(set.open)window.CriloBadgeEvents?.track('badge_filter');
        });
      });
    }catch(error){
      if(token!==loadToken)return;
      $('setsCompleted').textContent='— / —';
      $('collectionNotice').textContent='Could not load collection progress.';
      $('collectionSets').innerHTML='<p class="collection-loading">The badge collection could not be loaded. Please refresh to try again.</p>';
      console.error('Crilo collection progress failed',error);
    }
  }

  // The compact cards show a short preview. Click/tap or press Enter/Space
  // to expand the full requirement without losing the native title tooltip.
  const collectionContainer=$('collectionSets');
  function toggleTile(event){
    const tile=event.target.closest?.('.collection-tile');
    if(!tile||!collectionContainer.contains(tile))return;
    const expanded=tile.classList.toggle('expanded');
    tile.setAttribute('aria-expanded',String(expanded));
  }
  collectionContainer.addEventListener?.('click',toggleTile);
  collectionContainer.addEventListener?.('keydown',event=>{
    if(event.target.matches?.('.collection-tile')&&(event.key==='Enter'||event.key===' ')){
      event.preventDefault();
      toggleTile(event);
    }
  });

  window.addEventListener('crilo-auth-ready',load);
  load();
})();