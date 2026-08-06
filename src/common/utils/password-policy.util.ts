import { BadRequestException } from '@nestjs/common';

const BLOCKED_FRAGMENTS = [
  'password',
  'passw0rd',
  'qwerty',
  'admin',
  'dunas',
  'letmein',
  'welcome',
  '123456',
];

export function assertStrongPassword(password: string): void {
  if (password.length < 12 || password.length > 128) {
    throw new BadRequestException(
      'Password must be between 12 and 128 characters',
    );
  }

  const normalized = password.toLowerCase();
  if (BLOCKED_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
    throw new BadRequestException('Password is too predictable');
  }

  const characterClasses = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  if (characterClasses < 3) {
    throw new BadRequestException(
      'Password must use at least three character classes',
    );
  }

  if (/(.)\1{4,}/.test(password)) {
    throw new BadRequestException(
      'Password contains an unsafe repeated sequence',
    );
  }
}
