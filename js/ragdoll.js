'use strict';
/* ============================================================
   Dummies: articulated ragdolls with muscles, balance & injuries
   Coordinates are for a dummy facing right with feet at y = 0.
   Joint angle = child.angle - parent.angle.
   ============================================================ */
const PART_DEFS = [
  { n: 'chest',   hw: 0.17,  hh: 0.17,  cx: 0, cy: 1.37,  layer: 2, hp: 100, label: 'chest', density: 115 },
  { n: 'abdomen', hw: 0.15,  hh: 0.135, cx: 0, cy: 1.07,  parent: 'chest', jy: 1.205, lim: [-0.3, 0.7], tq: 550, layer: 2, hp: 100, sever: 75, label: 'abdomen' },
  { n: 'head',    hw: 0.1,   hh: 0.12,  cx: 0, cy: 1.665, parent: 'chest', jy: 1.545, lim: [-0.7, 0.5], tq: 90, layer: 3, hp: 70, sever: 30, label: 'head', density: 105 },
  { n: 'uarmB',   hw: 0.055, hh: 0.165, cx: 0, cy: 1.335, parent: 'chest', jy: 1.49, lim: [-1.3, 3.0], tq: 80, layer: 0, hp: 55, sever: 26, label: 'left upper arm' },
  { n: 'larmB',   hw: 0.05,  hh: 0.175, cx: 0, cy: 1.0,   parent: 'uarmB', jy: 1.175, lim: [0, 2.6], tq: 50, layer: 0, hp: 45, sever: 20, label: 'left forearm' },
  { n: 'thighB',  hw: 0.075, hh: 0.235, cx: 0, cy: 0.70,  parent: 'abdomen', jy: 0.935, lim: [-0.5, 2.1], tq: 700, layer: 1, hp: 80, sever: 38, label: 'left thigh' },
  { n: 'shinB',   hw: 0.062, hh: 0.215, cx: 0, cy: 0.285, parent: 'thighB', jy: 0.49, lim: [-2.5, 0.02], tq: 650, layer: 1, hp: 70, sever: 32, label: 'left shin' },
  { n: 'footB',   hw: 0.13,  hh: 0.04,  cx: 0.055, cy: 0.04, parent: 'shinB', jy: 0.075, lim: [-0.6, 0.7], tq: 220, layer: 1, hp: 40, sever: 18, label: 'left foot', friction: 1.2 },
  { n: 'thighF',  hw: 0.075, hh: 0.235, cx: 0, cy: 0.70,  parent: 'abdomen', jy: 0.935, lim: [-0.5, 2.1], tq: 700, layer: 4, hp: 80, sever: 38, label: 'right thigh' },
  { n: 'shinF',   hw: 0.062, hh: 0.215, cx: 0, cy: 0.285, parent: 'thighF', jy: 0.49, lim: [-2.5, 0.02], tq: 650, layer: 4, hp: 70, sever: 32, label: 'right shin' },
  { n: 'footF',   hw: 0.13,  hh: 0.04,  cx: 0.055, cy: 0.04, parent: 'shinF', jy: 0.075, lim: [-0.6, 0.7], tq: 220, layer: 4, hp: 40, sever: 18, label: 'right foot', friction: 1.2 },
  { n: 'uarmF',   hw: 0.055, hh: 0.165, cx: 0, cy: 1.335, parent: 'chest', jy: 1.49, lim: [-1.3, 3.0], tq: 80, layer: 5, hp: 55, sever: 26, label: 'right upper arm' },
  { n: 'larmF',   hw: 0.05,  hh: 0.175, cx: 0, cy: 1.0,   parent: 'uarmF', jy: 1.175, lim: [0, 2.6], tq: 50, layer: 5, hp: 45, sever: 20, label: 'right forearm' },
];
const LIMB_KIND = (n) => n === 'head' ? 'head' : (n === 'chest' || n === 'abdomen') ? 'torso' : n.startsWith('uarm') || n.startsWith('larm') ? 'arm' : 'leg';

const SKIN = { back: '#83878e', mid: '#a4a8ae', front: '#b5b9bf', head: '#b0b4ba', outline: '#1d1f23', char: '#2a2522', dead: '#8f98a4' };

let DUMMY_NO = 0;

class Dummy extends Entity {
  constructor(x, y, f = 1) {
    super('dummy');
    this.z = 20;
    this.f = f;
    this.num = ++DUMMY_NO;
    this.name = 'Dummy ' + this.num;
    this.group = -(G.groupCounter++);
    this.parts = {};
    this.partList = [];
    for (const d of PART_DEFS) {
      const shape = d.r ? Sh.circle(d.r) : Sh.box(d.hw, d.hh);
      const b = makeBody(this, { x: x + d.cx * f, y: y + d.cy, mat: 'flesh', group: this.group, cat: CAT.FLESH, ld: 0.05, ad: 0.9 },
        [{ shape, density: d.density || 110, friction: d.friction || 0.75 }]);
      const part = { n: d.n, d, body: b, hp: d.hp, maxHp: d.hp, broken: false, detached: false, wounds: [], char: 0, burning: 0,
        joint: null, parent: null, children: [], label: d.label, stumps: [], bruise: 0, cutAcc: 0, kind: LIMB_KIND(d.n) };
      b.getUserData().part = part;
      this.parts[d.n] = part;
      this.partList.push(part);
    }
    for (const p of this.partList) {
      const d = p.d;
      if (!d.parent) continue;
      const par = this.parts[d.parent];
      p.parent = par; par.children.push(p);
      const lo = f > 0 ? d.lim[0] : -d.lim[1], hi = f > 0 ? d.lim[1] : -d.lim[0];
      const j = G.world.createJoint(new PL.RevoluteJoint({ enableLimit: true, lowerAngle: lo, upperAngle: hi, enableMotor: true, maxMotorTorque: 5, motorSpeed: 0 },
        par.body, p.body, v2(x, y + d.jy)));
      j._base = [lo, hi];
      p.joint = j;
      this.joints.push(j);
    }
    this.mass = this.totalMass();
    this.drawOrder = this.partList.slice().sort((a, b) => a.d.layer - b.d.layer);
    // physiology
    this.blood = 100; this.brain = 100; this.cons = 1; this.pain = 0; this.alive = true;
    this.koTimer = 0; this.stun = 0; this.adrenaline = 0; this.sedated = 0; this.deadT = 0;
    this.spineBroken = false; this.neckBroken = false;
    this.state = 'stand'; this.fallenT = 0; this.getupT = 0; this.getupCool = 0; this.airT = 0;
    this.injuries = []; this.cause = null;
    this.phase = rand(0, 100);
    this.spreadT = 0;
    this.lastHurt = -10;
    this.flinch = 0;
    G.dummies.push(this);
  }

  onRemove() { const i = G.dummies.indexOf(this); if (i >= 0) G.dummies.splice(i, 1); }

  log(msg) {
    const last = this.injuries[0];
    if (last && last.msg === msg && G.time - last.t < 1.5) { last.n++; last.t = G.time; return; }
    this.injuries.unshift({ msg, t: G.time, n: 1 });
    if (this.injuries.length > 40) this.injuries.pop();
  }

