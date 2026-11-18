'use strict';
/* ============================================================
   Item catalog: weapons, explosives, gadgets and props
   Local coords: +x forward (muzzle / blade), origin near the grip.
   ============================================================ */
const ITEMS = [];
const ITEM = {};
const CATS = [
  { id: 'people', name: 'People' },
  { id: 'melee', name: 'Melee' },
  { id: 'guns', name: 'Firearms' },
  { id: 'explosives', name: 'Explosives' },
  { id: 'scifi', name: 'Sci-fi' },
  { id: 'misc', name: 'Gadgets' },
  { id: 'props', name: 'Props' },
  { id: 'structures', name: 'Buildings' },
];
function defItem(d) { ITEMS.push(d); ITEM[d.id] = d; return d; }

const C = {
  gun: '#535964', gunD: '#30343a', gunL: '#7b828d', poly: '#3a3d43', polyL: '#4a4e55',
  wood: '#7c5434', woodD: '#5b3b22', woodL: '#9a6c45', steel: '#a3abb5', steelL: '#d3d9df', steelD: '#6d747d',
  brass: '#c9a14a', olive: '#56603e', oliveD: '#3e4630', rim: 'rgba(255,255,255,0.16)', dark: 'rgba(0,0,0,0.45)',
};

function setMass(b, m) {
  const cur = b.getMass();
  if (cur <= 0) return;
  const k = m / cur;
  for (let f = b.getFixtureList(); f; f = f.getNext()) f.setDensity(f.getDensity() * k);
  b.resetMassData();
}

function fixShape(f, sy) {
  if (f.box) return Sh.box(f.box[0], f.box[1], f.box[2] || 0, f.box[3] || 0, f.box[4] || 0, sy);
  if (f.poly) return Sh.poly(f.poly, sy);
  return Sh.circle(f.circle[0], f.circle[1] || 0, f.circle[2] || 0, sy);
}
function fixBounds(fix) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const f of fix) {
    if (f.box) { const [hw, hh, cx = 0, cy = 0, a = 0] = f.box; const c = Math.cos(a), s = Math.sin(a); for (const [px, py] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) add(cx + px * c - py * s, cy + px * s + py * c); }
    else if (f.poly) for (const [x, y] of f.poly) add(x, y);
    else { const [r, cx = 0, cy = 0] = f.circle; add(cx - r, cy - r); add(cx + r, cy + r); }
  }
  return [x0, y0, x1, y1];
}

function buildSimple(it, x, y, a, sy) {
  const d = it.def;
  const fx = d.fix.map((f) => ({ shape: fixShape(f, sy), mat: f.mat, ud: f.ud, density: f.density, friction: f.friction, restitution: f.restitution, sensor: f.sensor }));
  const b = makeBody(it, { type: d.static ? 'static' : 'dynamic', x, y, angle: a, mat: d.mat || 'metal', sy, blunt: d.blunt || 1, bullet: !!d.bullet,
    ld: d.ld != null ? d.ld : 0.05, ad: d.ad != null ? d.ad : 0.25, cat: d.fcat || CAT.ITEM, mask: d.mask,
    ud: Object.assign({ fill: d.fill, stroke: d.stroke }, d.ud ? (typeof d.ud === 'function' ? d.ud(it) : d.ud) : {}) }, fx);
  if (d.mass && !d.static) setMass(b, d.mass);
  return b;
}

class Item extends Entity {
  constructor(def, x, y, flip, ang = 0) {
    super('item');
    this.def = def;
    this.name = def.name;
    this.sy = flip ? -1 : 1;
    this.z = def.z != null ? def.z : 30;
    this.cool = 0;
    this.st = {};
    const angle = (flip ? Math.PI : 0) + ang;
    if (def.build) def.build(this, x, y, angle, this.sy); else buildSimple(this, x, y, angle, this.sy);
    if (def.init) def.init(this);
  }
  get activatable() { return !!(this.def.activate || this.def.hold); }
  update(dt) {
    if (this.cool > 0) this.cool -= dt;
    if (this.def.life && G.time - this.born > this.def.life) { this.remove(); return; }
    if (this.def.update) this.def.update(this, dt);
  }
  activate() { if (this.def.activate) this.def.activate(this); }
  holdActivate(dt) { if (this.def.hold) this.def.hold(this, dt); }
  releaseActivate() { if (this.def.release) this.def.release(this); }
  onRemove() { if (this.hum) { this.hum.stop(); this.hum = null; } if (this.def.onRemove) this.def.onRemove(this); }
  draw(ctx) {
    const b = this.body;
    if (!b || b._dead) return;
    if (this.def.drawWorld) { this.def.drawWorld(ctx, this); return; }
    withBody(ctx, b, this.sy, () => this.def.draw(ctx, this));
    const ud = b.getUserData();
    if (ud.stains.length || ud.char) {
      const p = b.getPosition();
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.getAngle());
      const path = bodyPath(b);
      ctx.clip(path);
      if (ud.char) { ctx.fillStyle = `rgba(10,8,6,${ud.char * 0.75})`; ctx.fill(path); }
      drawStains(ctx, b);
      ctx.restore();
    }
    if (this.def.lightFx) this.def.lightFx(this);
  }
  wp(x, y) { return this.body.getWorldPoint(v2(x, y * this.sy)); }
  fwd() { return this.body.getWorldVector(v2(1, 0)); }
}

/* ============================================================ GUNS */
function muzzleFx(it, m, dir, size = 1) {
  addP({ type: 'flash', x: m.x + dir.x * 0.05, y: m.y + dir.y * 0.05, life: 0.05, size: 0.28 * size });
  G.lights.push({ x: m.x, y: m.y, r: 2.2 * size, col: '255,200,120', a: 0.55, life: 0.06, max: 0.06 });
  smoke(m.x + dir.x * 0.05, m.y + dir.y * 0.05, Math.round(2 * size), 0.06 * size, 'rgba(150,150,155,', 0.9, dir.x * 0.8, dir.y * 0.8 + 0.2);
}
function ejectShell(it, g) {
  if (!g.eject) return;
  const e = it.wp(g.eject[0], g.eject[1]);
  const up = it.body.getWorldVector(v2(-0.4, 1 * it.sy));
  const v = it.body.getLinearVelocity();
  addP({ type: 'shell', x: e.x, y: e.y, vx: v.x + up.x * rand(1.5, 2.6), vy: v.y + up.y * rand(1.5, 2.6), life: 6, size: g.shellSize || 0.016, rot: rand(0, TAU), w: rand(-25, 25), color: g.shellCol || C.brass });
}
function fireGun(it) {
  const g = it.def.gun, b = it.body;
  const m = it.wp(g.muzzle[0], g.muzzle[1]);
  const fwd = it.fwd();
  const a0 = Math.atan2(fwd.y, fwd.x);
  for (let i = 0; i < (g.pellets || 1); i++) {
    const a = a0 + rand(-1, 1) * (g.spread || 0);
    Combat.fireBullet({ x: m.x, y: m.y, dx: Math.cos(a), dy: Math.sin(a), dmg: g.dmg, pen: g.pen, src: b, ignoreEnt: it, knock: g.knock || 4,
      caliber: g.caliber || 1, dismember: g.dismember, tracer: g.tracer, tw: g.tw, apMul: g.apMul });
  }
  b.applyLinearImpulse(v2(-fwd.x * g.recoil, -fwd.y * g.recoil), m, true);
  b.applyAngularImpulse((g.kick || g.recoil * 0.02) * it.sy, true);
  muzzleFx(it, m, fwd, g.flash || 1);
  ejectShell(it, g);
  Sound.play(g.sound, g.vol || 1, 0.02);
  it.cool = g.rate;
  it.st.shot = G.time;
}
function gunDef(d) {
  d.cat = d.cat || 'guns';
  d.mat = d.mat || 'metal';
  d.bullet = true;
  const g = d.gun;
  if (g.auto) {
    d.activate = (it) => { it.st.trigger = true; if (it.cool <= 0) fireGun(it); };
    d.hold = (it) => { if (it.cool <= 0) fireGun(it); };
    d.release = (it) => { it.st.trigger = false; };
  } else {
    d.activate = (it) => {
      if (it.cool > 0) return;
      fireGun(it);
      if (g.pump) { defer(() => { if (!it.dead) { Sound.play('pump', 0.6); it.st.pump = G.time; } }, 0.25); }
      if (g.bolt) { defer(() => { if (!it.dead) { Sound.play('pump', 0.4); it.st.pump = G.time; } }, 0.45); }
    };
  }
  return defItem(d);
}

gunDef({
  id: 'pistol', name: 'Pistol', desc: '9 mm semi-automatic. Reliable and quick.', mass: 1.0,
  fix: [{ box: [0.145, 0.03, 0.08, 0.045] }, { poly: [[-0.06, 0.02], [0.0, 0.02], [-0.025, -0.11], [-0.082, -0.105]], mat: 'plastic' }],
  gun: { muzzle: [0.225, 0.05], eject: [0.05, 0.08], dmg: 26, pen: 34, rate: 0.16, recoil: 2.2, kick: 0.12, spread: 0.012, sound: 'pistol', knock: 5 },
  draw(ctx, it) {
    const kick = clamp(1 - (G.time - (it.st.shot || -9)) / 0.08, 0, 1) * 0.035;
    fillPoly(ctx, [-0.058, 0.02, 0.002, 0.02, -0.022, -0.112, -0.083, -0.106], C.poly, C.rim);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.004;
    for (let i = 0; i < 5; i++) line(ctx, -0.06 + i * 0.006, -0.02 - i * 0.016, -0.02 + i * 0.006, -0.02 - i * 0.016, 'rgba(0,0,0,0.3)', 0.004);
    fillRR(ctx, -0.06, -0.002, 0.24, 0.036, 0.008, C.gunD, C.rim);
    ctx.strokeStyle = C.gunD; ctx.lineWidth = 0.009;
    ctx.beginPath(); ctx.moveTo(0.0, -0.002); ctx.quadraticCurveTo(0.005, -0.05, 0.06, -0.04); ctx.lineTo(0.07, -0.002); ctx.stroke();
    line(ctx, 0.03, -0.004, 0.025, -0.03, C.gunL, 0.008);
    fillRR(ctx, -0.066 - kick, 0.024, 0.292, 0.052, 0.01, C.gun, C.rim);
    for (let i = 0; i < 4; i++) line(ctx, -0.055 - kick + i * 0.009, 0.03, -0.055 - kick + i * 0.009, 0.07, 'rgba(0,0,0,0.35)', 0.003);
    fillRR(ctx, 0.03 - kick, 0.058, 0.05, 0.014, 0.003, '#15171a');
    ctx.fillStyle = C.gunD; ctx.fillRect(0.2 - kick, 0.075, 0.012, 0.01); ctx.fillRect(-0.06 - kick, 0.075, 0.016, 0.01);
  },
});

gunDef({
  id: 'revolver', name: 'Revolver', desc: '.44 Magnum. Six rounds of heavy, punishing recoil.', mass: 1.5,
  fix: [{ box: [0.13, 0.022, 0.15, 0.05] }, { box: [0.06, 0.042, -0.0, 0.038] }, { poly: [[-0.07, 0.03], [-0.02, 0.0], [-0.06, -0.12], [-0.12, -0.1]], mat: 'wood' }],
  gun: { muzzle: [0.28, 0.052], dmg: 48, pen: 55, rate: 0.42, recoil: 4.5, kick: 0.35, spread: 0.008, sound: 'revolver', knock: 9, caliber: 1.4, flash: 1.3 },
  draw(ctx, it) {
    fillPoly(ctx, [-0.07, 0.03, -0.02, 0.0, -0.058, -0.122, -0.122, -0.104], C.woodD, C.rim);
    for (let i = 0; i < 4; i++) line(ctx, -0.07 + i * 0.008, -0.03 - i * 0.02, -0.035 + i * 0.008, -0.03 - i * 0.02, 'rgba(0,0,0,0.25)', 0.004);
    fillPoly(ctx, [-0.075, 0.07, 0.07, 0.07, 0.07, 0.005, -0.03, -0.005, -0.075, 0.03], C.steelD, C.rim);
    ctx.strokeStyle = C.steelD; ctx.lineWidth = 0.008;
    ctx.beginPath(); ctx.moveTo(-0.02, 0.0); ctx.quadraticCurveTo(-0.01, -0.045, 0.04, -0.035); ctx.lineTo(0.05, 0.0); ctx.stroke();
    fillRR(ctx, -0.038, 0.008, 0.085, 0.064, 0.014, C.steel, C.rim);
    for (let i = 0; i < 3; i++) fillRR(ctx, -0.03 + i * 0.026, 0.02, 0.016, 0.04, 0.006, 'rgba(0,0,0,0.25)');
    fillRR(ctx, 0.05, 0.03, 0.23, 0.043, 0.006, C.steel, C.rim);
    line(ctx, 0.05, 0.06, 0.27, 0.06, 'rgba(255,255,255,0.3)', 0.004);
    ctx.fillStyle = C.steelD; ctx.fillRect(0.255, 0.073, 0.014, 0.014);
    fillPoly(ctx, [-0.078, 0.07, -0.1, 0.09, -0.11, 0.08, -0.085, 0.06], C.steelD);
  },
});

gunDef({
  id: 'smg', name: 'SMG', desc: 'Compact submachine gun. Hold to spray.', mass: 2.6,
  fix: [{ box: [0.18, 0.04, 0.02, 0.04] }, { box: [0.06, 0.02, 0.26, 0.04] }, { box: [0.02, 0.09, 0.03, -0.08], mat: 'plastic' }, { box: [0.022, 0.06, -0.1, -0.05], mat: 'plastic' }],
  gun: { muzzle: [0.33, 0.04], eject: [0.05, 0.08], dmg: 17, pen: 24, rate: 0.065, auto: true, recoil: 1.1, kick: 0.06, spread: 0.04, sound: 'smg', knock: 3, flash: 0.8 },
  draw(ctx) {
    ctx.strokeStyle = C.gunD; ctx.lineWidth = 0.012;
    ctx.beginPath(); ctx.moveTo(-0.16, 0.06); ctx.lineTo(-0.36, 0.05); ctx.lineTo(-0.36, -0.02); ctx.lineTo(-0.16, 0.0); ctx.stroke();
    fillRR(ctx, -0.38, -0.035, 0.02, 0.1, 0.005, C.poly, C.rim);
    fillPoly(ctx, [-0.12, 0.005, -0.075, 0.005, -0.085, -0.11, -0.128, -0.105], C.poly, C.rim);
    fillPoly(ctx, [0.012, 0.0, 0.05, 0.0, 0.058, -0.17, 0.022, -0.17], C.gunD, C.rim);
    fillRR(ctx, -0.165, 0.0, 0.37, 0.08, 0.012, C.gun, C.rim);
    fillRR(ctx, 0.2, 0.022, 0.1, 0.038, 0.006, C.gunD, C.rim);
    for (let i = 0; i < 4; i++) fillCircle(ctx, 0.215 + i * 0.022, 0.041, 0.006, '#15171a');
    fillRR(ctx, 0.3, 0.03, 0.035, 0.02, 0.004, C.gunD);
    fillRR(ctx, 0.02, 0.06, 0.06, 0.014, 0.003, '#15171a');
    fillRR(ctx, -0.1, 0.08, 0.2, 0.012, 0.003, C.gunD);
  },
});

gunDef({
  id: 'rifle', name: 'Assault Rifle', desc: 'Full-auto 5.56. Accurate, penetrates well.', mass: 3.6,
  fix: [{ box: [0.24, 0.045, -0.0, 0.045] }, { box: [0.15, 0.035, 0.38, 0.045] }, { box: [0.1, 0.012, 0.62, 0.045] }, { box: [0.17, 0.04, -0.4, 0.02], mat: 'plastic' }, { box: [0.025, 0.08, 0.1, -0.07], mat: 'plastic' }],
  gun: { muzzle: [0.72, 0.045], eject: [0.06, 0.09], dmg: 30, pen: 60, rate: 0.095, auto: true, recoil: 1.8, kick: 0.09, spread: 0.014, sound: 'rifle', knock: 6, caliber: 1.1 },
  draw(ctx) {
    fillPoly(ctx, [-0.22, 0.075, -0.56, 0.06, -0.58, -0.035, -0.5, -0.04, -0.22, 0.005], C.poly, C.rim);
    fillRR(ctx, -0.56, -0.04, 0.025, 0.1, 0.006, '#202226');
    fillPoly(ctx, [-0.14, 0.005, -0.09, 0.005, -0.1, -0.11, -0.15, -0.1], C.poly, C.rim);
    fillPoly(ctx, [0.075, 0.0, 0.13, 0.0, 0.165, -0.16, 0.11, -0.168], C.gunD, C.rim);
    for (let i = 0; i < 4; i++) line(ctx, 0.08 + i * 0.008, -0.03 - i * 0.035, 0.13 + i * 0.008, -0.03 - i * 0.035, 'rgba(255,255,255,0.08)', 0.004);
    fillRR(ctx, -0.24, 0.0, 0.48, 0.09, 0.01, C.gun, C.rim);
    fillRR(ctx, 0.0, 0.06, 0.08, 0.016, 0.004, '#15171a');
    fillRR(ctx, 0.23, 0.012, 0.3, 0.068, 0.012, C.gunD, C.rim);
    for (let i = 0; i < 6; i++) fillRR(ctx, 0.25 + i * 0.045, 0.025, 0.028, 0.042, 0.005, 'rgba(0,0,0,0.35)');
    fillRR(ctx, 0.53, 0.035, 0.18, 0.022, 0.004, C.gunD, C.rim);
    fillRR(ctx, 0.68, 0.03, 0.045, 0.032, 0.004, '#1c1e22');
    fillPoly(ctx, [0.5, 0.075, 0.52, 0.12, 0.535, 0.12, 0.54, 0.075], C.gunD);
    fillRR(ctx, -0.16, 0.09, 0.36, 0.022, 0.004, '#25282d');
    fillPoly(ctx, [-0.12, 0.11, -0.1, 0.14, -0.06, 0.14, -0.04, 0.11], C.gunD);
  },
});

