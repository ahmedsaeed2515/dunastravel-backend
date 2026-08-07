import { envValidationSchema } from '../src/config/env.validation';

export function runEnvPreflight(): { success: boolean; missingOrInvalid: string[] } {
  console.log('[ENV PREFLIGHT] Checking environment variable validation schema...');

  const result = envValidationSchema.validate(process.env, {
    allowUnknown: true,
    abortEarly: false,
  });

  const missingOrInvalid: string[] = [];

  if (result.error) {
    for (const detail of result.error.details) {
      const key = detail.context?.key || detail.path.join('.');
      missingOrInvalid.push(`${key}: ${detail.message}`);
    }
  }

  const requiredProductionKeys = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'GUEST_TOKEN_SECRET',
    'REDIS_URL',
  ];

  console.log('[ENV PREFLIGHT] Verifying presence of key required environment variables:');
  for (const key of requiredProductionKeys) {
    const isConfigured = Boolean(process.env[key] || (result.value && result.value[key]));
    if (isConfigured) {
      console.log(`  ✓ ${key} is configured`);
    } else {
      console.error(`  ✗ ${key} IS MISSING OR INVALID`);
      if (!missingOrInvalid.some((m) => m.startsWith(key))) {
        missingOrInvalid.push(`${key}: Required environment variable is missing`);
      }
    }
  }

  if (missingOrInvalid.length > 0) {
    console.error(`\n[ENV PREFLIGHT] Validation FAILED with ${missingOrInvalid.length} error(s):`);
    for (const err of missingOrInvalid) {
      console.error(`  - ${err}`);
    }
    return { success: false, missingOrInvalid };
  }

  console.log('[ENV PREFLIGHT] Validation SUCCESS — all required environment variable contracts satisfied.\n');
  return { success: true, missingOrInvalid: [] };
}

if (require.main === module) {
  const { success } = runEnvPreflight();
  if (!success) {
    process.exit(1);
  }
}