  /* ---------------- status helpers ---------------- */
  get statusText() {
    if (!this.alive) return 'Dead';
    if (this.cons < 0.3) return this.brain < 35 ? 'Comatose' : 'Unconscious';
    if (this.partList.some((p) => p.burning > 0)) return 'Burning';
    if (this.state === 'stand') return this.pain > 40 ? 'Hurt' : 'Standing';
    if (this.state === 'getup') return 'Getting up';
    if (this.pain > 50) return 'In agony';
    return 'Down';
  }
  muscleOK(p) {
    if (!this.alive || p.detached) return false;
    if (this.neckBroken) return false;
    if (this.spineBroken && p.kind === 'leg') return false;
    return true;
  }
  legOK(side) {
    const t = this.parts['thigh' + side], s = this.parts['shin' + side];
    return !t.detached && !s.detached && !t.broken && !s.broken && t.hp > 0 && s.hp > 0 && !this.parts['foot' + side].detached;
  }
  canStand() {
    return this.alive && this.cons > 0.75 && this.stun <= 0 && !this.spineBroken && !this.neckBroken &&
      this.legOK('F') && this.legOK('B') && !this.parts.abdomen.detached && this.blood > 55 &&
      (this.pain < 85 || this.adrenaline > 0) && !this.partList.some((p) => p.burning > 0);
  }
  strength() {
    if (!this.alive) return 0;
    let s = this.cons;
    s *= clamp(1.25 - this.pain / 150, 0.3, 1);
    s *= clamp((this.blood - 35) / 40, 0, 1);
    if (this.adrenaline > 0) s = Math.min(1.35, s * 1.3 + 0.25);
    if (this.stun > 0) s *= 0.2;
    return s;
  }
  isGrabbed() { return Input.drag && Input.drag.ent === this; }

  /* ---------------- update ---------------- */
  update(dt) {
    this.decelTrauma(dt);
    this.physiology(dt);
    this.control(dt);
  }

  /* whole-body deceleration (falls, slams, blasts): organs and brain take the hit */
  decelTrauma(dt) {
    let mx = 0, my = 0, m = 0;
    for (const p of this.partList) {
      if (p.detached || p.body._dead) continue;
      const v = p.body.getLinearVelocity(), mm = p.body.getMass();
      mx += v.x * mm; my += v.y * mm; m += mm;
    }
    if (!m) return;
    const vx = mx / m, vy = my / m;
    const pv = this.pvCom;
    this.pvCom = { x: vx, y: vy };
    if (pv) {
      const dv = Math.hypot(vx - pv.x, vy - pv.y + 9.8 * dt);
      this.dvAcc = (this.dvAcc || 0) * 0.75 + dv;
      if (this.dvAcc > 9.5 && G.time - (this.lastDecel || -9) > 0.2) {
        this.lastDecel = G.time;
        const e = this.dvAcc - 9.5;
        const p = Math.random() < 0.5 ? this.parts.chest : this.parts.abdomen;
        this.hurt(p, e * 8, 'blunt');
        this.koTimer = Math.max(this.koTimer, 1.5 + e * 0.8);
        this.blood -= e * 2;
        const w = this.addWound(p, p.body.getPosition(), v2(0, 1), 0.001, e * 0.2, 'entry');
        if (w) w.internal = true;
        this.log(p.n === 'chest' ? 'Chest trauma' : 'Internal bleeding');
        if (e > 4 && Math.random() < 0.5) this.breakBone(p);
      }
    }
    // whiplash
    const h = this.parts.head;
    if (!h.body._dead) {
      const v = h.body.getLinearVelocity();
      const hp = h.pv; h.pv = { x: v.x, y: v.y };
      if (hp) {
        h.dvAcc = (h.dvAcc || 0) * 0.7 + Math.hypot(v.x - hp.x, v.y - hp.y + 9.8 * dt);
        if (h.dvAcc > 14 && G.time - (h.lastDecel || -9) > 0.2) {
          h.lastDecel = G.time;
          const e = h.dvAcc - 14;
          this.hurt(h, e * 5, 'blunt');
          this.koTimer = Math.max(this.koTimer, 3 + e * 1.5);
          this.log('Concussion');
        }
      }
    }
  }

  physiology(dt) {
    if (!this.alive) this.deadT += dt;
    const beat = Math.max(0, Math.sin((G.time + this.phase) * (this.adrenaline > 0 ? 11 : 7.5)));
    const pump = this.alive ? 0.6 + 0.8 * beat : Math.max(0, 1 - this.deadT / 10) * 0.45;
    let bleed = 0;
    for (const p of this.partList) {
      for (const w of p.wounds) {
        if (w.bleed <= 0.002) continue;
        const b = w.bleed * pump * (w.plug ? 0.25 : 1);
        bleed += b;
        if (!w.internal) {
          w.acc += b * dt * 9;
          while (w.acc > 1) { w.acc -= 1; this.emitBlood(p, w, pump); }
        }
        w.bleed *= Math.exp(-dt / w.clot);
      }
      if (p.burning > 0) this.burnTick(p, dt);
      if (p.bruise > 0) p.bruise = Math.max(0, p.bruise - dt * 0.005);
    }
    this.bleedRate = bleed;
    this.blood = Math.max(0, this.blood - bleed * dt);
    this.pain = Math.max(0, this.pain - dt * (6 + this.pain * 0.05));
    if (this.adrenaline > 0) { this.adrenaline -= dt; this.pain *= 0.98; }
    if (this.koTimer > 0) this.koTimer -= dt;
    if (this.sedated > 0) this.sedated -= dt;
    if (this.stun > 0) this.stun -= dt;
    if (this.getupCool > 0) this.getupCool -= dt;
    if (this.flinch > 0) this.flinch -= dt;

    if (this.alive) {
      // consciousness
      let target = 1;
      if (this.koTimer > 0 || this.sedated > 0) target = 0;
      if (this.brain < 35) target = 0;
      else if (this.brain < 60) target = Math.min(target, 0.85);
      if (this.blood < 45) target = 0;
      else if (this.blood < 62) target = Math.min(target, (this.blood - 45) / 17);
      if (this.pain > 150 && this.adrenaline <= 0) this.koTimer = Math.max(this.koTimer, 3);
      if (this.adrenaline > 0 && this.brain >= 35 && this.blood >= 40 && this.sedated <= 0) target = Math.max(target, 0.9);
      const rate = target < this.cons ? 5 : 0.9;
      this.cons += (target - this.cons) * Math.min(1, dt * rate);
      // brain heals a little when mildly concussed
      if (this.brain > 60 && this.brain < 100) this.brain = Math.min(100, this.brain + dt * 0.4);
      // death checks
      if (this.parts.head.detached) this.die('Decapitated');
      else if (this.parts.abdomen.detached) this.die('Cut in half');
      else if (this.brain <= 0) this.die('Fatal head trauma');
      else if (this.neckBroken && this.deadT === 0 && Math.random() < dt * 0.05) this.die('Broken neck');
      else if (this.blood <= 18) this.die('Blood loss');
      else if (this.parts.chest.hp <= -25) this.die('Fatal chest trauma');
      else if (this.parts.abdomen.hp <= -60) this.die('Fatal abdominal trauma');
      else if (this.partList.reduce((a, p) => a + p.char, 0) / this.partList.length > 0.8) this.die('Burns');
    } else {
      this.cons = Math.max(0, this.cons - dt * 3);
    }
  }

  emitBlood(p, w, pump) {
    const b = p.body;
    const wp = b.getWorldPoint(v2(w.lx, w.ly));
    const n = b.getWorldVector(v2(w.nx, w.ny));
    const v = b.getLinearVelocity();
    const arterial = w.bleed > 1.6;
    const sp = arterial ? rand(1.0, 3.0) * pump + 0.3 : rand(0.1, 0.6);
    addP({ type: 'blood', x: wp.x + n.x * 0.01, y: wp.y + n.y * 0.01, vx: v.x + n.x * sp + rand(-0.2, 0.2), vy: v.y + n.y * sp + rand(-0.2, 0.2),
      life: 2.5, size: rand(0.012, arterial ? 0.028 : 0.02), color: pick(BLOOD) });
  }

