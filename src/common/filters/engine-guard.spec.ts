import fs from 'node:fs';
import path from 'node:path';

describe('Tooling & Node Engine Guard Verification', () => {
  const root = path.resolve(__dirname, '../../../../');

  it('enforces Node.js 22 LTS in all .nvmrc and .node-version manifests', () => {
    const locations = [
      path.join(root, '.nvmrc'),
      path.join(root, '.node-version'),
      path.join(root, 'frontend', '.nvmrc'),
      path.join(root, 'frontend', '.node-version'),
      path.join(root, 'dunastravel-dashbord', '.nvmrc'),
      path.join(root, 'dunastravel-dashbord', '.node-version'),
      path.join(root, 'dunastravel-backend', '.nvmrc'),
      path.join(root, 'dunastravel-backend', '.node-version'),
    ];

    for (const loc of locations) {
      expect(fs.existsSync(loc)).toBe(true);
      const val = fs.readFileSync(loc, 'utf8').trim();
      expect(val).toBe('22');
    }
  });

  it('defines explicit engine constraints in all subproject package.json manifests', () => {
    const packages = [
      path.join(root, 'dunastravel-backend', 'package.json'),
      path.join(root, 'frontend', 'package.json'),
      path.join(root, 'dunastravel-dashbord', 'package.json'),
    ];

    for (const pkgPath of packages) {
      expect(fs.existsSync(pkgPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(pkg.engines).toBeDefined();
      expect(pkg.engines.node).toMatch(/22/);
    }
  });

  it('includes check-node-version guard script', () => {
    const scriptPath = path.join(root, 'scripts', 'check-node-version.cjs');
    expect(fs.existsSync(scriptPath)).toBe(true);
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('SUPPORTED_MAJORS');
  });
});
