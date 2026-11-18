'use strict';
/* ============================================================
   Input, tools and the HTML interface
   ============================================================ */
const TOOLS = [
  { id: 'drag', name: 'Grab', key: '1', hint: 'Drag to grab and throw. Drag empty space to pan.' },
  { id: 'pin', name: 'Pin', key: '2', hint: 'Click an object to pin it in place. Click a pin to remove it.' },
  { id: 'rope', name: 'Rope', key: '3', hint: 'Click two points to tie a rope. Empty space anchors to the world.' },
  { id: 'explode', name: 'Explode', key: '4', hint: 'Click anywhere to set off an explosion.' },
  { id: 'ignite', name: 'Ignite', key: '5', hint: 'Click a dummy or anything wooden to set it on fire.' },
  { id: 'heal', name: 'Heal', key: '6', hint: 'Click a dummy to fully heal and revive it.' },
  { id: 'delete', name: 'Delete', key: '7', hint: 'Click anything to delete it.' },
];

const Input = {
  sx: 0, sy: 0, wx: 0, wy: 0, over: false,
  drag: null, tool: 'drag', placing: null, placeFlip: false, placeAng: 0,
  ropeStart: null, pan: null, rmb: null, keys: new Set(), holdEnt: null,
  pointers: new Map(), pinch: null, hoverEnt: null,

  isHeld(b) { return !!(this.drag && this.drag.body === b); },

  pick(wx, wy, o = {}) {
    const r = 7 / Cam.z;
    const pts = [[0, 0]];
    for (let i = 0; i < 8; i++) pts.push([Math.cos(i * TAU / 8) * r, Math.sin(i * TAU / 8) * r]);
    let best = null, bestScore = -1e9;
    pts.forEach(([dx, dy], k) => {
      for (const fx of bodiesAt(v2(wx + dx, wy + dy))) {
        const b = fx.getBody();
        const ud = b.getUserData();
        if (!ud || ud.isGround) continue;
        const e = ud.ent;
        if (!e || e.dead) continue;
        if (o.dynamic && !b.isDynamic()) continue;
        const score = (e.z || 0) + (k === 0 ? 1000 : 0) + (b.isDynamic() ? 100 : 0);
        if (score > bestScore) { bestScore = score; best = { fx, body: b, ent: e }; }
      }
    });
    return best;
  },

  connectedMass(body) {
    const seen = new Set([body]);
    const stack = [body];
    let m = 0;
    while (stack.length && seen.size < 60) {
      const b = stack.pop();
      if (b.isDynamic()) m += b.getMass();
      for (let je = b.getJointList(); je; je = je.next) {
        if (je.joint.getType() === 'mouse-joint') continue;
        const o = je.other;
        if (!seen.has(o) && o.isDynamic()) { seen.add(o); stack.push(o); }
      }
    }
    return Math.min(m, 400);
  },

  startDrag(hit, p) {
    this.endDrag();
    const b = hit.body;
    const m = this.connectedMass(b);
    const j = G.world.createJoint(new PL.MouseJoint({ maxForce: m * 60 + 50, frequencyHz: 6, dampingRatio: 0.9 }, G.ground, b, v2(p.x, p.y)));
    const holdable = hit.ent.kind !== 'dummy';
    this.drag = { j, body: b, ent: hit.ent, hold: holdable, holdAngle: b.getAngle(), m };
    b.setAwake(true);
    if (hit.ent.kind === 'dummy') G.selected = hit.ent;
    else if (hit.ent.activatable) this.lastEnt = hit.ent;
    Sound.play('spawn', 0.3);
  },
  endDrag() {
    if (!this.drag) return;
    killJoint(this.drag.j);
    if (this.holdEnt && this.holdEnt === this.drag.ent) { this.holdEnt.releaseActivate(); this.holdEnt = null; }
    this.drag = null;
  },

  applyDrag(dt) {
    if (this.holdEnt) { if (this.holdEnt.dead) this.holdEnt = null; else this.holdEnt.holdActivate(dt); }
    const d = this.drag;
    if (!d) return;
    if (d.body._dead || d.j._dead || d.ent.dead) { this.drag = null; return; }
    d.j.setTarget(v2(this.wx, this.wy));
    // re-measure what is attached (an impaled dummy adds its weight) so a held blade can be pushed through
    d.mt = (d.mt || 0) - dt;
    if (d.mt <= 0) { d.mt = 0.2; d.m = this.connectedMass(d.body); d.j.setMaxForce(d.m * 60 + 50); }
    if (this.keys.has('KeyQ')) d.holdAngle += 3 * dt;
    if (this.keys.has('KeyE')) d.holdAngle -= 3 * dt;
    if (d.hold) {
      const b = d.body;
      const a = angNorm(b.getAngle() - d.holdAngle);
      const w = b.getAngularVelocity();
      const I = b.getInertia();
      const t = clamp((-a * 16 - w) * I / (DT * 5), -(I * 1500 + 25), I * 1500 + 25);
      b.applyTorque(t, true);
    }
  },

  activateEnt(e) {
    if (!e || e.dead) return;
    if (e.kind === 'dummy') { G.selected = e; return; }
    if (!e.activatable) return;
    e.activate();
    this.holdEnt = e;
  },

  /* R: drop another copy of the last catalog item at the cursor */
  spawnArmed() {
    const d = UI.armed;
    if (!d) return;
    spawnItem(d.id, this.wx, d.ground ? 0 : this.wy, this.placeFlip, this.placeAng);
    Sound.play('spawn', 0.5);
  },

  spawnPlacing(x, y) {
    const d = this.placing;
    const e = spawnItem(d.id, x, d.ground ? 0 : y, this.placeFlip, this.placeAng);
    Sound.play('spawn', 0.5);
    if (e && e.kind === 'dummy') G.selected = e;
  },

  toolClick(x, y) {
    const p = v2(x, y);
    switch (this.tool) {
      case 'pin': {
        for (const pn of G.pins) {
          if (pn.j._dead) continue;
          const a = pn.j.getAnchorB();
          if (Math.hypot(a.x - x, a.y - y) < 12 / Cam.z) { killJoint(pn.j); G.pins = G.pins.filter((q) => q !== pn); Sound.play('click', 0.5); return; }
        }
        const hit = this.pick(x, y, { dynamic: true });
        if (!hit) return;
        const j = G.world.createJoint(new PL.RevoluteJoint({}, G.ground, hit.body, p));
        G.pins.push({ j });
        Sound.play('click', 0.6);
        break;
      }
      case 'rope': {
        const hit = this.pick(x, y, { dynamic: true });
        const end = { body: hit ? hit.body : G.ground, p };
        if (!this.ropeStart) { this.ropeStart = end; Sound.play('click', 0.4); return; }
        const s = this.ropeStart;
        this.ropeStart = null;
        if (s.body === end.body) return;
        if (s.body._dead) return;
        const len = Math.max(0.2, Math.hypot(s.p.x - p.x, s.p.y - p.y));
        makeRope(s.body, end.body, s.p, p, len);
        Sound.play('click', 0.6);
        break;
      }
      case 'explode':
        Combat.explode(x, y, { r: 3.8, power: 80, dmg: 80, shrapnel: 8 });
        break;
      case 'ignite': {
        let any = false;
        for (const b of queryBodies(x, y, 0.35)) { if (b.getUserData().isGround) continue; Combat.ignite(b, 9); any = true; }
        for (let i = 0; i < 14; i++) addP({ type: 'fire', x: x + rand(-0.15, 0.15), y: y + rand(-0.1, 0.1), vx: rand(-0.6, 0.6), vy: rand(0.5, 2), life: rand(0.3, 0.7), size: rand(0.08, 0.18) });
        if (!any && y < 0.6) Combat.addFirePool(x, 0, 0.8, 6);
        Sound.play('fire', 0.6);
        break;
      }
      case 'heal': {
        const hit = this.pick(x, y);
        if (hit && hit.ent.kind === 'dummy') { hit.ent.heal(); G.selected = hit.ent; }
        break;
      }
      case 'delete': {
        const hit = this.pick(x, y);
        if (!hit) return;
        if (hit.ent.kind === 'structure') hit.ent.deletePiece(hit.body);
        else hit.ent.remove();
        Sound.play('click', 0.5);
        break;
      }
    }
  },

  setWorldFromScreen() { const w = screenToWorld(this.sx, this.sy); this.wx = w.x; this.wy = w.y; },

  init(cv) {
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    cv.addEventListener('pointerenter', () => { this.over = true; });
    cv.addEventListener('pointerleave', () => { this.over = false; });
    cv.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); if (this.holdEnt) { this.holdEnt.releaseActivate(); this.holdEnt = null; } });
  },

  localXY(e) { const r = R.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; },

  onDown(e) {
    Sound.init();
    R.cv.setPointerCapture && R.cv.setPointerCapture(e.pointerId);
    const p = this.localXY(e);
    this.pointers.set(e.pointerId, p);
    this.sx = p.x; this.sy = p.y; this.setWorldFromScreen();
    if (this.pointers.size === 2) {
      // start pinch: cancel any single-finger action
      this.endDrag(); this.pan = null;
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    if (e.button === 1) { this.pan = { x: p.x, y: p.y, cx: Cam.tx, cy: Cam.ty }; e.preventDefault(); return; }
    if (e.button === 2) {
      if (this.placing) { UI.setPlacing(null); return; }
      if (this.ropeStart) { this.ropeStart = null; return; }
      const hit = this.pick(this.wx, this.wy);
      this.rmb = { x: p.x, y: p.y, moved: false, cx: Cam.tx, cy: Cam.ty, hit };
      if (hit) this.activateEnt(hit.ent);
      return;
    }
    if (e.button !== 0) return;
    if (this.placing) {
      this.spawnPlacing(this.wx, this.wy);
      if (!e.shiftKey) UI.setPlacing(null);
      return;
    }
    if (this.tool === 'drag') {
      const hit = this.pick(this.wx, this.wy, { dynamic: true });
      if (hit) { this.startDrag(hit, v2(this.wx, this.wy)); return; }
      const st = this.pick(this.wx, this.wy);
      if (st && st.ent.kind === 'dummy') G.selected = st.ent;
      this.pan = { x: p.x, y: p.y, cx: Cam.tx, cy: Cam.ty };
      return;
    }
    this.toolClick(this.wx, this.wy);
  },
  onMove(e) {
    const p = this.localXY(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const k = d / (this.pinch.d || 1);
      Cam.tz = clamp(Cam.tz * k, 12, 260);
      Cam.tx -= (cx - this.pinch.cx) / Cam.tz; Cam.ty += (cy - this.pinch.cy) / Cam.tz;
      Cam.x = Cam.tx; Cam.y = Cam.ty; Cam.z = Cam.tz;
      this.pinch = { d, cx, cy };
      return;
    }
    this.sx = p.x; this.sy = p.y; this.setWorldFromScreen();
    const pan = this.pan || (this.rmb && !this.rmb.hit ? this.rmb : null);
    if (pan) {
      if (Math.abs(p.x - pan.x) + Math.abs(p.y - pan.y) > 4) pan.moved = true;
      Cam.tx = pan.cx - (p.x - pan.x) / Cam.z;
      Cam.ty = pan.cy + (p.y - pan.y) / Cam.z;
      Cam.x = Cam.tx; Cam.y = Cam.ty;
    }
  },
  onUp(e) {
    this.pointers.delete(e.pointerId);
    if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; return; }
    if (e.button === 2 || (e.pointerType !== 'mouse' && this.rmb)) {
      if (this.holdEnt) { this.holdEnt.releaseActivate(); this.holdEnt = null; }
      this.rmb = null;
    }
    if (e.button === 0 || e.pointerType !== 'mouse') { this.endDrag(); this.pan = null; }
    if (e.button === 1) this.pan = null;
  },
  onWheel(e) {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    if (this.drag && this.drag.hold) { this.drag.holdAngle -= Math.sign(dy) * 0.22; return; }
    if (this.placing) { this.placeAng -= Math.sign(dy) * 0.2; return; }
    const p = this.localXY(e);
    const before = { x: (p.x - R.W / 2) / Cam.tz + Cam.tx, y: (R.H / 2 - p.y) / Cam.tz + Cam.ty };
    Cam.tz = clamp(Cam.tz * Math.exp(-dy * 0.0016), 12, 260);
    Cam.tx = before.x - (p.x - R.W / 2) / Cam.tz;
    Cam.ty = before.y - (R.H / 2 - p.y) / Cam.tz;
  },
  onKey(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const c = e.code;
    if (down) this.keys.add(c); else this.keys.delete(c);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
    if (!down) {
      if ((c === 'Space' || c === 'KeyF') && this.holdEnt) { this.holdEnt.releaseActivate(); this.holdEnt = null; }
      return;
    }
    if (e.repeat) return;
    Sound.init();
    if (this.placing && (c === 'KeyF')) { this.placeFlip = !this.placeFlip; return; }
    switch (c) {
      case 'Space': case 'KeyF': {
        const tgt = this.drag ? this.drag.ent : (this.hoverEnt || null);
        if (tgt) this.activateEnt(tgt);
        break;
      }
      case 'KeyR': this.spawnArmed(); break;
      case 'KeyQ': if (this.placing) this.placeAng += 0.26; break;
      case 'KeyE': if (this.placing) this.placeAng -= 0.26; break;
      case 'Escape': if (this.placing) UI.setPlacing(null); else if (this.ropeStart) this.ropeStart = null; else G.selected = null; break;
      case 'KeyP': UI.togglePause(); break;
      case 'KeyT': UI.toggleSlow(); break;
      case 'KeyG': {
        // spawn a dummy with its feet at the cursor (it drops if the cursor is in mid-air)
        new Dummy(this.wx, Math.max(0, this.wy), this.placeFlip ? -1 : 1);
        Sound.play('spawn', 0.5);
        break;
      }
      case 'KeyL': UI.toggleLife(); break;
      case 'KeyH': UI.toggleHelp(); break;
      case 'KeyC': UI.clearDebris(); break;
      case 'Delete': case 'Backspace': case 'KeyX': {
        const hit = this.pick(this.wx, this.wy);
        if (hit) { if (hit.ent.kind === 'structure') hit.ent.deletePiece(hit.body); else hit.ent.remove(); }
        break;
      }
      default: {
        const t = TOOLS.find((t) => t.key === e.key);
        if (t) UI.setTool(t.id);
      }
    }
  },

  frame(dt) {
    // keyboard camera
    const sp = 600 / Cam.z * dt * 1.5;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) Cam.tx -= sp;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) Cam.tx += sp;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) Cam.ty += sp;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) Cam.ty -= sp;
    Cam.ty = clamp(Cam.ty, -4, 60);
    this.setWorldFromScreen();
    const hit = this.over && !this.drag && !this.pan ? this.pick(this.wx, this.wy) : null;
    this.hoverEnt = this.drag ? this.drag.ent : hit ? hit.ent : null;
    G.hover = this.hoverEnt;
  },

  drawOverlay(ctx) {
    // hover outline
    const h = this.hoverEnt;
    if (h && !h.dead && h.kind !== 'dummy' && !this.placing) {
      ctx.strokeStyle = 'rgba(242,194,48,0.55)'; ctx.lineWidth = 1.5 / Cam.z;
      for (const b of h.kind === 'structure' ? [] : h.bodies) {
        if (b._dead) continue;
        const p = b.getPosition();
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.getAngle()); fixturePath(ctx, b); ctx.stroke(); ctx.restore();
      }
    }
    if (this.drag && !this.drag.body._dead) {
      const a = this.drag.j.getAnchorB();
      ctx.strokeStyle = 'rgba(242,194,48,0.6)'; ctx.lineWidth = 1.5 / Cam.z;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(this.wx, this.wy); ctx.stroke();
      fillCircle(ctx, a.x, a.y, 3 / Cam.z, '#f2c230');
    }
    if (this.ropeStart) {
      ctx.strokeStyle = 'rgba(184,154,106,0.8)'; ctx.lineWidth = 0.02; ctx.setLineDash([0.08, 0.06]);
      ctx.beginPath(); ctx.moveTo(this.ropeStart.p.x, this.ropeStart.p.y); ctx.lineTo(this.wx, this.wy); ctx.stroke(); ctx.setLineDash([]);
    }
    if (this.placing && this.over) {
      const d = this.placing;
      ctx.save();
      ctx.globalAlpha = 0.55;
      const y = d.ground ? 0 : this.wy;
      ctx.translate(this.wx, y);
      if (d.spawn) { ctx.rotate(0); if (d.ghost) d.ghost(ctx, this.placeFlip); }
      else {
        ctx.rotate((this.placeFlip ? Math.PI : 0) + this.placeAng);
        if (this.placeFlip) ctx.scale(1, -1);
        d.draw(ctx, { st: { loaded: true }, sy: this.placeFlip ? -1 : 1, def: d });
      }
      ctx.restore();
    }
  },
  drawScreenOverlay(ctx) {
    const label = G.paused ? 'PAUSED' : G.slowmo ? 'SLOW MOTION  0.25×' : null;
    if (label) {
      ctx.fillStyle = 'rgba(242,194,48,0.9)';
      ctx.font = '600 13px "Chakra Petch", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, R.W / 2, 74);
    }
    if (G.slowmo && !G.paused) {
      // tinted frame so slow motion is obvious at a glance
      ctx.strokeStyle = 'rgba(242,194,48,0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, R.W - 3, R.H - 3);
    }
  },
};

