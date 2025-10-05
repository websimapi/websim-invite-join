/* ...existing code... */
import 'nipplejs'; // kept via importmap for potential future use

/* ...existing code... */

// shader/starfield setup
function initStarsShader(){
  const canvas = document.getElementById('stars');
  if(!canvas) return;
  const gl = canvas.getContext('webgl');
  if(!gl) return;
  function resize(){ 
    const dpr = Math.min(window.devicePixelRatio||1,2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    gl.viewport(0,0,canvas.width,canvas.height);
  }
  const vs = `
    attribute vec2 a;
    void main(){ gl_Position = vec4(a,0.0,1.0); }
  `;
  const fs = `
    precision highp float;
    uniform vec2 u_res;
    uniform float u_time;
    // simple hash / noise for stars
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i+vec2(0.,0.));
      float b = hash(i+vec2(1.,0.));
      float c = hash(i+vec2(0.,1.));
      float d = hash(i+vec2(1.,1.));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a,b,u.x)+ (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
    }
    void main(){
      vec2 uv = gl_FragCoord.xy / u_res.xy;
      vec2 p = uv * vec2(u_res.x/u_res.y,1.0) * 200.0;
      float n = noise(p);
      // generate sparse stars
      float stars = step(0.995, n);
      // twinkle by sampling time and nearby noise
      float tw = smoothstep(0.0,1.0, sin(u_time*3.0 + n*50.0)*0.5+0.5);
      vec3 col = vec3(0.0);
      col += stars * (0.6 + 0.8*tw) ; // bright star core
      // faint background shimmer
      col += 0.06 * noise(p*0.2 + u_time*0.02);
      gl_FragColor = vec4(col, clamp(col.r+col.g+col.b, 0.0, 1.0));
    }
  `;
  // compile helpers
  function compile(src, type){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }
  const vsh = compile(vs, gl.VERTEX_SHADER);
  const fsh = compile(fs, gl.FRAGMENT_SHADER);
  const prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.bindAttribLocation(prog, 0, 'a');
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ console.error(gl.getProgramInfoLog(prog)); return; }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,  1,-1,  -1,1,  -1,1,  1,-1,  1,1]), gl.STATIC_DRAW);
  gl.useProgram(prog);
  const u_res = gl.getUniformLocation(prog, 'u_res');
  const u_time = gl.getUniformLocation(prog, 'u_time');
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  let start = performance.now();
  function frame(){
    resize();
    gl.useProgram(prog);
    gl.uniform2f(u_res, canvas.width, canvas.height);
    gl.uniform1f(u_time, (performance.now()-start)/1000);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
window.addEventListener('load', initStarsShader);
window.addEventListener('resize', ()=> { const c=document.getElementById('stars'); if(c){ c.width=0; c.height=0; } });

(async function(){
  // initialize WebsimSocket (global in environment)
  const room = new WebsimSocket();

  // DOM
  const overlay = document.getElementById('overlay');
  const inviteInput = document.getElementById('invite-input');
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