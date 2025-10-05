import 'nipplejs';
(async()=>{
  const $=s=>document.querySelector(s);
  const loader=$('#loader'), appRoot=$('#app'), overlay=$('#overlay');
  const inviteBoxes=[...document.querySelectorAll('.invite-box')], displayName=$('#display-name'), joinBtn=$('#join-btn'), statusEl=$('#status');
  joinBtn.style.visibility = 'hidden'; // hide visually but keep layout space
  const loadImg=s=>new Promise(r=>{const i=new Image();i.onload=i.onerror=()=>r();i.src=s});
  await Promise.all([document.readyState==='complete'?Promise.resolve():new Promise(r=>window.addEventListener('load',r)),loadImg('/asset_background.png')]);

  const room=new WebsimSocket();
  const todaysInviteCode=()=>{const d=new Date(),mm=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'),yyyy=d.getFullYear();return`${mm}${dd}${yyyy}`};
  const getCurrentUser=async()=>{try{return await window.websim.getCurrentUser()}catch{return null}};
  const findRegistration=async username=>(await room.collection('author_meta').filter({username}).getList())?.[0]||null;

  try{
    const user=await getCurrentUser();
    if(!user) overlay.classList.remove('hidden'); else { const ex=await findRegistration(user.username); if(!ex) overlay.classList.remove('hidden'); }
  }catch(e){console.error(e);overlay.classList.remove('hidden')}

  const refresh=()=>{
    const code=inviteBoxes.map(b=>(b.value||'').trim()).join('');
    const name = (displayName.value||'').trim();
    const nameValid = /^[A-Za-z0-9]{3,}$/.test(name);
    const codeValid = code.length===8;
    if(codeValid && nameValid){
      joinBtn.style.visibility = 'visible';
      joinBtn.disabled = false;
    } else {
      joinBtn.style.visibility = 'hidden';
      joinBtn.disabled = true;
    }
    statusEl.textContent=''
  };

  inviteBoxes.forEach((box,i)=>{
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
  requestAnimationFrame(()=>{appRoot.classList.add('ready');loader.classList.add('hidden');loader.setAttribute('aria-hidden','true')});
})();