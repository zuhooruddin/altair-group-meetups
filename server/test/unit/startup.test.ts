/**
 * Regression test: start the real entry point under Node + tsx (not Vite).
 * Vitest transforms modules uniformly, which once hid an ESM/CJS mismatch
 * that made `npm run server` crash on import. Reaching the config check
 * proves every module, including @altair/shared, loaded under real Node.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('server entry point', () => {
  it('loads under Node and fails fast on invalid config, naming variables but not values', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
      cwd: serverDir,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        SUPABASE_URL: 'not-a-url',
        SUPABASE_ANON_KEY: 'secret-looking-value',
        DATABASE_URL: 'mysql://nope',
      },
    });
    const output = `${result.stdout}${result.stderr}`;
    expect(output).not.toMatch(/SyntaxError|does not provide an export/);
    expect(output).toContain('Invalid server configuration');
    expect(output).toContain('DATABASE_URL');
    expect(output).not.toContain('secret-looking-value');
    expect(result.status).toBe(1);
  }, 40_000);
});