gunDef({
  id: 'shotgun', name: 'Pump Shotgun', desc: '12 gauge, nine pellets per shell. Devastating up close.', mass: 3.4,
  fix: [{ box: [0.33, 0.018, 0.32, 0.06] }, { box: [0.12, 0.045, -0.05, 0.045] }, { box: [0.22, 0.04, -0.4, 0.03], mat: 'wood' }, { box: [0.09, 0.022, 0.3, 0.02], mat: 'wood' }],
  gun: { muzzle: [0.65, 0.06], eject: [-0.02, 0.09], dmg: 13, pen: 20, pellets: 9, spread: 0.075, rate: 0.85, recoil: 6, kick: 0.45, sound: 'shotgun', knock: 4, pump: true, flash: 1.6, shellCol: '#b8322c', shellSize: 0.022 },
  draw(ctx, it) {
    const pt = clamp((G.time - (it.st.pump || -9)) / 0.3, 0, 1);
    const po = Math.sin(pt * Math.PI) * -0.08;
    fillPoly(ctx, [-0.17, 0.08, -0.62, 0.055, -0.64, -0.035, -0.55, -0.03, -0.17, 0.005], C.wood, C.rim);
    line(ctx, -0.6, 0.02, -0.25, 0.04, 'rgba(0,0,0,0.18)', 0.004);
    fillRR(ctx, -0.64, -0.04, 0.025, 0.1, 0.006, '#1d1d20');
    fillRR(ctx, -0.17, 0.0, 0.24, 0.09, 0.01, C.gunD, C.rim);
    fillRR(ctx, -0.06, 0.05, 0.08, 0.02, 0.004, '#121316');
    ctx.strokeStyle = C.gunD; ctx.lineWidth = 0.008;
    ctx.beginPath(); ctx.moveTo(-0.07, 0.0); ctx.quadraticCurveTo(-0.06, -0.045, -0.01, -0.035); ctx.lineTo(0.0, 0.0); ctx.stroke();
    fillRR(ctx, 0.06, 0.004, 0.46, 0.032, 0.008, C.gun, C.rim);
    fillRR(ctx, 0.06, 0.042, 0.6, 0.034, 0.008, C.gun, C.rim);
    line(ctx, 0.07, 0.068, 0.64, 0.068, 'rgba(255,255,255,0.22)', 0.004);
    fillRR(ctx, 0.2 + po, -0.005, 0.18, 0.05, 0.012, C.woodD, C.rim);
    for (let i = 0; i < 6; i++) line(ctx, 0.215 + po + i * 0.026, 0.0, 0.215 + po + i * 0.026, 0.04, 'rgba(0,0,0,0.3)', 0.005);
    fillCircle(ctx, 0.64, 0.085, 0.008, C.steelL);
  },
});

gunDef({
  id: 'sniper', name: 'Sniper Rifle', desc: '.50 cal bolt-action. Punches through several targets and takes limbs off.', mass: 7,
  fix: [{ box: [0.24, 0.045, -0.02, 0.04] }, { box: [0.34, 0.018, 0.55, 0.05] }, { box: [0.22, 0.05, -0.45, 0.02], mat: 'plastic' }, { box: [0.17, 0.03, 0.0, 0.14] }],
  gun: { muzzle: [0.92, 0.05], eject: [0.05, 0.09], dmg: 110, pen: 190, rate: 1.4, recoil: 12, kick: 0.9, spread: 0.0, sound: 'sniper', knock: 24, caliber: 2.2, dismember: true, bolt: true, flash: 1.8, tracer: '255,240,200', tw: 0.03, shellSize: 0.024, apMul: 0.6 },
  draw(ctx, it) {
    fillPoly(ctx, [-0.24, 0.075, -0.66, 0.07, -0.68, -0.05, -0.6, -0.055, -0.4, -0.01, -0.24, -0.0], '#3d4237', C.rim);
    fillPoly(ctx, [-0.6, 0.07, -0.36, 0.075, -0.38, 0.11, -0.58, 0.1], '#353a30');
    fillRR(ctx, -0.69, -0.06, 0.03, 0.135, 0.006, '#1c1d1f');
    fillPoly(ctx, [-0.16, 0.005, -0.1, 0.005, -0.12, -0.11, -0.18, -0.1], '#3d4237', C.rim);
    fillRR(ctx, -0.26, 0.0, 0.5, 0.085, 0.01, C.gunD, C.rim);
    const bt = clamp((G.time - (it.st.pump || -9)) / 0.4, 0, 1);
    const bo = Math.sin(bt * Math.PI) * -0.07;
    line(ctx, -0.1 + bo, 0.06, -0.12 + bo, 0.0, C.steel, 0.012);
    fillCircle(ctx, -0.122 + bo, -0.005, 0.014, C.steelL);
    fillRR(ctx, 0.22, 0.032, 0.66, 0.036, 0.006, C.gun, C.rim);
    fillRR(ctx, 0.84, 0.02, 0.09, 0.06, 0.008, '#1c1e22', C.rim);
    for (let i = 0; i < 3; i++) fillRR(ctx, 0.855 + i * 0.024, 0.015, 0.01, 0.07, 0.002, '#0d0e10');
    fillRR(ctx, -0.12, 0.085, 0.03, 0.04, 0.004, C.gunD); fillRR(ctx, 0.07, 0.085, 0.03, 0.04, 0.004, C.gunD);
    fillRR(ctx, -0.17, 0.11, 0.34, 0.06, 0.025, '#24272c', C.rim);
    fillRR(ctx, 0.15, 0.1, 0.06, 0.08, 0.02, '#24272c', C.rim);
    fillRR(ctx, -0.2, 0.105, 0.05, 0.07, 0.015, '#24272c', C.rim);
    fillCircle(ctx, 0.2, 0.14, 0.022, 'rgba(120,180,255,0.35)');
    fillCircle(ctx, 0.196, 0.147, 0.007, 'rgba(255,255,255,0.7)');
    line(ctx, 0.45, 0.03, 0.42, -0.09, C.gunD, 0.012); line(ctx, 0.45, 0.03, 0.5, -0.09, C.gunD, 0.012);
  },
});

gunDef({
  id: 'minigun', name: 'Minigun', desc: 'Six spinning barrels. Hold to spin up, then shred.', mass: 18,
  fix: [{ box: [0.24, 0.11, 0.0, 0.02] }, { box: [0.36, 0.06, 0.58, 0.02] }, { box: [0.12, 0.08, -0.05, -0.17], mat: 'metal' }],
  gun: { muzzle: [0.95, 0.02], eject: [0.0, -0.08], dmg: 22, pen: 40, rate: 0.035, recoil: 1.4, kick: 0.05, spread: 0.035, sound: 'minigun', knock: 5, flash: 1.0, vol: 0.8 },
  init(it) { it.st.spin = 0; it.st.rot = 0; },
  activate(it) { it.st.trigger = true; },
  hold(it, dt) { it.st.trigger = true; },
  release(it) { it.st.trigger = false; },
  update(it, dt) {
    const s = it.st;
    s.spin = clamp(s.spin + (s.trigger ? dt / 0.6 : -dt / 1.2), 0, 1);
    s.rot += s.spin * dt * 60;
    if (s.spin > 0.02) {
      if (!it.hum) it.hum = Sound.hum(60, 0.06);
      if (it.hum) it.hum.set(60 + s.spin * 140, 0.05 * s.spin);
    } else if (it.hum) { it.hum.stop(); it.hum = null; }
    if (s.trigger && s.spin >= 1 && it.cool <= 0) fireGun(it);
    s.trigger = false;
  },
  draw(ctx, it) {
    fillRR(ctx, -0.12, -0.27, 0.22, 0.17, 0.015, C.oliveD, C.rim);
    line(ctx, -0.1, -0.2, 0.08, -0.2, 'rgba(0,0,0,0.3)', 0.008);
    fillRR(ctx, -0.26, -0.1, 0.5, 0.24, 0.03, C.gunD, C.rim);
    ctx.strokeStyle = '#25272b'; ctx.lineWidth = 0.025;
    ctx.beginPath(); ctx.moveTo(-0.16, 0.14); ctx.quadraticCurveTo(-0.05, 0.27, 0.08, 0.14); ctx.stroke();
    fillRR(ctx, 0.2, -0.06, 0.08, 0.16, 0.012, C.gun, C.rim);
    const r = (it.st && it.st.rot) || 0;
    for (let i = 0; i < 6; i++) {
      const y = 0.02 + Math.sin(r + i * TAU / 6) * 0.04;
      const depth = Math.cos(r + i * TAU / 6);
      fillRR(ctx, 0.25, y - 0.011, 0.7, 0.022, 0.005, depth > 0 ? C.steel : C.steelD);
    }
    fillRR(ctx, 0.48, -0.05, 0.04, 0.14, 0.008, C.gunD); fillRR(ctx, 0.88, -0.05, 0.04, 0.14, 0.008, C.gunD);
    if (it.st && it.st.spin > 0.1) glow(ctx, 0.6, 0.02, 0.2, '255,120,60', it.st.spin * 0.15);
  },
});

/* crossbow + bolt */
defItem({
  id: 'bolt', name: 'Crossbow Bolt', hidden: true, mat: 'wood', mass: 0.12, bullet: true, life: 90, cat: 'guns',
  fix: [{ box: [0.2, 0.01, -0.02, 0] }, { poly: [[0.18, 0.016], [0.25, 0], [0.18, -0.016]], mat: 'metal', ud: { sharp: 'tip', stab: 14, thr: 2.5, depth: 0.36, friction: 160, breakF: 5000 } }],
  update(it, dt) {
    // fly point-first
    const b = it.body, v = b.getLinearVelocity();
    const sp = v.length();
    if (sp > 6 && !(b.getUserData().impales || []).length) {
      const want = Math.atan2(v.y, v.x);
      const err = angNorm(want - b.getAngle());
      b.setAngularVelocity(b.getAngularVelocity() * 0.9 + err * 18 * 0.1);
    }
  },
  draw(ctx) {
    line(ctx, -0.22, 0, 0.19, 0, C.woodL, 0.016);
    fillPoly(ctx, [0.18, 0.017, 0.255, 0, 0.18, -0.017], C.steel, C.rim);
    fillPoly(ctx, [-0.22, 0.0, -0.17, 0.0, -0.21, 0.04, -0.25, 0.04], '#c23b3b');
    fillPoly(ctx, [-0.22, 0.0, -0.17, 0.0, -0.21, -0.04, -0.25, -0.04], '#c23b3b');
  },
});
defItem({
  id: 'crossbow', name: 'Crossbow', desc: 'Fires heavy bolts that pin targets to walls.', cat: 'guns', mat: 'wood', mass: 3.2, bullet: true,
  fix: [{ box: [0.32, 0.03, -0.06, 0.02] }, { box: [0.025, 0.24, 0.24, 0.03], mat: 'metal' }, { poly: [[-0.1, 0.0], [-0.05, 0.0], [-0.07, -0.1], [-0.12, -0.1]] }],
  init(it) { it.st.loaded = true; },
  activate(it) {
    if (!it.st.loaded) return;
    it.st.loaded = false;
    const m = it.wp(0.32, 0.045), f = it.fwd(), v = it.body.getLinearVelocity();
    const bolt = new Item(ITEM.bolt, m.x, m.y, false, Math.atan2(f.y, f.x));
    bolt.body.setLinearVelocity(v2(v.x + f.x * 58, v.y + f.y * 58));
    G.noCollide.set(pairKey(bolt.body, it.body), G.time + 0.2);
    it.body.applyLinearImpulse(v2(-f.x * 2, -f.y * 2), m, true);
    Sound.play('crossbow', 1);
    defer(() => { if (!it.dead) { it.st.loaded = true; Sound.play('pump', 0.3); } }, 1.1);
    let n = 0; for (const e of G.entities) if (e.def === ITEM.bolt) n++;
    if (n > 40) { const old = G.entities.find((e) => e.def === ITEM.bolt); if (old) old.remove(); }
  },
  draw(ctx, it) {
    const loaded = it.st.loaded !== false;
    fillPoly(ctx, [-0.1, 0.0, -0.05, 0.0, -0.075, -0.105, -0.125, -0.1], C.woodD, C.rim);
    fillPoly(ctx, [-0.38, 0.05, 0.26, 0.05, 0.26, -0.005, -0.18, -0.01, -0.38, -0.05], C.wood, C.rim);
    line(ctx, -0.35, 0.01, 0.2, 0.025, 'rgba(0,0,0,0.2)', 0.004);
    const sx = loaded ? -0.09 : 0.235;
    ctx.strokeStyle = '#d8d0bd'; ctx.lineWidth = 0.006;
    ctx.beginPath(); ctx.moveTo(0.2, 0.27); ctx.lineTo(sx, 0.045); ctx.lineTo(0.2, -0.21); ctx.stroke();
    ctx.strokeStyle = '#2a2d31'; ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.moveTo(0.19, 0.28); ctx.quadraticCurveTo(0.29, 0.03, 0.19, -0.22); ctx.stroke();
    if (loaded) {
      line(ctx, -0.09, 0.055, 0.3, 0.055, C.woodL, 0.012);
      fillPoly(ctx, [0.3, 0.068, 0.35, 0.055, 0.3, 0.042], C.steel);
      fillPoly(ctx, [-0.09, 0.055, -0.05, 0.055, -0.08, 0.085, -0.11, 0.085], '#c23b3b');
    }
    fillRR(ctx, -0.02, 0.05, 0.06, 0.03, 0.006, C.gunD);
  },
});

