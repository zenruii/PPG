// Bundles Voidbox into single-file pages.
//   dist/voidbox.html   – fully self-contained (planck inlined), works offline from file://
//   dist/artifact.html  – page body for hosting as a claude.ai Artifact (planck from jsDelivr)
// Usage: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const between = (a, b) => {
  const i = html.indexOf(a), j = html.indexOf(b);
  if (i < 0 || j < 0) throw new Error('marker missing: ' + a);
  return html.slice(i + a.length, j).trim();
};
const head = between('<!-- APP:HEAD -->', '<!-- /APP:HEAD -->');
const body = between('<!-- APP:BODY -->', '<!-- /APP:BODY -->');
const scripts = between('<!-- APP:SCRIPTS -->', '<!-- /APP:SCRIPTS -->');
const srcs = [...scripts.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const game = srcs.filter((s) => !s.includes('vendor/')).map((s) => `/* ---- ${s} ---- */\n` + readFileSync(join(root, s), 'utf8')).join('\n');
const planck = readFileSync(join(root, 'js/vendor/planck.min.js'), 'utf8');
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

mkdirSync(join(root, 'dist'), { recursive: true });
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${body}
<script>${safe(planck)}</script>
<script>${safe(game)}</script>
</body>
</html>
`;
writeFileSync(join(root, 'dist/voidbox.html'), standalone);

const artifact = `${head}
${body}
<script src="https://cdn.jsdelivr.net/npm/planck@1.4.3/dist/planck.min.js"></script>
<script>${safe(game)}</script>
`;
writeFileSync(join(root, 'dist/artifact.html'), artifact);
console.log('built dist/voidbox.html (' + (standalone.length / 1024).toFixed(0) + ' KB) and dist/artifact.html (' + (artifact.length / 1024).toFixed(0) + ' KB)');
