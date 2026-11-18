'use strict';
/* ============================================================
   VOIDBOX core: world, materials, entities, contacts, particles
   ============================================================ */
const PL = planck;
const Vec2 = PL.Vec2;
const v2 = (x, y) => new Vec2(x, y);
const DT = 1 / 120;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const angNorm = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/* Materials. density is "2D density" (kg per m^2 of side profile). */
const MAT = {
  flesh:   { density: 110, friction: 0.75, restitution: 0.04, resist: 24, soft: true,  sound: 'flesh' },
  wood:    { density: 45,  friction: 0.6,  restitution: 0.12, resist: 20, soft: true,  sound: 'wood', flammable: true, spark: 'splinter' },
  metal:   { density: 160, friction: 0.4,  restitution: 0.08, resist: 75, soft: false, sound: 'metal', spark: 'spark' },
  stone:   { density: 190, friction: 0.85, restitution: 0.04, resist: 95, soft: false, sound: 'stone', spark: 'dust' },
  glass:   { density: 70,  friction: 0.3,  restitution: 0.08, resist: 4,  soft: false, sound: 'glass', spark: 'glass' },
  rubber:  { density: 40,  friction: 1.1,  restitution: 0.55, resist: 16, soft: true,  sound: 'rubber', spark: 'dust' },
  plastic: { density: 35,  friction: 0.5,  restitution: 0.2,  resist: 12, soft: false, sound: 'plastic', spark: 'dust' },
  energy:  { density: 1,   friction: 0,    restitution: 0,    resist: 0,  soft: false, sound: 'none' },
};

const CAT = { DEFAULT: 0x0001, FLESH: 0x0002, DEBRIS: 0x0004, ITEM: 0x0008 };

const BLOOD = ['#9b30d0', '#8526b8', '#7a1fa8', '#6c1896'];
const BLOOD_DARK = '#3b0b52';

const G = {
  world: null, ground: null, groundEnt: null,
  entities: [], dummies: [],
  time: 0, steps: 0,
  paused: false, slowmo: false,
  particles: [], tracers: [], beams: [], lights: [], fires: [],
  deferred: [], noCollide: new Map(), contactEvents: [], impactRec: new Map(),
  nextId: 1, groupCounter: 1, shake: 0,
  lifeView: false, selected: null, hover: null,
  stainBodies: new Set(),
  ropes: [], pins: [],
};

function defer(fn, delay = 0) { G.deferred.push({ t: G.time + delay, fn }); }

/* -------------------- Entities -------------------- */
class Entity {
  constructor(kind) {
    this.id = G.nextId++;
    this.kind = kind;
    this.bodies = [];
    this.joints = [];
    this.dead = false;
    this.z = 10;
    this.name = kind;
    this.born = G.time;
    G.entities.push(this);
  }
  get body() { return this.bodies[0]; }
  update(dt) {}
  activate() {}
  holdActivate(dt) {}
  releaseActivate() {}
  draw(ctx) { for (const b of this.bodies) if (!b._dead) drawBodyGeneric(ctx, b); }
  totalMass() { let m = 0; for (const b of this.bodies) if (!b._dead) m += b.getMass(); return m; }
  remove() {
    if (this.dead) return;
    this.dead = true;
    this.onRemove && this.onRemove();
    for (const j of this.joints) killJoint(j);
    for (const b of this.bodies) killBody(b);
    const i = G.entities.indexOf(this);
    if (i >= 0) G.entities.splice(i, 1);
    if (G.selected === this) G.selected = null;
  }
}

function killJoint(j) {
  if (!j || j._dead) return;
  j._dead = true;
  try { G.world.destroyJoint(j); } catch (e) {}
}
function killBody(b) {
  if (!b || b._dead) return;
  for (let je = b.getJointList(); je; je = je.next) je.joint._dead = true;
  b._dead = true;
  G.stainBodies.delete(b);
  if (typeof Input !== 'undefined' && Input.drag && Input.drag.body === b) Input.endDrag();
  try { G.world.destroyBody(b); } catch (e) {}
}

