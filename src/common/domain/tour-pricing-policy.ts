const COMPLIMENTARY_TOUR_COUNTRIES = new Set(['egypt']);

export function isComplimentaryTourCountry(country: unknown): boolean {
  return (
    typeof country === 'string' &&
    COMPLIMENTARY_TOUR_COUNTRIES.has(country.trim().toLocaleLowerCase('en-US'))
  );
}
