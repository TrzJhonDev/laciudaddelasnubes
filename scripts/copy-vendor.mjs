// Copia el worker de MapLibre a public/vendor/ sin pasar por Vite.
// En desarrollo, Vite inyecta su cliente HMR en los módulos que sirve y eso bloquea el worker;
// servido desde public/ llega intacto. Se ejecuta antes de `dev` y de `build`.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkgPath = require.resolve('maplibre-gl/package.json');
const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
const src = join(dirname(pkgPath), 'dist', 'maplibre-gl-worker.mjs');
const outDir = join(process.cwd(), 'public', 'vendor');
const out = join(outDir, 'maplibre-gl-worker.mjs');

mkdirSync(outDir, { recursive: true });
copyFileSync(src, out);
// Quita la referencia al sourcemap (no se publica).
writeFileSync(out, readFileSync(out, 'utf8').replace(/\n?\/\/# sourceMappingURL=.*$/m, ''));
writeFileSync(join(outDir, 'maplibre-gl-worker.version'), `${version}\n`);
console.log(`[vendor] maplibre-gl-worker.mjs ${version} → public/vendor/`);
