'use strict';
/* ============================================================
   Tanks: hulls built from separate armour plates welded to a frame,
   sprung road wheels, a crew of dummies and a working cannon.
   Geometry is for a tank facing right, wheels on the ground at y = 0.
   Armour is in millimetres of steel; slope is handled by the shell.
   ============================================================ */
const box4 = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

const TANK_SPECS = {
  sherman: {
    name: 'M4 Sherman', short: 'Sherman', desc: 'US medium tank. Sloped but thin armour, quick 75 mm gun. Catches fire easily.',
    col: { base: '#5c6138', dark: '#3d4124', light: '#7a8050', inner: '#23251a', track: '#262729' },
    insignia: 'star', camo: false,
    core: [-2.55, 2.55, 0.52, 0.66], coreMass: 1700, turretMass: 650, gunMass: 260,
    plates: [
      { id: 'nose', pts: [[2.55, 0.52], [2.95, 0.72], [2.95, 1.04], [2.55, 0.66]], armor: 51 },
      { id: 'glacis', pts: [[2.95, 1.02], [3.07, 1.09], [2.12, 2.12], [2.0, 2.03]], armor: 63 },
      { id: 'roof front', pts: box4(0.95, 2.05, 2.02, 2.12), armor: 19 },
      { id: 'roof rear', pts: box4(-2.62, -1.0, 2.02, 2.12), armor: 19 },
      { id: 'rear', pts: [[-2.55, 0.52], [-2.47, 0.6], [-2.62, 2.12], [-2.76, 2.06]], armor: 38 },
    ],
    ring: [-1.0, 0.95, 2.02, 2.16],
    turret: [
      { id: 'turret front', pts: [[0.95, 2.16], [1.3, 2.32], [1.22, 2.86], [0.88, 2.98]], armor: 89 },
      { id: 'turret roof', pts: box4(-0.95, 0.9, 2.95, 3.07), armor: 25 },
      { id: 'turret rear', pts: [[-1.0, 2.16], [-0.85, 2.16], [-0.95, 2.97], [-1.28, 2.7]], armor: 63 },
      { id: 'cupola', pts: [[-0.6, 3.06], [-0.12, 3.06], [-0.18, 3.3], [-0.55, 3.3]], armor: 50 },
    ],
    gun: { pivot: [1.12, 2.58], len: 2.95, r: 0.045, mantlet: [0.2, 0.22], brake: false, sleeve: false, pen: 95, cal: 75, reload: 3.2, recoil: 220, elev: [-0.12, 0.32], he: { r: 2.4, power: 50, dmg: 120 } },
    wheels: { r: 0.3, y: 0.3, xs: [-2.0, -1.38, -0.76, 0.58, 1.2, 1.82] },
    sprocket: [2.62, 0.74, 0.3], idler: [-2.62, 0.55, 0.25],
    crew: [1.6, 0.5, -0.6, -1.7], floorTop: 0.66,
    speed: 9, torque: 1500, cookoff: 0.4,
    interior: [[2.55, 0.66], [2.95, 1.04], [2.0, 2.03], [-2.55, 2.03], [-2.5, 0.66]],
    turretSide: [[-1.0, 2.16], [0.95, 2.16], [1.25, 2.4], [1.18, 2.86], [0.86, 2.98], [-0.95, 2.98], [-1.28, 2.7]],
  },
  tiger: {
    name: 'Tiger I', short: 'Tiger', desc: 'German heavy tank. Thick flat armour and the deadly 88 mm gun. Slow.',
    col: { base: '#8c7f52', dark: '#5f5636', light: '#a99c6c', inner: '#2a261a', track: '#232325' },
    insignia: 'cross', camo: false,
    core: [-2.76, 2.76, 0.58, 0.72], coreMass: 2900, turretMass: 1000, gunMass: 420,
    plates: [
      { id: 'nose', pts: [[2.76, 0.58], [3.16, 0.94], [3.04, 0.99], [2.76, 0.72]], armor: 100 },
      { id: 'driver plate', pts: box4(3.03, 3.19, 0.95, 1.95), armor: 100 },
      { id: 'roof front', pts: box4(1.2, 3.19, 1.92, 2.02), armor: 26 },
      { id: 'roof rear', pts: box4(-2.92, -1.25, 1.92, 2.02), armor: 26 },
      { id: 'rear', pts: box4(-2.92, -2.76, 0.6, 1.95), armor: 80 },
    ],
    ring: [-1.25, 1.2, 1.95, 2.07],
    turret: [
      { id: 'mantlet face', pts: box4(1.2, 1.44, 2.07, 2.86), armor: 120 },
      { id: 'turret roof', pts: box4(-1.42, 1.44, 2.82, 2.92), armor: 25 },
      { id: 'turret rear', pts: box4(-1.46, -1.25, 2.07, 2.86), armor: 80 },
      { id: 'cupola', pts: [[-0.92, 2.92], [-0.38, 2.92], [-0.42, 3.13], [-0.88, 3.13]], armor: 80 },
    ],
    gun: { pivot: [1.44, 2.46], len: 4.45, r: 0.052, mantlet: [0.24, 0.32], brake: true, sleeve: false, pen: 165, cal: 88, reload: 4.6, recoil: 380, elev: [-0.1, 0.28], he: { r: 2.8, power: 60, dmg: 140 } },
    wheels: { r: 0.4, y: 0.4, xs: [-2.31, -1.65, -0.99, -0.33, 0.33, 0.99, 1.65, 2.31] },
    sprocket: [2.88, 0.8, 0.36], idler: [-2.86, 0.74, 0.33],
    crew: [1.75, 0.65, -0.45, -1.55], floorTop: 0.72,
    speed: 7, torque: 2600, cookoff: 0.22,
    interior: [[2.76, 0.72], [3.03, 0.96], [3.03, 1.92], [-2.76, 1.92], [-2.76, 0.72]],
    turretSide: [[-1.46, 2.07], [1.44, 2.07], [1.44, 2.92], [-1.46, 2.92]],
  },
  leopard: {
    name: 'Leopard 2', short: 'Leopard', desc: 'German main battle tank. Composite armour shrugs off old guns; 120 mm smoothbore. Fast.',
    col: { base: '#4b5a3c', dark: '#323d28', light: '#66765a', inner: '#1f251b', track: '#1f2022' },
    insignia: 'cross', camo: true,
    core: [-3.12, 3.12, 0.5, 0.63], coreMass: 3200, turretMass: 1300, gunMass: 480,
    plates: [
      { id: 'lower glacis', pts: [[3.12, 0.5], [3.56, 0.82], [3.46, 0.9], [3.12, 0.63]], armor: 320 },
      { id: 'upper glacis', pts: [[3.46, 0.86], [3.62, 0.95], [2.16, 1.83], [2.0, 1.72]], armor: 600 },
      { id: 'roof front', pts: box4(1.05, 2.06, 1.72, 1.82), armor: 40 },
      { id: 'roof rear', pts: box4(-3.28, -1.4, 1.72, 1.82), armor: 40 },
      { id: 'rear', pts: box4(-3.3, -3.12, 0.55, 1.82), armor: 60 },
    ],
    ring: [-1.4, 1.05, 1.78, 1.9],
    turret: [
      { id: 'turret front', pts: [[1.05, 1.9], [1.98, 1.98], [1.86, 2.55], [1.0, 2.62]], armor: 700 },
      { id: 'turret roof', pts: box4(-1.92, 1.0, 2.55, 2.65), armor: 60 },
      { id: 'bustle', pts: [[-1.98, 1.9], [-1.4, 1.9], [-1.4, 2.56], [-2.08, 2.5]], armor: 80 },
      { id: 'commander sight', pts: [[-0.72, 2.64], [-0.22, 2.64], [-0.27, 2.9], [-0.67, 2.9]], armor: 40 },
      { id: 'gunner sight', pts: box4(0.5, 0.95, 2.64, 2.8), armor: 40 },
    ],
    gun: { pivot: [1.6, 2.26], len: 5.1, r: 0.056, mantlet: [0.26, 0.2], brake: false, sleeve: true, pen: 620, cal: 120, reload: 4.0, recoil: 460, elev: [-0.1, 0.3], he: { r: 3.0, power: 65, dmg: 160 } },
    wheels: { r: 0.36, y: 0.36, xs: [-2.55, -1.7, -0.85, 0, 0.85, 1.7, 2.55] },
    sprocket: [-3.12, 0.64, 0.32], idler: [3.08, 0.6, 0.3],
    crew: [1.55, 0.45, -0.65, -1.75], floorTop: 0.63,
    speed: 12, torque: 3000, cookoff: 0.08, skirt: true,
    interior: [[3.12, 0.63], [3.46, 0.88], [2.0, 1.72], [-3.12, 1.72], [-3.12, 0.63]],
    turretSide: [[-1.98, 1.9], [1.05, 1.9], [1.98, 1.98], [1.86, 2.55], [1.0, 2.65], [-1.92, 2.65], [-2.08, 2.5]],
  },
};

