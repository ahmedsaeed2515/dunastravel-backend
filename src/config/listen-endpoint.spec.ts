import configuration from './configuration';
import {
  DEFAULT_LISTEN_PORT,
  isWindowsNamedPipe,
  parseNumericPort,
  resolveListenEndpoint,
} from './listen-endpoint';

// Rendered value: \\.\pipe\iisnode-7f3a
const IISNODE_PIPE = '\\\\.\\pipe\\iisnode-7f3a';
// Rendered value: \\?\pipe\iisnode-query-form
const IISNODE_PIPE_QUERY = '\\\\?\\pipe\\iisnode-query-form';

describe('listen-endpoint', () => {
  describe('isWindowsNamedPipe', () => {
    it('detects IISNode named-pipe paths', () => {
      expect(isWindowsNamedPipe(IISNODE_PIPE)).toBe(true);
      expect(isWindowsNamedPipe(IISNODE_PIPE_QUERY)).toBe(true);
      expect(isWindowsNamedPipe(`  ${IISNODE_PIPE}  `)).toBe(true);
    });

    it('rejects numeric and non-pipe values', () => {
      expect(isWindowsNamedPipe('3000')).toBe(false);
      expect(isWindowsNamedPipe(3000)).toBe(false);
      expect(isWindowsNamedPipe('/tmp/app.sock')).toBe(false);
      expect(isWindowsNamedPipe('\\\\.\\notapipe\\x')).toBe(false);
      expect(isWindowsNamedPipe(undefined)).toBe(false);
      expect(isWindowsNamedPipe('')).toBe(false);
    });
  });

  describe('parseNumericPort', () => {
    it('returns validated numbers for numeric values', () => {
      expect(parseNumericPort('3000')).toBe(3000);
      expect(parseNumericPort(' 8080 ')).toBe(8080);
      expect(parseNumericPort(5001)).toBe(5001);
      expect(parseNumericPort('65535')).toBe(65535);
    });

    it('never coerces a named-pipe path', () => {
      expect(parseNumericPort(IISNODE_PIPE)).toBeUndefined();
      expect(parseNumericPort(IISNODE_PIPE_QUERY)).toBeUndefined();
    });

    it('returns undefined for empty or invalid values', () => {
      expect(parseNumericPort(undefined)).toBeUndefined();
      expect(parseNumericPort(null)).toBeUndefined();
      expect(parseNumericPort('')).toBeUndefined();
      expect(parseNumericPort('   ')).toBeUndefined();
      expect(parseNumericPort('not-a-port')).toBeUndefined();
      expect(parseNumericPort('3000abc')).toBeUndefined();
      expect(parseNumericPort('0')).toBeUndefined();
      expect(parseNumericPort('-1')).toBeUndefined();
      expect(parseNumericPort('70000')).toBeUndefined();
      expect(parseNumericPort(3.5)).toBeUndefined();
    });
  });

  describe('resolveListenEndpoint', () => {
    it('returns the IISNode named pipe verbatim and never binds TCP', () => {
      expect(
        resolveListenEndpoint({
          pipePath: IISNODE_PIPE,
          appPort: '8080',
          configuredPort: 5000,
        }),
      ).toBe(IISNODE_PIPE);
    });

    it('keeps APP_PORT precedence for numeric deployments', () => {
      expect(
        resolveListenEndpoint({ appPort: '8080', configuredPort: 5000 }),
      ).toBe(8080);
    });

    it('falls back to the configured numeric port', () => {
      expect(resolveListenEndpoint({ configuredPort: 5001 })).toBe(5001);
      expect(resolveListenEndpoint({ appPort: '', configuredPort: 5002 })).toBe(
        5002,
      );
      expect(
        resolveListenEndpoint({ appPort: 'bogus', configuredPort: 5003 }),
      ).toBe(5003);
    });

    it('uses the default port when nothing is configured', () => {
      expect(resolveListenEndpoint({})).toBe(DEFAULT_LISTEN_PORT);
    });
  });

  describe('configuration factory', () => {
    const originalPort = process.env.PORT;
    const originalAppPort = process.env.APP_PORT;

    afterEach(() => {
      if (originalPort === undefined) {
        delete process.env.PORT;
      } else {
        process.env.PORT = originalPort;
      }
      if (originalAppPort === undefined) {
        delete process.env.APP_PORT;
      } else {
        process.env.APP_PORT = originalAppPort;
      }
    });

    it('keeps an IISNode named pipe out of the numeric port', () => {
      process.env.PORT = IISNODE_PIPE;
      delete process.env.APP_PORT;

      const config = configuration();

      expect(config.iisNodeNamedPipe).toBe(IISNODE_PIPE);
      expect(config.port).toBe(DEFAULT_LISTEN_PORT);
      expect(typeof config.port).toBe('number');
    });

    it('uses APP_PORT as the numeric fallback when PORT is a pipe', () => {
      process.env.PORT = IISNODE_PIPE;
      process.env.APP_PORT = '4000';

      const config = configuration();

      expect(config.iisNodeNamedPipe).toBe(IISNODE_PIPE);
      expect(config.port).toBe(4000);
    });

    it('parses a numeric PORT', () => {
      process.env.PORT = '4100';
      delete process.env.APP_PORT;

      const config = configuration();

      expect(config.port).toBe(4100);
      expect(config.iisNodeNamedPipe).toBeUndefined();
    });

    it('keeps APP_PORT precedence for numeric deployments', () => {
      process.env.PORT = '4100';
      process.env.APP_PORT = '4200';

      expect(configuration().port).toBe(4200);
    });

    it('falls back to 5000 when PORT is missing', () => {
      delete process.env.PORT;
      delete process.env.APP_PORT;

      const config = configuration();

      expect(config.port).toBe(DEFAULT_LISTEN_PORT);
      expect(config.iisNodeNamedPipe).toBeUndefined();
    });
  });
});
