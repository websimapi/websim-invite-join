/* ...existing code... */
import 'nipplejs'; // kept via importmap for potential future use

(async function(){
  // Show loader (default visible in DOM). We'll wait for assets and initialization then hide it.
  const loader = document.getElementById('loader');
  const appRoot = document.getElementById('app');
  const overlay = document.getElementById('overlay');

  // helper to load an image (background) to ensure no flash
  function loadImage(src){
    return new Promise((res, rej)=>{
      const img = new Image();
      img.onload = () => res();
      img.onerror = () => res(); // don't block app on failure
      img.src = src;
    });
  }

  // wait for DOM load, window load and background asset
  await Promise.all([
    document.readyState === 'complete' ? Promise.resolve() : new Promise(r => window.addEventListener('load', r)),
    loadImage('/asset_background.png')
  ]);

  // initialize WebsimSocket (global in environment)
  const room = new WebsimSocket();

  // DOM
  const inviteBoxes = Array.from(document.querySelectorAll('.invite-box'));
  const displayNameInput = document.getElementById('display-name');
  const joinBtn = document.getElementById('join-btn');
  const statusEl = document.getElementById('status');

  // compute today's invite code: format XX-YY-ZZZZ but WITHOUT dashes.
  // We'll interpret that as MM-DD-YYYY concatenated: MMDDYYYY
  function todaysInviteCode(){
    const d = new Date();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const yyyy = String(d.getFullYear());
    return `${mm}${dd}${yyyy}`;
  }

  // helper to get current user from websim
  async function getCurrentUser(){
    try { return await window.websim.getCurrentUser(); }
    catch(e){ console.error(e); return null; }
  }

  // check if user already has a registration record
  async function findRegistration(username){
    const list = await room.collection('author_meta').filter({ username }).getList();
    return list && list.length ? list[0] : null;
  }

  // on load: determine if current user has a record; if not show overlay
  try {
    const currentUser = await getCurrentUser();
    if(!currentUser){
      console.warn('No websim user available');
      overlay.classList.remove('hidden');
    } else {
      const existing = await findRegistration(currentUser.username);
      if(!existing){
        overlay.classList.remove('hidden');
        document.getElementById('not-found-msg').textContent = 'You need an invite code to join';
      } else {
        console.log('User registration found', existing);
      }
    }
  } catch(err){
    console.error(err);
    overlay.classList.remove('hidden');
  }

  // rest of app wiring (invite boxes, display name, join handler)
  function refreshState(){
    const codeStr = inviteBoxes.map(b => (b.value || '').trim()).join('');
    const ok = codeStr.length === 8 && displayNameInput.value.trim().length;
    joinBtn.disabled = !ok;
    statusEl.textContent = '';
  }

  inviteBoxes.forEach((box, i) => {
    box.addEventListener('input', (e) => {
      box.value = (box.value || '').replace(/\D/g,'').slice(0,1);
      if(box.value && i < inviteBoxes.length - 1) inviteBoxes[i+1].focus();
      refreshState();
    });
    box.addEventListener('keydown', (e) => {
      if(e.key === 'Backspace' && !box.value && i > 0){ inviteBoxes[i-1].focus(); }
    });
  });

  displayNameInput.addEventListener('input', refreshState);

  joinBtn.addEventListener('click', async function(){
    joinBtn.disabled = true;
    statusEl.textContent = '';
    const code = inviteBoxes.map(b => (b.value||'').replace(/\D/g,'')).join('').trim();
    const expected = todaysInviteCode();
    if(code !== expected){
      statusEl.textContent = 'Invalid invite code';
      joinBtn.disabled = false;
      return;
    }
    const displayName = displayNameInput.value.trim();
    if(!displayName){
      statusEl.textContent = 'Enter a display name';
      joinBtn.disabled = false;
      return;
    }

    try {
      const username = (await getCurrentUser()) ? (await getCurrentUser()).username : 'anonymous';
      let existing = await findRegistration(username);
      const payload = {
        registered_at: new Date().toISOString(),
        display_name: displayName
      };
      if(existing){
        await room.collection('author_meta').update(existing.id, { col1: JSON.stringify(payload) });
        statusEl.textContent = 'Updated registration. Welcome back!';
      } else {
        await room.collection('author_meta').create({ col1: JSON.stringify(payload) });
        statusEl.textContent = 'Registration complete. Welcome!';
      }
      setTimeout(()=> overlay.classList.add('hidden'), 700);
    } catch (err){
      console.error(err);
      statusEl.textContent = 'Failed to register. Try again.';
      joinBtn.disabled = false;
    }
  });

  refreshState();

  // All initialization done — reveal app and hide loader with a small delay for smooth fade
  requestAnimationFrame(() => {
    appRoot.classList.add('ready');
    loader.classList.add('hidden');
    loader.setAttribute('aria-hidden', 'true');
  });

})(); 
/* ...existing code... */