  burnTick(p, dt) {
    p.burning -= dt;
    p.char = Math.min(1, p.char + dt * 0.06);
    p.hp -= dt * 3;
    if (this.alive) this.pain += dt * 16;
    for (const w of p.wounds) w.bleed *= 0.996;
    if (Math.random() < dt * 30) {
      const b = p.body;
      const lx = p.d.r ? rand(-p.d.r, p.d.r) * 0.7 : rand(-p.d.hw, p.d.hw), ly = p.d.r ? rand(-p.d.r, p.d.r) * 0.7 : rand(-p.d.hh, p.d.hh);
      const wp = b.getWorldPoint(v2(lx, ly));
      addP({ type: 'fire', x: wp.x, y: wp.y, vx: rand(-0.3, 0.3), vy: rand(0.4, 1.2), life: rand(0.3, 0.7), size: rand(0.06, 0.13) });
      if (Math.random() < 0.15) smoke(wp.x, wp.y, 1, 0.1, 'rgba(40,38,40,', 1.5);
    }
    // spread
    this.spreadT -= dt;
    if (this.spreadT <= 0) {
      this.spreadT = 0.5;
      for (const q of [p.parent, ...p.children]) if (q && !q.detached && q.burning <= 0 && Math.random() < 0.35) q.burning = rand(5, 9);
      const pos = p.body.getPosition();
      for (const ob of queryBodies(pos.x, pos.y, 0.35)) {
        if (entOf(ob) === this) continue;
        if (Math.random() < 0.2) Combat.ignite(ob, 6);
      }
    }
    if (p.burning <= 0) p.burning = 0;
  }

  /* ---------------- motor control ---------------- */
  drive(p, target, tq, gain = 16) {
    const j = p.joint;
    if (!j || j._dead) return;
    if (!this.muscleOK(p)) { j.setMotorSpeed(0); j.setMaxMotorTorque(this.alive ? 2 : 1.2); return; }
    if (p.broken || p.hp <= 0) tq *= 0.06;
    if (p.parent && p.parent.broken && p.kind !== 'torso') tq *= 0.4;
    tq = Math.max(tq, 1.5);
    const lo = j.getLowerLimit(), hi = j.getUpperLimit();
    target = clamp(target, lo + 0.01, hi - 0.01);
    const a = j.getJointAngle();
    j.setMotorSpeed(clamp((target - a) * gain, -14, 14));
    j.setMaxMotorTorque(tq);
  }
  limp(fr) {
    for (const p of this.partList) {
      const j = p.joint;
      if (!j || j._dead) continue;
      j.setMotorSpeed(0);
      j.setMaxMotorTorque(fr * (p.kind === 'leg' ? 1.6 : p.n === 'head' ? 0.6 : 1));
    }
  }
  servo(body, target, maxT, k) {
    const a = angNorm(body.getAngle() - target);
    const w = body.getAngularVelocity();
    const t = clamp((-a * k - w) * 60, -maxT, maxT);
    body.applyTorque(t, true);
  }
  ground(x, y, len) {
    const g = this.group;
    return rayFirst(v2(x, y), v2(x, y - len), (fx) => {
      if (fx.getFilterGroupIndex() === g) return false;
      const b = fx.getBody();
      if (b.getUserData().noSupport) return false;
      return b.isStatic() || b.getMass() > 4;
    });
  }
  com() {
    let mx = 0, my = 0, m = 0;
    for (const p of this.partList) {
      if (p.detached) continue;
      const c = p.body.getWorldCenter(), mm = p.body.getMass();
      mx += c.x * mm; my += c.y * mm; m += mm;
    }
    return { x: mx / m, y: my / m, m };
  }

  control(dt) {
    const P = this.parts, f = this.f;
    const ch = P.chest.body, ab = P.abdomen.body;
    if (ch._dead || ab._dead) return;
    const grabbed = this.isGrabbed();
    const abp = ab.getPosition();
    const gh = this.ground(abp.x, abp.y, 1.9);
    const hipH = gh ? abp.y - gh.p.y : 99;
    const cA = angNorm(ch.getAngle()), aA = angNorm(ab.getAngle());
    const upright = Math.cos(cA) > 0.72 && Math.cos(aA) > 0.72;
    const canStand = this.canStand();
    const speed = ab.getLinearVelocity().length();
    const airborne = hipH > 1.7;
    this.airT = airborne ? this.airT + dt : 0;

    if (!this.alive) {
      this.state = 'fallen';
      if (this.deadT < 1.6) this.spasm(dt); else this.limp(this.deadT < 3 ? 3 : 1.4);
      return;
    }
    if (this.cons < 0.35) { this.state = 'fallen'; this.fallenT = 0; this.limp(2.6); return; }

    switch (this.state) {
      case 'stand':
        if (!canStand || grabbed || !upright || hipH > 1.5 || hipH < 0.72) { this.state = 'fallen'; this.fallenT = 0; }
        break;
      case 'fallen':
        this.fallenT += dt;
        if (canStand && !grabbed && this.fallenT > 1.4 && this.getupCool <= 0 && speed < 1.2 && hipH < 1.5) { this.state = 'getup'; this.getupT = 0; }
        break;
      case 'getup':
        this.getupT += dt;
        if (!canStand || grabbed) { this.state = 'fallen'; this.fallenT = 0; this.getupCool = 1.5; }
        else if (upright && hipH > 0.98 && this.getupT > 0.6) this.state = 'stand';
        else if (this.getupT > 3.2) { this.state = 'fallen'; this.fallenT = 0; this.getupCool = 2.5; }
        break;
    }

    const s = this.strength();
    if (this.stagger > 0) { this.stagger -= dt; if (this.stagger <= 0) this.stagCool = 0.8; }
    if (this.stagCool > 0) this.stagCool -= dt;
    if (this.legShock) for (const k in this.legShock) this.legShock[k] = Math.max(0, this.legShock[k] - dt);
    if (this.state === 'stand') {
      // being shoved or hit makes them stumble instead of standing rigid
      // a sudden change in body velocity (a shove, a hit, a blast) starts a stumble
      const cv = this.pvCom || { x: 0 };
      if (Math.abs(cv.x) > 1.9 && this.stagger > 0) { this.state = 'fallen'; this.fallenT = 0; this.stagger = 0; this.step = null; }
      else if ((this.dvAcc || 0) > (this.stagCool > 0 ? 1.4 : 0.45) && !(this.stagger > 0.05) && !this.step) {
        this.stagger = Math.max(this.stagger || 0, 0.35 + Math.min(this.dvAcc, 3) * 0.2);
        this.stagDir = Math.sign(cv.x) || this.stagDir || 1;
      } else if (this.stagger > 0 && Math.abs(cv.x) > 0.25) this.stagDir = Math.sign(cv.x);
    } else this.stagger = 0;
    if (this.state === 'fallen' && this.cons > 0.5 && !grabbed && hipH > 0.45 && hipH < 1.6 && speed > 1.2) {
      this.brace(s);
      this.clutching = null;
      return;
    }
    if (this.state === 'stand' || this.state === 'getup') {
      const r = this.state === 'getup' ? clamp(this.getupT / 1.1, 0.15, 1) : 1;
      this.balance(s, r, gh, hipH, this.state === 'getup');
    } else if (this.airT > 0.25 || (this.partList.some((p) => p.burning > 0))) {
      this.flail(s);
    } else if (this.pain > 28) {
      this.writhe(s);
    } else {
      this.rest(s);
    }
    this.clutch(s);
  }

