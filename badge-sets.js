/* Read-only Collection Progress: dynamic badge sets from the live catalog. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=value=>Crilo.esc(String(value??''));
  const model=window.CriloBadgeCollection;
  const query=new URLSearchParams(location.search);
  const requestedId=query.get('id');
  const requestedBadge=query.get('badge');
  let loadToken=0;
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
        const tiles=set.badges.map(b=>model.tileHTML(b,earnedIds.has(String(b.id)),esc)).join('');
        return '<details class="collection-card">'+
          '<summary><span class="collection-set-copy"><strong>'+esc(set.name)+'</strong>'+
          '<small>'+esc(set.description)+'</small></span>'+
          '<span class="collection-set-count"><strong>'+set.unlocked+' / '+set.total+'</strong>'+
          '<small>'+set.percent+'%</small></span>'+
          '<span class="collection-chevron" aria-hidden="true"></span>'+
          '<span class="collection-set-track"><i style="width:'+set.percent+'%"></i></span>'+
          '</summary><div class="collection-tile-grid">'+tiles+'</div></details>';
      }).join('');

      // A badge opened from a player's Top 50 preview lands on its actual
      // collection card, with the containing set expanded and badge highlighted.
      if(requestedBadge){
        const linked=Array.from($('collectionSets').querySelectorAll?.('.collection-tile[data-badge-key]')||[])
          .find(el=>el.dataset.badgeKey===requestedBadge);
        if(linked){
          const parent=linked.closest('details.collection-card');
          if(parent)parent.open=true;
          linked.classList.add('expanded','badge-linked-highlight');
          linked.setAttribute('aria-expanded','true');
          if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>linked.scrollIntoView?.({behavior:'smooth',block:'center'}));
        }
      }

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