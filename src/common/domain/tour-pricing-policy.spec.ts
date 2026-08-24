import { isComplimentaryTourCountry } from './tour-pricing-policy';

describe('tour pricing policy', () => {
  it.each(['Egypt', 'egypt', ' EGYPT '])(
    'marks %s tours as complimentary',
    (country) => {
      expect(isComplimentaryTourCountry(country)).toBe(true);
    },
  );

  it.each([undefined, null, '', 'Jordan', 'Multi-Country'])(
    'does not mark %p tours as complimentary',
    (country) => {
      expect(isComplimentaryTourCountry(country)).toBe(false);
    },
  );
});
