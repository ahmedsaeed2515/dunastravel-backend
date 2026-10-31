import { Prisma } from '@prisma/client';
import { SupportedLocale } from '../../modules/notifications/types/canonical-notification.types';

export function formatFinancialAmount(
  amount: number | string | Prisma.Decimal,
  currency: string = 'USD',
  locale: SupportedLocale = 'en',
): string {
  const normCurrency = (currency || 'USD').toUpperCase().trim();
  const decimal =
    amount instanceof Prisma.Decimal
      ? amount
      : new Prisma.Decimal(String(amount || '0'));

  const num = decimal.toNumber();
  const symbol =
    normCurrency === 'EUR' ? '€' : normCurrency === 'USD' ? '$' : normCurrency;

  const formattedNum = (() => {
    switch (locale) {
      case 'es':
      case 'pt':
      case 'it':
        // European formatting: 1.234,56
        return num.toLocaleString('de-DE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      case 'ar':
        return num.toLocaleString('ar-EG', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      case 'en':
      default:
        return num.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
    }
  })();

  if (locale === 'ar') {
    const currencyNameAr =
      normCurrency === 'EUR'
        ? 'يورو'
        : normCurrency === 'USD'
          ? 'دولار أمريكي'
          : normCurrency;
    return `${formattedNum} ${symbol} (${currencyNameAr})`;
  }

  if (locale === 'es' || locale === 'pt' || locale === 'it') {
    return `${formattedNum} ${symbol} ${normCurrency}`;
  }

  return `${symbol}${formattedNum} ${normCurrency}`;
}

export function formatMultiCurrencySummary(opts: {
  amount: number | string | Prisma.Decimal;
  currency: string;
  originalAmount?: number | string | Prisma.Decimal | null;
  originalCurrency?: string | null;
  exchangeRate?: number | string | Prisma.Decimal | null;
  amountUsd?: number | string | Prisma.Decimal | null;
  locale?: SupportedLocale;
}): string {
  const locale = opts.locale || 'en';
  const main = formatFinancialAmount(opts.amount, opts.currency, locale);

  if (
    opts.originalAmount &&
    opts.originalCurrency &&
    opts.originalCurrency.toUpperCase() !== opts.currency.toUpperCase()
  ) {
    const orig = formatFinancialAmount(
      opts.originalAmount,
      opts.originalCurrency,
      locale,
    );
    const rate = opts.exchangeRate
      ? ` @ ${Number(opts.exchangeRate).toFixed(6)}`
      : '';
    return `${main} (${orig}${rate})`;
  }

  if (
    opts.currency.toUpperCase() !== 'USD' &&
    opts.amountUsd &&
    Number(opts.amountUsd) > 0
  ) {
    const usd = formatFinancialAmount(opts.amountUsd, 'USD', locale);
    return `${main} (≈ ${usd})`;
  }

  return main;
}

export function redactEmailAddress(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const parts = email.split('@');
  const user = parts[0];
  const domain = parts[1];
  if (user.length <= 1) {
    return `*@${domain}`;
  }
  if (user.length === 2) {
    return `${user[0]}***${user[1]}@${domain}`;
  }
  const visiblePrefix = user.slice(0, 1);
  const visibleSuffix = user.slice(-1);
  return `${visiblePrefix}***${visibleSuffix}@${domain}`;
}