/* body creation helper. fixtures: [{shape, mat, density, friction, restitution, sensor, group, cat, mask, ud}] */
function makeBody(ent, o, fixtures) {
  const b = G.world.createBody({
    type: o.type || 'dynamic',
    position: v2(o.x, o.y),
    angle: o.angle || 0,
    bullet: !!o.bullet,
    linearDamping: o.ld != null ? o.ld : 0.03,
    angularDamping: o.ad != null ? o.ad : 0.08,
  });
  const ud = Object.assign({ id: G.nextId++, ent, mat: o.mat || 'wood', stains: [], sy: o.sy || 1, blunt: o.blunt || 1 }, o.ud || {});
  b.setUserData(ud);
  for (const f of fixtures) {
    const m = MAT[f.mat || ud.mat] || MAT.wood;
    b.createFixture(f.shape, {
      density: f.density != null ? f.density : m.density,
      friction: f.friction != null ? f.friction : m.friction,
      restitution: f.restitution != null ? f.restitution : m.restitution,
      isSensor: !!f.sensor,
      filterGroupIndex: f.group || o.group || 0,
      filterCategoryBits: f.cat || o.cat || CAT.DEFAULT,
      filterMaskBits: f.mask != null ? f.mask : (o.mask != null ? o.mask : 0xffff),
      userData: Object.assign({ mat: f.mat || ud.mat }, f.ud || {}),
    });
  }
  if (o.vx || o.vy) b.setLinearVelocity(v2(o.vx || 0, o.vy || 0));
  if (o.w) b.setAngularVelocity(o.w);
  if (ent) ent.bodies.push(b);
  return b;
}

/* shapes, with optional y-mirror (sy) for flipped items */
const Sh = {
  box: (hw, hh, cx = 0, cy = 0, a = 0, sy = 1) => new PL.Box(hw, hh, v2(cx, cy * sy), a * sy),
  circle: (r, cx = 0, cy = 0, sy = 1) => new PL.Circle(v2(cx, cy * sy), r),
  poly: (pts, sy = 1) => new PL.Polygon(pts.map((p) => v2(p[0], p[1] * sy))),
};

/* rope between two world points (planck's RopeJoint takes a single anchor, so pass local anchors) */
function makeRope(bA, bB, pA, pB, len, collide = true) {
  const j = G.world.createJoint(new PL.RopeJoint({ maxLength: len, localAnchorA: bA.getLocalPoint(pA), localAnchorB: bB.getLocalPoint(pB), collideConnected: collide }, bA, bB));
  G.ropes.push({ j, len });
  return j;
}

function entOf(body) { const u = body && body.getUserData(); return u ? u.ent : null; }
function udOf(body) { return body ? body.getUserData() : null; }
function bodyMat(body) { const u = udOf(body); return (u && u.mat) || 'stone'; }

/* -------------------- World -------------------- */
function initWorld() {
  G.world = new PL.World({ gravity: v2(0, -9.8) });
  G.world.on('pre-solve', onPreSolve);
  G.world.on('post-solve', onPostSolve);
  G.world.on('begin-contact', onBeginContact);
  G.groundEnt = new Entity('ground');
  G.groundEnt.z = -50;
  G.groundEnt.draw = () => {};
  G.ground = makeBody(G.groundEnt, { type: 'static', x: 0, y: -2, mat: 'stone', ud: { isGround: true } },
    [{ shape: Sh.box(600, 2), friction: 0.9 }]);
}

function resetWorld() {
  for (const e of G.entities.slice()) if (e !== G.groundEnt) e.remove();
  G.particles.length = 0; G.tracers.length = 0; G.beams.length = 0;
  G.deferred.length = 0; G.noCollide.clear(); G.contactEvents.length = 0;
  G.ground.getUserData().stains.length = 0;
  for (const b of G.stainBodies) if (!b._dead) b.getUserData().stains.length = 0;
  G.stainBodies.clear();
  G.ropes.length = 0; G.pins.length = 0;
  Combat.reset();
  G.selected = null;
}

/* -------------------- Contacts -------------------- */
function pairKey(a, b) { const x = a.getUserData().id, y = b.getUserData().id; return x < y ? x + '|' + y : y + '|' + x; }
function noCollide(a, b, sec) { G.noCollide.set(pairKey(a, b), G.time + sec); }

