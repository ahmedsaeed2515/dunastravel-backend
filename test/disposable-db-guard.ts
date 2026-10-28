/**
 * Disposable Database Safety Guard
 *
 * Fails closed. Strictly refuses Neon, shared, staging, or production database connections.
 * Requires host to be localhost/127.0.0.1, database name to match disposable pattern (*_test, *_disposable, dunastravel_test),
 * DISPOSABLE_DB_CONFIRMED=true, and ALLOW_DISPOSABLE_DB_MUTATION=true.
 */

export interface VerifiedDbTarget {
  host: string;
  port: string;
  database: string;
  connectionString: string;
}

export function verifyAndAssertDisposableDb(): VerifiedDbTarget {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error(
      '[DISPOSABLE DB GUARD] FAILED CLOSED: Neither TEST_DATABASE_URL nor DATABASE_URL is set.',
    );
  }

  // Refuse Neon or cloud providers explicitly before parsing
  if (
    dbUrl.includes('neon.tech') ||
    dbUrl.includes('rds.amazonaws.com') ||
    dbUrl.includes('supabase.co')
  ) {
    throw new Error(
      `[DISPOSABLE DB GUARD] REFUSED: Target connection string points to shared/cloud DB host.`,
    );
  }

  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname;
    const port = parsed.port || '5432';
    const database = parsed.pathname.replace(/^\//, '');

    // 1. Verify Host is local
    const isLocalHost =
      host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!isLocalHost) {
      throw new Error(
        `[DISPOSABLE DB GUARD] REFUSED: Target host "${host}" is not a verified local instance (localhost / 127.0.0.1).`,
      );
    }

    // 2. Verify Database Name has explicit disposable marker
    const isDisposableName =
      database === 'dunastravel_test' ||
      database.endsWith('_test') ||
      database.endsWith('_disposable');
    if (!isDisposableName) {
      throw new Error(
        `[DISPOSABLE DB GUARD] REFUSED: Database name "${database}" lacks an explicit disposable marker (_test or _disposable).`,
      );
    }

    // 3. Verify Explicit Disposable Flag
    const isConfirmed = process.env.DISPOSABLE_DB_CONFIRMED === 'true';
    if (!isConfirmed) {
      throw new Error(
        `[DISPOSABLE DB GUARD] REFUSED: DISPOSABLE_DB_CONFIRMED environment variable must be explicitly set to 'true'.`,
      );
    }

    // 4. Verify Explicit Mutation Permission
    const isMutationAllowed =
      process.env.ALLOW_DISPOSABLE_DB_MUTATION === 'true';
    if (!isMutationAllowed) {
      throw new Error(
        `[DISPOSABLE DB GUARD] REFUSED: ALLOW_DISPOSABLE_DB_MUTATION environment variable must be explicitly set to 'true' to permit mutating e2e tests.`,
      );
    }

    const redacted = dbUrl.replace(/\/\/[^:]+:[^@]+@/, '//*****:*****@');
    console.log(
      `[DISPOSABLE DB GUARD] VERIFIED SAFE TEST TARGET: host=${host}, port=${port}, database=${database}`,
    );
    console.log(`[DISPOSABLE DB GUARD] Redacted URL: ${redacted}`);

    return {
      host,
      port,
      database,
      connectionString: dbUrl,
    };
  } catch (err: any) {
    if (err.message?.startsWith('[DISPOSABLE DB GUARD]')) {
      throw err;
    }
    throw new Error(
      `[DISPOSABLE DB GUARD] FAILED CLOSED: Invalid connection string syntax. ${err.message}`,
    );
  }
}