  balance(s, r, gh, hipH, getup) {
    const P = this.parts, f = this.f;
    const ch = P.chest.body, ab = P.abdomen.body;
    const k = s * r;
    const W = this.mass * 9.8;
    const t = G.time + this.phase;
    const stag = !getup && this.stagger > 0 ? clamp(this.stagger / 0.5, 0, 1) : 0;
    const dir = this.stagDir || 1;
    const shock = this.legShock || {};
    const weak = { F: this.legWeak('F'), B: this.legWeak('B') };
    const hurtLean = (weak.F + weak.B) * 0.06;
    // idle sway + breathing, lean into a stumble, hunch when hurt
    const sway = 0.022 * Math.sin(t * 0.7) + 0.01 * Math.sin(t * 1.9);
    const lean = -0.03 * f + sway - dir * 0.16 * stag - f * hurtLean - f * clamp(this.pain / 400, 0, 0.12);
    this.servo(ch, lean, 360 * k * (1 - 0.45 * stag), 8);
    this.servo(ab, lean * 0.5, 300 * k * (1 - 0.45 * stag), 8);
    let feetMid = ab.getPosition().x;
    if (gh) {
      const vy = ab.getLinearVelocity().y;
      const dip = 0.04 * stag + (weak.F + weak.B) * 0.07 + Math.max(shock.F || 0, shock.B || 0) * 0.12;
      let F = 0.42 * W + 5200 * (1.07 - dip - hipH) - 520 * vy;
      F = clamp(F, 0, (getup ? 1.3 : 0.95) * W) * k;
      ab.applyForceToCenter(v2(0, F), true);
      let fx = 0, n = 0;
      for (const sd of ['F', 'B']) { const ft = P['foot' + sd]; if (!ft.detached) { fx += ft.body.getPosition().x; n++; } }
      if (n) {
        fx /= n; feetMid = fx;
        const c = this.com();
        const vx = ab.getLinearVelocity().x;
        // while stumbling the body is allowed to travel; the steps catch it
        const Fx = clamp(-1500 * (c.x - fx) - 260 * vx, -0.3 * W, 0.3 * W) * k * (1 - 0.45 * stag);
        ab.applyForceToCenter(v2(Fx, 0), true);
        if (!getup) {
          for (const sd of ['F', 'B']) {
            if (this.step && this.step.side === sd) continue;
            const ft = P['foot' + sd].body;
            const v = ft.getLinearVelocity();
            ft.applyForceToCenter(v2(-v.x * 40 * k * (1 - 0.6 * stag), 0), true);
          }
        }
      }
    }
    // stumble steps
    if (!getup) this.updateStep(stag, dir, feetMid);
    const abA = ab.getAngle(), chA = ch.getAngle();
    const tuck = getup && this.getupT < 0.45;
    const shift = 0.035 * Math.sin(t * 0.45);
    for (const sd of ['F', 'B']) {
      const th = P['thigh' + sd], sh = P['shin' + sd], ft = P['foot' + sd];
      const stance = (sd === 'F' ? 0.09 : -0.07) + shift;
      const legK = k * (1 - 0.75 * (shock[sd] || 0)) * (1 - 0.35 * weak[sd]);
      if (tuck) {
        this.drive(th, f * 1.3, 500 * s);
        this.drive(sh, f * -1.9, 450 * s);
      } else if (this.step && this.step.side === sd) {
        const st = this.step, ph = clamp(st.t / st.dur, 0, 1);
        const swing = Math.sin(ph * Math.PI);
        this.drive(th, angNorm(st.dir * (0.32 + 0.25 * st.reach) * Math.min(1, ph * 2) - abA), 650 * k, 12);
        this.drive(sh, f * (-0.08 - 1.0 * swing), 550 * k, 12);
      } else {
        const bend = 0.05 + 0.55 * weak[sd] + 0.9 * (shock[sd] || 0) + 0.12 * stag;
        const planted = this.step ? -this.step.dir * 0.12 : 0;
        this.drive(th, angNorm(f * stance + planted + f * bend * 0.45 - abA), 700 * legK);
        this.drive(sh, f * -bend, 650 * legK);
      }
      this.drive(ft, angNorm(-sh.body.getAngle()), 200 * k);
    }
    this.drive(P.abdomen, f * (0.04 * stag + hurtLean), 550 * k);
    // head: glance around when calm, snap toward a hit
    const look = this.flinch > 0 ? -0.25 * f : 0.12 * Math.sin(t * 0.35) + 0.05 * Math.sin(t * 1.3);
    this.drive(P.head, angNorm((0.04 * f + look) - chA) * 0.6, 80 * k, 9);
    for (const sd of ['F', 'B']) {
      const ua = P['uarm' + sd], la = P['larm' + sd];
      if (this.clutching === sd) continue;
      if (this.flinch > 0.15 && this.flinchPart !== 'uarm' + sd && this.flinchPart !== 'larm' + sd) {
        // protective flinch: forearms come up in front of the face
        this.drive(ua, f * (sd === 'F' ? 2.1 : 1.8), 70 * k, 12);
        this.drive(la, f * 2.1, 45 * k, 12);
      } else if (stag > 0.05) {
        // arms fling out to catch balance
        const flail = Math.sin(t * 9 + (sd === 'F' ? 0 : 2)) * 0.5;
        this.drive(ua, angNorm(dir * (1.3 + flail) - chA), 60 * k, 10);
        this.drive(la, f * (0.6 + 0.4 * flail), 40 * k, 10);
      } else {
        const swing = 0.07 * Math.sin(t * 0.9 + (sd === 'F' ? 0 : Math.PI));
        this.drive(ua, angNorm((sd === 'F' ? 0.08 : -0.04) * f + swing - chA), 55 * k, 8);
        this.drive(la, f * (sd === 'F' ? 0.3 : 0.18), 35 * k, 8);
      }
    }
  }

  legWeak(sd) {
    const th = this.parts['thigh' + sd], sh = this.parts['shin' + sd];
    const h = Math.min(th.hp / th.maxHp, sh.hp / sh.maxHp);
    return clamp((0.75 - h) / 0.5, 0, 1);
  }

  /* a stumbling step: swing the trailing foot out in the direction the body is falling */
  updateStep(stag, dir, feetMid) {
    const P = this.parts;
    if (this.step) {
      this.step.t += DT;
      if (this.step.t >= this.step.dur) { this.lastStepSide = this.step.side; this.step = null; this.stepCool = 0.04; }
      return;
    }
    if (this.stepCool > 0) { this.stepCool -= DT; return; }
    const c = this.com();
    const off = c.x - feetMid;
    const vx = (this.pvCom || { x: 0 }).x;
    if (stag <= 0.02) return;
    const need = Math.abs(off) > 0.06 || Math.abs(vx) > 0.25;
    if (!need) return;
    const d = Math.sign(off || vx) || dir;
    // the foot further behind in the fall direction steps
    let side = null, worst = 1e9;
    for (const sd of ['F', 'B']) {
      if (P['foot' + sd].detached || P['thigh' + sd].broken || P['shin' + sd].broken) continue;
      const x = P['foot' + sd].body.getPosition().x * d;
      if (x < worst) { worst = x; side = sd; }
    }
    if (side === this.lastStepSide && Math.random() < 0.5) side = side === 'F' ? 'B' : 'F';
    if (!side) return;
    this.step = { side, t: 0, dur: 0.24 + Math.random() * 0.06, dir: d, reach: clamp(Math.abs(off) * 4 + Math.abs(vx) * 0.4, 0, 1) };
  }

  /* arms shoot out toward the ground to break a fall */
  brace(s) {
    const P = this.parts, f = this.f;
    const ab = P.abdomen.body, ch = P.chest.body;
    const v = ab.getLinearVelocity();
    const c = ch.getPosition();
    const dx = Math.sign(v.x || 1);
    const T = v2(c.x + dx * 0.55, c.y - 0.9);
    for (const sd of ['F', 'B']) {
      if (!this.reach(sd, T, s * 1.4)) {
        this.drive(P['uarm' + sd], angNorm(dx * 1.0 - ch.getAngle()), 70 * s);
        this.drive(P['larm' + sd], f * 0.2, 45 * s);
      }
    }
    this.drive(P.head, f * -0.35, 70 * s);
    this.drive(P.abdomen, f * 0.35, 300 * s * 0.5);
    for (const sd of ['F', 'B']) {
      this.drive(P['thigh' + sd], f * 0.5, 400 * s * 0.4);
      this.drive(P['shin' + sd], f * -0.6, 350 * s * 0.4);
    }
  }

  /* brief involuntary twitching right after death */
  spasm(dt) {
    const k = Math.max(0, 1 - this.deadT / 1.6);
    this.spasmT = (this.spasmT || 0) - dt;
    if (this.spasmT <= 0) {
      this.spasmT = rand(0.06, 0.16);
      for (const p of this.partList) {
        const j = p.joint;
        if (!j || j._dead || p.detached) continue;
        const lo = j.getLowerLimit(), hi = j.getUpperLimit();
        j.setMotorSpeed(Math.random() < 0.5 ? rand(-6, 6) * k : 0);
        j.setMaxMotorTorque((p.kind === 'leg' ? 60 : p.kind === 'torso' ? 80 : 18) * k * rand(0.3, 1) + 2);
      }
    }
  }

