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

export function isWindowsNamedPipe(value: unknown): boolean {
  return (
    typeof value === 'string' && WINDOWS_NAMED_PIPE_PATTERN.test(value.trim())
  );
}

export function isValidPortNumber(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= 65535;
}

/**
 * Parses a raw env value into a validated TCP port number.
 * Named pipes and any non-numeric value return `undefined`; this function is
 * never allowed to coerce a pipe path into `NaN`.
 */
export function parseNumericPort(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return isValidPortNumber(value) ? value : undefined;
  }

  if (typeof value === 'string' && !isWindowsNamedPipe(value)) {
    const trimmed = value.trim();
    if (trimmed === '' || !/^\d+$/.test(trimmed)) {
      return undefined;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return isValidPortNumber(parsed) ? parsed : undefined;
  }

  return undefined;
}

export interface ListenEndpointOptions {
  /** IISNode named-pipe path captured from `process.env.PORT`. */
  pipePath?: string | null;
  /** Raw `process.env.APP_PORT` value (numeric TCP override). */
  appPort?: string | number | null;
  /** Validated numeric port from the configuration factory. */
  configuredPort?: number | null;
  /** Numeric fallback when nothing else is set. */
  fallback?: number;
}

/**
 * Resolves the final listen endpoint:
 * IISNode named pipe > `APP_PORT` > configured numeric port > fallback.
 *
 * A named pipe is returned verbatim so `app.listen()` binds the pipe IISNode
 * owns instead of opening an unrelated TCP port.
 */
export function resolveListenEndpoint({
  pipePath,
  appPort,
  configuredPort,
  fallback = DEFAULT_LISTEN_PORT,
}: ListenEndpointOptions): number | string {
  if (pipePath && isWindowsNamedPipe(pipePath)) {
    return pipePath.trim();
  }

  return (
    parseNumericPort(appPort) ?? parseNumericPort(configuredPort) ?? fallback
  );
}
