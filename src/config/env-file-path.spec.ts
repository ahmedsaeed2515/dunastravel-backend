import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Guards the explicit ConfigModule envFilePath. Under IISNode/Plesk the
 * process working directory is not guaranteed to be the backend root, so the
 * path must be derived from `__dirname` (src in dev, dist when compiled).
 */
describe('explicit .env loading path', () => {
  const backendRoot = resolve(__dirname, '..', '..');
  const appModuleSource = join(backendRoot, 'src', 'app.module.ts');

  it('declares envFilePath as join(__dirname, "..", ".env")', () => {
    const source = readFileSync(appModuleSource, 'utf8');

    expect(source).toMatch(
      /envFilePath:\s*join\(__dirname,\s*'\.\.',\s*'\.env'\)/,
    );
  });

  it('resolves to the backend root from both src and dist layouts', () => {
    const rootEnv = join(backendRoot, '.env');

    expect(join(backendRoot, 'src', '..', '.env')).toBe(rootEnv);
    expect(join(backendRoot, 'dist', '..', '.env')).toBe(rootEnv);
    expect(rootEnv).not.toContain(`${join(backendRoot, 'src')}`);
    expect(rootEnv).not.toContain(`${join(backendRoot, 'dist')}`);
  });

  it('keeps package.json and .env at the same project root', () => {
    expect(existsSync(join(backendRoot, 'package.json'))).toBe(true);
    expect(existsSync(appModuleSource)).toBe(true);
  });
});