/* RPG + rocket */
defItem({
  id: 'rocket', name: 'Rocket', hidden: true, mat: 'metal', mass: 2.2, bullet: true, cat: 'explosives',
  fix: [{ box: [0.2, 0.045, 0, 0] }, { poly: [[0.2, 0.045], [0.32, 0], [0.2, -0.045]] }],
  init(it) { it.st.t = 0; it.body.setGravityScale(0.35); it.body.getUserData().onTouch = (b, ob) => { if (G.time - it.born > 0.04 && !it.st.boom) { it.st.boom = true; defer(() => { if (!it.dead) { const p = it.body.getPosition(); it.remove(); Combat.explode(p.x, p.y, { r: 4.5, power: 110, dmg: 120, fire: true, shrapnel: 10 }); } }); } }; },
  update(it, dt) {
    it.st.t += dt;
    const b = it.body;
    const f = b.getWorldVector(v2(1, 0));
    if (it.st.t < 1.4) b.applyForceToCenter(v2(f.x * 420, f.y * 420), true);
    const v = b.getLinearVelocity();
    if (v.length() > 3) { const err = angNorm(Math.atan2(v.y, v.x) - b.getAngle()); b.setAngularVelocity(err * 12); }
    const tail = b.getWorldPoint(v2(-0.22, 0));
    if (it.st.t < 1.4) {
      addP({ type: 'fire', x: tail.x, y: tail.y, vx: -f.x * 3 + rand(-0.4, 0.4), vy: -f.y * 3 + rand(-0.4, 0.4), life: rand(0.08, 0.18), size: rand(0.08, 0.14) });
      R.frameLights && addLight(tail.x, tail.y, 1.2, '255,170,80', 0.35);
    }
    if (Math.random() < 0.8) smoke(tail.x, tail.y, 1, 0.12, 'rgba(160,160,165,', 2.2, -f.x * 0.5, -f.y * 0.5);
    if (it.st.t > 7 && !it.st.boom) { it.st.boom = true; const p = b.getPosition(); it.remove(); Combat.explode(p.x, p.y, { r: 4.5, power: 110, dmg: 120, fire: true }); }
  },
  draw(ctx) {
    fillRR(ctx, -0.2, -0.045, 0.4, 0.09, 0.02, '#5c6b46', C.rim);
    fillPoly(ctx, [0.2, 0.045, 0.33, 0, 0.2, -0.045], '#3d4630', C.rim);
    fillPoly(ctx, [-0.2, 0.045, -0.26, 0.09, -0.14, 0.045], '#3d4630');
    fillPoly(ctx, [-0.2, -0.045, -0.26, -0.09, -0.14, -0.045], '#3d4630');
    line(ctx, 0.08, -0.045, 0.08, 0.045, '#c9a14a', 0.012);
  },
});
defItem({
  id: 'rpg', name: 'RPG Launcher', desc: 'Shoulder-fired rocket. Explodes on impact.', cat: 'explosives', mat: 'metal', mass: 7, bullet: true,
  fix: [{ box: [0.58, 0.055, 0.02, 0.06] }, { box: [0.025, 0.08, -0.12, -0.04] }, { box: [0.025, 0.07, 0.12, -0.03] }],
  init(it) { it.st.loaded = true; },
  activate(it) {
    if (!it.st.loaded) return;
    it.st.loaded = false;
    const f = it.fwd(), m = it.wp(0.7, 0.06), back = it.wp(-0.6, 0.06), v = it.body.getLinearVelocity();
    const r = new Item(ITEM.rocket, m.x, m.y, false, Math.atan2(f.y, f.x));
    r.body.setLinearVelocity(v2(v.x + f.x * 24, v.y + f.y * 24));
    G.noCollide.set(pairKey(r.body, it.body), G.time + 0.3);
    it.body.applyLinearImpulse(v2(-f.x * 6, -f.y * 6), m, true);
    for (let i = 0; i < 14; i++) smoke(back.x, back.y, 1, 0.2, 'rgba(170,170,175,', 2, -f.x * rand(2, 5), -f.y * rand(2, 5));
    addP({ type: 'flash', x: back.x, y: back.y, life: 0.08, size: 0.6 });
    Sound.play('rocket', 1);
    defer(() => { if (!it.dead) { it.st.loaded = true; Sound.play('pump', 0.4); } }, 2.2);
  },
  draw(ctx, it) {
    fillRR(ctx, -0.14, -0.13, 0.05, 0.13, 0.01, C.oliveD, C.rim);
    fillRR(ctx, 0.1, -0.11, 0.045, 0.11, 0.01, C.oliveD, C.rim);
    fillRR(ctx, -0.58, 0.005, 1.2, 0.11, 0.02, C.olive, C.rim);
    fillRR(ctx, -0.6, -0.005, 0.06, 0.13, 0.01, C.oliveD);
    fillRR(ctx, 0.56, -0.005, 0.06, 0.13, 0.01, C.oliveD);
    line(ctx, -0.5, 0.09, 0.5, 0.09, 'rgba(255,255,255,0.08)', 0.01);
    fillRR(ctx, -0.05, 0.115, 0.12, 0.04, 0.008, C.gunD, C.rim);
    if (it.st.loaded !== false) {
      fillPoly(ctx, [0.62, 0.115, 0.7, 0.13, 0.86, 0.06, 0.7, -0.01, 0.62, 0.005], '#5c6b46', C.rim);
      line(ctx, 0.7, 0.0, 0.7, 0.12, '#c9a14a', 0.01);
    }
  },
});

/* flamethrower */
defItem({
  id: 'flamethrower', name: 'Flamethrower', desc: 'Hold to spray burning fuel. Sets dummies and wood alight.', cat: 'guns', mat: 'metal', mass: 6, bullet: true,
  fix: [{ box: [0.3, 0.03, 0.35, 0.04] }, { box: [0.17, 0.09, -0.1, -0.04] }, { box: [0.02, 0.07, 0.1, -0.06] }],
  hold(it, dt) { it.st.on = 0.08; },
  activate(it) { it.st.on = 0.08; },
  update(it, dt) {
    if (it.st.on > 0) {
      it.st.on -= dt;
      const f = it.fwd(), m = it.wp(0.68, 0.04), v = it.body.getLinearVelocity();
      for (let i = 0; i < 2; i++) {
        const a = Math.atan2(f.y, f.x) + rand(-0.08, 0.08), s = rand(9, 13);
        addP({ type: 'flame', x: m.x, y: m.y, vx: v.x + Math.cos(a) * s, vy: v.y + Math.sin(a) * s, life: rand(0.5, 0.8), size: 0.06, src: it.body });
      }
      addLight(m.x + f.x * 1.5, m.y + f.y * 1.5, 3, '255,140,60', 0.35);
      if (!it.hum) it.hum = Sound.hum(45, 0.08);
      it.body.applyForceToCenter(v2(-f.x * 30, -f.y * 30), true);
    } else if (it.hum) { it.hum.stop(); it.hum = null; }
  },
  lightFx(it) { const m = it.wp(0.68, 0.04); addLight(m.x, m.y, 0.25, '120,170,255', 0.5); },
  draw(ctx) {
    fillRR(ctx, -0.28, -0.13, 0.36, 0.18, 0.08, '#8a2a22', C.rim);
    line(ctx, -0.24, -0.04, 0.04, -0.04, 'rgba(0,0,0,0.25)', 0.01);
    fillRR(ctx, -0.12, 0.04, 0.05, 0.03, 0.006, C.steel);
    fillPoly(ctx, [0.08, 0.01, 0.13, 0.01, 0.12, -0.13, 0.08, -0.12], C.poly, C.rim);
    fillRR(ctx, 0.05, 0.01, 0.6, 0.06, 0.015, C.gunD, C.rim);
    for (let i = 0; i < 6; i++) fillRR(ctx, 0.25 + i * 0.05, 0.005, 0.02, 0.07, 0.004, '#1c1e21');
    fillRR(ctx, 0.62, 0.0, 0.07, 0.08, 0.01, C.steelD, C.rim);
    fillCircle(ctx, 0.7, 0.04, 0.012, 'rgba(120,170,255,0.9)');
  },
});

/* ============================================================ MELEE */
defItem({
  id: 'knife', name: 'Combat Knife', desc: 'Light and sharp. Throw it and it sticks.', cat: 'melee', mat: 'metal', mass: 0.35, bullet: true,
  fix: [{ box: [0.055, 0.017, -0.055, 0], mat: 'plastic' }, { box: [0.08, 0.018, 0.08, 0.002], ud: { sharp: 'edge', ny: -1, cut: 2.6, thr: 3.6 } },
    { poly: [[0.158, 0.02], [0.215, 0.012], [0.158, -0.016]], ud: { sharp: 'tip', stab: 5, thr: 2.6, depth: 0.17, friction: 150, breakF: 4500 } }],
  draw(ctx) {
    fillRR(ctx, -0.115, -0.019, 0.115, 0.038, 0.012, '#26282c', C.rim);
    for (let i = 0; i < 4; i++) line(ctx, -0.1 + i * 0.022, -0.017, -0.1 + i * 0.022, 0.017, 'rgba(255,255,255,0.08)', 0.005);
    fillRR(ctx, -0.004, -0.03, 0.012, 0.06, 0.003, C.steelD);
    fillPoly(ctx, [0.008, 0.02, 0.16, 0.022, 0.215, 0.012, 0.15, -0.016, 0.008, -0.016], C.steelL, C.rim);
    line(ctx, 0.01, 0.012, 0.15, 0.013, 'rgba(0,0,0,0.25)', 0.004);
  },
});

defItem({
  id: 'sword', name: 'Longsword', desc: 'Double-edged arming sword. Slashes and thrusts.', cat: 'melee', mat: 'metal', mass: 1.7, bullet: true,
  fix: [{ box: [0.1, 0.019, -0.1, 0], mat: 'wood' }, { circle: [0.03, -0.215, 0] }, { box: [0.014, 0.085, 0.006, 0] },
    { box: [0.4, 0.03, 0.42, 0], ud: { sharp: 'edge', both: true, ny: 1, cut: 3.4, thr: 4.0 } },
    { poly: [[0.82, 0.03], [0.96, 0], [0.82, -0.03]], ud: { sharp: 'tip', stab: 4.5, thr: 3.2, depth: 0.78, friction: 260, breakF: 9000 } }],
  draw(ctx) {
    fillRR(ctx, -0.2, -0.02, 0.2, 0.04, 0.012, '#4b3322', C.rim);
    for (let i = 0; i < 7; i++) line(ctx, -0.19 + i * 0.027, -0.02, -0.18 + i * 0.027, 0.02, 'rgba(0,0,0,0.3)', 0.006);
    fillCircle(ctx, -0.215, 0, 0.032, C.brass, C.rim);
    fillRR(ctx, -0.008, -0.088, 0.028, 0.176, 0.008, C.brass, C.rim);
    fillPoly(ctx, [0.02, 0.032, 0.82, 0.03, 0.965, 0, 0.82, -0.03, 0.02, -0.032], C.steelL, C.rim);
    line(ctx, 0.03, 0, 0.82, 0, 'rgba(0,0,0,0.22)', 0.008);
  },
});

defItem({
  id: 'katana', name: 'Katana', desc: 'Curved single-edge blade. Very sharp, cuts clean.', cat: 'melee', mat: 'metal', mass: 1.25, bullet: true,
  fix: [{ box: [0.13, 0.019, -0.13, 0], mat: 'wood' }, { box: [0.01, 0.05, 0.0, 0] },
    { box: [0.2, 0.022, 0.21, 0.005, 0.03], ud: { sharp: 'edge', ny: -1, cut: 4.2, thr: 3.8 } },
    { box: [0.19, 0.02, 0.59, 0.024, 0.07], ud: { sharp: 'edge', ny: -1, cut: 4.2, thr: 3.8 } },
    { poly: [[0.76, 0.05], [0.86, 0.06], [0.77, 0.018]], ud: { sharp: 'tip', stab: 4.5, thr: 3.2, depth: 0.66, friction: 230, breakF: 8000 } }],
  draw(ctx) {
    fillRR(ctx, -0.26, -0.02, 0.26, 0.04, 0.01, '#1e1f24', C.rim);
    ctx.strokeStyle = '#d8d0b8'; ctx.lineWidth = 0.005;
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(-0.25 + i * 0.03, 0.02); ctx.lineTo(-0.235 + i * 0.03, -0.02); ctx.moveTo(-0.235 + i * 0.03, 0.02); ctx.lineTo(-0.25 + i * 0.03, -0.02); ctx.stroke(); }
    fillRR(ctx, -0.27, -0.022, 0.02, 0.044, 0.004, C.brass);
    fillRR(ctx, -0.012, -0.05, 0.022, 0.1, 0.01, '#2c2c30', C.rim);
    ctx.beginPath();
    ctx.moveTo(0.01, 0.027); ctx.quadraticCurveTo(0.45, 0.05, 0.86, 0.062);
    ctx.lineTo(0.78, 0.02); ctx.quadraticCurveTo(0.42, -0.005, 0.01, -0.017); ctx.closePath();
    ctx.fillStyle = C.steelL; ctx.fill(); ctx.strokeStyle = C.rim; ctx.lineWidth = 0.008; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.004;
    ctx.beginPath(); ctx.moveTo(0.03, -0.008); ctx.quadraticCurveTo(0.45, 0.015, 0.78, 0.026); ctx.stroke();
  },
});

defItem({
  id: 'axe', name: 'Fire Axe', desc: 'Heavy head, chops limbs and crates.', cat: 'melee', mat: 'wood', mass: 2.8, bullet: true,
  fix: [{ box: [0.42, 0.022, 0, 0], density: 20 }, { box: [0.06, 0.045, 0.38, 0.0], mat: 'metal', density: 120 },
    { poly: [[0.33, 0.04], [0.43, 0.04], [0.47, 0.2], [0.3, 0.2]], mat: 'metal', density: 120, ud: { sharp: 'edge', ny: 1, cut: 4.6, thr: 3.8 } },
    { poly: [[0.34, -0.04], [0.42, -0.04], [0.385, -0.14]], mat: 'metal', density: 120 }],
  draw(ctx) {
    fillRR(ctx, -0.42, -0.022, 0.84, 0.044, 0.015, '#b8432f', C.rim);
    fillRR(ctx, -0.42, -0.024, 0.16, 0.048, 0.015, '#1f1f22');
    fillPoly(ctx, [0.32, -0.045, 0.44, -0.045, 0.44, 0.045, 0.32, 0.045], '#8c2f22', C.rim);
    fillPoly(ctx, [0.33, 0.04, 0.43, 0.04, 0.475, 0.205, 0.295, 0.205], '#8c2f22', C.rim);
    fillPoly(ctx, [0.3, 0.17, 0.47, 0.17, 0.475, 0.205, 0.295, 0.205], C.steelL);
    fillPoly(ctx, [0.34, -0.04, 0.42, -0.04, 0.385, -0.145], '#8c2f22', C.rim);
  },
});

defItem({
  id: 'spear', name: 'Spear', desc: 'Long reach. Thrown hard it skewers right through.', cat: 'melee', mat: 'wood', mass: 2.3, bullet: true,
  fix: [{ box: [1.0, 0.02, 0, 0] }, { box: [0.05, 0.026, 0.97, 0], mat: 'metal' },
    { poly: [[1.0, 0.04], [1.27, 0], [1.0, -0.04]], mat: 'metal', ud: { sharp: 'tip', stab: 6, thr: 2.8, depth: 0.9, friction: 330, breakF: 12000 } }],
  update(it) { const b = it.body, v = b.getLinearVelocity(); if (!Input.isHeld(b) && v.length() > 9 && !(b.getUserData().impales || []).length) { const err = angNorm(Math.atan2(v.y, v.x) - b.getAngle()); b.applyTorque(err * 30 - b.getAngularVelocity() * 3, true); } },
  draw(ctx) {
    fillRR(ctx, -1.0, -0.02, 1.98, 0.04, 0.02, C.woodL, C.rim);
    line(ctx, -0.95, 0.006, 0.9, 0.006, 'rgba(255,255,255,0.08)', 0.006);
    for (let i = 0; i < 6; i++) line(ctx, -0.25 + i * 0.03, -0.02, -0.24 + i * 0.03, 0.02, 'rgba(40,25,15,0.6)', 0.008);
    fillRR(ctx, 0.92, -0.028, 0.1, 0.056, 0.01, C.steelD, C.rim);
    fillPoly(ctx, [1.0, 0.045, 1.08, 0.04, 1.28, 0, 1.08, -0.04, 1.0, -0.045], C.steelL, C.rim);
    line(ctx, 1.02, 0, 1.22, 0, 'rgba(0,0,0,0.25)', 0.006);
  },
});

