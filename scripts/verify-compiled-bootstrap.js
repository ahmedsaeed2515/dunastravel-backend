const fs = require('fs');
const path = require('path');

async function testCompiledBootstrap() {
  console.log('[VERIFY BOOTSTRAP] Testing compiled production bootstrap...');

  const cwd = process.cwd();
  let distVercelPath = path.join(cwd, 'dist', 'src', 'vercel.js');
  if (!fs.existsSync(distVercelPath)) {
    distVercelPath = path.join(cwd, 'dist', 'vercel.js');
  }

  if (!fs.existsSync(distVercelPath)) {
    console.error(`  ✗ Could not locate compiled vercel.js output at ${distVercelPath}`);
    process.exit(1);
  }

  try {
    const vercelModule = require(distVercelPath);
    const handler = vercelModule.default || vercelModule;

    if (typeof handler !== 'function') {
      throw new Error(`Expected handler to be a function, received ${typeof handler}`);
    }

    console.log(`  ✓ Successfully loaded compiled vercel.js module without ERR_REQUIRE_ESM`);
    console.log('[VERIFY BOOTSTRAP] Compiled bootstrap verification PASSED.\n');
    process.exit(0);
  } catch (err) {
    console.error('  ✗ Compiled bootstrap verification FAILED with error:');
    console.error(err);
    process.exit(1);
  }
}

testCompiledBootstrap();
