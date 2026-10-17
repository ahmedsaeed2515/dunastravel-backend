import { BadRequestException } from '@nestjs/common';
import { ParseUuidOrSlugPipe } from './parse-uuid-or-slug.pipe';

describe('ParseUuidOrSlugPipe', () => {
  let pipe: ParseUuidOrSlugPipe;

  beforeEach(() => {
    pipe = new ParseUuidOrSlugPipe();
  });

  it('accepts valid UUID v4', () => {
    const uuid = '5b466cd9-b62b-4bdb-a3af-763e23ae1cda';
    expect(pipe.transform(uuid)).toBe(uuid);
  });

  it('accepts valid slugs with hyphens and underscores', () => {
    expect(pipe.transform('classic-program')).toBe('classic-program');
    expect(pipe.transform('classic_program')).toBe('classic_program');
    expect(pipe.transform('reg-01-legendary-turkey')).toBe(
      'reg-01-legendary-turkey',
    );
    expect(pipe.transform('hm001-honeymoon-in-dubai')).toBe(
      'hm001-honeymoon-in-dubai',
    );
    expect(pipe.transform('reg-21-jordan-extension---4-days')).toBe(
      'reg-21-jordan-extension---4-days',
    );
    expect(pipe.transform('reg-20-jordan-extension---5-days')).toBe(
      'reg-20-jordan-extension---5-days',
    );
  });

  it('trims leading and trailing slashes and spaces', () => {
    expect(pipe.transform('/classic-program/')).toBe('classic-program');
    expect(pipe.transform('  classic-program  ')).toBe('classic-program');
  });

  it('rejects invalid resource identifiers', () => {
    expect(() => pipe.transform('')).toThrow(BadRequestException);
    expect(() => pipe.transform('invalid$slug')).toThrow(BadRequestException);
    expect(() => pipe.transform('<script>')).toThrow(BadRequestException);
  });
});
