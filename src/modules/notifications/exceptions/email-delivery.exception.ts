export class EmailDeliveryException extends Error {
  constructor(
    public readonly providerMessage: string,
    public readonly providerErrorCode?: string,
    public readonly statusCode?: number,
    public readonly isTransient: boolean = true,
  ) {
    super(`Email Delivery Failed: ${providerMessage}`);
    this.name = 'EmailDeliveryException';
  }
}
