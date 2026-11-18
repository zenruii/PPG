'use strict';
/* ============================================================
   Boot, scene setup and main loop
   ============================================================ */
const Game = {
  scene() {
    buildHouse(9, 0, false);
    new Dummy(-2.6, 0, 1);
    new Dummy(-0.6, 0, 1);
    new Dummy(1.6, 0, -1);
    new Dummy(7.6, 0.18, 1);
    // weapon rack
    spawnItem('platform', -7.2, 1.05);
    spawnItem('pistol', -8.2, 1.2);
    spawnItem('shotgun', -7.3, 1.2);
    spawnItem('katana', -6.4, 1.15);
    spawnItem('grenade', -8.5, 0.1);
    spawnItem('spear', -6.5, 0.1);
    spawnItem('bat', -5.0, 0.1);
    // props
    spawnItem('crate', -11, 0.4);
    spawnItem('crate', -11.1, 1.2);
    spawnItem('crate_s', -10.0, 0.25);
    spawnItem('barrel', -12.2, 0.45);
    spawnItem('spikes', 3.6, 0);
  },
  reset() {
    resetWorld();
    DUMMY_NO = 0;
    this.scene();
    Cam.tx = 0.4; Cam.ty = 3.2; Cam.tz = Math.max(30, Math.min(80, R.W / 25.5));
  },
};

let lastT = 0, acc = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;
  Input.frame(dt);
  if (!G.paused) {
    acc += dt * (G.slowmo ? 0.25 : 1);
    let n = 0;
    while (acc >= DT && n < 5) { simStep(); acc -= DT; n++; }
    if (n === 5) acc = 0;
    if (n) updateParticles(n * DT);
  }
  render(dt);
  UI.frame(dt);
  requestAnimationFrame(loop);
}

function boot() {
  initWorld();
  initRender(document.getElementById('view'));
  Input.init(R.cv);
  UI.init();
  UI.syncSim();
  Game.scene();
  Cam.tz = Cam.z = Math.max(30, Math.min(80, R.W / 25.5));
  Cam.tx = Cam.x = 0.4; Cam.ty = Cam.y = 3.2;
  if (window.innerWidth < 760) { Cam.tz = Cam.z = 40; Cam.tx = Cam.x = -0.5; }
  requestAnimationFrame((t) => { lastT = t; loop(t); });
}
window.addEventListener('DOMContentLoaded', boot);
