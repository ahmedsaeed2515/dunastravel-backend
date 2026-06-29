export class EmailDeliveryException extends Error {
  constructor(
    public readonly providerMessage: string,
    public readonly providerErrorCode?: string,
  ) {
    super(`Email Delivery Failed: ${providerMessage}`);
    this.name = 'EmailDeliveryException';
  }
}
