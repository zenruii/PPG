'use strict';
/* ============================================================
   Combat: impacts, blades, impalement, bullets, blasts, fire
   ============================================================ */
const Combat = (() => {
  const impales = [];
  const projectiles = [];
  const firePools = [];
  const burning = new Set();
  let soundGate = 0;

  function isFlesh(b) { const u = b.getUserData(); return u && u.part; }

  /* ---------- generic impact damage ---------- */
  function onImpact(b, other, dv, J, contact) {
    const ud = b.getUserData();
    const oud = other.getUserData() || {};
    if (!ud) return;
    if (dv > 2.4 && ud.mat && G.time > soundGate) {
      const m = MAT[ud.mat];
      if (m && m.sound !== 'flesh' && m.sound !== 'none') { Sound.play(m.sound, clamp((dv - 2) / 9, 0.05, 1), 0.05); soundGate = G.time + 0.012; }
    }
    // blunt weapons are scored on first contact (see strike); here only raw deceleration counts
    const eff = dv * (oud.blunt > 1 ? 1 : (oud.blunt || 1));
    if (ud.part) ud.ent.impact(ud.part, eff, dv, J, other);
    if (ud.onImpact) ud.onImpact(b, dv, other, J);
  }

  /* ---------- contact events ---------- */
  function handleContact(ev) {
    const pairs = [[ev.fa, ev.fb, 1], [ev.fb, ev.fa, -1]];
    for (const [fx, ofx, sg] of pairs) {
      const b = fx.getBody(), ob = ofx.getBody();
      if (b._dead || ob._dead) continue;
      const d = fx.getUserData() || {};
      const ud = b.getUserData(), oud = ob.getUserData();
      const rv = v2(ev.rv.x * sg, ev.rv.y * sg);
      if (d.sharp && ev.p && !ofx.isSensor()) sharpHit(fx, ofx, ev.p, rv);
      if (ud.onTouch) ud.onTouch(b, ob, ev.p, ofx, ev.n);
      if (ev.strike && ev.p && ud.blunt > 1 && oud.part && !b.isStatic()) {
        // blunt weapon strike: closing speed scaled by how much mass is behind it
        const n = ev.n;
        const close = Math.abs(rv.x * n.x + rv.y * n.y);
        const mw = b.getMass(), ml = ob.getMass();
        const eff = close * Math.sqrt(mw / (mw + ml)) * ud.blunt * 0.75;
        if (eff > 3) { oud.ent.impact(oud.part, eff, close, 0, b); if (eff > 6) Sound.play('flesh', clamp(eff / 12, 0.2, 1)); }
      }
    }
  }

  function canImpale(ob) {
    const u = ob.getUserData();
    if (!u) return false;
    if (u.part) return !u.part.body._dead;
    return u.mat === 'wood' || u.mat === 'rubber' || u.mat === 'plastic';
  }

  /* would this tip contact drive the blade in? (same test is used in pre-solve so the collision
     doesn't stop the blade before the impale joint exists) */
  function tipWouldImpale(fx, ofx, p, rv) {
    const d = fx.getUserData();
    if (!d || d.sharp !== 'tip' || !d.depth || ofx.isSensor()) return false;
    const b = fx.getBody(), ob = ofx.getBody();
    if (!canImpale(ob)) return false;
    const ud = b.getUserData();
    if (ud.impales && (ud.impales.length >= 3 || ud.impales.some((i) => i.tb === ob))) return false;
    const sp = Math.hypot(rv.x, rv.y);
    if (sp < 1.2) return false;
    const ax = b.getWorldVector(v2(d.ax != null ? d.ax : 1, (d.ay || 0) * (ud.sy || 1)));
    const along = rv.x * ax.x + rv.y * ax.y;
    const held = typeof Input !== 'undefined' && Input.isHeld(b);
    return along > (d.thr || 4) * (held ? 0.45 : 1) && along / sp > 0.55;
  }

  function sharpHit(fx, ofx, p, rv) {
    const b = fx.getBody(), ob = ofx.getBody();
    const d = fx.getUserData(), ud = b.getUserData(), oud = ob.getUserData();
    if (!oud || oud.isGround && d.sharp === 'edge') return;
    const sp = Math.hypot(rv.x, rv.y);
    if (sp < 1.5) return;
    const massF = b.isStatic() ? 1.6 : Math.sqrt(Math.max(0.15, b.getMass()) / 1.5);
    const ent = ud.ent;
    if (d.sharp === 'tip') {
      const ax = b.getWorldVector(v2(d.ax != null ? d.ax : 1, (d.ay || 0) * (ud.sy || 1)));
      const along = rv.x * ax.x + rv.y * ax.y;
      const held = typeof Input !== 'undefined' && Input.isHeld(b);
      if (along > (d.thr || 4) * (held ? 0.45 : 1) && along / sp > 0.55) {
        if (oud.part) {
          const dm = (along - 2) * (d.stab || 4) * massF * 0.6;
          oud.ent.stabHit(oud.part, p, ax, dm);
          addStain(b, p.x, p.y, 0.03, pick(BLOOD));
          if (ent && ent.def && ent.def.inject && !ent.used) { ent.used = true; oud.ent.inject(ent.def.inject); Sound.play('heal', 0.4); }
        } else {
          Sound.play('stab', 0.5); impactFx(oud.mat, p.x, p.y, -ax.x, -ax.y, 0.6);
          if (oud.onShot) oud.onShot(ob, p, along * 2, {});
        }
        if (d.depth && canImpale(ob)) impale(b, ob, p, ax, d);
      }
    } else if (d.sharp === 'edge') {
      const nrm = b.getWorldVector(v2(d.nx || 0, (d.ny || 1) * (ud.sy || 1)));
      let into = rv.x * nrm.x + rv.y * nrm.y;
      if (d.both) into = Math.abs(into);
      if (into > (d.thr || 4.5)) {
        if (oud.part) {
          const dm = (into - 2.6) * (d.cut || 3) * massF;
          const dir = v2(rv.x / sp, rv.y / sp);
          oud.ent.cutHit(oud.part, p, dir, dm, {});
          addStain(b, p.x, p.y, 0.035, pick(BLOOD));
          if (dm > 7) noCollide(b, ob, 0.12);
        } else if (oud.mat === 'wood') {
          Sound.play('wood', 0.6);
          impactFx('wood', p.x, p.y, -nrm.x, -nrm.y, 1);
          if (oud.onShot) oud.onShot(ob, p, into * 3 * massF, {});
        } else if (oud.mat === 'metal' || oud.mat === 'stone') {
          sparks(p.x, p.y, -nrm.x, -nrm.y, 5);
        }
      }
    }
  }

  /* ---------- impalement (prismatic joint along blade axis) ---------- */
  function impale(wb, tb, p, ax, d) {
    const wud = wb.getUserData();
    wud.impales = wud.impales || [];
    if (wud.impales.length >= 3 || wud.impales.some((i) => i.tb === tb)) return;
    if (impales.length > 60) return;
    const j = G.world.createJoint(new PL.PrismaticJoint({
      enableLimit: true, lowerTranslation: -0.045, upperTranslation: d.depth,
      enableMotor: true, maxMotorForce: d.friction || 600, motorSpeed: 0, collideConnected: false,
    }, tb, wb, p, ax));
    const rec = { j, wb, tb, d, t: G.time, part: tb.getUserData().part, depth: 0, exited: false };
    let tfx = null; for (let f = tb.getFixtureList(); f; f = f.getNext()) if (!f.isSensor()) { tfx = f; break; }
    const ex = tfx ? exitPoint(tfx, p, ax, 1.2) : null;
    rec.thick = ex ? Math.max(0.04, ex.len) : 0.25;
    if (rec.part) {
      const lp = tb.getLocalPoint(p);
      rec.w = rec.part.wounds[rec.part.wounds.length - 1];
      if (rec.w) rec.w.plug = true;
    }
    wud.impales.push(rec);
    impales.push(rec);
  }
  function a0(r) { return r.j.getAnchorA(); }
  function ax0(r) { return r.wb.getWorldVector(v2(1, 0)); }
  function unimpale(rec, rip) {
    killJoint(rec.j);
    const wud = rec.wb.getUserData();
    if (wud && wud.impales) wud.impales = wud.impales.filter((r) => r !== rec);
    const i = impales.indexOf(rec); if (i >= 0) impales.splice(i, 1);
    if (rec.w) { rec.w.plug = false; rec.w.bleed += rip ? 1.5 : 0.8; }
    if (rec.w2) { rec.w2.plug = false; rec.w2.bleed += 0.8; }
    if (!rec.wb._dead && !rec.tb._dead) noCollide(rec.wb, rec.tb, 0.35);
    if (rec.part && !rec.tb._dead) {
      const pt = rec.wb.getWorldPoint(v2(0, 0));
      Sound.play('stab', 0.4);
    }
  }
  function releaseAll(wb) {
    const wud = wb.getUserData();
    if (wud && wud.impales) for (const r of wud.impales.slice()) unimpale(r, false);
  }

  /* ---------- bullets ---------- */
  function fireBullet(o) {
    const dir = v2(o.dx, o.dy);
    const range = o.range || 160;
    const p1 = v2(o.x, o.y), p2 = v2(o.x + dir.x * range, o.y + dir.y * range);
    const hits = rayAll(p1, p2, (fx) => fx.getBody() !== o.src && (!o.ignoreEnt || entOf(fx.getBody()) !== o.ignoreEnt));
    let energy = o.pen;
    let end = p2;
    const seen = new Set();
    for (const h of hits) {
      const b = h.body, ud = b.getUserData();
      if (seen.has(b)) continue;
      seen.add(b);
      const fmat = (h.fx.getUserData() && h.fx.getUserData().mat) || ud.mat || 'stone';
      const m = MAT[fmat] || MAT.stone;
      const frac = clamp(energy / o.pen, 0.2, 1);
      const dmg = o.dmg * (0.4 + 0.6 * frac);
      if (b.isDynamic()) b.applyLinearImpulse(v2(dir.x * o.knock * frac, dir.y * o.knock * frac), h.p, true);
      if (ud.part) {
        const ex = exitPoint(h.fx, h.p, dir, 0.9);
        const thick = ex ? ex.len : 0.25;
        const after = energy - m.resist * (thick / 0.25) * (o.apFlesh || 1);
        ud.ent.bulletHit(ud.part, h.p, h.n, dir, dmg, { exitP: after > 0 && ex ? ex.p : null, exitN: ex ? v2(-ex.n.x, -ex.n.y) : null, caliber: o.caliber || 1, dismember: o.dismember, label: o.label });
        if (o.burn) { ud.part.char = Math.min(1, ud.part.char + 0.15); if (Math.random() < o.burn) ud.ent.ignitePart(ud.part, 5); }
        energy = after;
      } else {
        impactFx(fmat, h.p.x, h.p.y, h.n.x, h.n.y, clamp(o.caliber || 1, 0.6, 2));
        if (fmat === 'metal' && Math.random() < 0.3) Sound.play('metal', 0.35, 0.05);
        else Sound.play(m.sound === 'glass' ? 'glass' : 'bullethit', 0.35, 0.04);
        if (ud.onShot) ud.onShot(b, h.p, dmg, o);
        if (!ud.noStain && fmat !== 'glass') addHole(b, h.p, o.caliber || 1);
        energy -= m.resist * (o.apMul || 1) + (ud.armor ? ud.armor * 3 : 0);
        if (ud.isGround) energy = -1;
      }
      if (energy <= 0) { end = h.p; break; }
    }
    if (o.tracer !== false) G.tracers.push({ x1: o.x, y1: o.y, x2: end.x, y2: end.y, life: o.tlife || 0.06, max: o.tlife || 0.06, col: o.tracer || '255,226,160', w: o.tw || 0.018 });
    return end;
  }
  function addHole(b, p, cal) {
    const ud = b.getUserData();
    if (!ud.stains) return;
    const lp = b.getLocalPoint(p);
    ud.stains.push({ x: lp.x, y: ud.isGround ? 2 : lp.y, r: 0.012 * Math.sqrt(cal), c: '#0b0b0d', hole: true, a: 0 });
    if (ud.stains.length > 60) ud.stains.shift();
    G.stainBodies.add(b);
  }

  /* hitscan beam that pierces everything except the ground */
  function fireBeam(o) {
    const dir = v2(o.dx, o.dy);
    const p1 = v2(o.x, o.y), p2 = v2(o.x + dir.x * 200, o.y + dir.y * 200);
    const hits = rayAll(p1, p2, (fx) => fx.getBody() !== o.src);
    let end = p2;
    const seen = new Set();
    for (const h of hits) {
      const b = h.body, ud = b.getUserData();
      if (seen.has(b)) continue; seen.add(b);
      if (b.isDynamic()) b.applyLinearImpulse(v2(dir.x * o.knock, dir.y * o.knock), h.p, true);
      if (ud.part) {
        const ex = exitPoint(h.fx, h.p, dir, 0.9);
        ud.ent.bulletHit(ud.part, h.p, h.n, dir, o.dmg, { exitP: ex ? ex.p : null, exitN: ex ? v2(-ex.n.x, -ex.n.y) : null, caliber: 2.2, dismember: true });
        ud.part.char = Math.min(1, ud.part.char + 0.3);
      } else {
        impactFx(ud.mat, h.p.x, h.p.y, h.n.x, h.n.y, 1.6);
        if (ud.onShot) ud.onShot(b, h.p, o.dmg, o);
        if (ud.onBlast && b.isStatic()) ud.onBlast(b, 0.5);
        addHole(b, h.p, 2.5);
      }
      if (ud.isGround) { end = h.p; break; }
    }
    G.beams.push({ x1: o.x, y1: o.y, x2: end.x, y2: end.y, life: 0.7, max: 0.7, col: o.col || '120,200,255', w: 0.06 });
    // spiral particles
    const L = Math.hypot(end.x - o.x, end.y - o.y);
    for (let s = 0; s < L; s += 0.25) {
      const ph = s * 5;
      const nx = -dir.y, ny = dir.x;
      addP({ type: 'glow', x: o.x + dir.x * s + nx * Math.cos(ph) * 0.07, y: o.y + dir.y * s + ny * Math.cos(ph) * 0.07, vx: nx * Math.sin(ph) * 0.3, vy: ny * Math.sin(ph) * 0.3, life: rand(0.4, 0.9), size: 0.05, col: '150,210,255' });
    }
    return end;
  }

  /* ---------- projectiles (plasma bolts) ---------- */
  function addProjectile(p) { projectiles.push(p); }
  function stepProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      const ox = p.x, oy = p.y;
      p.vy -= (p.grav || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (Math.random() < 0.5) addP({ type: 'glow', x: ox, y: oy, vx: 0, vy: 0, life: 0.2, size: p.size * 0.8, col: p.col });
      const h = p.life > 0 ? rayFirst(v2(ox, oy), v2(p.x, p.y), (fx) => fx.getBody() !== p.src) : null;
      if (h || p.life <= 0) {
        projectiles.splice(i, 1);
        if (!h) continue;
        const ud = h.body.getUserData();
        const d = v2(p.vx, p.vy); const l = Math.hypot(d.x, d.y) || 1; d.x /= l; d.y /= l;
        if (h.body.isDynamic()) h.body.applyLinearImpulse(v2(d.x * p.knock, d.y * p.knock), h.p, true);
        for (let k = 0; k < 10; k++) addP({ type: 'glow', x: h.p.x, y: h.p.y, vx: h.n.x * rand(0, 3) + rand(-1.5, 1.5), vy: h.n.y * rand(0, 3) + rand(-1.5, 1.5), life: rand(0.2, 0.5), size: rand(0.03, 0.07), col: p.col });
        G.lights.push({ x: h.p.x, y: h.p.y, r: 1.2, col: p.col, a: 0.6, life: 0.12, max: 0.12 });
        if (ud.part) {
          ud.ent.hurt(ud.part, p.dmg, 'energy');
          const w = ud.ent.addWound(ud.part, h.p, h.n, 0.022, 0.08, 'entry');
          if (w) w.burnt = true;
          ud.part.char = Math.min(1, ud.part.char + 0.2);
          if (Math.random() < 0.18) ud.ent.ignitePart(ud.part, 4);
          ud.ent.log('Plasma burn · ' + ud.part.label);
          if (ud.part.n === 'head' && p.dmg > 20) ud.ent.brain -= 25;
          Sound.play('energy_hit', 0.5);
        } else {
          Sound.play('zap', 0.35);
          if (ud.onShot) ud.onShot(h.body, h.p, p.dmg, {});
          if (Math.random() < 0.1) ignite(h.body, 4);
          addHole(h.body, h.p, 1.5);
        }
      }
    }
  }

  /* ---------- explosions ---------- */
  function explode(x, y, o = {}) {
    const R = o.r || 4, power = o.power || 80, dmg = o.dmg || 80;
    G.shake = Math.max(G.shake, Math.min(1.4, R * 0.2));
    Sound.play(R > 3.2 ? 'explosion' : 'small_explosion', Math.min(1.4, R / 4), 0.01);
    addP({ type: 'flash', x, y, life: 0.14, size: R * 1.1 });
    addP({ type: 'ring', x, y, life: 0.35, size: R * 1.25 });
    G.lights.push({ x, y, r: R * 3, col: '255,180,90', a: 1, life: 0.35, max: 0.35 });
    for (let i = 0; i < 26 * (R / 4); i++) { const a = rand(0, TAU), s = rand(1, 6) * R / 4; addP({ type: 'fire', x: x + rand(-0.2, 0.2), y: y + rand(-0.2, 0.2), vx: Math.cos(a) * s, vy: Math.sin(a) * s + 1, life: rand(0.3, 0.8), size: rand(0.25, 0.55) * R / 4 }); }
    smoke(x, y + 0.3, Math.round(18 * R / 4), 0.5 * R / 4, 'rgba(70,68,72,', 3.5, 0, 1.2);
    sparks(x, y, 0, 1, 30, '#ffcf70', 14);
    debrisBurst(x, y, 0, 1, 14, '#3a3a3e', 9, 0.05);
    const bodies = queryBodies(x, y, R);
    const hitDummies = new Set();
    for (const b of bodies) {
      if (b._dead) continue;
      const ud = b.getUserData();
      const c = b.getWorldCenter();
      let dx = c.x - x, dy = c.y - y;
      let d = Math.hypot(dx, dy);
      if (d > R) continue;
      const blocker = rayFirst(v2(x, y), c, (fx) => { const ob = fx.getBody(); if (ob === b) return false; const u = ob.getUserData(); return (ob.isStatic() && !u.isGround) || (u.armor != null && u.tankPart && entOf(ob) !== entOf(b)); });
      const occl = !blocker ? 1 : blocker.body.isStatic() ? 0.3 : 0.06;
      const fall = 1 - d / R;
      const k = fall * fall * occl;
      if (b.isStatic()) { if (ud.onBlast) ud.onBlast(b, k * (o.structMul || 1)); continue; }
      if (d < 0.01) { dx = 0; dy = 1; d = 1; }
      const nx = dx / d, ny = dy / d + 0.35;
      const imp = power * 0.3 * k * Math.pow(Math.max(b.getMass(), 0.3), 0.6);
      b.applyLinearImpulse(v2(nx * imp, ny * imp), c, true);
      b.applyAngularImpulse(rand(-1, 1) * imp * 0.02, true);
      if (ud.part) { ud.ent.blastHit(ud.part, dmg * k, k, o); hitDummies.add(ud.ent); }
      if (ud.onBlast) ud.onBlast(b, k);
      if (o.fire && k > 0.25 && Math.random() < 0.5) ignite(b, rand(5, 9));
    }
    for (const dm of hitDummies) if (dm.alive) dm.koTimer = Math.max(dm.koTimer, 1.5);
    // shrapnel
    const n = o.shrapnel || 0;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      fireBullet({ x, y, dx: Math.cos(a), dy: Math.sin(a), dmg: 14, pen: 18, range: R * 2.6, knock: 2, caliber: 0.6, tracer: '255,200,140', tw: 0.01, tlife: 0.04, label: 'Shrapnel wound' });
    }
  }

  /* ---------- fire ---------- */
  function ignite(body, dur = 6) {
    if (!body || body._dead) return;
    const ud = body.getUserData();
    if (!ud) return;
    if (ud.part) { ud.ent.ignitePart(ud.part, dur); return; }
    const m = MAT[ud.mat];
    if ((m && m.flammable) || ud.flammable) {
      ud.burning = Math.max(ud.burning || 0, dur * 1.6);
      burning.add(body);
    }
    if (ud.onIgnite) ud.onIgnite(body);
  }
  function addFirePool(x, y, w, t = 9) { firePools.push({ x, y, w, t, max: t, tick: 0 }); Sound.play('fire', 0.8); }

  function stepFire(dt) {
    for (const b of burning) {
      if (b._dead) { burning.delete(b); continue; }
      const ud = b.getUserData();
      ud.burning -= dt;
      ud.char = Math.min(1, (ud.char || 0) + dt * 0.04);
      if (ud.hp !== undefined && ud.hp !== Infinity) { ud.hp -= dt * 4; if (ud.hp <= 0 && ud.onBreak) { ud.onBreak(b); burning.delete(b); continue; } }
      if (Math.random() < dt * 25) {
        const fx = b.getFixtureList();
        if (fx) {
          const ab = fx.getAABB(0);
          const px = rand(ab.lowerBound.x, ab.upperBound.x), py = rand(ab.lowerBound.y, ab.upperBound.y);
          if (fx.testPoint(v2(px, py))) addP({ type: 'fire', x: px, y: py, vx: rand(-0.3, 0.3), vy: rand(0.5, 1.3), life: rand(0.35, 0.8), size: rand(0.08, 0.18) });
        }
      }
      if (Math.random() < dt * 2) {
        const p = b.getPosition();
        for (const ob of queryBodies(p.x, p.y, 0.6)) if (ob !== b && Math.random() < 0.25) ignite(ob, 6);
      }
      if (ud.burning <= 0) burning.delete(b);
    }
    for (let i = firePools.length - 1; i >= 0; i--) {
      const fp = firePools[i];
      fp.t -= dt;
      if (fp.t <= 0) { firePools.splice(i, 1); continue; }
      const k = fp.t / fp.max;
      if (Math.random() < dt * 60 * k) addP({ type: 'fire', x: fp.x + rand(-fp.w, fp.w), y: fp.y + 0.05, vx: rand(-0.2, 0.2), vy: rand(0.6, 1.8), life: rand(0.4, 0.9), size: rand(0.12, 0.3) * (0.5 + k) });
      G.lights.push({ x: fp.x, y: fp.y + 0.4, r: 2.4 * fp.w, col: '255,140,60', a: 0.25 * k, life: dt, max: dt });
      fp.tick -= dt;
      if (fp.tick <= 0) {
        fp.tick = 0.25;
        const aabb = new PL.AABB(v2(fp.x - fp.w, fp.y - 0.1), v2(fp.x + fp.w, fp.y + 0.6));
        G.world.queryAABB(aabb, (fx) => { if (Math.random() < 0.5) ignite(fx.getBody(), 5); return true; });
      }
    }
  }

  /* ---------- per-step ---------- */
  function update(dt) {
    for (let i = impales.length - 1; i >= 0; i--) {
      const r = impales[i];
      if (r.j._dead || r.wb._dead || r.tb._dead) { impales.splice(i, 1); const wud = r.wb.getUserData(); if (wud && wud.impales) wud.impales = wud.impales.filter((q) => q !== r); continue; }
      const t = r.j.getJointTranslation();
      if (t < -0.035 && G.time - r.t > 0.05) { unimpale(r, false); continue; }
      if (t > r.depth + 0.015) {
        // the blade is being driven deeper: tissue damage scales with distance travelled
        const dd = t - r.depth;
        r.depth = t;
        if (r.part) {
          const dm = r.part.dummy || r.tb.getUserData().ent;
          dm.hurt(r.part, dd * 90, 'stab');
          if (r.w) r.w.bleed = Math.min(r.w.bleed + dd * 6, 6);
          if (!r.exited && t > r.thick + 0.02) {
            r.exited = true;
            const ax = r.wb.getWorldVector(v2(r.d.ax != null ? r.d.ax : 1, (r.d.ay || 0) * (r.wb.getUserData().sy || 1)));
            const a = r.j.getAnchorA();
            const out = v2(a.x + ax.x * r.thick, a.y + ax.y * r.thick);
            const w = dm.addWound(r.part, out, ax, 0.024, 1.4, 'exit');
            if (w) w.plug = true;
            r.w2 = w;
            bloodSpray(out.x, out.y, ax.x, ax.y, 16, 3.2, 0.5, 1.2);
            dm.log('Run through · ' + r.part.label);
            if (r.part.n === 'head') dm.brain = -50;
            if (r.part.n === 'chest' && Math.random() < 0.35) dm.hurt(r.part, 60, 'stab');
            Sound.play('stab', 0.9);
          } else if (Math.random() < dd * 20) bloodSpray(a0(r).x, a0(r).y, -ax0(r).x, -ax0(r).y, 3, 1.5, 0.6);
        }
      }
      const F = r.j.getReactionForce(1 / DT);
      const lat = Math.hypot(F.x, F.y);
      if (lat > (r.d.breakF || 9000)) unimpale(r, true);
    }
    stepProjectiles(dt);
    stepFire(dt);
    for (let i = G.lights.length - 1; i >= 0; i--) { const l = G.lights[i]; l.life -= dt; if (l.life <= 0) G.lights.splice(i, 1); }
  }

  function reset() { impales.length = 0; projectiles.length = 0; firePools.length = 0; burning.clear(); G.lights.length = 0; }

  return { addHole, tipWouldImpale, update, onImpact, handleContact, fireBullet, fireBeam, explode, ignite, addFirePool, addProjectile, impale, releaseAll, reset,
    get projectiles() { return projectiles; }, get firePools() { return firePools; }, get impales() { return impales; }, burning };
})();