function setCrewLayer(d, on) {
  for (const p of d.partList) {
    const fx = p.body.getFixtureList();
    fx.setFilterData({ groupIndex: d.group, categoryBits: on ? CAT.CREW : CAT.FLESH, maskBits: on ? 0xffff & ~CAT.CREW : 0xffff });
  }
}

function polyCentroid(pts) { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; }
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => clamp(Math.round(v * (1 + k)), 0, 255);
  return '#' + ((1 << 24) | (ch(n >> 16) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).slice(1);
}

/* convex hull of points (monotone chain) */
function hull(pts) {
  pts.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

const SEAT_POSE = { abdomen: 0.1, head: 0.05, thighF: 1.5, thighB: 1.45, shinF: -0.2, shinB: -0.25, footF: -0.55, footB: -0.55, uarmF: 1.05, uarmB: 1.0, larmF: 0.8, larmB: 0.85 };

class Tank extends Entity {
  constructor(key, x, flip) {
    super('tank');
    const S = this.S = TANK_SPECS[key];
    this.key = key; this.name = S.name; this.short = S.short;
    this.f = flip ? -1 : 1;
    this.z = 25;
    this.group = -(G.groupCounter++);
    this.X = x;
    this.plates = [];
    this.cool = 0; this.hits = 0; this.burnT = 0; this.recoilT = -9;
    const f = this.f;
    const M = (pts) => pts.map(([a, b]) => [a * f, b]);
    const opts = (o) => Object.assign({ x, y: 0, mat: 'metal', group: this.group, cat: CAT.DEFAULT, ld: 0.05, ad: 0.3 }, o);

    // frame (hull floor)
    this.core = makeBody(this, opts({ ud: { fill: S.col.dark, armor: 20, tankPart: 'core' } }), [{ shape: Sh.poly(M(box4(S.core[0], S.core[1], S.core[2], S.core[3]))), density: 300 }]);
    setMass(this.core, S.coreMass);
    for (const pl of S.plates) this.addPlate(pl, this.core, false);
    // turret ring, welded on
    this.turret = makeBody(this, opts({ ud: { fill: S.col.dark, armor: 40, tankPart: 'ring' } }), [{ shape: Sh.poly(M(box4(S.ring[0], S.ring[1], S.ring[2], S.ring[3]))), density: 300 }]);
    setMass(this.turret, S.turretMass);
    this.turretWeld = this.weld(this.core, this.turret);
    for (const pl of S.turret) this.addPlate(pl, this.turret, true);
    // gun: barrel + mantlet on a trunnion
    const g = S.gun;
    const px = x + g.pivot[0] * f, py = g.pivot[1];
    this.gun = makeBody(this, { x: px, y: py, mat: 'metal', group: this.group, ld: 0.05, ad: 0.5, ud: { fill: S.col.base, armor: 80, tankPart: 'gun' } },
      [{ shape: Sh.poly(M(box4(0, g.len, -g.r, g.r))), density: 300 }, { shape: Sh.poly(M(box4(-g.mantlet[0] * 0.6, g.mantlet[0] * 1.4, -g.mantlet[1], g.mantlet[1]))), density: 300 }]);
    setMass(this.gun, S.gunMass);
    const lo = f > 0 ? g.elev[0] : -g.elev[1], hi = f > 0 ? g.elev[1] : -g.elev[0];
    this.gunJoint = G.world.createJoint(new PL.RevoluteJoint({ enableLimit: true, lowerAngle: lo, upperAngle: hi, enableMotor: true, maxMotorTorque: 9000, motorSpeed: 0 }, this.turret, this.gun, v2(px, py)));
    this.joints.push(this.gunJoint);
    // sprung road wheels
    this.wheels = [];
    for (const wx of S.wheels.xs) {
      const b = makeBody(this, { x: x + wx * f, y: S.wheels.y, mat: 'rubber', group: this.group, ld: 0.05, ad: 0.2, ud: { fill: '#2d2f31', tankPart: 'wheel' } },
        [{ shape: Sh.circle(S.wheels.r), density: 300, friction: 1.6, restitution: 0.05, mask: 0xffff & ~CAT.CREW }]);
      setMass(b, 160);
      const j = G.world.createJoint(new PL.WheelJoint({ enableMotor: true, maxMotorTorque: S.torque * 0.6, motorSpeed: 0, frequencyHz: 4.5, dampingRatio: 0.75 }, this.core, b, b.getPosition(), v2(0, 1)));
      this.joints.push(j);
      this.wheels.push({ b, j });
    }
    // crew
    this.crew = S.crew.map((cx) => this.seatDummy(x + cx * f, S.floorTop));
    this.interior = new TankInterior(this);
  }

  weld(a, b, at) {
    const c = at || b.getWorldCenter();
    const j = G.world.createJoint(new PL.WeldJoint({ frequencyHz: 0, dampingRatio: 0 }, a, b, v2(c.x, c.y)));
    this.joints.push(j);
    return j;
  }

  addPlate(pl, parent, isTurret) {
    const f = this.f;
    const tone = (Math.sin(this.plates.length * 12.9898 + pl.armor) * 0.5) * 0.1;
    const b = makeBody(this, { x: this.X, y: 0, mat: 'metal', group: this.group, ld: 0.05, ad: 0.3,
      ud: { fill: shade(this.S.col.base, tone), armor: pl.armor, tankPart: 'plate' } },
    [{ shape: Sh.poly(pl.pts.map(([a, c]) => [a * f, c])), density: 600 }]);
    const ud = b.getUserData();
    const rec = { id: pl.id, b, armor: pl.armor, hp: 120 + pl.armor * 2.2, max: 120 + pl.armor * 2.2, isTurret, parent, tank: this, seed: this.plates.length * 7.13 + 1 };
    rec.weld = this.weld(parent, b);
    rec.breakF = 18000 + pl.armor * 60;
    ud.plateRec = rec;
    ud.onShot = (bb, p, dmg) => { rec.hp -= dmg * 0.03; if (rec.hp <= 0) this.detach(rec); };
    ud.onBlast = (bb, k) => { rec.hp -= k * 480 * 150 / (rec.armor + 150); if (rec.hp <= 0) this.detach(rec, k); };
    this.plates.push(rec);
    return rec;
  }

  detach(rec, k = 0.3) {
    if (rec.detached) return;
    rec.detached = true;
    killJoint(rec.weld);
    const fx = rec.b.getFixtureList();
    fx.setFilterData({ groupIndex: 0, categoryBits: CAT.DEFAULT, maskBits: 0xffff });
    const c = rec.b.getWorldCenter();
    rec.b.applyAngularImpulse(rand(-1, 1) * rec.b.getMass() * 0.4 * (0.5 + k), true);
    sparks(c.x, c.y, 0, 1, 14, '#ffd27a', 6);
    smoke(c.x, c.y, 4, 0.2, 'rgba(90,90,90,', 2);
    Sound.play('metal', 1);
  }

  popTurret() {
    if (this.turretWeld._dead) return;
    killJoint(this.turretWeld);
    for (const b of [this.turret, this.gun]) b.applyLinearImpulse(v2(rand(-1, 1) * b.getMass() * 3, b.getMass() * rand(9, 13)), b.getWorldCenter(), true);
    this.turret.applyAngularImpulse(rand(-1, 1) * this.turret.getMass() * 2, true);
    for (const r of this.plates) if (r.isTurret && Math.random() < 0.5) this.detach(r, 1);
  }

  seatDummy(x, floorY) {
    const d = new Dummy(x, 80 + Math.random() * 10, this.f);
    d.pose(x, 81, SEAT_POSE);
    const low = d.lowestY();
    d.translate(0, floorY + 0.012 - low);
    setCrewLayer(d, true);
    const ab = d.parts.abdomen.body;
    d.seat = G.world.createJoint(new PL.WeldJoint({ frequencyHz: 3.5, dampingRatio: 0.6 }, this.core, ab, ab.getWorldCenter()));
    d.vehicle = this;
    d.state = 'seated';
    return d;
  }

  get activatable() { return true; }
  activate() { this.fire(); }

  crewOK(i) { const d = this.crew[i]; return d && !d.dead && d.alive && d.cons > 0.5; }
  canDrive() { return this.crewOK(0) && this.wheels.filter((w) => !w.j._dead && !w.b._dead).length >= 3 && !this.core._dead; }
  canFire() { return (this.crewOK(1) || this.crewOK(2) || this.crewOK(3)) && !this.gun._dead && !this.gunJoint._dead; }
  get statusText() {
    if (this.crew.every((d) => d.dead || !d.alive)) return 'Knocked out';
    if (!this.canDrive()) return this.crewOK(0) ? 'Immobilised' : 'Driver down';
    if (!this.canFire()) return this.gunJoint._dead ? 'Gun knocked out' : 'Gun crew down';
    return this.cool > 0 ? `Reloading ${this.cool.toFixed(1)} s` : 'Ready to fire';
  }

  fire() {
    if (this.cool > 0 || !this.canFire()) { if (this.cool <= 0) Sound.play('click', 0.6); return; }
    const S = this.S, g = S.gun, f = this.f;
    const dir = this.gun.getWorldVector(v2(f, 0));
    const m = this.gun.getWorldPoint(v2(f * g.len, 0));
    tankShell(this, m, dir, g);
    this.gun.applyLinearImpulse(v2(-dir.x * g.recoil, -dir.y * g.recoil), m, true);
    this.core.applyLinearImpulse(v2(-dir.x * g.recoil * 1.5, -dir.y * g.recoil * 1.5), this.core.getWorldCenter(), true);
    addP({ type: 'flash', x: m.x + dir.x * 0.3, y: m.y + dir.y * 0.3, life: 0.1, size: 1.1 });
    G.lights.push({ x: m.x, y: m.y, r: 7, col: '255,200,120', a: 0.9, life: 0.15, max: 0.15 });
    for (let i = 0; i < 26; i++) { const a = Math.atan2(dir.y, dir.x) + rand(-0.9, 0.9); const sp = rand(1, 7); smoke(m.x, m.y, 1, rand(0.15, 0.4), 'rgba(170,165,155,', rand(1.5, 3.2), Math.cos(a) * sp, Math.sin(a) * sp); }
    if (g.brake) for (const s of [1, -1]) smoke(m.x, m.y, 6, 0.25, 'rgba(170,165,155,', 2, -dir.y * s * 4, dir.x * s * 4);
    const gp = rayFirst(v2(m.x, m.y), v2(m.x, m.y - 4));
    if (gp && gp.body.getUserData().isGround) smoke(gp.p.x, 0.1, 10, 0.3, 'rgba(120,110,95,', 2.5, dir.x * 2, 0.6);
    G.shake = Math.max(G.shake, 0.7);
    Sound.play('explosion', 0.9, 0.01);
    Sound.play('sniper', 1, 0.01);
    this.cool = g.reload;
    this.recoilT = G.time;
    defer(() => { if (!this.dead) Sound.play('pump', 0.8); }, g.reload * 0.9);
  }

  onPenetrated(p) {
    this.hits++;
    for (const d of this.crew) if (!d.dead && Math.random() < 0.3) d.ignitePart(pick(d.partList), 6);
    if (Math.random() < 0.45) this.burnT = Math.max(this.burnT, rand(12, 25));
    if (!this.cooking && Math.random() < this.S.cookoff) {
      this.cooking = true;
      defer(() => {
        if (this.dead) return;
        const c = this.core.getWorldCenter();
        Combat.explode(c.x, c.y + 0.8, { r: 4.5, power: 120, dmg: 220, fire: true, shrapnel: 20 });
        this.popTurret();
        this.burnT = 40;
        for (const r of this.plates) { r.hp -= rand(150, 450); if (r.hp <= 0) this.detach(r, 1); }
      }, rand(1.2, 3));
    }
  }

  update(dt) {
    const S = this.S;
    if (this.cool > 0) this.cool -= dt;
    if (this.core._dead) { this.remove(); return; }
    // plates rip off under extreme stress (yanking, crashes)
    for (const r of this.plates) {
      if (r.detached || r.weld._dead) { if (!r.detached) r.detached = true; continue; }
      const F = r.weld.getReactionForce(1 / DT);
      if (Math.hypot(F.x, F.y) > r.breakF) this.detach(r);
    }
    for (const d of this.crew) {
      if (d.seat && !d.seat._dead) {
        const F = d.seat.getReactionForce(1 / DT);
        if (Math.hypot(F.x, F.y) > 9000) this.unseat(d);
      }
    }
    let throttle = 0, aim = 0;
    const me = G.vehicle === this;
    if (me) {
      if (Input.keys.has('KeyD')) throttle += 1;
      if (Input.keys.has('KeyA')) throttle -= 1;
      if (Input.keys.has('KeyW')) aim += 1;
      if (Input.keys.has('KeyS')) aim -= 1;
    }
    if (!this.canDrive()) throttle = 0;
    if (!this.canFire()) aim = 0;
    for (const w of this.wheels) {
      if (w.j._dead) continue;
      w.j.setMotorSpeed(-throttle * S.speed);
      w.j.setMaxMotorTorque(throttle ? S.torque : S.torque * 0.5);
    }
    if (!this.gunJoint._dead) this.gunJoint.setMotorSpeed(aim * 0.45 * this.f);
    // engine
    if (me && this.canDrive()) {
      if (!this.hum) this.hum = Sound.hum(38, 0.05);
      if (this.hum) this.hum.set(38 + Math.abs(throttle) * 30, 0.04 + Math.abs(throttle) * 0.05);
    } else if (this.hum) { this.hum.stop(); this.hum = null; }
    if (throttle && Math.random() < 0.5) {
      const ex = this.core.getWorldPoint(v2(S.core[0] * this.f - 0.1 * this.f, S.core[3] + 0.9));
      smoke(ex.x, ex.y, 1, 0.12, 'rgba(60,60,64,', 1.8, -this.f * 0.6, 0.8);
    }
    // burning wreck
    if (this.burnT > 0) {
      this.burnT -= dt;
      const c = this.core.getWorldPoint(v2(rand(-1.5, 1.5), 1.3));
      if (Math.random() < 0.6) addP({ type: 'fire', x: c.x, y: c.y, vx: rand(-0.3, 0.3), vy: rand(0.8, 2), life: rand(0.4, 0.9), size: rand(0.15, 0.35) });
      if (Math.random() < 0.5) smoke(c.x, c.y + 0.6, 1, 0.35, 'rgba(30,30,32,', 4, 0, 1.4);
      addLight(c.x, c.y, 3, '255,140,60', 0.25);
      if (Math.random() < dt * 2) { const d = pick(this.crew); if (d && !d.dead) d.ignitePart(pick(d.partList), 5); }
    }
  }

  unseat(d) {
    if (d.seat) killJoint(d.seat);
    d.seat = null;
    setCrewLayer(d, false);
  }

  onRemove() {
    if (this.hum) { this.hum.stop(); this.hum = null; }
    if (G.vehicle === this) G.vehicle = null;
    if (this.interior) this.interior.remove();
    for (const d of this.crew) if (!d.dead) this.unseat(d);
  }

  /* is a world point inside the hull or turret silhouette? (for clicking the tank) */
  containsPoint(x, y) {
    const S = this.S, f = this.f;
    const test = (b, poly) => {
      if (b._dead) return false;
      const lp = b.getLocalPoint(v2(x, y));
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0] * f, yi = poly[i][1], xj = poly[j][0] * f, yj = poly[j][1];
        if ((yi > lp.y) !== (yj > lp.y) && lp.x < ((xj - xi) * (lp.y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    return test(this.core, S.interior) || test(this.turret, S.turretSide);
  }

  /* ---------- drawing ---------- */
  trackPoints() {
    const S = this.S, f = this.f, pts = [];
    const ring = (cx, cy, r) => { for (let i = 0; i < 14; i++) { const a = i * TAU / 14; pts.push({ x: cx + Math.cos(a) * (r + 0.05), y: cy + Math.sin(a) * (r + 0.05) }); } };
    for (const w of this.wheels) if (!w.j._dead) { const p = w.b.getPosition(); ring(p.x, p.y, S.wheels.r); }
    for (const s of [S.sprocket, S.idler]) { const p = this.core.getWorldPoint(v2(s[0] * f, s[1])); ring(p.x, p.y, s[2]); }
    return hull(pts);
  }

  draw(ctx) {
    const S = this.S, f = this.f;
    // track
    if (!this.core._dead) {
      const h = this.trackPoints();
      ctx.beginPath(); h.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      ctx.strokeStyle = S.col.track; ctx.lineWidth = 0.1; ctx.lineJoin = 'round'; ctx.stroke();
      const spin = this.wheels.length && !this.wheels[0].b._dead ? -this.wheels[0].b.getAngle() * S.wheels.r : 0;
      ctx.strokeStyle = '#3c3e41'; ctx.lineWidth = 0.1; ctx.setLineDash([0.05, 0.07]); ctx.lineDashOffset = spin; ctx.stroke(); ctx.setLineDash([]);
      ctx.lineJoin = 'miter';
      for (const s of [S.sprocket, S.idler]) {
        const p = this.core.getWorldPoint(v2(s[0] * f, s[1]));
        fillCircle(ctx, p.x, p.y, s[2] * 0.85, '#36383b', 'rgba(255,255,255,0.1)', 0.012);
        const a = this.wheels.length ? this.wheels[0].b.getAngle() : 0;
        for (let i = 0; i < 8; i++) { const t = a + i * TAU / 8; fillCircle(ctx, p.x + Math.cos(t) * s[2] * 0.9, p.y + Math.sin(t) * s[2] * 0.9, 0.035, '#36383b'); }
        fillCircle(ctx, p.x, p.y, s[2] * 0.3, '#55585c');
      }
    }
    // road wheels
    for (const w of this.wheels) {
      const b = w.b; if (b._dead) continue;
      const p = b.getPosition(), a = b.getAngle(), r = S.wheels.r;
      fillCircle(ctx, p.x, p.y, r, '#2a2c2e', 'rgba(255,255,255,0.1)', 0.012);
      fillCircle(ctx, p.x, p.y, r * 0.78, shade(S.col.base, -0.2));
      for (let i = 0; i < 6; i++) { const t = a + i * TAU / 6; fillCircle(ctx, p.x + Math.cos(t) * r * 0.48, p.y + Math.sin(t) * r * 0.48, r * 0.09, shade(S.col.dark, -0.2)); }
      fillCircle(ctx, p.x, p.y, r * 0.24, shade(S.col.base, 0.1), 'rgba(0,0,0,0.4)', 0.01);
    }
    // frame + ring
    for (const b of [this.core, this.turret]) if (!b._dead) this.drawSteel(ctx, b, S.col.dark, null);
    // gun
    if (!this.gun._dead) this.drawGun(ctx);
    // armour plates
    for (const r of this.plates) if (!r.b._dead) this.drawSteel(ctx, r.b, r.b.getUserData().fill, r);
    // skirt over the upper track run (Leopard)
    if (S.skirt && !this.core._dead) {
      withBody(ctx, this.core, 1, () => {
        const x0 = (S.core[0] - 0.2) * f, x1 = (S.core[1] + 0.15) * f;
        const sk = [x0, 0.42, x1, 0.42, x1 + 0.12 * f, 0.62, x0 - 0.05 * f, 0.62];
        fillPoly(ctx, sk, shade(S.col.base, -0.05), 'rgba(0,0,0,0.5)', 0.014);
        ctx.save(); polyPath(ctx, sk); ctx.clip(); this.camo(ctx, 21); ctx.restore();
        for (let i = 0; i < 7; i++) line(ctx, lerp(x0, x1, i / 6), 0.43, lerp(x0, x1, i / 6), 0.61, 'rgba(0,0,0,0.3)', 0.012);
      });
    }
    if (G.vehicle === this && !this.core._dead) {
      const c = this.core.getWorldPoint(v2(0, 0));
      ctx.strokeStyle = 'rgba(242,194,48,0.7)'; ctx.lineWidth = 2 / Cam.z;
      ctx.beginPath(); ctx.moveTo(c.x - 0.3, c.y - 0.35); ctx.lineTo(c.x, c.y - 0.15); ctx.lineTo(c.x + 0.3, c.y - 0.35); ctx.stroke();
    }
  }

  camo(ctx, seed) {
    if (!this.S.camo) return;
    const cols = ['rgba(92,70,48,0.85)', 'rgba(24,26,22,0.8)'];
    for (let i = 0; i < 9; i++) {
      const x = Math.sin(seed * 3.1 + i * 7.7) * 3.6, y = 0.4 + Math.abs(Math.cos(seed * 1.7 + i * 3.3)) * 2.6;
      ctx.fillStyle = cols[i % 2];
      ctx.beginPath(); ctx.ellipse(x, y, 0.35 + (i % 3) * 0.12, 0.16 + (i % 2) * 0.08, i, 0, TAU); ctx.fill();
    }
  }

  drawSteel(ctx, b, fill, rec) {
    const ud = b.getUserData();
    const p = b.getPosition();
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.getAngle());
    const path = bodyPath(b);
    ctx.fillStyle = fill; ctx.fill(path);
    ctx.save(); ctx.clip(path);
    if (rec) this.camo(ctx, rec.seed);
    if (rec && rec.hp < rec.max) { ctx.fillStyle = `rgba(10,8,6,${clamp(1 - rec.hp / rec.max, 0, 1) * 0.55})`; ctx.fill(path); }
    if (ud.char) { ctx.fillStyle = `rgba(10,8,6,${ud.char * 0.6})`; ctx.fill(path); }
    drawStains(ctx, b);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.02; ctx.stroke(path);
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 0.008; ctx.stroke(path);
    // bolts at every corner, inset toward the middle
    const sh = b.getFixtureList().getShape();
    if (sh.getType() === 'polygon') {
      let cx = 0, cy = 0; for (let i = 0; i < sh.m_count; i++) { cx += sh.m_vertices[i].x; cy += sh.m_vertices[i].y; }
      cx /= sh.m_count; cy /= sh.m_count;
      for (let i = 0; i < sh.m_count; i++) {
        const v = sh.m_vertices[i], dx = cx - v.x, dy = cy - v.y, l = Math.hypot(dx, dy) || 1;
        const k = Math.min(0.07, l * 0.4);
        const bx = v.x + dx / l * k, by = v.y + dy / l * k;
        fillCircle(ctx, bx, by, 0.022, 'rgba(20,20,16,0.8)');
        fillCircle(ctx, bx - 0.006, by + 0.006, 0.009, 'rgba(255,255,255,0.25)');
      }
    }
    ctx.restore();
  }

  drawGun(ctx) {
    const S = this.S, g = S.gun, f = this.f;
    const rk = clamp(1 - (G.time - this.recoilT) / 0.35, 0, 1);
    const back = -Math.sin(rk * Math.PI * 0.5) * 0.3 * f;
    withBody(ctx, this.gun, 1, () => {
      ctx.translate(back, 0);
      ctx.scale(f, 1);
      const r = g.r;
      fillRR(ctx, 0, -r, g.len, r * 2, r * 0.5, shade(S.col.base, -0.08), 'rgba(0,0,0,0.55)', 0.016);
      line(ctx, 0.1, r * 0.4, g.len - 0.1, r * 0.4, 'rgba(255,255,255,0.12)', 0.01);
      if (g.sleeve) for (let i = 1; i < 5; i++) fillRR(ctx, g.len * i / 5.3, -r * 1.25, 0.07, r * 2.5, 0.01, shade(S.col.dark, -0.1));
      if (g.sleeve) fillRR(ctx, g.len - 0.12, -r * 1.3, 0.1, r * 2.6, 0.01, shade(S.col.dark, -0.2));
      if (g.brake) { fillRR(ctx, g.len - 0.28, -r * 2, 0.28, r * 4, 0.02, shade(S.col.dark, -0.1), 'rgba(0,0,0,0.6)', 0.012); line(ctx, g.len - 0.14, -r * 2, g.len - 0.14, r * 2, 'rgba(0,0,0,0.6)', 0.03); }
      if (!g.brake && !g.sleeve) fillRR(ctx, g.len - 0.16, -r * 1.25, 0.16, r * 2.5, 0.01, shade(S.col.dark, -0.1));
      const mw = g.mantlet[0], mh = g.mantlet[1];
      fillRR(ctx, -mw * 0.6, -mh, mw * 2, mh * 2, 0.04, shade(S.col.base, 0.03), 'rgba(0,0,0,0.55)', 0.018);
      for (const [bx, by] of [[-mw * 0.4, mh * 0.75], [mw * 1.2, mh * 0.75], [-mw * 0.4, -mh * 0.75], [mw * 1.2, -mh * 0.75]]) fillCircle(ctx, bx, by, 0.024, 'rgba(20,20,16,0.8)');
    });
  }
}

class TankInterior extends Entity {
  constructor(t) { super('tankint'); this.t = t; this.z = 15; this.name = t.name; }
  draw(ctx) {
    const t = this.t, S = t.S, f = t.f;
    if (t.dead) return;
    const M = (pts) => pts.flatMap(([a, b]) => [a * f, b]);
    if (!t.core._dead) withBody(ctx, t.core, 1, () => {
      fillPoly(ctx, M(S.interior), S.col.inner, 'rgba(0,0,0,0.6)', 0.02);
      ctx.save(); polyPath(ctx, M(S.interior)); ctx.clip();
      // ribs, ammo rack, controls: a cutaway view of the fighting compartment
      for (let x = S.core[0]; x < S.core[1]; x += 0.55) line(ctx, x * f, S.floorTop, x * f, 2.2, 'rgba(255,255,255,0.03)', 0.06);
      const rackX = S.crew[2] - 0.35;
      for (let i = 0; i < 6; i++) {
        const sx = (rackX + i * 0.11) * f;
        fillRR(ctx, sx - 0.035, S.floorTop + 0.42, 0.07, 0.42, 0.02, '#b89648', 'rgba(0,0,0,0.4)', 0.008);
        fillRR(ctx, sx - 0.025, S.floorTop + 0.84, 0.05, 0.1, 0.02, '#6a6f74');
      }
      fillRR(ctx, (S.crew[1] - 0.25) * f - 0.2, S.floorTop + 0.7, 0.4, 0.28, 0.03, '#33372a', 'rgba(0,0,0,0.5)', 0.01);
      for (let i = 0; i < 3; i++) fillCircle(ctx, (S.crew[1] - 0.25) * f - 0.1 + i * 0.1, S.floorTop + 0.86, 0.03, i === 1 ? '#7fd38a' : '#c9b26a');
      line(ctx, (S.crew[0] + 0.45) * f, S.floorTop + 0.05, (S.crew[0] + 0.25) * f, S.floorTop + 0.6, '#4a4d50', 0.035);
      line(ctx, (S.crew[0] + 0.55) * f, S.floorTop + 0.05, (S.crew[0] + 0.4) * f, S.floorTop + 0.55, '#4a4d50', 0.035);
      ctx.restore();
    });
    if (!t.turret._dead) withBody(ctx, t.turret, 1, () => {
      fillPoly(ctx, M(S.turretSide), shade(S.col.base, -0.12), 'rgba(0,0,0,0.6)', 0.02);
      ctx.save(); polyPath(ctx, M(S.turretSide)); ctx.clip(); t.camo(ctx, 3); ctx.restore();
      const [cx, cy] = polyCentroid(S.turretSide);
      const ix = (cx - 0.15) * f, iy = cy;
      if (S.insignia === 'star') {
        fillCircle(ctx, ix, iy, 0.26, null, '#e8e6dc', 0.035);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.09 : 0.23; ctx.lineTo(ix + Math.cos(a) * r, iy + Math.sin(a) * r); }
        ctx.closePath(); ctx.fillStyle = '#e8e6dc'; ctx.fill();
      } else {
        const a = 0.2, w = 0.07;
        ctx.fillStyle = '#e8e6dc';
        ctx.fillRect(ix - a - 0.03, iy - w - 0.03, (a + 0.03) * 2, (w + 0.03) * 2); ctx.fillRect(ix - w - 0.03, iy - a - 0.03, (w + 0.03) * 2, (a + 0.03) * 2);
        ctx.fillStyle = '#16171a';
        ctx.fillRect(ix - a, iy - w, a * 2, w * 2); ctx.fillRect(ix - w, iy - a, w * 2, a * 2);
      }
    });
  }
}

/* armour-piercing shell: slope-aware penetration, behind-armour explosion, ricochets */
function tankShell(tank, m, dir, g) {
  let pen = g.pen;
  const far = v2(m.x + dir.x * 220, m.y + dir.y * 220);
  const hits = rayAll(m, far, (fx) => entOf(fx.getBody()) !== tank);
  let end = far, through = null, stopped = false, bounced = false;
  const seen = new Set();
  for (const h of hits) {
    const b = h.body, ud = b.getUserData();
    if (seen.has(b)) continue;
    seen.add(b);
    if (b.isDynamic()) b.applyLinearImpulse(v2(dir.x * 60, dir.y * 60), h.p, true);
    if (ud.plateRec || (ud.armor != null && ud.tankPart)) {
      const cos = Math.abs(dir.x * h.n.x + dir.y * h.n.y);
      const eff = ud.armor / Math.max(0.2, cos);
      const rec = ud.plateRec;
      sparks(h.p.x, h.p.y, h.n.x, h.n.y, 22, '#ffd27a', 9);
      Sound.play('metal', 1);
      if (ud.tankPart === 'gun') {
        // a hit on the barrel or mantlet wrecks the gun rather than breaching the hull
        const tk = entOf(b);
        if (pen >= eff && tk && tk.gunJoint && !tk.gunJoint._dead && Math.random() < 0.6) { killJoint(tk.gunJoint); tk.gunOut = true; }
        Combat.addHole(b, h.p, 3);
        end = h.p; stopped = true;
        break;
      }
      if (pen >= eff) {
        if (rec) { rec.hp -= pen * 1.2; if (rec.hp <= 0) rec.tank.detach(rec, 0.8); }
        Combat.addHole(b, h.p, 5);
        pen -= eff * 0.7 + 15;
        through = { p: h.p, tank: rec ? rec.tank : entOf(b) };
        continue;
      }
      if (rec) { rec.hp -= pen * 1.6; if (rec.hp <= 0) rec.tank.detach(rec, 0.6); }
      Combat.addHole(b, h.p, 2.5);
      end = h.p; stopped = true;
      if (cos < 0.55 && Math.random() < 0.75) {
        const dn = dir.x * h.n.x + dir.y * h.n.y;
        const rx = dir.x - 2 * dn * h.n.x, ry = dir.y - 2 * dn * h.n.y;
        G.tracers.push({ x1: h.p.x, y1: h.p.y, x2: h.p.x + rx * 25, y2: h.p.y + ry * 25 + rand(-2, 2), life: 0.12, max: 0.12, col: '255,220,160', w: 0.05 });
        bounced = true;
      }
      break;
    }
    if (ud.part) { ud.ent.bulletHit(ud.part, h.p, h.n, dir, 260 * clamp(pen / 60, 0.3, 1), { caliber: 3, dismember: true, label: 'Hit by a tank shell' }); pen -= 40; if (pen <= 0) { end = h.p; break; } continue; }
    if (ud.isGround || b.isStatic()) { end = h.p; stopped = true; if (ud.onBlast) ud.onBlast(b, 0.9); break; }
    if (ud.onShot) ud.onShot(b, h.p, 300, {});
    pen -= (MAT[ud.mat] || MAT.stone).resist * 1.5;
    if (pen <= 0) { end = h.p; stopped = true; break; }
  }
  G.tracers.push({ x1: m.x, y1: m.y, x2: end.x, y2: end.y, life: 0.12, max: 0.12, col: '255,215,150', w: 0.07 });
  if (through) {
    const bp = v2(through.p.x + dir.x * 0.45, through.p.y + dir.y * 0.45);
    Combat.explode(bp.x, bp.y, { r: g.he.r * 0.75, power: g.he.power * 0.8, dmg: g.he.dmg * 0.9, fire: true, shrapnel: 16 });
    if (through.tank && through.tank.onPenetrated) through.tank.onPenetrated(bp);
  } else if (stopped && !bounced) {
    Combat.explode(end.x - dir.x * 0.1, end.y - dir.y * 0.1, { r: g.he.r * 0.8, power: g.he.power, dmg: g.he.dmg * 0.6, fire: true });
  }
}

function drawTankIcon(ctx, S, f = 1) {
  const M = (pts) => pts.flatMap(([a, b]) => [a * f, b]);
  ctx.strokeStyle = S.col.track; ctx.lineWidth = 0.12; ctx.lineJoin = 'round';
  const w = S.wheels, xs = w.xs;
  ctx.beginPath();
  ctx.moveTo((xs[0] - w.r) * f, w.y); ctx.lineTo(S.idler[0] * f, S.idler[1]); ctx.lineTo(S.idler[0] * f, S.idler[1] + S.idler[2]);
  ctx.lineTo(S.sprocket[0] * f, S.sprocket[1] + S.sprocket[2]); ctx.lineTo(S.sprocket[0] * f, S.sprocket[1]); ctx.lineTo((xs[xs.length - 1] + w.r) * f, w.y);
  ctx.lineTo(xs[xs.length - 1] * f, -0.03); ctx.lineTo(xs[0] * f, -0.03); ctx.closePath(); ctx.stroke(); ctx.lineJoin = 'miter';
  for (const x of xs) { fillCircle(ctx, x * f, w.y, w.r, '#2a2c2e'); fillCircle(ctx, x * f, w.y, w.r * 0.7, shade(S.col.base, -0.2)); }
  fillPoly(ctx, M(S.interior), S.col.inner);
  fillPoly(ctx, M(S.turretSide), shade(S.col.base, -0.1));
  const g = S.gun;
  ctx.fillStyle = shade(S.col.base, -0.08); ctx.fillRect(Math.min(g.pivot[0] * f, (g.pivot[0] + g.len) * f), g.pivot[1] - g.r, g.len, g.r * 2);
  for (const pl of S.plates.concat(S.turret)) fillPoly(ctx, M(pl.pts), S.col.base, 'rgba(0,0,0,0.5)', 0.02);
  fillPoly(ctx, M(box4(S.core[0], S.core[1], S.core[2], S.core[3])), S.col.dark);
}

for (const key of Object.keys(TANK_SPECS)) {
  const S = TANK_SPECS[key];
  const xs = S.plates.concat(S.turret).flatMap((p) => p.pts.map((q) => q[0]));
  defItem({
    id: key, name: S.name, desc: S.desc + ' Comes with a crew of four. Right-click it to drive.', cat: 'vehicles', ground: true,
    bb: [Math.min(...xs) - 0.2, -0.1, S.gun.pivot[0] + S.gun.len + 0.1, 3.4],
    spawn: (x, y, flip) => new Tank(key, x, flip),
    icon(ctx) { drawTankIcon(ctx, S, 1); },
    ghost(ctx, flip) { drawTankIcon(ctx, S, flip ? -1 : 1); },
  });
}