/* ------------------------------------------------------------ HTML UI */
const ICONS = {
  drag: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5v-2a1.5 1.5 0 1 1 3 0V12m0-1a1.5 1.5 0 1 1 3 0v1m0 0a1.5 1.5 0 1 1 3 0v3.5a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L5 15.6a1.6 1.6 0 0 1 2.6-1.8L8 14.5"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v8"/>',
  rope: '<path d="M5 5c4 0 4 4 7 4s3-4 7-4M5 5v0M19 5l0 0M12 9v10"/><circle cx="12" cy="20" r="1.5"/>',
  explode: '<path d="M12 2l2 5 5-3-2 5 5 1-5 3 3 4-5-1-1 5-2-4-3 4 0-5-5 1 3-4-4-3 5-1-2-5 5 3z"/>',
  ignite: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
  heal: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>',
  delete: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4l12 8-12 8z"/>',
  slow: '<circle cx="12" cy="13" r="8"/><path d="M12 13V8M12 3h0"/>',
  life: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/>',
  broom: '<path d="M14 3l-4 9M6 13h8l2 8H4z"/>',
  reset: '<path d="M4 4v6h6M4.5 15a8 8 0 1 0 2-8.5L4 10"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h0"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const svg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

const UI = {
  cat: 'people',
  init() {
    this.el = {
      cats: document.getElementById('cats'), items: document.getElementById('items'), tools: document.getElementById('tools'),
      sim: document.getElementById('sim'), hint: document.getElementById('hint'), insp: document.getElementById('inspector'),
      help: document.getElementById('help'), catalog: document.getElementById('catalog'), count: document.getElementById('count'),
    };
    // categories
    for (const c of CATS) {
      const b = document.createElement('button');
      b.className = 'cat'; b.dataset.cat = c.id; b.type = 'button';
      b.innerHTML = `<span>${c.name}</span><small>${ITEMS.filter((i) => i.cat === c.id && !i.hidden).length}</small>`;
      b.onclick = () => this.setCat(c.id);
      this.el.cats.appendChild(b);
    }
    // tools
    for (const t of TOOLS) {
      const b = document.createElement('button');
      b.className = 'tbtn'; b.dataset.tool = t.id; b.type = 'button'; b.title = `${t.name} (${t.key})`;
      b.innerHTML = svg(t.id) + `<span>${t.name}</span><kbd>${t.key}</kbd>`;
      b.onclick = () => this.setTool(t.id);
      this.el.tools.appendChild(b);
    }
    const simBtns = [
      ['pause', 'Pause (P)', () => this.togglePause()], ['slow', 'Slow motion (T)', () => this.toggleSlow()],
      ['life', 'Health overlay (L)', () => this.toggleLife()], ['sound', 'Sound', () => this.toggleSound()],
      ['broom', 'Clear blood & debris (C)', () => this.clearDebris()], ['reset', 'Reset scene', () => this.confirmReset()],
      ['help', 'Controls (H)', () => this.toggleHelp()],
    ];
    for (const [ic, title, fn] of simBtns) {
      const b = document.createElement('button');
      b.className = 'sbtn'; b.type = 'button'; b.title = title; b.dataset.k = ic; b.setAttribute('aria-label', title);
      b.innerHTML = svg(ic);
      b.onclick = fn;
      this.el.sim.appendChild(b);
    }
    document.getElementById('help-close').onclick = () => this.toggleHelp(false);
    // touch: an on-screen Use button activates the held (or last grabbed) item
    this.coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const use = document.getElementById('use');
    this.el.use = use;
    use.hidden = !this.coarse;
    use.addEventListener('pointerdown', (e) => { e.preventDefault(); Sound.init(); const t = Input.drag ? Input.drag.ent : Input.lastEnt; if (t && !t.dead) Input.activateEnt(t); });
    const rel = () => { if (Input.holdEnt) { Input.holdEnt.releaseActivate(); Input.holdEnt = null; } };
    use.addEventListener('pointerup', rel); use.addEventListener('pointercancel', rel); use.addEventListener('pointerleave', rel);
    document.getElementById('drawer').onclick = () => this.el.catalog.classList.toggle('open');
    this.el.insp.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a || !G.selected) return;
      const d = G.selected;
      if (a.dataset.act === 'close') G.selected = null;
      if (a.dataset.act === 'heal') d.heal();
      if (a.dataset.act === 'delete') d.remove();
      if (a.dataset.act === 'ignite') Combat.ignite(d.parts.chest.body, 8);
    });
    this.setCat('people');
    this.setTool('drag');
    this.renderInspector(true);
    this.inspT = 0;
  },
  setCat(id) {
    this.cat = id;
    for (const b of this.el.cats.children) b.classList.toggle('on', b.dataset.cat === id);
    const box = this.el.items;
    box.innerHTML = '';
    for (const d of ITEMS) {
      if (d.cat !== id || d.hidden) continue;
      const b = document.createElement('button');
      b.className = 'item'; b.type = 'button'; b.dataset.id = d.id;
      b.title = d.desc || d.name;
      const cv = document.createElement('canvas');
      cv.width = 168; cv.height = 96;
      b.appendChild(cv);
      const label = document.createElement('span'); label.textContent = d.name; b.appendChild(label);
      b.onclick = () => {
        this.armed = d;
        this.setPlacing(this.placingId === d.id ? null : d);
        if (window.innerWidth < 760) this.el.catalog.classList.remove('open');
      };
      box.appendChild(b);
      drawThumb(cv, d);
    }
    this.markPlacing();
  },
  setPlacing(d) {
    Input.placing = d; this.placingId = d ? d.id : null;
    Input.placeAng = 0;
    this.markPlacing();
  },
  markPlacing() {
    for (const b of this.el.items.children) {
      b.classList.toggle('on', b.dataset.id === this.placingId);
      b.classList.toggle('armed', !!this.armed && b.dataset.id === this.armed.id);
    }
  },
  setTool(id) {
    Input.tool = id; Input.ropeStart = null;
    this.setPlacing(null);
    for (const b of this.el.tools.children) b.classList.toggle('on', b.dataset.tool === id);
  },
  togglePause() { G.paused = !G.paused; this.syncSim(); },
  toggleSlow() { G.slowmo = !G.slowmo; this.syncSim(); },
  toggleLife() { G.lifeView = !G.lifeView; this.syncSim(); },
  toggleSound() { Sound.init(); Sound.enabled = !Sound.enabled; this.syncSim(); },
  toggleHelp(v) { const h = this.el.help; h.hidden = v === undefined ? !h.hidden : !v; },
  clearDebris() {
    G.particles.length = 0;
    G.ground.getUserData().stains.length = 0;
    for (const b of G.stainBodies) if (!b._dead) b.getUserData().stains = b.getUserData().stains.filter((s) => s.hole && false);
    for (const e of G.entities.slice()) if (e.def && (e.def === ITEM.shard || e.def === ITEM.plankbit || e.def === ITEM.bolt)) e.remove();
  },
  confirmReset() {
    const b = this.el.sim.querySelector('[data-k="reset"]');
    if (b.classList.contains('arm')) { b.classList.remove('arm'); Game.reset(); return; }
    b.classList.add('arm'); b.title = 'Click again to reset';
    setTimeout(() => { b.classList.remove('arm'); b.title = 'Reset scene'; }, 2200);
  },
  syncSim() {
    const q = (k) => this.el.sim.querySelector(`[data-k="${k}"]`);
    const p = q('pause'); p.innerHTML = svg(G.paused ? 'play' : 'pause'); p.classList.toggle('on', G.paused);
    q('slow').classList.toggle('on', G.slowmo);
    q('life').classList.toggle('on', G.lifeView);
    const s = q('sound'); s.innerHTML = svg(Sound.enabled ? 'sound' : 'mute'); s.classList.toggle('on', !Sound.enabled);
  },

  frame(dt) {
    this.updateHint();
    this.inspT -= dt;
    if (this.inspT <= 0) { this.inspT = 0.15; this.renderInspector(); }
    if (this.el.count) {
      const n = G.dummies.length, alive = G.dummies.filter((d) => d.alive).length;
      const txt = `${alive}/${n} alive · ${G.entities.length - 1} objects${G.slowmo ? ' · 0.25×' : ''}`;
      if (this.el.count.textContent !== txt) this.el.count.textContent = txt;
    }
  },
  updateHint() {
    let h;
    const k = (s) => `<kbd>${s}</kbd>`;
    if (Input.placing) h = `<b>${Input.placing.name}</b> ${k('Click')} place · ${k('Shift')}+click place several · ${k('F')} flip · ${k('Q')}${k('E')} rotate · ${k('Esc')} cancel`;
    else if (Input.drag) {
      const e = Input.drag.ent;
      h = e.kind === 'dummy' ? `<b>${e.name}</b> release to throw` : `<b>${e.name}</b> ${e.activatable ? k('Space') + ' use · ' : ''}${k('Q')}${k('E')} or wheel to rotate · release to throw`;
    } else if (Input.ropeStart) h = `Click a second point to tie the rope · ${k('Esc')} cancel`;
    else if (Input.hoverEnt && Input.hoverEnt.kind !== 'structure') {
      const e = Input.hoverEnt;
      h = e.kind === 'dummy' ? `<b>${e.name}</b> · ${e.statusText} · right-click to inspect` : `<b>${e.name}</b>${e.activatable ? ' · right-click or ' + k('Space') + ' to use' : ''}`;
    } else h = TOOLS.find((t) => t.id === Input.tool).hint + (this.coarse ? ' · Pinch to zoom' : ` · Right-drag to pan · Wheel to zoom`);
    if (this.armed && !Input.placing && !Input.drag && !this.coarse) h += ` · ${k('R')} spawn ${this.armed.name}`;
    if (h !== this.lastHint) { this.el.hint.innerHTML = h; this.lastHint = h; }
    if (this.coarse) { const t = Input.drag ? Input.drag.ent : Input.lastEnt; this.el.use.disabled = !(t && !t.dead && t.activatable); }
  },

  renderInspector(force) {
    const d = G.selected;
    const el = this.el.insp;
    if (!d || d.dead) { if (!el.hidden) el.hidden = true; G.selected = d && d.dead ? null : G.selected; return; }
    el.hidden = false;
    if (this.inspFor !== d) {
      this.inspFor = d;
      el.innerHTML = `
        <header><div><h2>${d.name}</h2><span class="chip" id="i-status"></span></div>
        <button class="x" data-act="close" aria-label="Close inspector">${svg('close')}</button></header>
        <div class="vitals">
          <div class="vital"><label>Blood</label><div class="bar"><i id="i-blood" style="--c:var(--blood)"></i></div><output id="i-bloodv"></output></div>
          <div class="vital"><label>Consciousness</label><div class="bar"><i id="i-cons" style="--c:var(--ok)"></i></div><output id="i-consv"></output></div>
          <div class="vital"><label>Pain</label><div class="bar"><i id="i-pain" style="--c:var(--warn)"></i></div><output id="i-painv"></output></div>
        </div>
        <div class="split"><canvas id="i-body" width="180" height="300" aria-label="Body condition diagram"></canvas>
        <div class="facts" id="i-facts"></div></div>
        <h3>Injury log</h3><ol id="i-log"></ol>
        <div class="acts"><button data-act="heal" type="button">Heal</button><button data-act="ignite" type="button">Ignite</button><button data-act="delete" type="button" class="danger">Delete</button></div>`;
    }
    const st = d.statusText;
    const chip = el.querySelector('#i-status');
    chip.textContent = st;
    chip.dataset.s = !d.alive ? 'dead' : d.cons < 0.35 ? 'ko' : d.pain > 50 || d.state !== 'stand' ? 'hurt' : 'ok';
    const set = (id, v, txt) => { el.querySelector('#i-' + id).style.width = clamp(v, 0, 100) + '%'; el.querySelector('#i-' + id + 'v').textContent = txt; };
    set('blood', d.blood, Math.round(d.blood) + '%');
    set('cons', d.cons * 100, Math.round(d.cons * 100) + '%');
    set('pain', d.pain / 1.5, Math.round(d.pain));
    const broken = d.partList.filter((p) => p.broken).length;
    const lost = d.partList.filter((p) => p.detached && p.joint === null).length;
    const facts = [];
    facts.push(['Bleeding', d.bleedRate > 0.05 ? d.bleedRate.toFixed(1) + ' /s' : 'none']);
    facts.push(['Brain', Math.max(0, Math.round(d.brain)) + '%']);
    facts.push(['Fractures', broken || 'none']);
    if (lost) facts.push(['Severed', lost]);
    if (d.spineBroken) facts.push(['Spine', 'fractured']);
    if (d.adrenaline > 0) facts.push(['Adrenaline', Math.ceil(d.adrenaline) + ' s']);
    if (d.sedated > 0 && d.alive) facts.push(['Sedated', Math.ceil(d.sedated) + ' s']);
    if (!d.alive) facts.push(['Cause', d.cause]);
    el.querySelector('#i-facts').innerHTML = facts.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
    const log = d.injuries.slice(0, 7).map((i) => `<li><span>${i.msg}${i.n > 1 ? ' ×' + i.n : ''}</span><time>${fmtAgo(G.time - i.t)}</time></li>`).join('') || '<li class="empty"><span>No injuries yet</span></li>';
    const lg = el.querySelector('#i-log');
    if (lg.innerHTML !== log) lg.innerHTML = log;
    drawBodyMap(el.querySelector('#i-body'), d);
  },
};
function fmtAgo(s) { return s < 60 ? Math.floor(s) + 's' : Math.floor(s / 60) + 'm'; }