function onPreSolve(contact) {
  const fa = contact.getFixtureA(), fb = contact.getFixtureB();
  const ba = fa.getBody(), bb = fb.getBody();
  if (G.noCollide.size) {
    const t = G.noCollide.get(pairKey(ba, bb));
    if (t !== undefined) {
      if (t > G.time) { contact.setEnabled(false); return; }
      G.noCollide.delete(pairKey(ba, bb));
    }
  }
  const ua = ba.getUserData(), ub = bb.getUserData();
  if ((ua.passFlesh && ub.mat === 'flesh') || (ub.passFlesh && ua.mat === 'flesh')) { contact.setEnabled(false); return; }
  // a blade tip arriving fast enough to stab in: let it through, the impale joint takes over after the step
  const da = fa.getUserData(), db = fb.getUserData();
  if ((da && da.sharp === 'tip') || (db && db.sharp === 'tip')) {
    const wm = contact.getWorldManifold(null);
    if (!wm || !wm.points || !wm.points.length) return;
    const p = v2(wm.points[0].x, wm.points[0].y);
    const va = ba.getLinearVelocityFromWorldPoint(p), vb = bb.getLinearVelocityFromWorldPoint(p);
    const rv = v2(va.x - vb.x, va.y - vb.y);
    if ((da && da.sharp === 'tip' && Combat.tipWouldImpale(fa, fb, p, rv)) || (db && db.sharp === 'tip' && Combat.tipWouldImpale(fb, fa, p, v2(-rv.x, -rv.y)))) {
      contact.setEnabled(false);
    }
  }
}

function onBeginContact(contact) {
  const fa = contact.getFixtureA(), fb = contact.getFixtureB();
  const da = fa.getUserData() || {}, db = fb.getUserData() || {};
  const ba = fa.getBody(), bb = fb.getBody();
  const ua = ba.getUserData(), ub = bb.getUserData();
  const strike = (ua.blunt > 1 && ub.part) || (ub.blunt > 1 && ua.part);
  if (da.sharp || db.sharp || ua.onTouch || ub.onTouch || strike) {
    const wm = contact.getWorldManifold(null);
    let p = null;
    if (wm && wm.points && wm.points.length && contact.getManifold().pointCount > 0) p = v2(wm.points[0].x, wm.points[0].y);
    // velocities here are pre-solve, i.e. the true impact velocities
    let rv = v2(0, 0);
    if (p) {
      const va = ba.getLinearVelocityFromWorldPoint(p), vb = bb.getLinearVelocityFromWorldPoint(p);
      rv = v2(va.x - vb.x, va.y - vb.y);
    }
    G.contactEvents.push({ fa, fb, p, n: wm ? v2(wm.normal.x, wm.normal.y) : v2(0, 1), rv, strike });
  }
}

function onPostSolve(contact, impulse) {
  const n = contact.getManifold().pointCount;
  let J = 0;
  for (let i = 0; i < n; i++) J += impulse.normalImpulses[i];
  if (J < 0.5) return;
  const ba = contact.getFixtureA().getBody(), bb = contact.getFixtureB().getBody();
  rec(ba, bb, J, contact);
  rec(bb, ba, J, contact);
}
function rec(b, other, J, contact) {
  const r = G.impactRec.get(b);
  if (!r || r.J < J) G.impactRec.set(b, { J, other, contact });
}

/* -------------------- Raycasting -------------------- */
function rayAll(p1, p2, filter) {
  const hits = [];
  if (p1.x === p2.x && p1.y === p2.y) return hits;
  G.world.rayCast(p1, p2, (fx, pt, n, fr) => {
    if (fx.isSensor()) return -1;
    if (filter && !filter(fx)) return -1;
    hits.push({ fx, body: fx.getBody(), p: v2(pt.x, pt.y), n: v2(n.x, n.y), f: fr });
    return 1;
  });
  hits.sort((a, b) => a.f - b.f);
  return hits;
}
function rayFirst(p1, p2, filter) {
  let best = null;
  if (p1.x === p2.x && p1.y === p2.y) return null;
  G.world.rayCast(p1, p2, (fx, pt, n, fr) => {
    if (fx.isSensor()) return -1;
    if (filter && !filter(fx)) return -1;
    best = { fx, body: fx.getBody(), p: v2(pt.x, pt.y), n: v2(n.x, n.y), f: fr };
    return fr;
  });
  return best;
}
/* exit point of a ray through a single fixture */
function exitPoint(fx, p, dir, maxLen = 1.2) {
  const out = {};
  const p1 = v2(p.x + dir.x * maxLen, p.y + dir.y * maxLen);
  if (fx.rayCast(out, { p1, p2: p, maxFraction: 1 }, 0)) {
    return { p: v2(p1.x + (p.x - p1.x) * out.fraction, p1.y + (p.y - p1.y) * out.fraction), n: out.normal, len: maxLen * (1 - out.fraction) };
  }
  return null;
}
function bodiesAt(p) {
  const res = [];
  const aabb = new PL.AABB(v2(p.x - 0.01, p.y - 0.01), v2(p.x + 0.01, p.y + 0.01));
  G.world.queryAABB(aabb, (fx) => { if (!fx.isSensor() && fx.testPoint(p)) res.push(fx); return true; });
  return res;
}
function queryBodies(x, y, r) {
  const set = new Set();
  G.world.queryAABB(new PL.AABB(v2(x - r, y - r), v2(x + r, y + r)), (fx) => { set.add(fx.getBody()); return true; });
  return [...set];
}

