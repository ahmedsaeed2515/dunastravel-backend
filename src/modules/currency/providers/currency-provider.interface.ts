export interface CurrencyRateResult {
  base: string; // Canonical base for ECB reference (e.g., 'EUR')
  quote: string; // Quote currency (e.g., 'USD')
  rate: string; // 1 EUR = X USD (e.g., '1.125300')
  inverseRate: string; // 1 USD = 1/X EUR (e.g., '0.888652')
  date: string; // Date of the ECB observation (e.g., '2026-10-16')
  source: string; // Reference source ('ECB')
  provider: string; // Integration provider ('Frankfurter')
  fetchedAt: string; // Timestamp of synchronization
}

export interface ICurrencyProvider {
  getProviderName(): string;
  fetchEurUsdRate(): Promise<CurrencyRateResult>;
}