defItem({
  id: 'lance', name: 'Jousting Lance', desc: 'Three metres of cavalry lance. Kebab two dummies at once.', cat: 'melee', mat: 'wood', mass: 6.5, bullet: true,
  fix: [{ box: [0.16, 0.035, -0.46, 0] }, { poly: [[-0.3, 0.13], [-0.2, 0.06], [-0.2, -0.06], [-0.3, -0.13]], mat: 'metal' },
    { poly: [[-0.2, 0.065], [2.4, 0.024], [2.4, -0.024], [-0.2, -0.065]] },
    { poly: [[2.4, 0.024], [2.76, 0], [2.4, -0.024]], mat: 'metal', ud: { sharp: 'tip', stab: 7, thr: 2.6, depth: 1.5, friction: 420, breakF: 18000 } }],
  update(it) { const b = it.body, v = b.getLinearVelocity(); if (!Input.isHeld(b) && v.length() > 8 && !(b.getUserData().impales || []).length) { const err = angNorm(Math.atan2(v.y, v.x) - b.getAngle()); b.applyTorque(err * 120 - b.getAngularVelocity() * 12, true); } },
  draw(ctx) {
    fillRR(ctx, -0.62, -0.036, 0.42, 0.072, 0.02, '#3a2a20', C.rim);
    ctx.save();
    polyPath(ctx, [-0.2, 0.066, 2.4, 0.025, 2.4, -0.025, -0.2, -0.066]);
    ctx.fillStyle = '#e8e2d6'; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#b3262a';
    for (let x = -0.2; x < 2.4; x += 0.22) { polyPath(ctx, [x, 0.08, x + 0.11, 0.08, x + 0.05, -0.08, x - 0.06, -0.08]); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = C.rim; ctx.lineWidth = 0.01; polyPath(ctx, [-0.2, 0.066, 2.4, 0.025, 2.4, -0.025, -0.2, -0.066]); ctx.stroke();
    fillPoly(ctx, [-0.3, 0.135, -0.19, 0.06, -0.19, -0.06, -0.3, -0.135], C.steel, C.rim);
    fillPoly(ctx, [2.4, 0.026, 2.77, 0, 2.4, -0.026], C.steelL, C.rim);
  },
});

defItem({
  id: 'hammer', name: 'Sledgehammer', desc: 'Ten pounds of steel. Breaks bones, caves skulls.', cat: 'melee', mat: 'wood', mass: 5, bullet: true, blunt: 3.2,
  fix: [{ box: [0.45, 0.021, 0, 0], density: 18 }, { box: [0.075, 0.12, 0.5, 0], mat: 'metal', density: 220 }],
  draw(ctx) {
    fillRR(ctx, -0.45, -0.021, 0.9, 0.042, 0.015, '#c9a66b', C.rim);
    fillRR(ctx, -0.45, -0.023, 0.2, 0.046, 0.015, '#2b2b2e');
    fillRR(ctx, 0.425, -0.12, 0.15, 0.24, 0.02, '#5b6068', C.rim);
    fillRR(ctx, 0.425, -0.12, 0.15, 0.03, 0.01, '#7c828b'); fillRR(ctx, 0.425, 0.09, 0.15, 0.03, 0.01, '#7c828b');
  },
});

defItem({
  id: 'bat', name: 'Baseball Bat', desc: 'Ash wood slugger. Concussions guaranteed.', cat: 'melee', mat: 'wood', mass: 1.1, bullet: true, blunt: 2.7,
  fix: [{ poly: [[-0.42, 0.017], [0.0, 0.024], [0.45, 0.038], [0.47, 0], [0.45, -0.038], [0.0, -0.024], [-0.42, -0.017]] }, { circle: [0.027, -0.43, 0] }],
  draw(ctx) {
    fillPoly(ctx, [-0.42, 0.017, 0.0, 0.025, 0.45, 0.038, 0.47, 0, 0.45, -0.038, 0.0, -0.025, -0.42, -0.017], '#c8a774', C.rim);
    line(ctx, -0.35, 0.006, 0.42, 0.014, 'rgba(255,255,255,0.15)', 0.006);
    fillRR(ctx, -0.42, -0.02, 0.16, 0.04, 0.01, '#2a2a2e');
    fillCircle(ctx, -0.43, 0, 0.028, '#2a2a2e', C.rim);
  },
});

defItem({
  id: 'crowbar', name: 'Crowbar', desc: 'A trusty physicist\'s crowbar. Pries crates and skulls alike.', cat: 'melee', mat: 'metal', mass: 1.5, bullet: true, blunt: 2.4,
  fix: [{ box: [0.38, 0.014, 0, 0] }, { box: [0.045, 0.013, -0.41, 0.03, 0.9] }, { box: [0.032, 0.011, 0.395, 0.01, 0.3], ud: { sharp: 'tip', stab: 2.5, thr: 4, depth: 0.12, friction: 300 } }],
  draw(ctx) {
    ctx.strokeStyle = '#b8352a'; ctx.lineWidth = 0.03; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.42, 0.02); ctx.lineTo(0.37, 0.0); ctx.lineTo(-0.36, 0.0); ctx.quadraticCurveTo(-0.45, 0.0, -0.44, 0.06); ctx.lineTo(-0.4, 0.075); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.008;
    ctx.beginPath(); ctx.moveTo(0.35, 0.007); ctx.lineTo(-0.34, 0.007); ctx.stroke(); ctx.lineCap = 'butt';
  },
});

/* energy blades: virtual blade sampled every step */
function bladeCut(it, segs, mode, dt) {
  const b = it.body;
  const touched = new Map();
  for (const s of segs) {
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const lp = v2(lerp(s[0], s[2], t), lerp(s[1], s[3], t) * it.sy);
      const wpnt = b.getWorldPoint(lp);
      for (const fx of bodiesAt(wpnt)) {
        const ob = fx.getBody();
        if (ob === b || touched.has(ob)) continue;
        touched.set(ob, wpnt);
      }
    }
  }
  const prev = it.st.inside || new Map();
  for (const [ob, p] of touched) {
    const ud = ob.getUserData();
    const va = b.getLinearVelocityFromWorldPoint(p), vb = ob.getLinearVelocityFromWorldPoint(p);
    const rv = v2(va.x - vb.x, va.y - vb.y), sp = Math.hypot(rv.x, rv.y);
    const dir = sp > 0.1 ? v2(rv.x / sp, rv.y / sp) : it.fwd();
    const last = prev.get(ob);
    if (ud.part) {
      if (mode === 'energy') {
        if (!last) ud.ent.cutHit(ud.part, p, dir, 7 + sp * 2.6, { energy: true });
        else if (sp > 3 && G.time - last.t > 0.1) ud.ent.cutHit(ud.part, p, dir, sp * 1.4, { energy: true });
        else { touched.set(ob, last.p); }
      } else {
        if (!last || G.time - last.t > 0.07) {
          ud.ent.cutHit(ud.part, p, dir, 6 + sp * 0.8, {});
          bloodSpray(p.x, p.y, rand(-1, 1), 1, 6, 3, 1.2);
        } else touched.set(ob, last.p);
      }
      if (!last) Sound.play(mode === 'energy' ? 'energy_hit' : 'slice', 0.8);
    } else if (!ud.isGround) {
      if (ud.mat === 'wood') { ud.char = Math.min(1, (ud.char || 0) + 0.02); if (mode !== 'energy') impactFx('wood', p.x, p.y, 0, 1, 0.4); if (ud.onShot && (!last || G.time - last.t > 0.15)) ud.onShot(ob, p, mode === 'energy' ? 25 : 12, {}); }
      else if (ud.mat === 'metal' || ud.mat === 'stone') sparks(p.x, p.y, rand(-1, 1), 1, 2, mode === 'energy' ? '#9fe0ff' : '#ffd27a', 4);
      else if (ud.mat === 'glass' && ud.onShot) ud.onShot(ob, p, 50, {});
    } else if (Math.random() < 0.3) sparks(p.x, p.y, 0, 1, 2, '#9fe0ff', 3);
  }
  const next = new Map();
  for (const [ob, p] of touched) { const last = prev.get(ob); next.set(ob, last && (last.p === p) ? last : { t: G.time, p }); }
  it.st.inside = next;
}

function energyBlade(id, name, desc, col, segs, drawHilt, drawBlade) {
  return defItem({
    id, name, desc, cat: 'scifi', mat: 'metal', mass: 1.1, bullet: true,
    fix: [{ box: [0.11, 0.022, -0.02, 0] }], bb: id === 'esword' ? [-0.14, -0.15, 0.92, 0.15] : [-0.15, -0.06, 1.02, 0.06],
    init(it) { it.st.on = false; },
    activate(it) {
      it.st.on = !it.st.on;
      Sound.play(it.st.on ? 'energy_on' : 'energy_off', 0.9);
      if (it.st.on && !it.hum) it.hum = Sound.hum(id === 'esword' ? 95 : 70, 0.05);
      if (!it.st.on && it.hum) { it.hum.stop(); it.hum = null; }
      it.st.ext = it.st.ext || 0;
    },
    update(it, dt) {
      it.st.ext = clamp((it.st.ext || 0) + (it.st.on ? dt * 6 : -dt * 6), 0, 1);
      if (it.st.ext > 0.5) bladeCut(it, segs.map((s) => [s[0], s[1], lerp(s[0], s[2], it.st.ext), lerp(s[1], s[3], it.st.ext)]), 'energy', dt);
      else it.st.inside = null;
      if (it.hum) { const w = Math.abs(it.body.getAngularVelocity()); it.hum.set((id === 'esword' ? 95 : 70) + w * 6, 0.04 + Math.min(0.05, w * 0.004)); }
    },
    lightFx(it) { if (it.st.ext > 0) { const c = it.wp(0.45, 0); addLight(c.x, c.y, 1.4, col, 0.32 * it.st.ext); } },
    draw(ctx, it) {
      const e = it.st.ext != null ? it.st.ext : 1;
      if (e > 0) { ctx.globalCompositeOperation = 'lighter'; drawBlade(ctx, e); ctx.globalCompositeOperation = 'source-over'; }
      drawHilt(ctx);
    },
    icon(ctx, it) { it.st.ext = 1; this.draw(ctx, it); },
  });
}
energyBlade('esword', 'Energy Sword', 'Twin-pronged plasma blade. Activate to ignite; cauterizes as it cuts.', '110,200,255',
  [[0.06, 0.05, 0.86, 0.06], [0.06, -0.05, 0.86, -0.06], [0.1, 0, 0.7, 0]],
  (ctx) => {
    fillRR(ctx, -0.13, -0.024, 0.22, 0.048, 0.014, '#2d333d', C.rim);
    fillPoly(ctx, [0.05, 0.03, 0.1, 0.09, 0.12, 0.08, 0.08, 0.02], '#3b434f', C.rim);
    fillPoly(ctx, [0.05, -0.03, 0.1, -0.09, 0.12, -0.08, 0.08, -0.02], '#3b434f', C.rim);
    fillRR(ctx, -0.1, -0.006, 0.12, 0.012, 0.006, 'rgba(110,200,255,0.9)');
  },
  (ctx, e) => {
    for (const s of [1, -1]) {
      const L = 0.8 * e;
      ctx.beginPath();
      ctx.moveTo(0.1, s * 0.085);
      ctx.quadraticCurveTo(0.1 + L * 0.5, s * 0.14, 0.1 + L, s * 0.03);
      ctx.quadraticCurveTo(0.1 + L * 0.5, s * 0.075, 0.1, s * 0.045);
      ctx.closePath();
      ctx.fillStyle = 'rgba(90,170,255,0.55)'; ctx.fill();
      ctx.strokeStyle = 'rgba(200,235,255,0.95)'; ctx.lineWidth = 0.012; ctx.stroke();
    }
  });
energyBlade('saber', 'Laser Sword', 'A humming beam of red light. Activate to ignite.', '255,70,60',
  [[0.1, 0, 1.0, 0]],
  (ctx) => {
    fillRR(ctx, -0.14, -0.022, 0.24, 0.044, 0.01, '#9aa1aa', C.rim);
    for (let i = 0; i < 5; i++) fillRR(ctx, -0.11 + i * 0.024, -0.025, 0.012, 0.05, 0.004, '#22252a');
    fillRR(ctx, 0.07, -0.028, 0.035, 0.056, 0.008, '#5b616a', C.rim);
    fillRR(ctx, -0.02, 0.018, 0.02, 0.014, 0.003, '#d33');
  },
  (ctx, e) => {
    ctx.lineCap = 'round';
    line(ctx, 0.1, 0, 0.1 + 0.9 * e, 0, 'rgba(255,50,40,0.45)', 0.07);
    line(ctx, 0.1, 0, 0.1 + 0.9 * e, 0, 'rgba(255,90,70,0.8)', 0.04);
    line(ctx, 0.1, 0, 0.1 + 0.9 * e, 0, 'rgba(255,235,230,1)', 0.018);
    ctx.lineCap = 'butt';
  });

defItem({
  id: 'chainsaw', name: 'Chainsaw', desc: 'Activate to rev. Rips through anything soft.', cat: 'melee', mat: 'plastic', mass: 6, bullet: true,
  fix: [{ box: [0.18, 0.11, -0.06, 0.02] }, { box: [0.36, 0.04, 0.46, 0.0], mat: 'metal' }],
  init(it) { it.st.on = false; it.st.chain = 0; },
  activate(it) { it.st.on = !it.st.on; Sound.play(it.st.on ? 'energy_on' : 'energy_off', 0.5); if (it.st.on && !it.hum) it.hum = Sound.hum(48, 0.07); if (!it.st.on && it.hum) { it.hum.stop(); it.hum = null; } },
  update(it, dt) {
    if (!it.st.on) { it.st.inside = null; return; }
    it.st.chain += dt * 8;
    bladeCut(it, [[0.12, 0.045, 0.82, 0.045], [0.12, -0.045, 0.82, -0.045], [0.84, 0.03, 0.84, -0.03]], 'saw', dt);
    it.body.applyForceToCenter(v2(rand(-15, 15), rand(-15, 15)), true);
    if (it.st.inside && it.st.inside.size && it.hum) it.hum.set(38, 0.1); else if (it.hum) it.hum.set(52, 0.06);
  },
  draw(ctx, it) {
    fillRR(ctx, 0.1, -0.042, 0.74, 0.084, 0.04, '#9aa2ac', C.rim);
    const off = ((it.st.chain || 0) % 1) * 0.04;
    ctx.fillStyle = '#2a2c30';
    for (let x = 0.12 + off; x < 0.82; x += 0.04) { ctx.fillRect(x, 0.04, 0.018, 0.012); ctx.fillRect(x, -0.052, 0.018, 0.012); }
    fillRR(ctx, -0.24, -0.09, 0.36, 0.21, 0.04, '#e27a1c', C.rim);
    fillRR(ctx, -0.2, -0.06, 0.12, 0.12, 0.02, '#2a2c30');
    for (let i = 0; i < 4; i++) line(ctx, -0.19, -0.04 + i * 0.027, -0.09, -0.04 + i * 0.027, '#55595f', 0.008);
    ctx.strokeStyle = '#2a2c30'; ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.moveTo(-0.18, 0.12); ctx.quadraticCurveTo(-0.05, 0.25, 0.08, 0.12); ctx.stroke();
    fillRR(ctx, -0.36, -0.03, 0.13, 0.06, 0.02, '#2a2c30', C.rim);
  },
});

/* ============================================================ EXPLOSIVES */
function fuseItem(it, sec, boom) {
  if (it.st.armed) return;
  it.st.armed = true;
  it.st.fuseAt = G.time + sec;
  Sound.play('pin', 0.8);
  defer(() => { if (!it.dead) { const p = it.body.getPosition(); it.remove(); boom(p.x, p.y); } }, sec);
}
function stickOnTouch(it) {
  it.body.getUserData().onTouch = (b, ob, p) => {
    if (!it.st.armed || it.st.stuck || ob === b || !p) return;
    const oud = ob.getUserData();
    if (oud && oud.part === undefined && ob.isStatic() === false && ob.getMass() < 0.5) return;
    it.st.stuck = true;
    defer(() => {
      if (it.dead || ob._dead) return;
      const j = G.world.createJoint(new PL.WeldJoint({ frequencyHz: 0, dampingRatio: 0 }, ob, it.body, p));
      it.joints.push(j);
      Sound.play('click', 0.5);
    });
  };
}

defItem({
  id: 'grenade', name: 'Frag Grenade', desc: 'Activate to pull the pin. Three seconds, then shrapnel.', cat: 'explosives', mat: 'metal', mass: 0.6, bullet: true,
  fix: [{ circle: [0.062, 0, 0] }, { box: [0.025, 0.02, 0, 0.07] }],
  activate(it) { fuseItem(it, 3, (x, y) => Combat.explode(x, y, { r: 5, power: 85, dmg: 85, shrapnel: 45 })); },
  update(it) { if (it.st.armed && !it.st.spoon) { it.st.spoon = true; const p = it.wp(0.04, 0.08); addP({ type: 'debris', x: p.x, y: p.y, vx: rand(-1, 1), vy: 3, life: 3, size: 0.05, color: '#808a70', rot: 0, w: 20 }); } },
  lightFx(it) { if (it.st.armed && Math.floor(G.time * 6) % 2) { const p = it.body.getPosition(); addLight(p.x, p.y, 0.35, '255,60,40', 0.6); } },
  draw(ctx, it) {
    fillCircle(ctx, 0, 0, 0.064, C.olive, C.rim);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.006;
    for (const x of [-0.03, 0, 0.03]) line(ctx, x, -0.06, x, 0.06, 'rgba(0,0,0,0.25)', 0.006);
    line(ctx, -0.06, 0.0, 0.06, 0.0, 'rgba(0,0,0,0.25)', 0.006);
    fillRR(ctx, -0.025, 0.05, 0.05, 0.04, 0.006, C.steelD, C.rim);
    if (!it.st.armed) {
      fillPoly(ctx, [0.02, 0.085, 0.045, 0.08, 0.075, -0.03, 0.06, -0.035], C.steel);
      ctx.strokeStyle = C.brass; ctx.lineWidth = 0.006; ctx.beginPath(); ctx.arc(-0.05, 0.085, 0.022, 0, TAU); ctx.stroke();
    }
  },
});

defItem({
  id: 'sticky', name: 'Plasma Grenade', desc: 'Sticks to the first thing it touches once armed.', cat: 'scifi', mat: 'metal', mass: 0.5, bullet: true,
  fix: [{ circle: [0.065, 0, 0] }],
  init(it) { stickOnTouch(it); },
  activate(it) { fuseItem(it, 3, (x, y) => { Combat.explode(x, y, { r: 4, power: 80, dmg: 110, fire: true }); for (let i = 0; i < 30; i++) addP({ type: 'glow', x, y, vx: rand(-6, 6), vy: rand(-6, 6), life: rand(0.3, 0.8), size: 0.1, col: '110,170,255' }); }); },
  lightFx(it) { const p = it.body.getPosition(); addLight(p.x, p.y, it.st.armed ? 0.9 : 0.4, '110,170,255', it.st.armed ? 0.5 + 0.3 * Math.sin(G.time * 20) : 0.25); },
  draw(ctx, it) {
    fillCircle(ctx, 0, 0, 0.066, '#26365a', C.rim);
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.3; fillPoly(ctx, [Math.cos(a) * 0.03, Math.sin(a) * 0.03, Math.cos(a + 0.4) * 0.07, Math.sin(a + 0.4) * 0.07, Math.cos(a - 0.4) * 0.07, Math.sin(a - 0.4) * 0.07], '#3a5a9a'); }
    fillCircle(ctx, 0, 0, 0.032, it.st.armed ? '#bfe0ff' : '#5f8fe0');
  },
});

