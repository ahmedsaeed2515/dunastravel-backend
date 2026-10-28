import { ConfigService } from '@nestjs/config';
import {
  isAllowedBrowserOrigin,
  validateCorsConfiguration,
} from './allowed-origin.util';

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

describe('SEC-01: CORS Origin Security Specification', () => {
  const prodConfig = config({
    nodeEnv: 'production',
    corsAllowedOrigins:
      'https://www.dunastravel.com,https://dunastravel.com,https://admin.dunastravel.com',
  });

  describe('Production Origin Strict Matching', () => {
    it('allows exact configured production origins', () => {
      expect(
        isAllowedBrowserOrigin('https://www.dunastravel.com', prodConfig),
      ).toBe(true);
      expect(
        isAllowedBrowserOrigin('https://dunastravel.com', prodConfig),
      ).toBe(true);
      expect(
        isAllowedBrowserOrigin('https://admin.dunastravel.com', prodConfig),
      ).toBe(true);
    });

    it('allows exact configured origins regardless of uppercase or trailing slash', () => {
      expect(
        isAllowedBrowserOrigin('HTTPS://WWW.DUNASTRAVEL.COM', prodConfig),
      ).toBe(true);
      expect(
        isAllowedBrowserOrigin('https://www.dunastravel.com/', prodConfig),
      ).toBe(true);
    });

    it('REJECTS arbitrary Vercel origins (Exploit PoC test)', () => {
      expect(
        isAllowedBrowserOrigin('https://evil-test.vercel.app', prodConfig),
      ).toBe(false);
    });

    it('REJECTS look-alike preview origins', () => {
      expect(
        isAllowedBrowserOrigin(
          'https://dunastravel-evil.vercel.app',
          prodConfig,
        ),
      ).toBe(false);
      expect(
        isAllowedBrowserOrigin(
          'https://dunastravel-frontend-evil.vercel.app',
          prodConfig,
        ),
      ).toBe(false);
    });

    it('REJECTS subdomain spoofing and look-alike domains', () => {
      expect(
        isAllowedBrowserOrigin('https://dunastravel.com.evil.com', prodConfig),
      ).toBe(false);
      expect(
        isAllowedBrowserOrigin(
          'https://www.dunastravel.com.attacker.org',
          prodConfig,
        ),
      ).toBe(false);
    });

    it('REJECTS http variant when only https is configured', () => {
      expect(
        isAllowedBrowserOrigin('http://www.dunastravel.com', prodConfig),
      ).toBe(false);
    });

    it('REJECTS trailing-dot trick origins', () => {
      expect(
        isAllowedBrowserOrigin('https://www.dunastravel.com.', prodConfig),
      ).toBe(false);
    });

    it('REJECTS null and empty origins', () => {
      expect(isAllowedBrowserOrigin('null', prodConfig)).toBe(false);
      expect(isAllowedBrowserOrigin('', prodConfig)).toBe(false);
      expect(isAllowedBrowserOrigin(undefined, prodConfig)).toBe(false);
    });
  });

  describe('Production Boot-time Guard', () => {
    it('refuses to start in production if CORS_ALLOWED_ORIGINS is empty', () => {
      const emptyConfig = config({
        nodeEnv: 'production',
        corsAllowedOrigins: '',
      });
      expect(() => validateCorsConfiguration(emptyConfig)).toThrow(
        /CORS_ALLOWED_ORIGINS must be defined and non-empty in production/,
      );
    });

    it('refuses to start in production if CORS_ALLOWED_ORIGINS contains wildcard "*"', () => {
      const wildcardConfig = config({
        nodeEnv: 'production',
        corsAllowedOrigins: 'https://dunastravel.com,*',
      });
      expect(() => validateCorsConfiguration(wildcardConfig)).toThrow(
        /Wildcard "\*" is strictly forbidden/,
      );
    });

    it('passes boot-time validation with valid production origins', () => {
      expect(() => validateCorsConfiguration(prodConfig)).not.toThrow();
    });
  });
});
