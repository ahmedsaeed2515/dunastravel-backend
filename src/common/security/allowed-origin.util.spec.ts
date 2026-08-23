import { ConfigService } from '@nestjs/config';
import { isAllowedBrowserOrigin } from './allowed-origin.util';

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

describe('isAllowedBrowserOrigin', () => {
  it('allows official production and owned dashboard preview origins', () => {
    const production = config({ nodeEnv: 'production' });
    expect(
      isAllowedBrowserOrigin(
        'https://dunastravel-dashbord.vercel.app',
        production,
      ),
    ).toBe(true);
    expect(
      isAllowedBrowserOrigin(
        'https://dunastravel-dashbord-g1yhrrwup-ahmedsaeed2515-1865s-projects.vercel.app',
        production,
      ),
    ).toBe(true);
  });

  it('rejects lookalike Vercel origins and localhost in production', () => {
    const production = config({ nodeEnv: 'production' });
    expect(
      isAllowedBrowserOrigin('https://dunastravel-evil.vercel.app', production),
    ).toBe(false);
    expect(isAllowedBrowserOrigin('http://localhost:3000', production)).toBe(
      false,
    );
  });

  it('allows exact configured origins and local development origins', () => {
    expect(
      isAllowedBrowserOrigin(
        'https://preview.example.com/',
        config({
          nodeEnv: 'production',
          corsAllowedOrigins: 'https://preview.example.com',
        }),
      ),
    ).toBe(true);
    expect(
      isAllowedBrowserOrigin(
        'http://127.0.0.1:5173',
        config({ nodeEnv: 'development' }),
      ),
    ).toBe(true);
  });
});
