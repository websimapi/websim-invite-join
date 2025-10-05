/* ...existing code... */
import 'nipplejs'; // kept via importmap for potential future use

(async function(){
  // initialize WebsimSocket (global in environment)
  const room = new WebsimSocket();

  // DOM
  const overlay = document.getElementById('overlay');
  const inviteInput = document.getElementById('invite-input');
  const displayNameInput = document.getElementById('display-name');
  const joinBtn = document.getElementById('join-btn');
  const statusEl = document.getElementById('status');

  // obfuscated generator for today's code with per-char ASCII shift
  const todaysInviteCode = (function(){
    // build a tiny hidden transformer via constructor and split operations
    const fBody = [
      "const d=new Date();",
      "const z=(n)=>String(n).padStart(2,'0');",
      "let s=z(d.getMonth()+1)+z(d.getDate())+String(d.getFullYear());",
      // compute shift in a non-obvious way (e.g. 17 expressed as arithmetic)
      "const sh=( (2<<3) + 1 );",
      "let out='';",
      "for(let i=0;i<s.length;i++){",
        "const c=s.charAt(i);",
        "const code=c.charCodeAt(0);",
        "const nc=String.fromCharCode(code+sh);",
        "out+=(/[0-9A-Za-z]/).test(nc)?nc:c;",
      "}",
      "return out;"
    ].join("");
    return new Function(fBody) ;
  })();

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
  const currentUser = await getCurrentUser();
  if(!currentUser){
    console.warn('No websim user available');
    // if no user object, still show overlay to allow manual join (unlikely)
    overlay.classList.remove('hidden');
  } else {
    const existing = await findRegistration(currentUser.username);
    if(!existing){
      overlay.classList.remove('hidden');
      document.getElementById('not-found-msg').textContent = 'You need an invite code to join';
    } else {
      // user found - do nothing (keep app visible)
      console.log('User registration found', existing);
    }
  }

  // enable join when both fields filled
  function refreshState(){
    const ok = inviteInput.value.trim().length && displayNameInput.value.trim().length;
    joinBtn.disabled = !ok;
    statusEl.textContent = '';
  }
  inviteInput.addEventListener('input', refreshState);
  displayNameInput.addEventListener('input', refreshState);

  // join handler
  joinBtn.addEventListener('click', async function(){
    joinBtn.disabled = true;
    statusEl.textContent = '';
    const code = (inviteInput.value || '').replace(/\D/g,'').trim();
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
      const username = currentUser ? currentUser.username : 'anonymous';

      // try to find existing record; if present, update same row; else create
      let existing = await findRegistration(username);
      const payload = {
        registered_at: new Date().toISOString(),
        display_name: displayName
      };
      if(existing){
        // update column1 JSON object (we store JSON as string in column1)
        await room.collection('author_meta').update(existing.id, { col1: JSON.stringify(payload) });
        statusEl.textContent = 'Updated registration. Welcome back!';
      } else {
        await room.collection('author_meta').create({
          col1: JSON.stringify(payload)
        });
        statusEl.textContent = 'Registration complete. Welcome!';
      }

      // close overlay after short delay
      setTimeout(()=> overlay.classList.add('hidden'), 700);
    } catch (err){
      console.error(err);
      statusEl.textContent = 'Failed to register. Try again.';
      joinBtn.disabled = false;
    }
  });

  // prefill invite input hint (not the actual code) for UX
  inviteInput.placeholder = 'MMDDYYYY';
  refreshState();

})();
/* ...existing code... */