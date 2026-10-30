/**
 * Resolution of the endpoint the HTTP server must listen on.
 *
 * On Linux/Vercel the port is a numeric TCP port. On Windows behind IISNode
 * (`Plesk for Windows`), IISNode hands the application a named-pipe path such as
 * `\\.\pipe\iisnode-<id>` through `process.env.PORT`. The pipe path must be
 * passed to `app.listen()` unchanged — running it through `parseInt` produces
 * `NaN` and the process dies during startup.
 */

/** IISNode named-pipe forms: `\\.\pipe\<name>` and `\\?\pipe\<name>`. */
export const WINDOWS_NAMED_PIPE_PATTERN = /^\\\\[.?]\\pipe\\/;

export const DEFAULT_LISTEN_PORT = 5000;

export function isWindowsNamedPipe(value: unknown): value is string {
  return (
    typeof value === 'string' && WINDOWS_NAMED_PIPE_PATTERN.test(value.trim())
  );
}

export function isValidPortNumber(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= 65535;
}

/**
 * Converts a raw port env value into a listenable endpoint.
 * Named-pipe paths are preserved verbatim; numeric values become numbers.
 */
export function parsePortValue(
  value: unknown,
  fallback: number = DEFAULT_LISTEN_PORT,
): number | string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (isWindowsNamedPipe(trimmed)) {
      return trimmed;
    }
    if (trimmed === '') {
      return fallback;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return isValidPortNumber(parsed) ? parsed : fallback;
  }

  if (typeof value === 'number' && isValidPortNumber(value)) {
    return value;
  }

  return fallback;
}

export interface ListenEndpointOptions {
  /** Raw `process.env.APP_PORT` value (takes precedence when set/valid). */
  appPort?: string | null;
  /** Value resolved from the validated config (`port`). */
  configuredPort?: string | number | null;
  /** Numeric fallback when nothing else is set. */
  fallback?: number;
}

/**
 * Resolves the final listen endpoint while preserving the historical
 * `APP_PORT` > configured `PORT` > fallback precedence. A named-pipe value in
 * either slot is returned untouched.
 */
export function resolveListenEndpoint({
  appPort,
  configuredPort,
  fallback = DEFAULT_LISTEN_PORT,
}: ListenEndpointOptions): number | string {
  if (
    appPort !== undefined &&
    appPort !== null &&
    String(appPort).trim() !== ''
  ) {
    const rawAppPort = String(appPort).trim();
    if (isWindowsNamedPipe(rawAppPort)) {
      return rawAppPort;
    }
    const parsedAppPort = Number.parseInt(rawAppPort, 10);
    if (isValidPortNumber(parsedAppPort)) {
      return parsedAppPort;
    }
  }

  return parsePortValue(configuredPort, fallback);
}