defItem({
  id: 'c4', name: 'C4 Charge', desc: 'Activate to arm a 5 s timer. Sticks to whatever it hits.', cat: 'explosives', mat: 'plastic', mass: 1.2,
  fix: [{ box: [0.15, 0.05, 0, 0] }],
  init(it) { stickOnTouch(it); },
  activate(it) {
    if (it.st.armed) return;
    fuseItem(it, 5, (x, y) => Combat.explode(x, y, { r: 6.5, power: 150, dmg: 160, structMul: 1.6 }));
  },
  update(it, dt) {
    if (!it.st.armed) return;
    const left = it.st.fuseAt - G.time;
    const period = clamp(left / 5, 0.08, 1) * 0.6;
    it.st.bt = (it.st.bt || 0) - dt;
    if (it.st.bt <= 0) { it.st.bt = period; it.st.blink = G.time; Sound.play('beep', 0.6, 0.02); }
  },
  lightFx(it) { if (it.st.blink && G.time - it.st.blink < 0.06) { const p = it.wp(0.07, 0.03); addLight(p.x, p.y, 0.4, '255,40,40', 0.8); } },
  draw(ctx, it) {
    fillRR(ctx, -0.15, -0.05, 0.3, 0.1, 0.01, '#cbbd8d', C.rim);
    for (const x of [-0.11, -0.04, 0.03]) fillRR(ctx, x, -0.052, 0.025, 0.104, 0.004, '#3b3f46');
    fillRR(ctx, 0.05, 0.005, 0.08, 0.04, 0.006, '#15171a', C.rim);
    const on = it.st.blink && G.time - it.st.blink < 0.06;
    fillRR(ctx, 0.06, 0.015, 0.06, 0.02, 0.003, it.st.armed ? (on ? '#ff3b3b' : '#5a1414') : '#2b3b2b');
    ctx.strokeStyle = '#c33'; ctx.lineWidth = 0.006; ctx.beginPath(); ctx.moveTo(0.05, 0.03); ctx.quadraticCurveTo(-0.02, 0.09, -0.1, 0.05); ctx.stroke();
    ctx.strokeStyle = '#33c'; ctx.beginPath(); ctx.moveTo(0.05, 0.02); ctx.quadraticCurveTo(-0.01, 0.08, -0.07, 0.05); ctx.stroke();
  },
});

defItem({
  id: 'mine', name: 'Landmine', desc: 'Arms a second after placing. Anything stepping on it goes up.', cat: 'explosives', mat: 'metal', mass: 4, minY: 0.06,
  fix: [{ poly: [[-0.17, -0.035], [0.17, -0.035], [0.13, 0.035], [-0.13, 0.035]] }],
  init(it) {
    it.body.getUserData().onTouch = (b, ob) => {
      if (G.time - it.born < 1 || it.st.boom || ob.isStatic()) return;
      if (ob.getMass() < 0.4) return;
      it.st.boom = true;
      Sound.play('click', 1);
      defer(() => { if (!it.dead) { const p = it.body.getPosition(); it.remove(); Combat.explode(p.x, p.y + 0.1, { r: 4.5, power: 130, dmg: 140, shrapnel: 25 }); } }, 0.18);
    };
  },
  lightFx(it) { if (G.time - it.born > 1 && Math.floor(G.time * 2) % 2) { const p = it.wp(0.1, 0.04); addLight(p.x, p.y, 0.2, '255,50,40', 0.7); } },
  draw(ctx) {
    fillPoly(ctx, [-0.17, -0.035, 0.17, -0.035, 0.13, 0.035, -0.13, 0.035], '#4f5a3a', C.rim);
    fillRR(ctx, -0.07, 0.03, 0.14, 0.02, 0.008, '#3c4430', C.rim);
    line(ctx, -0.15, -0.005, 0.15, -0.005, 'rgba(0,0,0,0.3)', 0.006);
  },
});

defItem({
  id: 'barrel', name: 'Explosive Barrel', desc: 'Shoot it, burn it, or hit it hard.', cat: 'explosives', mat: 'metal', mass: 30, z: 12, minY: 0.45,
  fix: [{ box: [0.29, 0.44, 0, 0] }],
  init(it) {
    const ud = it.body.getUserData();
    ud.hp = 45;
    const boom = (delay) => { if (it.st.boom) return; it.st.boom = true; defer(() => { if (!it.dead) { const p = it.body.getPosition(); it.remove(); Combat.explode(p.x, p.y, { r: 5.5, power: 130, dmg: 120, fire: true, shrapnel: 15 }); Combat.addFirePool(p.x, Math.max(0.02, p.y - 0.4), 1.4, 7); } }, delay); };
    ud.onShot = (b, p, dmg) => { ud.hp -= dmg; if (ud.hp <= 0) boom(0.05); else if (Math.random() < 0.3) Combat.ignite(b, 3); };
    ud.onBlast = (b, k) => { if (k > 0.15) boom(rand(0.08, 0.3)); };
    ud.onImpact = (b, dv) => { if (dv > 15) boom(0.02); };
    ud.flammable = true;
    ud.onBreak = () => boom(0.01);
  },
  update(it) { const ud = it.body.getUserData(); if (ud.burning > 0) { ud.hp -= 0.2; if (ud.hp <= 0 && ud.onBreak) ud.onBreak(); } },
  draw(ctx) {
    fillRR(ctx, -0.29, -0.44, 0.58, 0.88, 0.05, '#9b2b22', C.rim);
    for (const y of [-0.3, 0, 0.3]) fillRR(ctx, -0.3, y - 0.02, 0.6, 0.04, 0.01, '#7a1f19');
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0.08, -0.43, 0.1, 0.86);
    fillPoly(ctx, [0, 0.13, 0.12, 0.0, 0, -0.13, -0.12, 0.0], '#f2c230', '#1b1b1b', 0.012);
    fillPoly(ctx, [0, 0.07, 0.04, -0.02, -0.04, -0.02], '#1b1b1b');
    fillCircle(ctx, 0, -0.06, 0.012, '#1b1b1b');
  },
});

defItem({
  id: 'molotov', name: 'Molotov', desc: 'Activate to light the rag, then throw. Shatters into flames.', cat: 'explosives', mat: 'glass', mass: 0.8, bullet: true,
  fix: [{ box: [0.1, 0.05, 0, 0] }, { box: [0.05, 0.02, 0.14, 0] }],
  init(it) {
    const ud = it.body.getUserData();
    const smash = () => {
      if (it.st.broken) return;
      it.st.broken = true;
      defer(() => {
        if (it.dead) return;
        const p = it.body.getPosition();
        it.remove();
        Sound.play('glass', 1);
        debrisBurst(p.x, p.y, 0, 1, 14, 'rgba(160,220,170,0.8)', 3, 0.03);
        if (it.st.lit) {
          const g = rayFirst(v2(p.x, p.y + 0.1), v2(p.x, p.y - 3));
          Combat.addFirePool(p.x, g ? g.p.y : Math.max(0, p.y - 0.1), 1.3, 10);
          for (const b of queryBodies(p.x, p.y, 1.2)) Combat.ignite(b, 8);
          Combat.explode(p.x, p.y, { r: 1.5, power: 8, dmg: 5, fire: true });
        }
      });
    };
    ud.onImpact = (b, dv) => { if (dv > 5) smash(); };
    ud.onShot = smash; ud.onBlast = smash;
  },
  activate(it) { if (!it.st.lit) { it.st.lit = true; Sound.play('fire', 0.5); } },
  update(it) { if (it.st.lit && Math.random() < 0.5) { const p = it.wp(0.21, 0); addP({ type: 'fire', x: p.x, y: p.y, vx: rand(-0.2, 0.2), vy: rand(0.5, 1), life: rand(0.2, 0.4), size: rand(0.04, 0.08) }); } },
  lightFx(it) { if (it.st.lit) { const p = it.wp(0.21, 0); addLight(p.x, p.y, 1.1, '255,150,60', 0.35); } },
  draw(ctx, it) {
    fillRR(ctx, -0.1, -0.052, 0.2, 0.104, 0.03, 'rgba(110,170,120,0.75)', C.rim);
    fillRR(ctx, -0.09, -0.045, 0.12, 0.07, 0.02, 'rgba(210,150,60,0.6)');
    fillRR(ctx, 0.08, -0.022, 0.12, 0.044, 0.01, 'rgba(110,170,120,0.8)', C.rim);
    fillPoly(ctx, [0.19, 0.02, 0.26, 0.04, 0.25, -0.01, 0.19, -0.02], '#d9cfb0');
  },
});

defItem({
  id: 'blackhole', name: 'Singularity Grenade', desc: 'Activate. After 2 s a black hole swallows everything nearby.', cat: 'scifi', mat: 'metal', mass: 0.7, bullet: true,
  fix: [{ circle: [0.07, 0, 0] }],
  activate(it) { fuseItem(it, 2, (x, y) => new Singularity(x, y)); },
  lightFx(it) { const p = it.body.getPosition(); addLight(p.x, p.y, it.st.armed ? 0.9 : 0.35, '190,90,255', it.st.armed ? 0.6 : 0.3); },
  draw(ctx, it) {
    fillCircle(ctx, 0, 0, 0.072, '#17121f', C.rim);
    ctx.strokeStyle = it.st.armed ? '#e6b8ff' : '#9b5de5'; ctx.lineWidth = 0.012;
    const r = it.st.armed ? G.time * 8 : 0;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.055, 0.02, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 0.055, 0.02, r + 1.2, 0, TAU); ctx.stroke();
    fillCircle(ctx, 0, 0, 0.018, '#000');
  },
});