  rest(s) {
    const P = this.parts, f = this.f, k = 0.22 * s;
    this.drive(P.abdomen, f * 0.1, 300 * k);
    this.drive(P.head, f * -0.1, 60 * k);
    for (const sd of ['F', 'B']) {
      this.drive(P['thigh' + sd], f * (sd === 'F' ? 0.5 : 0.2), 500 * k);
      this.drive(P['shin' + sd], f * (sd === 'F' ? -0.8 : -0.4), 400 * k);
      this.drive(P['foot' + sd], 0, 100 * k);
      if (this.clutching !== sd) {
        this.drive(P['uarm' + sd], f * 0.5, 50 * k);
        this.drive(P['larm' + sd], f * 1.0, 30 * k);
      }
    }
  }

  writhe(s) {
    const P = this.parts, f = this.f;
    const t = G.time + this.phase;
    const amp = clamp(this.pain / 90, 0.3, 1);
    const k = (0.28 + 0.2 * amp) * s;
    this.drive(P.abdomen, f * (0.25 + 0.3 * Math.sin(t * 1.7) * amp), 350 * k);
    this.drive(P.head, f * (-0.2 + 0.3 * Math.sin(t * 2.3)), 60 * k);
    for (const sd of ['F', 'B']) {
      const ph = sd === 'F' ? 0 : 1.7;
      this.drive(P['thigh' + sd], f * (0.9 + 0.6 * Math.sin(t * 2.1 + ph) * amp), 450 * k);
      this.drive(P['shin' + sd], f * (-1.2 - 0.7 * Math.sin(t * 1.6 + ph + 1) * amp), 400 * k);
      if (this.clutching !== sd) {
        this.drive(P['uarm' + sd], f * (1.0 + 0.8 * Math.sin(t * 2.6 + ph) * amp), 60 * k);
        this.drive(P['larm' + sd], f * (1.6 + 0.6 * Math.sin(t * 3.1 + ph)), 40 * k);
      }
    }
  }

  flail(s) {
    const P = this.parts, f = this.f;
    const t = G.time * 1.0 + this.phase;
    const k = 0.45 * s;
    this.drive(P.abdomen, f * 0.2 * Math.sin(t * 5), 300 * k);
    this.drive(P.head, f * 0.3 * Math.sin(t * 4), 60 * k);
    for (const sd of ['F', 'B']) {
      const ph = sd === 'F' ? 0 : Math.PI;
      this.drive(P['thigh' + sd], f * (0.6 + 0.9 * Math.sin(t * 8 + ph)), 450 * k);
      this.drive(P['shin' + sd], f * (-0.9 - 0.7 * Math.sin(t * 8 + ph + 1)), 350 * k);
      if (this.clutching !== sd) {
        this.drive(P['uarm' + sd], f * (1.4 + 1.4 * Math.sin(t * 10 + ph)), 70 * k);
        this.drive(P['larm' + sd], f * (1.2 + 0.9 * Math.sin(t * 11 + ph)), 45 * k);
      }
    }
  }

  /* hold the worst bleeding wound with a free hand (two-bone IK) */
  clutch(s) {
    this.clutching = null;
    if (s < 0.2 || this.airT > 0.25) return;
    let best = null, bw = null, bv = 0.35;
    for (const p of this.partList) {
      if (p.detached || p.kind === 'arm') continue;
      for (const w of p.wounds) if (w.bleed > bv && !w.plug && !w.internal) { bv = w.bleed; best = p; bw = w; }
    }
    if (!best) return;
    const target = best.body.getWorldPoint(v2(bw.lx * 0.6, bw.ly * 0.85));
    for (const sd of ['F', 'B']) {
      if (this.reach(sd, target, s)) { this.clutching = sd; return; }
    }
  }
  reach(sd, T, s) {
    const ua = this.parts['uarm' + sd], la = this.parts['larm' + sd];
    if (ua.detached || la.detached || ua.broken || la.broken || !ua.joint || ua.joint._dead || !la.joint || la.joint._dead) return false;
    const S = ua.joint.getAnchorA();
    const L1 = 0.315, L2 = 0.3;
    const dx = T.x - S.x, dy = T.y - S.y;
    const d = clamp(Math.hypot(dx, dy), 0.1, L1 + L2 - 0.02);
    if (Math.hypot(dx, dy) > L1 + L2 + 0.25) return false;
    const base = Math.atan2(dy, dx);
    const A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const chA = this.parts.chest.body.getAngle();
    for (const sg of [1, -1]) {
      const a1 = base + sg * A;
      const ex = S.x + Math.cos(a1) * L1, ey = S.y + Math.sin(a1) * L1;
      const a2 = Math.atan2(T.y - ey, T.x - ex);
      const th1 = a1 + Math.PI / 2, th2 = a2 + Math.PI / 2;
      const rs = angNorm(th1 - chA), re = angNorm(th2 - th1);
      if (re * this.f >= -0.05 && Math.abs(re) <= 2.6) {
        this.drive(ua, rs, 70 * s);
        this.drive(la, re, 45 * s);
        return true;
      }
    }
    return false;
  }

  /* ---------------- injuries ---------------- */
  hurt(p, amt, type) {
    if (!p || amt <= 0) return;
    p.hp -= amt;
    this.lastHurt = G.time;
    const pm = { bullet: 1.1, cut: 1.1, stab: 1.2, blunt: 0.9, burn: 1.4, blast: 1.0, energy: 1.2 }[type] || 1;
    if (this.alive) this.pain += amt * pm * (this.adrenaline > 0 ? 0.3 : 1);
    if (p.n === 'head') this.brain -= amt * (type === 'blunt' ? 0.9 : 1.4);
    if (amt > 28 && this.state === 'stand') this.stun = Math.max(this.stun, 0.2 + amt / 70);
    if (this.state === 'stand') this.stagger = Math.max(this.stagger || 0, 0.35 + Math.min(amt, 40) / 60);
    this.flinch = 0.45;
    this.flinchPart = p.n;
    if (p.kind === 'leg') { const sd = p.n.slice(-1); this.legShock = this.legShock || {}; this.legShock[sd] = Math.max(this.legShock[sd] || 0, Math.min(1.2, 0.3 + amt / 40)); }
  }

  addWound(p, wp, wn, r, bleed, type, ang = 0) {
    const b = p.body;
    if (b._dead) return null;
    const lp = b.getLocalPoint(wp);
    const ln = b.getLocalVector(wn);
    const ll = Math.hypot(ln.x, ln.y) || 1;
    // clamp onto the part surface
    let lx = lp.x, ly = lp.y;
    if (p.d.r) { const l = Math.hypot(lx, ly) || 1; if (l > p.d.r) { lx *= p.d.r / l; ly *= p.d.r / l; } }
    else { lx = clamp(lx, -p.d.hw, p.d.hw); ly = clamp(ly, -p.d.hh, p.d.hh); }
    for (const w of p.wounds) {
      if (Math.hypot(w.lx - lx, w.ly - ly) < r * 0.6 && w.type === type) { w.bleed += bleed; w.r = Math.min(w.r * 1.15, 0.06); return w; }
    }
    const w = { lx, ly, nx: ln.x / ll, ny: ln.y / ll, r, bleed, type, ang: ang - b.getAngle(), clot: bleed > 2 ? 70 : bleed > 0.8 ? 40 : 22, acc: 0, t: G.time };
    p.wounds.push(w);
    if (p.wounds.length > 16) p.wounds.shift();
    return w;
  }

