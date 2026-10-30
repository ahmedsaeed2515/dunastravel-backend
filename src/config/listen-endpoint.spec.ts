import configuration from './configuration';
import {
  DEFAULT_LISTEN_PORT,
  isWindowsNamedPipe,
  parsePortValue,
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
      expect(isWindowsNamedPipe(undefined)).toBe(false);
      expect(isWindowsNamedPipe('')).toBe(false);
    });
  });

  describe('parsePortValue', () => {
    it('returns numbers for numeric values', () => {
      expect(parsePortValue('3000')).toBe(3000);
      expect(parsePortValue(' 8080 ')).toBe(8080);
      expect(parsePortValue(5001)).toBe(5001);
    });

    it('preserves named-pipe paths unchanged', () => {
      expect(parsePortValue(IISNODE_PIPE)).toBe(IISNODE_PIPE);
      expect(parsePortValue(IISNODE_PIPE_QUERY)).toBe(IISNODE_PIPE_QUERY);
    });

    it('falls back to the default for empty or invalid values', () => {
      expect(parsePortValue(undefined)).toBe(DEFAULT_LISTEN_PORT);
      expect(parsePortValue('')).toBe(DEFAULT_LISTEN_PORT);
      expect(parsePortValue('not-a-port')).toBe(DEFAULT_LISTEN_PORT);
      expect(parsePortValue('0')).toBe(DEFAULT_LISTEN_PORT);
      expect(parsePortValue('-1')).toBe(DEFAULT_LISTEN_PORT);
      expect(parsePortValue('70000')).toBe(DEFAULT_LISTEN_PORT);
      expect(parsePortValue(null, 4000)).toBe(4000);
    });
  });

  describe('resolveListenEndpoint', () => {
    it('keeps APP_PORT precedence for numeric ports', () => {
      expect(
        resolveListenEndpoint({ appPort: '8080', configuredPort: 5000 }),
      ).toBe(8080);
    });

    it('keeps APP_PORT precedence for named pipes', () => {
      expect(
        resolveListenEndpoint({ appPort: IISNODE_PIPE, configuredPort: 5000 }),
      ).toBe(IISNODE_PIPE);
    });

    it('returns a configured named pipe untouched', () => {
      expect(resolveListenEndpoint({ configuredPort: IISNODE_PIPE })).toBe(
        IISNODE_PIPE,
      );
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

    afterEach(() => {
      if (originalPort === undefined) {
        delete process.env.PORT;
      } else {
        process.env.PORT = originalPort;
      }
    });

    it('keeps an IISNode named pipe as a string (never parseInt)', () => {
      process.env.PORT = IISNODE_PIPE;

      const config = configuration();

      expect(config.port).toBe(IISNODE_PIPE);
      expect(typeof config.port).toBe('string');
    });

    it('parses a numeric PORT', () => {
      process.env.PORT = '4000';

      expect(configuration().port).toBe(4000);
      expect(typeof configuration().port).toBe('number');
    });

    it('falls back to 5000 when PORT is missing', () => {
      delete process.env.PORT;

      expect(configuration().port).toBe(5000);
    });
  });
});