/* -------------------- Particles -------------------- */
const MAX_PARTICLES = 2600;
function addP(p) {
  if (G.particles.length >= MAX_PARTICLES) {
    if (p.type === 'smoke' || p.type === 'spark') return;
    G.particles.splice(0, 50);
  }
  p.life = p.life || 1; p.max = p.life; p.vx = p.vx || 0; p.vy = p.vy || 0;
  G.particles.push(p);
  return p;
}

function bloodSpray(x, y, dx, dy, count, speed, spread = 0.5, size = 1) {
  const a0 = Math.atan2(dy, dx);
  for (let i = 0; i < count; i++) {
    const a = a0 + rand(-spread, spread);
    const s = speed * rand(0.35, 1.1);
    addP({ type: 'blood', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(1.2, 2.5), size: rand(0.012, 0.03) * size, color: pick(BLOOD) });
  }
}
function sparks(x, y, nx, ny, count, col = '#ffd27a', speed = 6) {
  const a0 = Math.atan2(ny, nx);
  for (let i = 0; i < count; i++) {
    const a = a0 + rand(-1.1, 1.1), s = speed * rand(0.3, 1.2);
    addP({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.15, 0.45), size: rand(0.008, 0.018), color: col });
  }
}
function debrisBurst(x, y, nx, ny, count, col, speed = 3, size = 0.03) {
  const a0 = Math.atan2(ny, nx);
  for (let i = 0; i < count; i++) {
    const a = a0 + rand(-1.2, 1.2), s = speed * rand(0.3, 1.2);
    addP({ type: 'debris', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.8, 2.2), size: size * rand(0.5, 1.3), color: col, rot: rand(0, TAU), w: rand(-15, 15) });
  }
}
function smoke(x, y, count, size = 0.25, col = 'rgba(120,120,128,', life = 2, vx = 0, vy = 0.6) {
  for (let i = 0; i < count; i++) {
    addP({ type: 'smoke', x: x + rand(-0.1, 0.1), y: y + rand(-0.1, 0.1), vx: vx + rand(-0.4, 0.4), vy: vy + rand(-0.2, 0.4), life: life * rand(0.6, 1.3), size: size * rand(0.6, 1.4), col });
  }
}
function impactFx(mat, x, y, nx, ny, strength = 1) {
  const m = MAT[mat] || MAT.stone;
  switch (m.spark) {
    case 'spark': sparks(x, y, nx, ny, Math.round(6 * strength), '#ffdf8a', 7); break;
    case 'splinter': debrisBurst(x, y, nx, ny, Math.round(5 * strength), '#a07848', 3.5, 0.025); smoke(x, y, 1, 0.08, 'rgba(160,140,110,', 0.6); break;
    case 'glass': debrisBurst(x, y, nx, ny, Math.round(8 * strength), 'rgba(190,225,240,0.85)', 4, 0.025); break;
    case 'dust': default: debrisBurst(x, y, nx, ny, Math.round(4 * strength), '#6a6a70', 2.5, 0.02); smoke(x, y, 2, 0.1, 'rgba(110,110,118,', 0.8); break;
  }
}

function addStain(body, wx, wy, r, color) {
  if (!body || body._dead) return;
  const ud = body.getUserData();
  if (!ud || !ud.stains || ud.noStain) return;
  const lp = body.getLocalPoint(v2(wx, wy));
  const st = ud.stains;
  const isG = !!ud.isGround;
  const maxR = isG ? 0.7 : 0.1;
  for (let i = st.length - 1; i >= Math.max(0, st.length - 40); i--) {
    const s = st[i];
    if (Math.abs(s.x - lp.x) < s.r * 0.9 && Math.abs(s.y - lp.y) < s.r * 0.9 + 0.05) {
      if (s.r < maxR) s.r += r * (isG ? 0.18 : 0.12);
      return;
    }
  }
  st.push({ x: lp.x, y: isG ? 2 : lp.y, r, c: color, a: rand(0, TAU) });
  if (st.length > (isG ? 450 : 30)) st.shift();
  G.stainBodies.add(body);
}