  impact(p, eff, dv, J, other) {
    if (p.detached && p.kind !== 'head') return;
    if (p.n === 'head') {
      if (eff > 6) {
        const d = (eff - 6) * 6.5;
        this.hurt(p, d, 'blunt');
        p.bruise = Math.min(1, p.bruise + d / 40);
        if (eff > 8.5) { this.koTimer = Math.max(this.koTimer, Math.min(25, (eff - 7.5) * 2.2)); this.log('Concussion'); }
        if (eff > 13 && !p.broken && Math.random() < 0.5) this.breakBone(p);
        if (eff > 15 && !this.neckBroken && Math.random() < 0.35) { this.neckBroken = true; this.log('Broken neck'); Sound.play('bone', 0.8); this.die('Broken neck'); }
        Sound.play('flesh', clamp(eff / 14, 0.1, 1));
      }
    } else {
      const thr = p.kind === 'torso' ? 8.5 : 7.5;
      if (eff > thr) {
        const d = (eff - thr) * 5;
        this.hurt(p, d, 'blunt');
        p.bruise = Math.min(1, p.bruise + d / 50);
        if (d > 6) this.log('Blunt trauma · ' + p.label);
        Sound.play('flesh', clamp(eff / 16, 0.1, 1));
        if (eff > 12) bloodSpray(p.body.getPosition().x, p.body.getPosition().y, 0, 1, 3, 1.5, 1.2);
      }
      const bt = p.kind === 'leg' ? 11 : p.kind === 'arm' ? 10 : 13.5;
      if (eff > bt && !p.broken && Math.random() < (eff - bt) / 5) this.breakBone(p);
      // a hard landing travels up the leg
      if (p.kind === 'leg' && eff > bt && p.parent && p.parent.kind === 'leg' && Math.random() < 0.6) this.impact(p.parent, eff * 0.8, dv * 0.8, 0, other);
    }
    // crushing
    const F = J / DT;
    if (F > 14000 && other && other.getMass() > 25) this.hurt(p, (F - 14000) * 0.0005, 'blunt');
  }

  breakBone(p) {
    if (p.broken || p.detached) return;
    p.broken = true;
    const loosen = (j, m) => { if (j && !j._dead && j._base) j.setLimits(j._base[0] - m, j._base[1] + m); };
    if (p.n === 'head') { this.brain -= 30; this.log('Skull fracture'); }
    else if (p.n === 'abdomen') { this.spineBroken = true; loosen(p.joint, 0.6); this.log('Spinal fracture'); }
    else if (p.n === 'chest') { this.pain += 25; this.log('Broken ribs'); }
    else {
      loosen(p.joint, 0.7);
      for (const c of p.children) loosen(c.joint, 0.9);
      this.log('Fractured ' + p.label);
    }
    if (this.alive) this.pain += 30;
    this.stun = Math.max(this.stun, 0.8);
    p.bruise = Math.min(1, p.bruise + 0.5);
    Sound.play('bone', 0.9);
  }

  sever(p, o = {}) {
    if (!p.joint || p.joint._dead || p.detached) return false;
    const j = p.joint;
    const anchor = j.getAnchorA();
    const a = v2(anchor.x, anchor.y);
    killJoint(j);
    p.joint = null;
    const mark = (q) => { q.detached = true; for (const c of q.children) mark(c); };
    mark(p);
    const par = p.parent;
    const bleed = o.cauterize ? 0.15 : (p.n === 'head' ? 7 : p.kind === 'leg' ? 6 : 4.5);
    const pp = par.body.getPosition(), cp = p.body.getPosition();
    const nPar = v2(a.x - pp.x, a.y - pp.y), nCh = v2(a.x - cp.x, a.y - cp.y);
    const lenP = Math.hypot(nPar.x, nPar.y) || 1, lenC = Math.hypot(nCh.x, nCh.y) || 1;
    nPar.x /= lenP; nPar.y /= lenP; nCh.x /= lenC; nCh.y /= lenC;
    const r = Math.min(p.d.hw || p.d.r * 0.6, 0.07);
    const w1 = this.addWound(par, a, nPar, r, bleed, 'stump');
    const w2 = this.addWound(p, a, nCh, r, bleed * 0.5, 'stump');
    if (w1) { w1.cut = !!o.cauterize; w1.clot = 120; }
    if (w2) { w2.cut = !!o.cauterize; w2.clot = 30; }
    if (!o.cauterize) {
      bloodSpray(a.x, a.y, nPar.x, nPar.y, 22, 3.5, 0.7, 1.3);
      bloodSpray(a.x, a.y, nCh.x, nCh.y, 12, 2.5, 0.8, 1.2);
    } else {
      smoke(a.x, a.y, 4, 0.08, 'rgba(60,60,70,', 1);
    }
    if (this.alive) this.pain += 90;
    this.stun = Math.max(this.stun, 1.5);
    const nice = p.n === 'head' ? 'Decapitated' : p.n === 'abdomen' ? 'Severed at the waist' : 'Lost ' + p.label;
    this.log(nice);
    Sound.play(o.cauterize ? 'energy_hit' : 'slice', 1);
    Sound.play('bone', 0.6);
    if (p.n === 'head') this.die('Decapitated');
    if (p.n === 'abdomen') this.die('Cut in half');
    return true;
  }

  die(cause) {
    if (!this.alive) return;
    this.alive = false;
    this.cause = cause;
    this.deadT = 0;
    this.log('Died · ' + cause);
  }

  /* bullet, blade, blast, burn handlers */
  bulletHit(p, pt, n, dir, dmg, o = {}) {
    const cal = o.caliber || 1;
    this.hurt(p, dmg, 'bullet');
    let bleed = 0.45 * cal + (p.kind === 'torso' ? 0.8 : 0) + (p.n.startsWith('thigh') ? 0.9 : 0) + (p.n === 'head' ? 0.4 : 0);
    this.addWound(p, pt, n, 0.014 * Math.sqrt(cal), bleed, 'entry');
    bloodSpray(pt.x, pt.y, n.x - dir.x * 0.3, n.y - dir.y * 0.3, Math.round(4 * cal), 2, 0.6);
    if (o.exitP) {
      const en = o.exitN || dir;
      this.addWound(p, o.exitP, en, 0.024 * Math.sqrt(cal), bleed * 0.7, 'exit');
      bloodSpray(o.exitP.x, o.exitP.y, dir.x, dir.y, Math.round(10 * cal), 4.5 * Math.min(2, cal), 0.35, 1.1);
    }
    if (p.n === 'head') {
      if (dmg >= 26) { this.brain = -50; this.log('Gunshot wound to the head'); }
      else this.brain -= dmg * 1.6;
    } else this.log((o.label || 'Gunshot wound') + ' · ' + p.label);
    if ((p.kind === 'arm' || p.kind === 'leg') && Math.random() < 0.2 * cal) this.breakBone(p);
    if (p.kind === 'torso' && Math.random() < 0.08 * cal) this.breakBone(p);
    if (o.dismember && p.d.sever && p.n !== 'abdomen' && dmg > p.d.sever * 0.9 && Math.random() < 0.65) this.sever(p);
    else if (o.dismember && p.d.sever && dmg > p.d.sever * 1.6 && Math.random() < 0.5) this.sever(p);
    Sound.play('bullethit', 0.7);
  }

