import 'nipplejs';
(async()=>{
  const $=s=>document.querySelector(s);
  const loader=$('#loader'), appRoot=$('#app'), overlay=$('#overlay');
  const navPlaceholder = $('#nav-placeholder');
  const inviteBoxes=[...document.querySelectorAll('.invite-box')], displayName=$('#display-name'), joinBtn=$('#join-btn'), statusEl=$('#status');
  joinBtn.style.visibility = 'hidden'; // hide visually but keep layout space
  const loadImg=s=>new Promise(r=>{const i=new Image();i.onload=i.onerror=()=>r();i.src=s});
  await Promise.all([document.readyState==='complete'?Promise.resolve():new Promise(r=>window.addEventListener('load',r)),loadImg('/asset_background.png')]);

  const room=new WebsimSocket();
  const todaysInviteCode=()=>{const d=new Date(),mm=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'),yyyy=d.getFullYear();return`${mm}${dd}${yyyy}`};
  const getCurrentUser=async()=>{try{return await window.websim.getCurrentUser()}catch{return null}};
  // try to resolve avatar from current user object or author_meta comment metadata
  const getAvatarForUser=async(user)=>{
    if(user?.avatar_url) return user.avatar_url;
    if(!user?.username) return null;
    try{
      const rec = (await room.collection('author_meta').filter({username: user.username}).getList())?.[0];
      if(rec && rec.col1){
        const meta = JSON.parse(rec.col1 || '{}');
        if(meta.avatar_url) return meta.avatar_url;
      }
    }catch(e){console.warn('avatar lookup failed',e)}
    return null;
  };
  const setPfpImage=async(user)=>{
    // ensure nav exists before trying to find pfp button
    const pfpBtn = document.querySelector('.pfp');
    const url = await getAvatarForUser(user);
    if(url){
      pfpBtn.innerHTML = '';
      pfpBtn.style.background = `url('${url}') center/cover no-repeat`;
      pfpBtn.style.border = '2px solid rgba(255,255,255,0.06)';
    } else {
      pfpBtn.style.background = '';
      pfpBtn.textContent = (user?.display_name || 'U')[0].toUpperCase();
    }
  };

  // lazy render nav after loader finishes
  const renderNav = (user) => {
    if(!navPlaceholder) return;
    navPlaceholder.innerHTML = `
      <nav id="left-nav" aria-label="Main navigation">
        <div class="nav-top">
          <button class="nav-btn" aria-label="Home">🏠</button>
          <button class="nav-btn" aria-label="Search">🔍</button>
          <button class="nav-btn" aria-label="Notifications">🔔</button>
        </div>
        <div class="nav-center">
          <button class="pfp" aria-label="User profile">U</button>
        </div>
        <div class="nav-bottom">
          <button class="more" aria-label="More">…</button>
        </div>
      </nav>
    `;
    navPlaceholder.setAttribute('aria-hidden','false');
    // set pfp now that nav exists
    setPfpImage(user);
  };

  const findRegistration=async username=>(await room.collection('author_meta').filter({username}).getList())?.[0]||null;

  try{
    const user=await getCurrentUser();
    if(!user) overlay.classList.remove('hidden'); else { const ex=await findRegistration(user.username); if(!ex) overlay.classList.remove('hidden'); }
    // don't render nav until after loader fades; render it now so it appears after loader hides
    // we wait for the appRoot ready state below before actually showing the app UI
    renderNav(user);
  }catch(e){console.error(e);overlay.classList.remove('hidden'); renderNav(null)}

  const refresh=()=>{
    const code=inviteBoxes.map(b=>(b.value||'').trim()).join('');
    const name = (displayName.value||'').trim();
    const nameValid = /^[A-Za-z0-9]{3,}$/.test(name);
    // only reveal join if the code exactly matches today's invite code and name is valid
    const codeMatchesToday = code === todaysInviteCode();
    if(codeMatchesToday && nameValid){
      joinBtn.style.visibility = 'visible';
      joinBtn.disabled = false;
    } else {
      joinBtn.style.visibility = 'hidden';
      joinBtn.disabled = true;
    }
    statusEl.textContent=''
  };

  inviteBoxes.forEach((box,i)=>{
    box.addEventListener('focus',()=>box.select()); // ensure typing overrides existing content
    box.addEventListener('input',e=>{
      box.value=(box.value||'').replace(/\D/g,'').slice(0,1);
      if(box.value && i<inviteBoxes.length-1) inviteBoxes[i+1].focus(); refresh();
    });
    box.addEventListener('keydown',e=>{ if(e.key==='Backspace' && !box.value && i>0) inviteBoxes[i-1].focus() });
  });

  displayName.addEventListener('input',refresh);

  joinBtn.addEventListener('click',async()=>{
    joinBtn.disabled=true; statusEl.textContent='';
    const code=inviteBoxes.map(b=>(b.value||'').replace(/\D/g,'')).join('').trim();
    if(code!==todaysInviteCode()){statusEl.textContent='Invalid invite code';joinBtn.disabled=false;return}
    const name=displayName.value.trim(); if(!name){statusEl.textContent='Enter a display name';joinBtn.disabled=false;return}
    try{
      const user=await getCurrentUser(); const username=user?user.username:'anonymous';
      let existing=await findRegistration(username);
      const payload={registered_at:new Date().toISOString(),display_name:name};
      if(existing){
        await room.collection('author_meta').update(existing.id,{col1:JSON.stringify(payload)});
      }
      else{
        await room.collection('author_meta').create({col1:JSON.stringify(payload)});
      }
      // fade the UI away on success (no status text)
      setTimeout(()=>{
        overlay.classList.add('hidden');
        appRoot.classList.remove('ready');
      },700);
    }catch(err){console.error(err);statusEl.textContent='Failed to register. Try again.';joinBtn.disabled=false}
  });

  refresh();
  requestAnimationFrame(()=>{
    // reveal application and then hide loader — nav was injected earlier but will only be visible once app shows
    appRoot.classList.add('ready');
    loader.classList.add('hidden');
    loader.setAttribute('aria-hidden','true');
  });
})();