import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * Use only for endpoints authenticated by a non-cookie mechanism, such as a
 * provider-signed webhook. This does not make the endpoint public.
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