  cutHit(p, pt, dir, dmg, o = {}) {
    if (dmg <= 0) return;
    // chest cuts near a joint sever that child (e.g. neck)
    let target = p;
    if (p.n === 'chest' && dmg > 18) {
      let best = null, bd = 0.13;
      for (const c of p.children) {
        if (!c.joint || c.joint._dead) continue;
        const a = c.joint.getAnchorA();
        const d = Math.hypot(a.x - pt.x, a.y - pt.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) target = best;
    }
    this.hurt(p, dmg, o.energy ? 'energy' : 'cut');
    const c = p.body.getPosition();
    const n = v2(pt.x - c.x, pt.y - c.y);
    const nl = Math.hypot(n.x, n.y) || 1; n.x /= nl; n.y /= nl;
    const bleed = o.energy ? 0.05 : clamp(dmg * 0.09, 0.3, 3.5);
    const w = this.addWound(p, pt, n, clamp(0.02 + dmg * 0.0018, 0.02, 0.07), bleed, 'cut', Math.atan2(dir.y, dir.x));
    if (w && o.energy) w.burnt = true;
    if (!o.energy) bloodSpray(pt.x, pt.y, dir.x * 0.5 + n.x, dir.y * 0.5 + n.y, Math.round(clamp(dmg / 2.5, 3, 18)), 3, 0.8);
    else { p.char = Math.min(1, p.char + 0.12); smoke(pt.x, pt.y, 1, 0.06, 'rgba(70,70,80,', 0.7); }
    let severed = false;
    const sv = target.d.sever;
    if (sv && target.n !== 'chest') {
      target.cutAcc = (target.cutAcc || 0) * 0.5 + dmg;
      if (dmg > sv * rand(0.85, 1.25) || (o.energy && target.cutAcc > sv)) severed = this.sever(target, { cauterize: o.energy });
    }
    if (!severed) {
      if (dmg > 22 && (p.kind === 'arm' || p.kind === 'leg') && Math.random() < 0.35) this.breakBone(p);
      this.log((o.energy ? 'Plasma burn · ' : 'Laceration · ') + p.label);
      Sound.play(o.energy ? 'energy_hit' : 'slice', clamp(dmg / 25, 0.3, 1));
    }
    return severed;
  }

  stabHit(p, pt, ax, dmg) {
    this.hurt(p, dmg, 'stab');
    const n = v2(-ax.x, -ax.y);
    const w = this.addWound(p, pt, n, 0.02, clamp(dmg * 0.11, 0.5, 4), 'stab', Math.atan2(ax.y, ax.x));
    bloodSpray(pt.x, pt.y, n.x, n.y, Math.round(clamp(dmg / 3, 3, 12)), 2.2, 0.7);
    if (p.n === 'head' && dmg > 18) this.brain -= dmg * 2;
    this.log('Stab wound · ' + p.label);
    Sound.play('stab', 0.8);
    return w;
  }

  blastHit(p, dmg, k, o) {
    this.hurt(p, dmg, 'blast');
    p.char = Math.min(1, p.char + k * (o.fire ? 0.5 : 0.25));
    p.bruise = Math.min(1, p.bruise + k);
    const n = Math.round(k * 4);
    for (let i = 0; i < n; i++) {
      const c = p.body.getPosition();
      const a = rand(0, TAU);
      this.addWound(p, v2(c.x + Math.cos(a) * 0.2, c.y + Math.sin(a) * 0.2), v2(Math.cos(a), Math.sin(a)), rand(0.01, 0.02), rand(0.2, 0.7), 'entry');
    }
    if (p.n === 'head') { this.koTimer = Math.max(this.koTimer, k * 12); }
    if (k > 0.35 && (p.kind === 'arm' || p.kind === 'leg') && Math.random() < k * 0.6) this.breakBone(p);
    if (k > 0.6 && p.d.sever && dmg > p.d.sever * 1.2 && Math.random() < (p.n === 'abdomen' ? 0.15 : 0.45)) this.sever(p);
    if (o.fire && Math.random() < k) p.burning = Math.max(p.burning, rand(4, 8));
    if (k > 0.2) this.log('Blast injuries');
  }

  burnHit(p, amt) {
    if (!p) return;
    p.burning = Math.max(p.burning, rand(4, 8));
    if (this.alive) this.pain += amt * 6;
  }
  ignitePart(p, dur) {
    if (p.burning <= 0) this.log('On fire · ' + p.label);
    p.burning = Math.max(p.burning, dur);
  }

  inject(kind) {
    if (kind === 'life') { this.heal(); this.log('Life serum injected'); }
    else if (kind === 'adrenaline') {
      if (!this.alive) { this.log('Adrenaline · no effect'); return; }
      this.adrenaline = 25; this.koTimer = 0; this.pain *= 0.2; this.stun = 0; this.log('Adrenaline injected');
    } else if (kind === 'sedative') {
      this.sedated = 18; this.log('Sedative injected');
    }
  }

  heal() {
    const revivable = !this.parts.head.detached && !this.parts.abdomen.detached;
    this.blood = 100; this.brain = 100; this.pain = 0; this.koTimer = 0; this.stun = 0; this.sedated = 0;
    this.spineBroken = false; this.neckBroken = false;
    for (const p of this.partList) {
      p.hp = p.maxHp; p.broken = false; p.char = 0; p.burning = 0; p.bruise = 0; p.cutAcc = 0;
      p.wounds = p.wounds.filter((w) => w.type === 'stump').map((w) => Object.assign(w, { bleed: 0 }));
      p.body.getUserData().stains.length = 0;
      if (p.joint && !p.joint._dead && p.joint._base) p.joint.setLimits(p.joint._base[0], p.joint._base[1]);
    }
    if (revivable) {
      if (!this.alive) this.log('Revived');
      this.alive = true; this.deadT = 0; this.cause = null; this.cons = 0.5;
    }
    this.state = 'fallen'; this.fallenT = 1;
    Sound.play('heal', 0.7);
    const c = this.parts.chest.body.getPosition();
    for (let i = 0; i < 14; i++) addP({ type: 'glow', x: c.x + rand(-0.4, 0.4), y: c.y + rand(-0.9, 0.5), vx: 0, vy: rand(0.3, 1), life: rand(0.5, 1.1), size: rand(0.05, 0.1), col: '120,255,170' });
  }

  /* ---------------- drawing ---------------- */
  partColor(p) {
    let base = p.d.layer === 0 || p.d.layer === 1 ? SKIN.back : p.d.layer === 2 ? SKIN.mid : p.n === 'head' ? SKIN.head : SKIN.front;
    if (!this.alive) base = mixColor(base, SKIN.dead, clamp(this.deadT / 30, 0, 0.6));
    if (p.char > 0) base = mixColor(base, SKIN.char, p.char * 0.9);
    return base;
  }

  draw(ctx) {
    for (const p of this.drawOrder) this.drawPart(ctx, p);
  }

  drawPart(ctx, p) {
    const b = p.body;
    if (b._dead) return;
    const pos = b.getPosition(), a = b.getAngle(), f = this.f, d = p.d;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(a);
    if (!p.path) {
      p.path = new Path2D();
      if (d.r) p.path.arc(0, 0, d.r, 0, TAU);
      else if (p.n.startsWith('foot')) roundRectPath(p.path, -d.hw, -d.hh, d.hw * 2, d.hh * 2 + 0.01, f > 0 ? [0.008, 0.02, 0.006, 0.006] : [0.02, 0.008, 0.006, 0.006]);
      else roundRectPath(p.path, -d.hw, -d.hh, d.hw * 2, d.hh * 2, 0.012);
    }
    const path = p.path;
    const col = this.partColor(p);
    ctx.fillStyle = col;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    // soft side shading gives some volume
    if (!d.r) {
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(-f * d.hw, -d.hh, f * d.hw * 0.55, d.hh * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(f * d.hw * 0.25, -d.hh, f * d.hw * 0.45, d.hh * 2);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.arc(-f * d.r * 0.35, -d.r * 0.2, d.r, 0, TAU); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(f * d.r * 0.12, d.r * 0.1, d.r * 0.85, 0, TAU); ctx.fill();
    }
    // hands & shoes
    if (p.n.startsWith('larm')) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-d.hw, -d.hh, d.hw * 2, 0.075); }
    if (p.n.startsWith('foot')) { ctx.fillStyle = 'rgba(20,22,26,0.55)'; ctx.fillRect(-d.hw, -d.hh, d.hw * 2, d.hh * 2 + 0.02); }
    // crash-test marker on head & hips
    if (p.n === 'head') drawMarker(ctx, -f * 0.015, 0.005, 0.034);
    if (p.n === 'abdomen') drawMarker(ctx, 0, -0.04, 0.03);
    // bruises
    if (p.bruise > 0.05) {
      ctx.fillStyle = `rgba(70,40,95,${p.bruise * 0.45})`;
      ctx.beginPath(); ctx.ellipse(0, 0, (d.hw || d.r) * 0.9, (d.hh || d.r) * 0.6, 0, 0, TAU); ctx.fill();
    }
    // char spots
    if (p.char > 0.15) {
      ctx.fillStyle = `rgba(15,12,10,${p.char * 0.6})`;
      const seed = p.n.length * 7;
      for (let i = 0; i < 5; i++) {
        const sx = Math.sin(seed + i * 2.3) * (d.hw || d.r) * 0.8, sy2 = Math.cos(seed + i * 1.7) * (d.hh || d.r) * 0.8;
        ctx.beginPath(); ctx.arc(sx, sy2, 0.025 + 0.02 * p.char, 0, TAU); ctx.fill();
      }
    }
    drawStains(ctx, b);
    for (const w of p.wounds) if (!w.internal) drawWound(ctx, w);
    // fracture line
    if (p.broken && p.n !== 'head') {
      ctx.strokeStyle = 'rgba(40,20,55,0.7)'; ctx.lineWidth = 0.008;
      ctx.beginPath(); ctx.moveTo(-(d.hw || 0.05), 0.01); ctx.lineTo(-0.01, -0.012); ctx.lineTo(0.015, 0.012); ctx.lineTo(d.hw || 0.05, -0.01); ctx.stroke();
    }
    ctx.restore();
    // outline
    let oc = SKIN.outline, lw = 0.014;
    if (G.lifeView) { oc = healthColor(p, this); lw = 0.022; }
    if (G.selected === this && !G.lifeView) { oc = '#f2c230'; lw = 0.018; }
    ctx.strokeStyle = oc; ctx.lineWidth = lw; ctx.stroke(path);
    if (p.n === 'head') this.drawFace(ctx, p);
    if (p.n === 'head' && p.broken) {
      ctx.strokeStyle = 'rgba(30,15,40,0.8)'; ctx.lineWidth = 0.008;
      ctx.beginPath(); ctx.moveTo(-f * 0.02, 0.11); ctx.lineTo(-f * 0.04, 0.06); ctx.lineTo(-f * 0.01, 0.03); ctx.lineTo(-f * 0.05, -0.01); ctx.stroke();
    }
    ctx.restore();
  }