function updateParticles(dt) {
  const ps = G.particles;
  let w = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) continue;
    const ox = p.x, oy = p.y;
    switch (p.type) {
      case 'blood':
        p.vy -= 9.8 * dt; p.vx *= 0.995;
        p.x += p.vx * dt; p.y += p.vy * dt;
        {
          const h = rayFirst(v2(ox, oy), v2(p.x, p.y), (fx) => !fx.getBody().getUserData().noStain);
          if (h) {
            addStain(h.body, h.p.x, h.p.y, p.size * rand(1.4, 2.6), p.color);
            continue;
          }
        }
        break;
      case 'spark':
        p.vy -= 9.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y < 0) { p.y = 0; p.vy *= -0.4; p.vx *= 0.6; }
        break;
      case 'debris': case 'shell':
        p.vy -= 9.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.w * dt;
        if (p.y < p.size * 0.5) { p.y = p.size * 0.5; p.vy *= -0.35; p.vx *= 0.6; p.w *= 0.6; if (p.type === 'shell' && Math.abs(p.vy) > 0.8 && Math.random() < 0.5) Sound.play('shell', 0.15); }
        break;
      case 'smoke':
        p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.15 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.size += dt * 0.25;
        break;
      case 'fire':
        p.vy += 2.2 * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt; p.size *= (1 - dt * 1.2);
        break;
      case 'flame':
        // flamethrower stream: collides and ignites
        p.vy -= 1.5 * dt; p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx * dt; p.y += p.vy * dt; p.size += dt * 0.35;
        if (!p.hitDone) {
          const h = rayFirst(v2(ox, oy), v2(p.x, p.y), (fx) => fx.getBody() !== p.src);
          if (h) {
            p.hitDone = true; p.x = h.p.x; p.y = h.p.y; p.vx *= 0.1; p.vy = 0.8;
            if (Math.random() < 0.35) Combat.ignite(h.body, 6);
            const e = entOf(h.body);
            if (e && e.kind === 'dummy') e.burnHit(h.body.getUserData().part, 1.2);
          }
        }
        break;
      case 'glow':
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
        break;
      case 'ring': case 'flash':
        break;
      case 'orbit': {
        // black hole debris
        const dx = p.cx - p.x, dy = p.cy - p.y, d = Math.hypot(dx, dy) + 0.01;
        p.vx += (dx / d) * 30 * dt - (dy / d) * 12 * dt; p.vy += (dy / d) * 30 * dt + (dx / d) * 12 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; if (d < 0.25) p.life = 0;
        break;
      }
    }
    ps[w++] = p;
  }
  ps.length = w;
  for (const t of G.tracers) t.life -= dt;
  G.tracers = G.tracers.filter((t) => t.life > 0);
  for (const b of G.beams) b.life -= dt;
  G.beams = G.beams.filter((b) => b.life > 0);
}

/* -------------------- Simulation step -------------------- */
const fleshPrevVel = new Map();

function simStep() {
  const dt = DT;
  // deferred timed actions
  if (G.deferred.length) {
    const now = G.deferred.filter((d) => d.t <= G.time);
    G.deferred = G.deferred.filter((d) => d.t > G.time);
    for (const d of now) d.fn();
  }
  Input.applyDrag(dt);
  for (const e of G.entities.slice()) if (!e.dead) e.update(dt);
  Combat.update(dt);

  // remember velocities of bodies that care about impacts
  fleshPrevVel.clear();
  for (let b = G.world.getBodyList(); b; b = b.getNext()) {
    if (!b.isDynamic() || !b.isAwake()) continue;
    const v = b.getLinearVelocity();
    fleshPrevVel.set(b, { x: v.x, y: v.y, w: b.getAngularVelocity() });
  }
  G.impactRec.clear();
  G.world.step(dt, 8, 3);
  G.time += dt;
  G.steps++;

  // contact events (sharp, sticky, triggers)
  const evs = G.contactEvents; G.contactEvents = [];
  for (const ev of evs) Combat.handleContact(ev);

  // impacts
  for (const [b, r] of G.impactRec) {
    if (b._dead) continue;
    const pv = fleshPrevVel.get(b);
    if (!pv) continue;
    const v = b.getLinearVelocity();
    const dvx = v.x - pv.x, dvy = v.y - pv.y + 9.8 * dt;
    const dv = Math.hypot(dvx, dvy);
    Combat.onImpact(b, r.other, dv, r.J, r.contact);
  }

  // cleanup bodies falling into the void
  for (const e of G.entities.slice()) {
    if (e.dead || e === G.groundEnt) continue;
    let allGone = true;
    for (const b of e.bodies) {
      if (b._dead) continue;
      if (b.getPosition().y > -80) { allGone = false; break; }
    }
    if (allGone && e.bodies.length) e.remove();
  }
}