class Singularity extends Entity {
  constructor(x, y) {
    super('singularity');
    this.name = 'Singularity'; this.x = x; this.y = Math.max(y, 0.6); this.t = 0; this.z = 60;
    Sound.play('blackhole', 1);
  }
  update(dt) {
    this.t += dt;
    const R = 13, k = Math.min(1, this.t / 0.6) * (this.t > 4.6 ? Math.max(0, (5 - this.t) / 0.4) : 1);
    const eaten = new Set();
    for (const b of queryBodies(this.x, this.y, R)) {
      if (b._dead) continue;
      const ud = b.getUserData();
      if (ud.isGround) continue;
      const c = b.getWorldCenter();
      const dx = this.x - c.x, dy = this.y - c.y, d = Math.hypot(dx, dy) + 0.01;
      if (d > R) continue;
      if (b.isStatic()) { if (ud.onBlast && d < 4 && Math.random() < dt * 2) ud.onBlast(b, 1); continue; }
      const m = b.getMass();
      const F = Math.min(260 * m / (d * 0.6 + 0.4), 2500 * m) * k;
      b.applyForceToCenter(v2(dx / d * F - dy / d * F * 0.3, dy / d * F + dx / d * F * 0.3), true);
      if (d < 0.5) eaten.add(entOf(b));
    }
    for (const e of eaten) {
      if (!e || e.dead || e === this) continue;
      if (e.kind === 'dummy') { e.die('Spaghettified'); }
      if (e.kind === 'structure') continue;
      e.remove();
    }
    if (Math.random() < 0.9) { const a = rand(0, TAU), r = rand(1.5, 4); addP({ type: 'orbit', x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r, cx: this.x, cy: this.y, vx: -Math.sin(a) * 3, vy: Math.cos(a) * 3, life: 1.5, size: rand(0.03, 0.07), col: pick(['200,120,255', '255,170,90', '150,110,255']) }); }
    if (this.t > 5) { this.remove(); Combat.explode(this.x, this.y, { r: 6, power: 90, dmg: 30 }); }
  }
  draw(ctx) {
    const s = Math.min(1, this.t / 0.5) * (this.t > 4.6 ? Math.max(0.05, (5 - this.t) / 0.4) : 1);
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, 0, 2.6 * s, '120,60,200', 0.5);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(${i === 1 ? '255,170,90' : '200,130,255'},${0.6 - i * 0.15})`; ctx.lineWidth = 0.08 - i * 0.02;
      ctx.beginPath(); ctx.ellipse(0, 0, (0.75 + i * 0.25) * s, (0.2 + i * 0.05) * s, G.time * (1.5 + i * 0.4), 0, TAU); ctx.stroke();
    }
    fillCircle(ctx, 0, 0, 0.42 * s, '#000', 'rgba(230,200,255,0.8)', 0.03);
    ctx.restore();
  }
}

/* ============================================================ SCI-FI GUNS */
defItem({
  id: 'railgun', name: 'Railgun', desc: 'Charges for half a second, then a slug that pierces everything.', cat: 'scifi', mat: 'metal', mass: 8, bullet: true,
  fix: [{ box: [0.24, 0.07, -0.12, 0.0] }, { box: [0.42, 0.03, 0.5, 0.03] }, { box: [0.025, 0.07, -0.1, -0.12] }],
  activate(it) {
    if (it.cool > 0 || it.st.charging) return;
    it.st.charging = G.time;
    Sound.play('charge', 0.8);
    defer(() => {
      if (it.dead) return;
      it.st.charging = 0;
      const f = it.fwd(), m = it.wp(0.95, 0.03);
      Combat.fireBeam({ x: m.x, y: m.y, dx: f.x, dy: f.y, dmg: 140, knock: 35, src: it.body });
      it.body.applyLinearImpulse(v2(-f.x * 18, -f.y * 18), m, true);
      it.body.applyAngularImpulse(0.8 * it.sy, true);
      G.shake = Math.max(G.shake, 0.4);
      G.lights.push({ x: m.x, y: m.y, r: 4, col: '120,200,255', a: 0.8, life: 0.25, max: 0.25 });
      Sound.play('rail', 1);
      it.cool = 1.6;
    }, 0.55);
  },
  lightFx(it) {
    if (it.st.charging) { const k = (G.time - it.st.charging) / 0.55; const m = it.wp(0.6, 0.03); addLight(m.x, m.y, 0.6 + k, '120,200,255', 0.5 * k); }
    const c = it.wp(-0.15, 0.0); addLight(c.x, c.y, 0.3, '120,200,255', 0.35);
  },
  draw(ctx, it) {
    fillPoly(ctx, [-0.36, 0.06, -0.62, 0.04, -0.62, -0.05, -0.36, -0.06], '#2b2f37', C.rim);
    fillRR(ctx, -0.125, -0.19, 0.05, 0.13, 0.01, '#2b2f37', C.rim);
    fillRR(ctx, -0.36, -0.075, 0.5, 0.15, 0.03, '#3d434d', C.rim);
    fillRR(ctx, -0.3, -0.02, 0.3, 0.04, 0.02, 'rgba(120,200,255,0.85)');
    fillRR(ctx, 0.1, 0.045, 0.85, 0.022, 0.004, '#9aa2ad', C.rim);
    fillRR(ctx, 0.1, -0.005, 0.85, 0.022, 0.004, '#9aa2ad', C.rim);
    const k = it.st.charging ? (G.time - it.st.charging) / 0.55 : 0;
    for (let i = 0; i < 7; i++) fillRR(ctx, 0.15 + i * 0.11, 0.015, 0.05, 0.03, 0.006, k > i / 7 ? '#bfe6ff' : '#2a5d86');
  },
});

defItem({
  id: 'plasma', name: 'Plasma Rifle', desc: 'Full-auto bolts of superheated plasma. Burns on contact.', cat: 'scifi', mat: 'metal', mass: 4, bullet: true,
  fix: [{ poly: [[-0.3, 0.06], [0.3, 0.07], [0.45, 0.02], [0.3, -0.05], [-0.3, -0.04]] }, { box: [0.025, 0.06, -0.1, -0.08] }],
  activate(it) { it.st.trigger = true; this.hold(it); },
  hold(it) {
    if (it.cool > 0) return;
    const f = it.fwd(), m = it.wp(0.46, 0.02), a = Math.atan2(f.y, f.x) + rand(-0.02, 0.02);
    Combat.addProjectile({ x: m.x, y: m.y, vx: Math.cos(a) * 42, vy: Math.sin(a) * 42, life: 2.5, dmg: 22, knock: 5, size: 0.07, col: '110,255,220', src: it.body, grav: 0.5 });
    it.body.applyLinearImpulse(v2(-f.x * 0.8, -f.y * 0.8), m, true);
    G.lights.push({ x: m.x, y: m.y, r: 1.5, col: '110,255,220', a: 0.5, life: 0.06, max: 0.06 });
    Sound.play('plasma', 0.6);
    it.cool = 0.12;
  },
  lightFx(it) { const c = it.wp(0.05, 0.01); addLight(c.x, c.y, 0.45, '110,255,220', 0.45); },
  draw(ctx) {
    fillRR(ctx, -0.125, -0.15, 0.05, 0.12, 0.012, '#24403f', C.rim);
    ctx.beginPath();
    ctx.moveTo(-0.32, 0.03); ctx.quadraticCurveTo(-0.3, 0.09, -0.1, 0.085); ctx.quadraticCurveTo(0.25, 0.1, 0.46, 0.02);
    ctx.quadraticCurveTo(0.25, -0.07, -0.1, -0.05); ctx.quadraticCurveTo(-0.3, -0.05, -0.32, 0.03); ctx.closePath();
    ctx.fillStyle = '#2f6f70'; ctx.fill(); ctx.strokeStyle = C.rim; ctx.lineWidth = 0.01; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0.1, -0.02, 0.25, 0.025, 0, 0, TAU); ctx.fill();
    fillRR(ctx, -0.05, -0.005, 0.22, 0.03, 0.015, 'rgba(120,255,225,0.9)');
    fillCircle(ctx, 0.44, 0.02, 0.018, 'rgba(160,255,235,0.9)');
  },
});

defItem({
  id: 'gravgun', name: 'Gravity Gun', desc: 'Zero-point energy punt. Launches anything in front of it.', cat: 'scifi', mat: 'metal', mass: 5, bullet: true,
  fix: [{ box: [0.22, 0.08, -0.05, 0.0] }, { box: [0.12, 0.04, 0.27, 0.0] }, { box: [0.03, 0.07, -0.12, -0.12] }],
  activate(it) {
    if (it.cool > 0) return;
    it.cool = 0.5; it.st.punt = G.time;
    const f = it.fwd(), m = it.wp(0.42, 0);
    const hitEnts = new Set();
    for (const b of queryBodies(m.x + f.x * 4, m.y + f.y * 4, 4.5)) {
      if (b === it.body || !b.isDynamic()) continue;
      const c = b.getWorldCenter();
      const dx = c.x - m.x, dy = c.y - m.y, d = Math.hypot(dx, dy);
      if (d > 8 || d < 0.01) continue;
      const cos = (dx * f.x + dy * f.y) / d;
      if (cos < 0.86) continue;
      const k = (1 - d / 8) * 0.7 + 0.3;
      const imp = 26 * k * Math.pow(b.getMass(), 0.65);
      b.applyLinearImpulse(v2(f.x * imp, f.y * imp + imp * 0.1), c, true);
      const e = entOf(b); if (e) hitEnts.add(e);
    }
    for (const e of hitEnts) if (e.kind === 'dummy' && e.alive) e.koTimer = Math.max(e.koTimer, 1);
    it.body.applyLinearImpulse(v2(-f.x * 10, -f.y * 10), m, true);
    for (let i = 0; i < 20; i++) addP({ type: 'glow', x: m.x, y: m.y, vx: f.x * rand(4, 14) + rand(-1.5, 1.5), vy: f.y * rand(4, 14) + rand(-1.5, 1.5), life: rand(0.15, 0.35), size: rand(0.04, 0.1), col: '255,170,60' });
    G.lights.push({ x: m.x, y: m.y, r: 2.5, col: '255,170,60', a: 0.7, life: 0.15, max: 0.15 });
    Sound.play('punt', 1);
  },
  lightFx(it) { const m = it.wp(0.36, 0); addLight(m.x, m.y, 0.35, '255,170,60', 0.3 + 0.1 * Math.sin(G.time * 5)); },
  draw(ctx, it) {
    const open = clamp(1 - (G.time - (it.st.punt || -9)) / 0.25, 0, 1);
    fillRR(ctx, -0.135, -0.2, 0.05, 0.14, 0.012, '#2c2f34', C.rim);
    fillRR(ctx, -0.28, -0.08, 0.46, 0.16, 0.04, '#d9701f', C.rim);
    fillRR(ctx, -0.25, -0.03, 0.3, 0.06, 0.02, '#2c2f34');
    for (let i = 0; i < 4; i++) fillRR(ctx, -0.23 + i * 0.07, -0.02, 0.04, 0.04, 0.01, '#4c535c');
    fillRR(ctx, 0.15, -0.04, 0.24, 0.08, 0.02, '#3a3f46', C.rim);
    for (const s of [1, -1]) {
      ctx.save(); ctx.translate(0.36, s * 0.035); ctx.rotate(s * (0.3 + open * 0.4));
      fillPoly(ctx, [0, 0, 0.14, s * 0.02, 0.15, s * 0.045, 0.01, s * 0.03], '#bfc5cc', C.rim);
      ctx.restore();
    }
    fillCircle(ctx, 0.37, 0, 0.022, 'rgba(255,190,90,0.95)');
  },
});

/* ============================================================ GADGETS */
function syringe(id, name, desc, liquid, kind) {
  return defItem({
    id, name, desc, cat: 'misc', mat: 'plastic', mass: 0.15, bullet: true, inject: kind,
    fix: [{ box: [0.075, 0.019, 0, 0] }, { box: [0.02, 0.01, -0.095, 0] }, { poly: [[0.075, 0.006], [0.15, 0], [0.075, -0.006]], mat: 'metal', ud: { sharp: 'tip', stab: 0.4, thr: 1.6, depth: 0.05, friction: 120, breakF: 2500 } }],
    draw(ctx, it) {
      fillRR(ctx, -0.12, -0.012, 0.05, 0.024, 0.004, '#c9ced4');
      fillRR(ctx, -0.13, -0.03, 0.014, 0.06, 0.004, '#c9ced4', C.rim);
      fillRR(ctx, -0.075, -0.02, 0.15, 0.04, 0.006, 'rgba(220,230,235,0.35)', 'rgba(255,255,255,0.5)');
      if (!it.used) fillRR(ctx, -0.06, -0.015, 0.13, 0.03, 0.004, liquid);
      for (let i = 0; i < 5; i++) line(ctx, -0.05 + i * 0.025, 0.02, -0.05 + i * 0.025, 0.01, 'rgba(0,0,0,0.4)', 0.003);
      line(ctx, 0.075, 0, 0.15, 0, '#d9dee3', 0.006);
    },
  });
}
syringe('syr_life', 'Life Syringe', 'Stab into a dummy to heal every injury and revive the dead.', '#59e08f', 'life');
syringe('syr_adr', 'Adrenaline', 'Wakes dummies up, numbs pain and makes them stronger.', '#f2c230', 'adrenaline');
syringe('syr_sed', 'Sedative', 'Knocks a dummy out for about 18 seconds.', '#58a6ff', 'sedative');

class Turret extends Entity {
  constructor(x, y, flip) {
    super('turret');
    this.name = 'Sentry Turret'; this.z = 28; this.sy = flip ? -1 : 1; this.active = true; this.cool = 0; this.scan = rand(0, 6);
    this.target = null; this.aim = null;
    y = Math.max(y, 0);
    this.base = makeBody(this, { x, y: y + 0.38, mat: 'metal', cat: CAT.ITEM, ad: 0.5, ud: { fill: '#3d424a' } },
      [{ shape: Sh.poly([[-0.38, -0.38], [0.38, -0.38], [0.1, 0.12], [-0.1, 0.12]]), density: 120, friction: 1 }, { shape: Sh.box(0.05, 0.14, 0, 0.22), density: 60 }]);
    const a0 = flip ? Math.PI : 0;
    this.head = makeBody(this, { x, y: y + 0.78, angle: a0, mat: 'metal', cat: CAT.ITEM, sy: this.sy, ad: 2 },
      [{ shape: Sh.box(0.2, 0.09, 0, 0), density: 40 }, { shape: Sh.box(0.13, 0.022, 0.32, 0.0), density: 40 }]);
    this.joint = G.world.createJoint(new PL.RevoluteJoint({ enableLimit: true, lowerAngle: -1.1, upperAngle: 1.1, enableMotor: true, maxMotorTorque: 160, motorSpeed: 0 }, this.base, this.head, v2(x, y + 0.76)));
    this.joints.push(this.joint);
    this.a0 = a0;
  }
  get activatable() { return true; }
  activate() { this.active = !this.active; Sound.play('turret', 0.8); }
  update(dt) {
    if (this.cool > 0) this.cool -= dt;
    if (this.head._dead || this.base._dead || this.joint._dead) return;
    if (!this.active) { this.joint.setMotorSpeed(0); this.aim = null; return; }
    const hb = this.head;
    const m = hb.getWorldPoint(v2(0.46, 0));
    let best = null, bd = 30;
    const baseA = this.base.getAngle() + this.a0;
    for (const d of G.dummies) {
      if (!d.alive) continue;
      for (const pn of ['chest', 'head', 'abdomen']) {
        const p = d.parts[pn];
        if (p.body._dead) continue;
        const tp = p.body.getPosition();
        const dist = Math.hypot(tp.x - m.x, tp.y - m.y);
        if (dist > bd) continue;
        const ang = Math.atan2(tp.y - m.y, tp.x - m.x);
        if (Math.abs(angNorm(ang - baseA)) > 1.05) continue;
        const h = rayFirst(m, tp, (fx) => fx.getBody() !== hb && fx.getBody() !== this.base);
        if (h && entOf(h.body) === d) { best = { d, tp, ang }; bd = dist; break; }
      }
    }
    let want;
    if (best) { want = best.ang; this.aim = best.tp; } else { this.scan += dt; want = baseA + Math.sin(this.scan * 0.9) * 0.7; this.aim = null; }
    const err = angNorm(want - hb.getAngle());
    this.joint.setMotorSpeed(clamp(err * 14, -7, 7));
    if (best && Math.abs(err) < 0.05 && this.cool <= 0) {
      const f = hb.getWorldVector(v2(1, 0));
      const a = Math.atan2(f.y, f.x) + rand(-0.02, 0.02);
      Combat.fireBullet({ x: m.x, y: m.y, dx: Math.cos(a), dy: Math.sin(a), dmg: 16, pen: 26, src: hb, ignoreEnt: this, knock: 3.5, caliber: 0.9 });
      hb.applyAngularImpulse(0.04 * this.sy, true);
      addP({ type: 'flash', x: m.x, y: m.y, life: 0.04, size: 0.22 });
      G.lights.push({ x: m.x, y: m.y, r: 1.6, col: '255,200,120', a: 0.5, life: 0.05, max: 0.05 });
      addP({ type: 'shell', x: m.x - f.x * 0.4, y: m.y, vx: rand(-1, 1), vy: 2, life: 4, size: 0.014, rot: 0, w: 20, color: C.brass });
      Sound.play('smg', 0.6);
      this.cool = 0.1;
    }
  }
  draw(ctx) {
    const b = this.base, h = this.head;
    if (b._dead || h._dead) { for (const bb of this.bodies) if (!bb._dead) drawBodyGeneric(ctx, bb); return; }
    withBody(ctx, b, 1, () => {
      fillPoly(ctx, [-0.38, -0.38, -0.3, -0.38, 0.0, 0.08, -0.06, 0.1], '#3d424a', C.rim);
      fillPoly(ctx, [0.38, -0.38, 0.3, -0.38, 0.0, 0.08, 0.06, 0.1], '#3d424a', C.rim);
      fillPoly(ctx, [-0.04, -0.38, 0.04, -0.38, 0.03, 0.05, -0.03, 0.05], '#2f3339', C.rim);
      fillRR(ctx, -0.05, 0.08, 0.1, 0.3, 0.02, '#4b515a', C.rim);
      fillRR(ctx, -0.12, 0.05, 0.24, 0.06, 0.02, '#2a2d32', C.rim);
    });
    withBody(ctx, h, this.sy, () => {
      fillRR(ctx, 0.18, -0.025, 0.28, 0.05, 0.008, '#2a2d32', C.rim);
      fillRR(ctx, 0.42, -0.033, 0.06, 0.066, 0.008, '#1b1d20');
      fillRR(ctx, -0.22, -0.1, 0.44, 0.2, 0.06, '#d8dbe0', C.rim);
      fillRR(ctx, -0.18, -0.03, 0.2, 0.06, 0.02, '#3a3e44');
      const on = this.active;
      fillCircle(ctx, 0.12, 0.02, 0.035, '#111');
      fillCircle(ctx, 0.12, 0.02, 0.022, on ? (this.aim ? '#ff3b30' : '#ffb02e') : '#333');
    });
    if (this.active) {
      const m = h.getWorldPoint(v2(0.46, 0));
      const c = h.getWorldPoint(v2(0.12, 0.02 * this.sy));
      addLight(c.x, c.y, 0.4, this.aim ? '255,60,48' : '255,176,46', 0.6);
      const f = h.getWorldVector(v2(1, 0));
      const hit = rayFirst(m, v2(m.x + f.x * 30, m.y + f.y * 30), (fx) => fx.getBody() !== h);
      const e = hit ? hit.p : v2(m.x + f.x * 30, m.y + f.y * 30);
      ctx.strokeStyle = this.aim ? 'rgba(255,60,48,0.35)' : 'rgba(255,60,48,0.12)'; ctx.lineWidth = 0.008;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    }
  }
}
defItem({ id: 'turret', name: 'Sentry Turret', desc: 'Tracks and shoots any living dummy in view. Activate to toggle.', cat: 'misc', spawn: (x, y, f) => new Turret(x, y, f), bb: [-0.4, 0, 0.5, 0.9],
  ghost(ctx, flip) {
    ctx.save(); if (flip) ctx.scale(-1, 1);
    fillPoly(ctx, [-0.38, 0, -0.3, 0, 0.0, 0.46, -0.06, 0.48], '#3d424a'); fillPoly(ctx, [0.38, 0, 0.3, 0, 0.0, 0.46, 0.06, 0.48], '#3d424a');
    fillRR(ctx, -0.05, 0.46, 0.1, 0.3, 0.02, '#4b515a'); fillRR(ctx, -0.12, 0.43, 0.24, 0.06, 0.02, '#2a2d32');
    fillRR(ctx, 0.18, 0.755, 0.28, 0.05, 0.008, '#2a2d32'); fillRR(ctx, -0.22, 0.68, 0.44, 0.2, 0.06, '#d8dbe0'); fillCircle(ctx, 0.12, 0.8, 0.03, '#ffb02e');
    ctx.restore();
  } });

defItem({
  id: 'lamp', name: 'Hanging Lamp', desc: 'A bulb on a rope. Lights the void until you shoot it.', cat: 'misc', mat: 'glass', mass: 1.2, z: 31, ld: 0.2,
  fix: [{ poly: [[-0.16, -0.06], [0.16, -0.06], [0.06, 0.08], [-0.06, 0.08]], mat: 'metal' }, { circle: [0.06, 0, -0.08] }],
  build(it, x, y, a, sy) {
    buildSimple(it, x, y, 0, 1);
    const anchor = v2(x, y + 1.4);
    makeRope(G.ground, it.body, anchor, it.body.getWorldPoint(v2(0, 0.08)), 1.32, false);
    it.st.on = true;
    const ud = it.body.getUserData();
    ud.onShot = () => { if (it.st.on) { it.st.on = false; Sound.play('glass', 0.7); debrisBurst(it.body.getPosition().x, it.body.getPosition().y - 0.08, 0, -1, 10, 'rgba(255,240,200,0.8)', 2, 0.02); } };
    ud.onBlast = ud.onShot;
    ud.onImpact = (b, dv) => { if (dv > 7) ud.onShot(); };
  },
  bb: [-0.2, -0.16, 0.2, 0.5],
  icon(ctx, it) { line(ctx, 0, 0.08, 0, 0.5, '#b89a6a', 0.012); this.draw(ctx, it); },
  lightFx(it) { if (it.st.on) { const p = it.wp(0, -0.09); addLight(p.x, p.y, 4.2, '255,200,130', 0.16); addLight(p.x, p.y, 1.1, '255,225,180', 0.35); addLight(p.x, p.y, 0.25, '255,245,225', 0.9); } },
  draw(ctx, it) {
    fillPoly(ctx, [-0.16, -0.06, 0.16, -0.06, 0.06, 0.08, -0.06, 0.08], '#2b3036', C.rim);
    fillCircle(ctx, 0, -0.08, 0.055, it.st.on ? '#fff2cf' : '#4a4a44', C.rim);
  },
});

/* ============================================================ PROPS */
function breakable(it, hp, pieces) {
  const ud = it.body.getUserData();
  ud.hp = hp;
  ud.onShot = (b, p, dmg) => { ud.hp -= dmg * 0.5; if (ud.hp <= 0) ud.onBreak(b); };
  ud.onBlast = (b, k) => { ud.hp -= k * 180; if (ud.hp <= 0) ud.onBreak(b); };
  ud.onImpact = (b, dv, other) => { if (dv > 9) { ud.hp -= (dv - 9) * 8; if (ud.hp <= 0) ud.onBreak(b); } };
  ud.onBreak = () => {
    if (it.st.broken) return;
    it.st.broken = true;
    defer(() => {
      if (it.dead) return;
      const b = it.body, p = b.getPosition(), a = b.getAngle(), v = b.getLinearVelocity();
      it.remove();
      Sound.play('wood', 1);
      debrisBurst(p.x, p.y, 0, 1, 18, '#8a6440', 4, 0.05);
      for (let i = 0; i < pieces; i++) {
        const piece = new Item(ITEM.plankbit, p.x + rand(-0.25, 0.25), p.y + rand(-0.25, 0.25), false, a + rand(-1, 1));
        piece.body.setLinearVelocity(v2(v.x + rand(-2, 2), v.y + rand(0, 3)));
        piece.body.setAngularVelocity(rand(-6, 6));
        if (ud.burning > 0) Combat.ignite(piece.body, 4);
      }
    });
  };
}
defItem({ id: 'plankbit', name: 'Splintered Plank', hidden: true, cat: 'props', mat: 'wood', mass: 1.5, life: 30, fcat: CAT.DEBRIS, mask: 0xffff & ~CAT.DEBRIS,
  fix: [{ box: [0.3, 0.035, 0, 0] }],
  draw(ctx) { fillPoly(ctx, [-0.3, -0.035, 0.3, -0.035, 0.27, 0.0, 0.3, 0.035, -0.3, 0.035, -0.26, 0.0], '#9b7148', C.rim); line(ctx, -0.25, 0.0, 0.25, 0.005, 'rgba(0,0,0,0.2)', 0.005); } });

function crateDraw(s) {
  return (ctx) => {
    fillRR(ctx, -s, -s, s * 2, s * 2, 0.02, '#8d6440', C.rim);
    ctx.save(); ctx.beginPath(); roundRectPath(ctx, -s, -s, s * 2, s * 2, 0.02); ctx.clip();
    for (let y = -s; y < s; y += s / 2) line(ctx, -s, y, s, y, 'rgba(40,25,15,0.45)', 0.01);
    ctx.restore();
    const b = s * 0.16;
    ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = b; ctx.strokeRect(-s + b / 2, -s + b / 2, s * 2 - b, s * 2 - b);
    line(ctx, -s + b, -s + b, s - b, s - b, '#6b4a2e', b);
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) fillCircle(ctx, x * (s - b / 2), y * (s - b / 2), 0.012, '#3b3f46');
  };
}
defItem({ id: 'crate', name: 'Wooden Crate', desc: 'Stackable, breakable, flammable.', cat: 'props', mat: 'wood', mass: 22, z: 12, minY: 0.4,
  fix: [{ box: [0.4, 0.4, 0, 0] }], init(it) { breakable(it, 90, 5); }, draw: crateDraw(0.4) });
defItem({ id: 'crate_s', name: 'Small Crate', desc: 'Half-size crate. Easy to throw.', cat: 'props', mat: 'wood', mass: 9, z: 12, minY: 0.25,
  fix: [{ box: [0.25, 0.25, 0, 0] }], init(it) { breakable(it, 55, 3); }, draw: crateDraw(0.25) });
defItem({ id: 'mcrate', name: 'Steel Crate', desc: 'Riveted and heavy. Stops most bullets.', cat: 'props', mat: 'metal', mass: 90, z: 12, minY: 0.36, blunt: 1.3,
  fix: [{ box: [0.36, 0.36, 0, 0] }],
  draw(ctx) {
    fillRR(ctx, -0.36, -0.36, 0.72, 0.72, 0.03, '#4d5560', C.rim);
    fillRR(ctx, -0.3, -0.3, 0.6, 0.6, 0.02, '#58616d');
    for (let x = -0.24; x <= 0.25; x += 0.12) line(ctx, x, -0.3, x, 0.3, 'rgba(0,0,0,0.2)', 0.012);
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) fillCircle(ctx, x * 0.33, y * 0.33, 0.015, '#9aa2ac');
    fillPoly(ctx, [-0.36, 0.25, -0.25, 0.36, -0.15, 0.36, -0.36, 0.15], '#f2c230');
  } });
defItem({ id: 'plank', name: 'Plank', desc: 'A 2.4 m length of timber.', cat: 'props', mat: 'wood', mass: 9, z: 12, minY: 0.06,
  fix: [{ box: [1.2, 0.06, 0, 0] }], init(it) { breakable(it, 60, 3); },
  draw(ctx) { fillRR(ctx, -1.2, -0.06, 2.4, 0.12, 0.01, '#9b7148', C.rim); for (const x of [-0.9, -0.2, 0.6]) { ctx.strokeStyle = 'rgba(60,35,20,0.4)'; ctx.lineWidth = 0.006; ctx.beginPath(); ctx.ellipse(x, 0, 0.08, 0.025, 0, 0, TAU); ctx.stroke(); } line(ctx, -1.15, 0.025, 1.15, 0.02, 'rgba(0,0,0,0.15)', 0.005); } });
defItem({ id: 'brick', name: 'Brick', desc: 'Fits nicely in the hand. Hurts on impact.', cat: 'props', mat: 'stone', mass: 2.5, z: 12, blunt: 2.0, minY: 0.06, bullet: true,
  fix: [{ box: [0.12, 0.05, 0, 0] }],
  draw(ctx) { fillRR(ctx, -0.12, -0.05, 0.24, 0.1, 0.008, '#94442f', C.rim); ctx.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < 6; i++) ctx.fillRect(-0.1 + i * 0.035, -0.03 + (i % 2) * 0.03, 0.012, 0.01); } });
defItem({ id: 'concrete', name: 'Concrete Block', desc: 'Very heavy. Drop it from height.', cat: 'props', mat: 'stone', mass: 180, z: 12, minY: 0.3, blunt: 1.4,
  fix: [{ box: [0.5, 0.3, 0, 0] }],
  draw(ctx) { fillRR(ctx, -0.5, -0.3, 1.0, 0.6, 0.02, '#6f7276', C.rim); fillRR(ctx, -0.4, -0.18, 0.32, 0.36, 0.02, '#4f5256'); fillRR(ctx, 0.08, -0.18, 0.32, 0.36, 0.02, '#4f5256'); ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 14; i++) ctx.fillRect(Math.sin(i * 7) * 0.45, Math.cos(i * 3) * 0.25, 0.015, 0.015); } });
defItem({ id: 'ball', name: 'Steel Ball', desc: 'A rolling wrecking ball.', cat: 'props', mat: 'metal', mass: 60, z: 12, minY: 0.23, blunt: 1.6, ad: 0.05,
  fix: [{ circle: [0.22, 0, 0] }],
  draw(ctx) { fillCircle(ctx, 0, 0, 0.22, '#7d858f', C.rim); fillCircle(ctx, -0.06, 0.07, 0.07, 'rgba(255,255,255,0.18)'); fillCircle(ctx, -0.08, 0.09, 0.025, 'rgba(255,255,255,0.4)'); line(ctx, -0.2, 0, 0.2, 0, 'rgba(0,0,0,0.15)', 0.01); } });
defItem({ id: 'tire', name: 'Tyre', desc: 'Bouncy rubber.', cat: 'props', mat: 'rubber', mass: 10, z: 12, minY: 0.36, ad: 0.05,
  fix: [{ circle: [0.36, 0, 0] }],
  draw(ctx) {
    fillCircle(ctx, 0, 0, 0.36, '#1e1f22', C.rim);
    ctx.strokeStyle = '#2d2f33'; ctx.lineWidth = 0.03;
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.3, Math.sin(a) * 0.3); ctx.lineTo(Math.cos(a) * 0.355, Math.sin(a) * 0.355); ctx.stroke(); }
    fillCircle(ctx, 0, 0, 0.2, '#8f969e', '#111', 0.02); fillCircle(ctx, 0, 0, 0.06, '#5a6068');
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; fillCircle(ctx, Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.014, '#3a3e44'); }
  } });
defItem({ id: 'table', name: 'Table', desc: 'Wooden table. Breaks under abuse.', cat: 'props', mat: 'wood', mass: 18, z: 11, minY: 0.0,
  fix: [{ box: [0.7, 0.04, 0, 0.76] }, { box: [0.03, 0.36, -0.6, 0.36] }, { box: [0.03, 0.36, 0.6, 0.36] }],
  init(it) { breakable(it, 70, 4); },
  draw(ctx) { fillRR(ctx, -0.63, 0.0, 0.06, 0.74, 0.01, '#6b4a2e', C.rim); fillRR(ctx, 0.57, 0.0, 0.06, 0.74, 0.01, '#6b4a2e', C.rim); fillRR(ctx, -0.55, 0.6, 1.1, 0.08, 0.01, '#5d3f27'); fillRR(ctx, -0.72, 0.72, 1.44, 0.08, 0.015, '#8d6440', C.rim); } });
defItem({ id: 'chair', name: 'Chair', desc: 'Sit, or swing it at someone.', cat: 'props', mat: 'wood', mass: 6, z: 11, minY: 0.0, blunt: 1.3,
  fix: [{ box: [0.23, 0.03, 0, 0.45] }, { box: [0.025, 0.34, -0.21, 0.76] }, { box: [0.02, 0.21, -0.2, 0.21] }, { box: [0.02, 0.21, 0.2, 0.21] }],
  init(it) { breakable(it, 40, 2); },
  draw(ctx) {
    fillRR(ctx, -0.22, 0.0, 0.04, 0.43, 0.01, '#6b4a2e', C.rim); fillRR(ctx, 0.18, 0.0, 0.04, 0.43, 0.01, '#6b4a2e', C.rim);
    fillRR(ctx, -0.235, 0.42, 0.05, 0.68, 0.015, '#7c5434', C.rim);
    for (const y of [0.7, 0.85, 1.0]) fillRR(ctx, -0.22, y, 0.06, 0.035, 0.01, '#5d3f27');
    fillRR(ctx, -0.23, 0.42, 0.46, 0.06, 0.012, '#8d6440', C.rim);
  } });

function shatterGlass(it, b, n = 9) {
  if (it.st.broken) return;
  it.st.broken = true;
  defer(() => {
    if ((it.dead && !it.isPiece) || b._dead) return;
    const p = b.getPosition(), a = b.getAngle(), v = b.getLinearVelocity();
    const fx = b.getFixtureList(); const ab = fx.getAABB(0);
    const w = ab.upperBound.x - ab.lowerBound.x, h = ab.upperBound.y - ab.lowerBound.y;
    if (it.isPiece) it.ownerStruct.deletePiece(b); else it.remove();
    Sound.play('glass', 1);
    debrisBurst(p.x, p.y, 0, 1, 26, 'rgba(190,225,240,0.85)', 4, 0.03);
    let shards = 0; for (const e of G.entities) if (e.def === ITEM.shard) shards++;
    for (let i = 0; i < n && shards + i < 70; i++) {
      const s = new Item(ITEM.shard, p.x + rand(-w / 2, w / 2) * 0.8, p.y + rand(-h / 2, h / 2) * 0.8, false, rand(0, TAU));
      s.body.setLinearVelocity(v2(v.x + rand(-2.5, 2.5), v.y + rand(-1, 2)));
      s.body.setAngularVelocity(rand(-10, 10));
    }
  });
}
defItem({ id: 'shard', name: 'Glass Shard', hidden: true, cat: 'props', mat: 'glass', mass: 0.15, life: 14, bullet: false, z: 32,
  fix: [{ poly: [[-0.05, -0.03], [0.07, 0.0], [-0.03, 0.04]], ud: { sharp: 'edge', both: true, ny: 1, cut: 1.2, thr: 4 } }], fcat: CAT.DEBRIS, mask: 0xffff & ~CAT.DEBRIS,
  draw(ctx) { fillPoly(ctx, [-0.05, -0.03, 0.07, 0.0, -0.03, 0.04], 'rgba(190,225,240,0.45)', 'rgba(230,245,255,0.8)', 0.006); } });
defItem({ id: 'glass', name: 'Glass Pane', desc: 'Shatters into sharp shards.', cat: 'props', mat: 'glass', mass: 14, z: 13, minY: 0.61,
  fix: [{ box: [0.03, 0.6, 0, 0] }],
  init(it) { const ud = it.body.getUserData(); ud.onShot = () => shatterGlass(it, it.body); ud.onBlast = ud.onShot; ud.onImpact = (b, dv) => { if (dv > 3.5) shatterGlass(it, b); }; },
  draw(ctx) { fillRR(ctx, -0.03, -0.6, 0.06, 1.2, 0.005, 'rgba(150,200,230,0.28)', 'rgba(210,235,250,0.7)', 0.008); line(ctx, -0.01, 0.4, 0.01, 0.2, 'rgba(255,255,255,0.5)', 0.006); line(ctx, -0.01, 0.1, 0.01, 0.0, 'rgba(255,255,255,0.4)', 0.006); } });

defItem({ id: 'ramp', name: 'Ramp', desc: 'Fixed concrete ramp for launches.', cat: 'props', mat: 'stone', static: true, z: 5, minY: 0,
  fix: [{ poly: [[-1.2, 0], [1.2, 0], [1.2, 0.8]] }],
  draw(ctx) { fillPoly(ctx, [-1.2, 0, 1.2, 0, 1.2, 0.8], '#4d5056', C.rim); line(ctx, -1.0, 0.03, 1.15, 0.75, 'rgba(255,255,255,0.08)', 0.02); } });
defItem({ id: 'platform', name: 'Fixed Platform', desc: 'A steel grate frozen in mid-air. Good for drops.', cat: 'props', mat: 'metal', static: true, z: 5,
  fix: [{ box: [1.5, 0.07, 0, 0] }],
  draw(ctx) { fillRR(ctx, -1.5, -0.07, 3.0, 0.14, 0.01, '#3e444c', C.rim); for (let x = -1.4; x < 1.45; x += 0.1) line(ctx, x, -0.06, x + 0.05, 0.06, 'rgba(0,0,0,0.35)', 0.012); fillPoly(ctx, [-1.5, 0.07, -1.35, -0.07, -1.25, -0.07, -1.4, 0.07], '#f2c230'); fillPoly(ctx, [1.5, 0.07, 1.35, -0.07, 1.25, -0.07, 1.4, 0.07], '#f2c230'); } });
defItem({ id: 'wall', name: 'Concrete Wall', desc: 'A fixed 3 m wall. Blasts can knock it loose.', cat: 'props', mat: 'stone', static: true, z: 5, minY: 1.5,
  fix: [{ box: [0.15, 1.5, 0, 0] }],
  init(it) { const ud = it.body.getUserData(); ud.hp = 160; ud.onBlast = (b, k) => { ud.hp -= k * 150; if (ud.hp <= 0 && b.isStatic()) defer(() => { if (!b._dead) b.setType('dynamic'); }); }; ud.onShot = (b, p, d) => { ud.hp -= d * 0.05; }; },
  draw(ctx) { fillRR(ctx, -0.15, -1.5, 0.3, 3.0, 0.01, '#5d6066', C.rim); for (let y = -1.2; y < 1.5; y += 0.5) line(ctx, -0.15, y, 0.15, y, 'rgba(0,0,0,0.25)', 0.008); } });
defItem({ id: 'spikes', name: 'Spike Strip', desc: 'Fixed spikes. Drop dummies onto them.', cat: 'props', mat: 'metal', static: true, z: 22, minY: 0,
  fix: [{ box: [0.6, 0.04, 0, 0.04] }, ...[-0.48, -0.24, 0, 0.24, 0.48].map((x) => ({ poly: [[x - 0.05, 0.08], [x + 0.05, 0.08], [x, 0.42]], ud: { sharp: 'tip', ax: 0, ay: 1, stab: 6, thr: 2.2, depth: 0.28, friction: 500, breakF: 12000 } }))],
  draw(ctx) { fillRR(ctx, -0.6, 0, 1.2, 0.08, 0.01, '#3e444c', C.rim); for (const x of [-0.48, -0.24, 0, 0.24, 0.48]) { fillPoly(ctx, [x - 0.05, 0.08, x + 0.05, 0.08, x, 0.42], '#aab2bc', C.rim); line(ctx, x, 0.1, x, 0.38, 'rgba(255,255,255,0.3)', 0.005); } } });

/* ============================================================ PEOPLE */
defItem({ id: 'dummy', name: 'Dummy', desc: 'A grey crash-test dummy. Feels pain, bleeds, breaks bones and tries to stand.', cat: 'people',
  spawn: (x, y, f) => new Dummy(x, Math.max(0.0, y), f ? -1 : 1), bb: [-0.25, 0, 0.25, 1.8],
  ghost(ctx, flip) { drawDummyIcon(ctx, flip ? -1 : 1); }, icon(ctx) { drawDummyIcon(ctx, 1); } });
function drawDummyIcon(ctx, f) {
  ctx.save(); ctx.scale(f, 1);
  const g = SKIN, r = 0.012;
  fillRR(ctx, -0.062, 0.07, 0.124, 0.43, r, g.back); fillRR(ctx, -0.075, 0.465, 0.15, 0.47, r, g.back); fillRR(ctx, -0.075, 0.0, 0.26, 0.08, 0.01, '#2b2e33');
  fillRR(ctx, -0.055, 0.825, 0.1, 0.35, r, g.back); fillRR(ctx, -0.055, 1.17, 0.11, 0.33, r, g.back);
  fillRR(ctx, -0.17, 1.2, 0.34, 0.34, r, g.mid); fillRR(ctx, -0.15, 0.935, 0.3, 0.27, r, g.mid);
  fillRR(ctx, -0.022, 0.07, 0.124, 0.43, r, g.front); fillRR(ctx, -0.035, 0.465, 0.15, 0.47, r, g.front); fillRR(ctx, -0.022, 0.0, 0.26, 0.08, 0.01, '#33363c');
  fillRR(ctx, -0.1, 1.545, 0.2, 0.24, r, g.head);
  fillRR(ctx, 0.046, 1.678, 0.024, 0.024, 0.003, '#121316');
  drawMarker(ctx, -0.015, 1.67, 0.034);
  fillRR(ctx, 0.0, 0.825, 0.1, 0.35, r, g.front); fillRR(ctx, -0.005, 1.17, 0.11, 0.33, r, g.front);
  ctx.restore();
}

/* ============================================================ BUILDINGS */
function brickTex(ctx, x0, y0, x1, y1, col, mortar) {
  ctx.fillStyle = col; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = mortar; ctx.lineWidth = 0.014;
  let row = 0;
  for (let y = y0; y < y1; y += 0.16, row++) {
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    for (let x = x0 + (row % 2) * 0.15; x < x1; x += 0.3) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 0.16); ctx.stroke(); }
  }
}

class Structure extends Entity {
  constructor(name) { super('structure'); this.name = name; this.z = 4; this.pieces = []; this.backdrop = null; }
  addPiece(o, fix, style, supports = []) {
    const b = makeBody(this, { type: 'static', x: o.x, y: o.y, angle: o.a || 0, mat: o.mat || 'stone', ud: { fill: o.fill } }, fix);
    const ud = b.getUserData();
    const pc = { b, style, hp: o.hp || 150, supports, loose: false, w: o.w, h: o.h, draw: o.draw };
    ud.piece = pc;
    ud.onShot = (bb, p, dmg) => { if (style === 'glass') { shatterGlass({ st: pc, isPiece: true, ownerStruct: this, dead: false }, bb, 10); return; } pc.hp -= dmg * 0.08; if (pc.hp <= 0) this.loosen(pc); };
    ud.onBlast = (bb, k) => { if (style === 'glass') { ud.onShot(bb); return; } pc.hp -= k * 220; if (pc.hp <= 0) this.loosen(pc, k); };
    ud.onImpact = (bb, dv) => { if (style === 'glass' && dv > 4) ud.onShot(bb); };
    if (style === 'wood' || style === 'roof' || style === 'door') ud.flammable = true;
    ud.onBreak = () => this.loosen(pc);
    this.pieces.push(pc);
    return pc;
  }
  loosen(pc, k = 0.5) {
    if (pc.loose) return;
    pc.loose = true;
    defer(() => {
      if (pc.b._dead) return;
      pc.b.setType('dynamic');
      pc.b.setAwake(true);
      pc.b.applyAngularImpulse(rand(-1, 1) * pc.b.getMass() * 0.1 * k, true);
      Sound.play('stone', 0.8);
      debrisBurst(pc.b.getPosition().x, pc.b.getPosition().y, 0, 1, 10, '#5a5048', 3, 0.05);
      smoke(pc.b.getPosition().x, pc.b.getPosition().y, 6, 0.3, 'rgba(90,86,82,', 2.5);
      this.cascade();
    }, 0.02);
  }
  cascade() {
    for (const p of this.pieces) {
      if (p.loose || !p.supports.length) continue;
      if (p.supports.every((s) => s.loose || s.b._dead)) { defer(() => this.loosen(p, 0.2), rand(0.05, 0.25)); }
    }
  }
  deletePiece(b) {
    const pc = this.pieces.find((p) => p.b === b);
    killBody(b);
    if (pc) { pc.loose = true; pc.gone = true; this.cascade(); }
    this.bodies = this.bodies.filter((x) => x !== b);
    if (!this.bodies.length) this.remove();
  }
  draw(ctx) {
    for (const pc of this.pieces) {
      const b = pc.b;
      if (b._dead) continue;
      const ud = b.getUserData();
      const p = b.getPosition();
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.getAngle());
      const path = bodyPath(b);
      const [bx0, by0, bx1, by1] = ud._bounds;
      ctx.save(); ctx.clip(path);
      switch (pc.style) {
        case 'brick': brickTex(ctx, bx0, by0, bx1, by1, '#4b4440', '#2c2724'); break;
        case 'concrete': ctx.fillStyle = '#55585d'; ctx.fill(path); for (let y = by0; y < by1; y += 0.5) line(ctx, bx0, y, bx1, y, 'rgba(0,0,0,0.2)', 0.01); break;
        case 'wood': ctx.fillStyle = '#5e4630'; ctx.fill(path); for (let y = by0 + 0.05; y < by1; y += 0.07) line(ctx, bx0, y, bx1, y, 'rgba(0,0,0,0.25)', 0.008); break;
        case 'roof': ctx.fillStyle = '#383c44'; ctx.fill(path); for (let x = bx0; x < bx1; x += 0.2) line(ctx, x, by0, x + 0.02, by1, 'rgba(0,0,0,0.3)', 0.012); break;
        case 'metal': ctx.fillStyle = '#3e444c'; ctx.fill(path); for (let y = by0; y < by1; y += 0.4) line(ctx, bx0, y, bx1, y + 0.3, 'rgba(0,0,0,0.3)', 0.02); break;
        case 'glass': ctx.fillStyle = 'rgba(140,190,225,0.22)'; ctx.fill(path); line(ctx, bx0 * 0.5, by1 * 0.6, bx1 * 0.5, by1 * 0.2, 'rgba(255,255,255,0.5)', 0.012); break;
      }
      if (ud.char) { ctx.fillStyle = `rgba(10,8,6,${ud.char * 0.7})`; ctx.fill(path); }
      drawStains(ctx, b);
      ctx.restore();
      ctx.strokeStyle = pc.style === 'glass' ? 'rgba(210,235,250,0.6)' : 'rgba(255,255,255,0.1)'; ctx.lineWidth = 0.014; ctx.stroke(path);
      ctx.restore();
    }
  }
}

class Backdrop extends Entity {
  constructor(drawFn) { super('backdrop'); this.z = -40; this.drawFn = drawFn; this.name = 'Backdrop'; }
  draw(ctx) { this.drawFn(ctx); }
}

function buildHouse(x, y, flip) {
  const s = new Structure('House');
  const X = x - 3.5, top = 3.0;
  const floor = s.addPiece({ x: X + 3.5, y: 0.09, mat: 'stone', w: 3.6, h: 0.09 }, [{ shape: Sh.box(3.6, 0.09) }], 'concrete');
  const lintel = s.addPiece({ x: X + 0.125, y: 2.65, mat: 'stone', w: 0.125, h: 0.35 }, [{ shape: Sh.box(0.125, 0.35) }], 'brick');
  const rLow = s.addPiece({ x: X + 6.875, y: 0.6, mat: 'stone', w: 0.125, h: 0.42 }, [{ shape: Sh.box(0.125, 0.42) }], 'brick', [floor]);
  const glass = s.addPiece({ x: X + 6.875, y: 1.5, mat: 'glass', w: 0.03, h: 0.48 }, [{ shape: Sh.box(0.03, 0.48), mat: 'glass' }], 'glass', [rLow]);
  const rUp = s.addPiece({ x: X + 6.875, y: 2.5, mat: 'stone', w: 0.125, h: 0.5 }, [{ shape: Sh.box(0.125, 0.5) }], 'brick', [rLow]);
  const ceil = s.addPiece({ x: X + 3.5, y: 3.11, mat: 'wood', w: 3.7, h: 0.11 }, [{ shape: Sh.box(3.7, 0.11), mat: 'wood' }], 'wood', [lintel, rUp]);
  lintel.supports = [ceil];
  const roofL = s.addPiece({ x: 0, y: 0, mat: 'wood' }, [{ shape: Sh.poly([[X - 0.45, 3.22], [X - 0.1, 3.22], [X + 3.5, 4.75], [X + 3.5, 5.0]]), mat: 'wood' }], 'roof', [ceil]);
  const roofR = s.addPiece({ x: 0, y: 0, mat: 'wood' }, [{ shape: Sh.poly([[X + 7.45, 3.22], [X + 7.1, 3.22], [X + 3.5, 4.75], [X + 3.5, 5.0]]), mat: 'wood' }], 'roof', [ceil]);
  s.addPiece({ x: X + 5.3, y: 4.55, mat: 'stone', w: 0.2, h: 0.7 }, [{ shape: Sh.box(0.2, 0.7) }], 'brick', [roofR]);
  // hinged door
  const door = new Item(ITEM.door, X + 0.125, 1.24, false, 0);
  const dj = G.world.createJoint(new PL.RevoluteJoint({ enableLimit: true, lowerAngle: -1.45, upperAngle: 1.45, enableMotor: true, maxMotorTorque: 4, motorSpeed: 0 }, lintel.b, door.body, v2(X + 0.125, 2.29)));
  door.joints.push(dj);
  // furniture
  new Item(ITEM.table, X + 3.9, 0.19, false);
  new Item(ITEM.chair, X + 2.9, 0.19, false);
  new Item(ITEM.crate_s, X + 6.2, 0.45, false);
  const lamp = new Item(ITEM.lampc, X + 3.9, 2.25, false);
  makeRope(ceil.b, lamp.body, v2(X + 3.9, 3.0), lamp.body.getWorldPoint(v2(0, 0.08)), 0.78, false);
  new Backdrop((ctx) => {
    ctx.fillStyle = '#16151a'; ctx.fillRect(X + 0.25, 0.18, 6.5, 2.82);
    ctx.fillStyle = 'rgba(255,255,255,0.025)'; for (let xx = X + 0.4; xx < X + 6.7; xx += 0.3) ctx.fillRect(xx, 0.18, 0.12, 2.82);
    ctx.fillStyle = '#211d1a'; ctx.fillRect(X + 0.25, 0.18, 6.5, 0.14);
    fillRR(ctx, X + 1.6, 1.45, 0.9, 0.65, 0.01, '#2b2620', '#6b5332', 0.04);
    ctx.fillStyle = '#3a4a5a'; ctx.fillRect(X + 1.68, 1.53, 0.74, 0.49);
    fillPoly(ctx, [X + 1.68, 1.53, X + 1.95, 1.85, X + 2.15, 1.65, X + 2.42, 1.95, X + 2.42, 1.53], '#2c3a2c');
    fillRR(ctx, X + 4.8, 1.7, 1.2, 0.05, 0.01, '#4a3524');
    fillRR(ctx, X + 4.9, 1.75, 0.12, 0.25, 0.02, '#3b6e5c'); fillRR(ctx, X + 5.1, 1.75, 0.1, 0.18, 0.02, '#7a3b3b'); fillRR(ctx, X + 5.3, 1.75, 0.2, 0.14, 0.01, '#5a5a3a');
    fillPoly(ctx, [X - 0.1, 3.22, X + 7.1, 3.22, X + 3.5, 4.75], '#121115');
  });
  return s;
}
defItem({ id: 'door', name: 'Door', hidden: true, cat: 'structures', mat: 'wood', mass: 20, z: 6,
  fix: [{ box: [0.05, 1.05, 0, 0] }],
  init(it) { breakable(it, 70, 4); },
  draw(ctx) { fillRR(ctx, -0.05, -1.05, 0.1, 2.1, 0.01, '#6b4a2e', C.rim); fillRR(ctx, -0.035, 0.1, 0.07, 0.8, 0.01, '#5b3e26'); fillRR(ctx, -0.035, -0.95, 0.07, 0.8, 0.01, '#5b3e26'); fillCircle(ctx, 0.0, -0.05, 0.025, C.brass); } });
defItem({ id: 'lampc', name: 'Ceiling Lamp', hidden: true, cat: 'misc', mat: 'glass', mass: 1.2, z: 31, ld: 0.2,
  fix: ITEM.lamp.fix, init(it) { it.st.on = true; const ud = it.body.getUserData(); ud.onShot = () => { if (it.st.on) { it.st.on = false; Sound.play('glass', 0.7); } }; ud.onBlast = ud.onShot; ud.onImpact = (b, dv) => { if (dv > 7) ud.onShot(); }; },
  lightFx: ITEM.lamp.lightFx, draw: ITEM.lamp.draw });

defItem({ id: 'house', name: 'House', desc: 'A small brick house with a door, window and furniture. Destructible.', cat: 'structures',
  spawn: (x, y, f) => buildHouse(x, 0, f), bb: [-3.9, 0, 3.9, 5.2], ground: true,
  ghost(ctx) { ctx.strokeStyle = 'rgba(242,194,48,0.7)'; ctx.lineWidth = 0.04; ctx.strokeRect(-3.5, 0, 7, 3.2); ctx.beginPath(); ctx.moveTo(-3.9, 3.2); ctx.lineTo(0, 5); ctx.lineTo(3.9, 3.2); ctx.stroke(); },
  icon(ctx) { fillRR(ctx, -3.5, 0, 7, 3.2, 0.05, '#4b4440'); fillPoly(ctx, [-3.95, 3.1, 0, 5.0, 3.95, 3.1], '#383c44'); fillRR(ctx, -3.5, 0, 0.6, 2.3, 0.05, '#6b4a2e'); fillRR(ctx, 2.2, 1.0, 1.2, 1.0, 0.05, '#6c93ad'); fillRR(ctx, 1.6, 3.6, 0.45, 1.2, 0.02, '#4b4440'); } });

function buildTower(x, y, flip) {
  const s = new Structure('Watchtower');
  const H = 12;
  const pL = s.addPiece({ x: x - 1.25, y: H / 2, mat: 'metal', w: 0.08, h: H / 2 }, [{ shape: Sh.box(0.08, H / 2), mat: 'metal' }], 'metal');
  const pR = s.addPiece({ x: x + 1.25, y: H / 2, mat: 'metal', w: 0.08, h: H / 2 }, [{ shape: Sh.box(0.08, H / 2), mat: 'metal' }], 'metal');
  for (const h of [4, 8, 12]) {
    s.addPiece({ x, y: h, mat: 'wood', w: 1.6, h: 0.07 }, [{ shape: Sh.box(1.6, 0.07), mat: 'wood' }], 'wood', [pL, pR]);
    s.addPiece({ x: x + 1.55, y: h + 0.5, mat: 'metal', w: 0.03, h: 0.45 }, [{ shape: Sh.box(0.03, 0.45), mat: 'metal' }], 'metal', [pR]);
  }
  new Backdrop((ctx) => {
    ctx.strokeStyle = '#2a2d33'; ctx.lineWidth = 0.05;
    for (let h = 0; h < H; h += 4) { ctx.beginPath(); ctx.moveTo(x - 1.2, h); ctx.lineTo(x + 1.2, h + 4); ctx.moveTo(x + 1.2, h); ctx.lineTo(x - 1.2, h + 4); ctx.stroke(); }
    ctx.strokeStyle = '#4a4e56'; ctx.lineWidth = 0.035;
    ctx.beginPath(); ctx.moveTo(x - 1.45, 0); ctx.lineTo(x - 1.45, H); ctx.moveTo(x - 1.8, 0); ctx.lineTo(x - 1.8, H); ctx.stroke();
    for (let h = 0.3; h < H; h += 0.35) line(ctx, x - 1.8, h, x - 1.45, h, '#4a4e56', 0.03);
  });
  return s;
}
defItem({ id: 'tower', name: 'Watchtower', desc: 'Twelve metres of scaffold. Perfect for fall testing.', cat: 'structures',
  spawn: (x, y, f) => buildTower(x, 0, f), bb: [-1.9, 0, 1.7, 13], ground: true,
  ghost(ctx) { ctx.strokeStyle = 'rgba(242,194,48,0.7)'; ctx.lineWidth = 0.04; ctx.strokeRect(-1.33, 0, 2.66, 12.1); for (const h of [4, 8, 12]) { ctx.beginPath(); ctx.moveTo(-1.6, h); ctx.lineTo(1.6, h); ctx.stroke(); } },
  icon(ctx) { fillRR(ctx, -1.33, 0, 0.16, 12, 0.02, '#3e444c'); fillRR(ctx, 1.17, 0, 0.16, 12, 0.02, '#3e444c'); for (const h of [4, 8, 12]) fillRR(ctx, -1.6, h - 0.07, 3.2, 0.3, 0.02, '#5e4630'); ctx.strokeStyle = '#2a2d33'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(-1.2, 0); ctx.lineTo(1.2, 4); ctx.lineTo(-1.2, 8); ctx.lineTo(1.2, 12); ctx.stroke(); } });

/* ------------------------------------------------------------ spawning */
function spawnItem(id, x, y, flip = false, ang = 0) {
  const d = ITEM[id];
  if (!d) return null;
  if (d.spawn) return d.spawn(x, y, flip, ang);
  if (!d.static) {
    const bb = d.bb || fixBounds(d.fix);
    const minY = d.minY != null ? d.minY : Math.max(0.05, -Math.min(bb[1], 0) + 0.02);
    y = Math.max(y, minY);
  } else if (d.minY != null && y < d.minY) y = d.minY;
  return new Item(d, x, y, flip, ang);
}