  drawFace(ctx, p) {
    const f = this.f;
    const ex = f * 0.058, ey = 0.025;
    ctx.strokeStyle = '#121316'; ctx.fillStyle = '#121316';
    ctx.lineWidth = 0.012; ctx.lineCap = 'round';
    if (!this.alive) {
      const s = 0.017;
      ctx.beginPath(); ctx.moveTo(ex - s, ey - s); ctx.lineTo(ex + s, ey + s); ctx.moveTo(ex - s, ey + s); ctx.lineTo(ex + s, ey - s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(f * 0.05, -0.055); ctx.lineTo(f * 0.09, -0.05); ctx.stroke();
    } else if (this.cons < 0.35) {
      ctx.beginPath(); ctx.moveTo(ex - 0.018, ey); ctx.lineTo(ex + 0.018, ey); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(f * 0.055, -0.055); ctx.lineTo(f * 0.085, -0.055); ctx.stroke();
    } else if (this.pain > 35 || this.flinch > 0) {
      ctx.beginPath(); ctx.moveTo(ex - f * 0.018, ey + 0.016); ctx.lineTo(ex + f * 0.012, ey); ctx.lineTo(ex - f * 0.018, ey - 0.016); ctx.stroke();
      { const mh = 0.04 * clamp(this.pain / 60, 0.5, 1.2); ctx.fillRect(f * 0.075 - 0.015, -0.058 - mh / 2, 0.03, mh); }
    } else if (this.airT > 0.2) {
      ctx.fillRect(ex - 0.018, ey - 0.018, 0.036, 0.036);
      ctx.fillStyle = '#d8dce0'; ctx.fillRect(ex + f * 0.002 - 0.005, ey + 0.002, 0.01, 0.01);
      ctx.fillStyle = '#121316'; ctx.fillRect(f * 0.075 - 0.013, -0.08, 0.026, 0.04);
    } else {
      ctx.fillRect(ex - 0.013, ey - 0.013, 0.026, 0.026);
      ctx.beginPath(); ctx.moveTo(f * 0.055, -0.055); ctx.lineTo(f * 0.09, -0.05); ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
}

function drawMarker(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(25,26,30,0.55)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(232,234,236,0.55)';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r * 0.9, 0, Math.PI / 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r * 0.9, Math.PI, Math.PI * 1.5); ctx.closePath(); ctx.fill();
}

function drawWound(ctx, w) {
  ctx.save();
  ctx.translate(w.lx, w.ly);
  switch (w.type) {
    case 'entry':
      ctx.fillStyle = 'rgba(120,40,160,0.55)';
      ctx.beginPath(); ctx.arc(0, 0, w.r * 1.6, 0, TAU); ctx.fill();
      ctx.fillStyle = BLOOD_DARK;
      ctx.beginPath(); ctx.arc(0, 0, w.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#16041f';
      ctx.beginPath(); ctx.arc(0, 0, w.r * 0.5, 0, TAU); ctx.fill();
      break;
    case 'exit':
      ctx.fillStyle = 'rgba(130,40,170,0.6)';
      ctx.beginPath(); ctx.arc(0, 0, w.r * 1.5, 0, TAU); ctx.fill();
      ctx.fillStyle = BLOOD_DARK;
      for (let i = 0; i < 5; i++) { const a = i * 1.3 + w.r * 100; ctx.beginPath(); ctx.arc(Math.cos(a) * w.r * 0.5, Math.sin(a) * w.r * 0.5, w.r * 0.6, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#e8d8e8';
      ctx.beginPath(); ctx.arc(w.r * 0.2, -w.r * 0.1, w.r * 0.18, 0, TAU); ctx.fill();
      break;
    case 'cut': case 'stab': {
      ctx.rotate(w.ang);
      const L = w.type === 'stab' ? w.r * 1.2 : w.r * 2.6;
      ctx.lineCap = 'round';
      ctx.strokeStyle = w.burnt ? 'rgba(255,140,60,0.5)' : 'rgba(130,40,170,0.6)';
      ctx.lineWidth = w.r * 0.9;
      ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke();
      ctx.strokeStyle = w.burnt ? '#1c1410' : BLOOD_DARK;
      ctx.lineWidth = w.r * 0.45;
      ctx.beginPath(); ctx.moveTo(-L * 0.9, 0); ctx.lineTo(L * 0.9, 0); ctx.stroke();
      ctx.lineCap = 'butt';
      break;
    }
    case 'stump': {
      const a = Math.atan2(w.ny, w.nx);
      ctx.rotate(a);
      ctx.fillStyle = w.cut ? '#2a1a14' : BLOOD_DARK;
      ctx.beginPath(); ctx.ellipse(0, 0, w.r * 0.5, w.r * 1.15, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = w.cut ? '#ff8a3a' : '#7d1fae';
      ctx.beginPath(); ctx.ellipse(0.004, 0, w.r * 0.28, w.r * 0.95, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ece4dc';
      ctx.beginPath(); ctx.arc(0.006, 0, w.r * 0.32, 0, TAU); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function healthColor(p, d) {
  if (p.detached) return '#55585e';
  if (!d.alive) return '#3d4046';
  if (p.broken) return '#ff7a2f';
  const h = clamp(p.hp / p.maxHp, 0, 1);
  const bleeding = p.wounds.some((w) => w.bleed > 0.4);
  if (bleeding && h > 0.5) return '#e3c84a';
  return h > 0.75 ? '#5fd38a' : h > 0.45 ? '#e3c84a' : h > 0.15 ? '#f08a3c' : '#e5484d';
}

function mixColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(pa >> 16, pb >> 16, t)), g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t)), bl = Math.round(lerp(pa & 255, pb & 255, t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
