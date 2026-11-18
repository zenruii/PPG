'use strict';
/* ============================================================
   Rendering: camera, world, particles, lights, overlays
   ============================================================ */
const Cam = { x: 0, y: 3, z: 70, tx: 0, ty: 3, tz: 70 };
const R = { cv: null, ctx: null, W: 0, H: 0, dpr: 1, frameLights: [], sprites: {} };

function roundRectPath(ctx, x, y, w, h, r) {
  let tl, tr, br, bl;
  if (Array.isArray(r)) [tl, tr, br, bl] = r; else tl = tr = br = bl = r;
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br); ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl); ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}
function polyPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}
function fillPoly(ctx, pts, fill, stroke, lw = 0.01) {
  polyPath(ctx, pts);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function fillRR(ctx, x, y, w, h, r, fill, stroke, lw = 0.01) {
  ctx.beginPath(); roundRectPath(ctx, x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function fillCircle(ctx, x, y, r, fill, stroke, lw = 0.01) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function line(ctx, x1, y1, x2, y2, col, w) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

function fixturePath(ctx, b) {
  ctx.beginPath();
  for (let fx = b.getFixtureList(); fx; fx = fx.getNext()) {
    if (fx.isSensor()) continue;
    const s = fx.getShape();
    if (s.getType() === 'circle') { ctx.moveTo(s.m_p.x + s.m_radius, s.m_p.y); ctx.arc(s.m_p.x, s.m_p.y, s.m_radius, 0, TAU); }
    else if (s.getType() === 'polygon') {
      const v = s.m_vertices;
      ctx.moveTo(v[0].x, v[0].y);
      for (let i = 1; i < s.m_count; i++) ctx.lineTo(v[i].x, v[i].y);
      ctx.closePath();
    }
  }
}

/* cached Path2D of a body's (static) fixture shapes in body-local coords */
function bodyPath(b) {
  const ud = b.getUserData();
  if (ud._path) return ud._path;
  const path = new Path2D();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let fx = b.getFixtureList(); fx; fx = fx.getNext()) {
    if (fx.isSensor()) continue;
    const s = fx.getShape();
    if (s.getType() === 'circle') {
      const c = s.m_p, r = s.m_radius;
      path.moveTo(c.x + r, c.y); path.arc(c.x, c.y, r, 0, TAU);
      x0 = Math.min(x0, c.x - r); x1 = Math.max(x1, c.x + r); y0 = Math.min(y0, c.y - r); y1 = Math.max(y1, c.y + r);
    } else if (s.getType() === 'polygon') {
      const v = s.m_vertices;
      path.moveTo(v[0].x, v[0].y);
      for (let i = 1; i < s.m_count; i++) path.lineTo(v[i].x, v[i].y);
      path.closePath();
      for (let i = 0; i < s.m_count; i++) { x0 = Math.min(x0, v[i].x); x1 = Math.max(x1, v[i].x); y0 = Math.min(y0, v[i].y); y1 = Math.max(y1, v[i].y); }
    }
  }
  ud._path = path;
  ud._bounds = [x0, y0, x1, y1];
  return path;
}

function drawStains(ctx, b) {
  const st = b.getUserData().stains;
  if (!st || !st.length) return;
  for (const s of st) {
    if (s.hole) { ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); continue; }
    ctx.fillStyle = s.c;
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.8, s.a, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* generic body render: fixture shapes with fill/stroke from userdata */
function drawBodyGeneric(ctx, b) {
  const ud = b.getUserData();
  const p = b.getPosition();
  ctx.save();
  ctx.translate(p.x, p.y); ctx.rotate(b.getAngle());
  const path = bodyPath(b);
  ctx.fillStyle = ud.fill || '#555';
  ctx.fill(path);
  if (ud.char) { ctx.fillStyle = `rgba(12,10,8,${ud.char * 0.7})`; ctx.fill(path); }
  ctx.strokeStyle = ud.stroke || 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.014;
  ctx.stroke(path);
  if (ud.stains.length) { ctx.save(); ctx.clip(path); drawStains(ctx, b); ctx.restore(); }
  ctx.restore();
}

/* transform helper for an entity body */
function withBody(ctx, b, sy, fn) {
  const p = b.getPosition();
  ctx.save();
  ctx.translate(p.x, p.y); ctx.rotate(b.getAngle());
  if (sy === -1) ctx.scale(1, -1);
  fn();
  ctx.restore();
}

/* pre-rendered glow sprite */
function glowSprite(rgb) {
  if (R.sprites[rgb]) return R.sprites[rgb];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.35, `rgba(${rgb},0.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  R.sprites[rgb] = c;
  return c;
}
function glow(ctx, x, y, r, rgb, a = 1) {
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}
function addLight(x, y, r, rgb, a) { R.frameLights.push({ x, y, r, col: rgb, a }); }

function initRender(cv) {
  R.cv = cv; R.ctx = cv.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}
function resize() {
  R.dpr = Math.min(window.devicePixelRatio || 1, 2);
  R.W = R.cv.clientWidth; R.H = R.cv.clientHeight;
  R.cv.width = Math.round(R.W * R.dpr); R.cv.height = Math.round(R.H * R.dpr);
}
function screenToWorld(sx, sy) { return { x: (sx - R.W / 2) / Cam.z + Cam.x, y: (R.H / 2 - sy) / Cam.z + Cam.y }; }
function worldToScreen(x, y) { return { x: (x - Cam.x) * Cam.z + R.W / 2, y: R.H / 2 - (y - Cam.y) * Cam.z }; }

function render(frameDt) {
  const ctx = R.ctx, W = R.W, H = R.H, dpr = R.dpr;
  // camera smoothing
  Cam.x += (Cam.tx - Cam.x) * Math.min(1, frameDt * 14);
  Cam.y += (Cam.ty - Cam.y) * Math.min(1, frameDt * 14);
  Cam.z += (Cam.tz - Cam.z) * Math.min(1, frameDt * 14);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#030405';
  ctx.fillRect(0, 0, W, H);
  // horizon haze
  const hz = worldToScreen(0, 0).y;
  const hg = ctx.createLinearGradient(0, hz - H * 0.6, 0, hz);
  hg.addColorStop(0, 'rgba(30,34,44,0)'); hg.addColorStop(1, 'rgba(30,34,44,0.28)');
  ctx.fillStyle = hg; ctx.fillRect(0, Math.max(0, hz - H * 0.6), W, Math.min(H, H * 0.6));

  let sx = 0, sy = 0;
  if (G.shake > 0.01) { sx = rand(-1, 1) * G.shake * 9; sy = rand(-1, 1) * G.shake * 9; G.shake *= Math.pow(0.02, frameDt); }
  const z = Cam.z;
  ctx.setTransform(z * dpr, 0, 0, -z * dpr, (W / 2 - Cam.x * z + sx) * dpr, (H / 2 + Cam.y * z + sy) * dpr);
  R.frameLights.length = 0;

  const view = { x0: Cam.x - W / 2 / z - 2, x1: Cam.x + W / 2 / z + 2, y0: Cam.y - H / 2 / z - 2, y1: Cam.y + H / 2 / z + 2 };
  drawGround(ctx, view);

  const ents = G.entities.slice().sort((a, b) => a.z - b.z);
  for (const e of ents) if (!e.dead) e.draw(ctx);

  drawConstraints(ctx);
  drawParticles(ctx);
  drawProjectiles(ctx);
  drawTracers(ctx);
  Input.drawOverlay(ctx);

  // additive lights
  ctx.globalCompositeOperation = 'lighter';
  for (const l of G.lights) glow(ctx, l.x, l.y, l.r, l.col, l.a * (l.life / l.max));
  for (const l of R.frameLights) glow(ctx, l.x, l.y, l.r, l.col, l.a);
  drawGlowParticles(ctx);
  ctx.globalCompositeOperation = 'source-over';

  // screen-space overlays
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawRuler(ctx, view);
  Input.drawScreenOverlay(ctx);
}

function drawGround(ctx, v) {
  const x0 = Math.max(v.x0, -600), x1 = Math.min(v.x1, 600);
  ctx.fillStyle = '#0d0e11';
  ctx.fillRect(x0, -30, x1 - x0, 30);
  const g = ctx.createLinearGradient(0, 0, 0, -1.2);
  g.addColorStop(0, '#1c1e23'); g.addColorStop(1, 'rgba(13,14,17,0)');
  ctx.fillStyle = g; ctx.fillRect(x0, -1.2, x1 - x0, 1.2);
  line(ctx, x0, 0, x1, 0, '#3a3d45', 2 / Cam.z);
  // tick marks
  ctx.strokeStyle = 'rgba(120,126,140,0.25)'; ctx.lineWidth = 1 / Cam.z;
  ctx.beginPath();
  for (let x = Math.ceil(x0); x <= x1; x++) {
    const h = x % 5 === 0 ? 0.16 : 0.06;
    ctx.moveTo(x, 0); ctx.lineTo(x, -h);
  }
  ctx.stroke();
  // blood puddles
  const st = G.ground.getUserData().stains;
  for (const s of st) {
    if (s.x < x0 - 1 || s.x > x1 + 1) continue;
    if (s.hole) { ctx.fillStyle = '#060607'; ctx.fillRect(s.x - s.r, -s.r * 2, s.r * 2, s.r * 2); continue; }
    ctx.fillStyle = s.c;
    ctx.beginPath(); ctx.ellipse(s.x, 0.004, s.r * 1.7, Math.min(s.r * 0.25, 0.03), 0, 0, TAU); ctx.fill();
  }
}

function drawRuler(ctx, v) {
  if (Cam.z < 25) return;
  ctx.fillStyle = 'rgba(120,126,140,0.45)';
  ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  for (let x = Math.ceil(v.x0 / 5) * 5; x <= v.x1; x += 5) {
    const p = worldToScreen(x, -0.2);
    if (p.y > R.H - 4) continue;
    ctx.fillText(x + ' m', p.x, p.y + 12);
  }
}

function drawConstraints(ctx) {
  // ropes & pins
  for (const r of G.ropes) {
    if (r.j._dead) continue;
    const a = r.j.getAnchorA(), b = r.j.getAnchorB();
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const slack = Math.max(0, r.len - d);
    ctx.strokeStyle = '#b89a6a'; ctx.lineWidth = 0.022;
    ctx.beginPath(); ctx.moveTo(a.x, a.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - slack * 0.6;
    ctx.quadraticCurveTo(mx, my, b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.008; ctx.setLineDash([0.03, 0.03]); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const p of G.pins) {
    if (p.j._dead) continue;
    const a = p.j.getAnchorB();
    fillCircle(ctx, a.x, a.y, 0.05, '#d64545', '#1a0a0a', 0.012);
    fillCircle(ctx, a.x - 0.012, a.y + 0.012, 0.015, 'rgba(255,255,255,0.6)');
  }
}

function drawParticles(ctx) {
  for (const p of G.particles) {
    const t = p.life / p.max;
    switch (p.type) {
      case 'blood': {
        ctx.fillStyle = p.color;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 2.5) {
          ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 1.4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.012, p.y - p.vy * 0.012); ctx.stroke(); ctx.lineCap = 'butt';
        } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); }
        break;
      }
      case 'debris':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, t * 3);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.restore(); ctx.globalAlpha = 1;
        break;
      case 'shell':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, t * 4);
        ctx.fillStyle = p.color || '#c9a14a'; ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
        ctx.restore(); ctx.globalAlpha = 1;
        break;
      case 'smoke':
        ctx.fillStyle = p.col + (0.32 * t) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
        break;
      case 'ring':
        ctx.strokeStyle = `rgba(255,230,190,${t * 0.6})`; ctx.lineWidth = 0.08 * t + 0.01;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - t * t), 0, TAU); ctx.stroke();
        break;
    }
  }
}
function drawGlowParticles(ctx) {
  for (const p of G.particles) {
    const t = p.life / p.max;
    switch (p.type) {
      case 'spark':
        ctx.strokeStyle = p.color; ctx.globalAlpha = t; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke(); ctx.globalAlpha = 1;
        break;
      case 'fire': case 'flame': {
        const col = t > 0.6 ? '255,220,120' : t > 0.3 ? '255,140,50' : '200,60,30';
        glow(ctx, p.x, p.y, p.size * 1.6, col, t * 0.9);
        break;
      }
      case 'glow': case 'orbit':
        glow(ctx, p.x, p.y, p.size * 1.5, p.col || '200,120,255', t);
        break;
      case 'flash':
        glow(ctx, p.x, p.y, p.size * (1.4 - t * 0.4), '255,235,190', t);
        break;
    }
  }
}
function drawProjectiles(ctx) {
  ctx.globalCompositeOperation = 'lighter';
  for (const p of Combat.projectiles) {
    const l = Math.hypot(p.vx, p.vy) || 1;
    ctx.strokeStyle = `rgba(${p.col},0.9)`; ctx.lineWidth = p.size * 0.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx / l * 0.3, p.y - p.vy / l * 0.3); ctx.stroke();
    ctx.lineCap = 'butt';
    glow(ctx, p.x, p.y, p.size * 3, p.col, 0.9);
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawTracers(ctx) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const t of G.tracers) {
    const k = t.life / t.max;
    ctx.strokeStyle = `rgba(${t.col},${0.85 * k})`; ctx.lineWidth = t.w;
    ctx.beginPath(); ctx.moveTo(lerp(t.x2, t.x1, k), lerp(t.y2, t.y1, k)); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  for (const b of G.beams) {
    const k = b.life / b.max;
    ctx.strokeStyle = `rgba(${b.col},${0.5 * k})`; ctx.lineWidth = b.w * 3 * k;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * k})`; ctx.lineWidth = b.w * 0.6 * k;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.globalCompositeOperation = 'source-over';
}
