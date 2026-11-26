import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Reglas editoriales que el esquema Zod no puede ver porque viven en el cuerpo MDX:
 * - los <Step id> del cuerpo coinciden, en orden, con `steps` del frontmatter (H8);
 * - cada paso tiene entre 30 y 80 palabras (§8.3).
 */
const dir = join(process.cwd(), 'src/content/chapters');
const files = readdirSync(dir).filter((f) => f.endsWith('.mdx'));

function parse(source: string) {
  const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const stepsBlock = fm.split(/^steps:\s*$/m)[1]?.split(/^\S/m)[0] ?? '';
  const frontmatterIds = [...stepsBlock.matchAll(/^\s+-\s+id:\s*['"]?([\w-]+)/gm)].map((m) => m[1]);
  const body = source.slice(source.indexOf('---', 3) + 3);
  const bodySteps = [...body.matchAll(/<Step\s+id="([\w-]+)"[^>]*>([\s\S]*?)<\/Step>/g)].map(
    (m) => ({ id: m[1], text: m[2] ?? '' }),
  );
  const sourcesBlock = fm.split(/^sources:\s*$/m)[1]?.split(/^\S/m)[0] ?? '';
  const frontmatterSources = [...sourcesBlock.matchAll(/^\s+-\s+([\w-]+)/gm)].map((m) => m[1]);
  const citedSources = [...body.matchAll(/<SourceNote\s+id="([\w-]+)"/g)].map((m) => m[1]);
  return { frontmatterIds, bodySteps, frontmatterSources, citedSources };
}

function wordCount(mdx: string): number {
  const text = mdx
    .replace(/<SourceNote[^>]*\/>/g, '')
    .replace(/<Counter[^>]*\bto=\{([\d.]+)\}[^>]*\/>/g, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
  return text.split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;
}

describe.each(files)('capítulo %s', (file) => {
  const { frontmatterIds, bodySteps, frontmatterSources, citedSources } = parse(
    readFileSync(join(dir, file), 'utf8'),
  );

  it('cada fuente citada en el texto está en `sources` del frontmatter', () => {
    const missing = [...new Set(citedSources)].filter((s) => !frontmatterSources.includes(s));
    expect(missing).toEqual([]);
  });

  it('declara pasos en el frontmatter', () => {
    expect(frontmatterIds.length).toBeGreaterThan(0);
  });

  it('los <Step> del cuerpo coinciden con el frontmatter', () => {
    expect(bodySteps.map((s) => s.id)).toEqual(frontmatterIds);
  });

  it.each(bodySteps.map((s) => [s.id, s.text] as const))(
    'el paso %s tiene entre 30 y 80 palabras',
    (_id, text) => {
      const n = wordCount(text);
      expect(n).toBeGreaterThanOrEqual(30);
      expect(n).toBeLessThanOrEqual(80);
    },
  );
});