function drawThumb(cv, d) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const bb = d.bb || fixBounds(d.fix);
  const bw = bb[2] - bb[0], bh = bb[3] - bb[1];
  // long, thin things read better tilted
  const rot = bw / bh > 7 ? 0.38 : 0;
  const c = Math.cos(rot), sn = Math.sin(rot);
  const rw = bw * c + bh * sn, rh = bw * sn + bh * c;
  const s = Math.min((W - 22) / rw, (H - 18) / rh);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(s, -s);
  ctx.rotate(rot);
  ctx.translate(-(bb[0] + bb[2]) / 2, -(bb[1] + bb[3]) / 2);
  const fake = { st: { loaded: true, ext: 1 }, sy: 1, def: d, used: false, cool: 0 };
  try {
    if (d.icon) d.icon(ctx, fake);
    else if (d.draw) d.draw(ctx, fake);
    else if (d.ghost) d.ghost(ctx, false);
  } catch (e) { console.warn('thumb', d.id, e); }
  ctx.restore();
}

function drawBodyMap(cv, d) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const s = 150;
  ctx.save();
  ctx.translate(W / 2, H - 14);
  ctx.scale(s, -s);
  // front-facing schematic: left/right limbs spread
  const lay = {
    head: [0, 1.665, 0.1, 0.12], chest: [0, 1.37, 0.17, 0.17], abdomen: [0, 1.07, 0.15, 0.135],
    uarmF: [-0.24, 1.335, 0.055, 0.165], larmF: [-0.26, 1.0, 0.05, 0.175], uarmB: [0.24, 1.335, 0.055, 0.165], larmB: [0.26, 1.0, 0.05, 0.175],
    thighF: [-0.085, 0.7, 0.07, 0.235], shinF: [-0.09, 0.285, 0.06, 0.215], footF: [-0.11, 0.04, 0.08, 0.04],
    thighB: [0.085, 0.7, 0.07, 0.235], shinB: [0.09, 0.285, 0.06, 0.215], footB: [0.11, 0.04, 0.08, 0.04],
  };
  for (const p of d.partList) {
    const L = lay[p.n];
    if (!L) continue;
    ctx.beginPath();
    if (L.length === 3) ctx.arc(L[0], L[1], L[2], 0, TAU);
    else roundRectPath(ctx, L[0] - L[2], L[1] - L[3], L[2] * 2, L[3] * 2, 0.012);
    const c = healthColor(p, d);
    ctx.fillStyle = p.detached ? 'rgba(80,84,92,0.25)' : c + '55';
    ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = p.broken ? 0.02 : 0.012;
    if (p.detached) ctx.setLineDash([0.03, 0.03]);
    ctx.stroke(); ctx.setLineDash([]);
    if (p.burning > 0) { ctx.fillStyle = 'rgba(255,140,50,0.6)'; ctx.fill(); }
    const bleed = p.wounds.reduce((a, w) => a + w.bleed, 0);
    if (bleed > 0.2) { ctx.fillStyle = '#b04ae0'; ctx.beginPath(); ctx.arc(L[0], L[1], clamp(0.02 + bleed * 0.01, 0.02, 0.05), 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  ctx.fillStyle = '#7d8390'; ctx.font = '10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
  ctx.fillText('R', 22, 70); ctx.fillText('L', W - 22, 70);
}
