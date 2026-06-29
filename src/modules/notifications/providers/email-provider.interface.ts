import { EmailPayload, EmailResult } from '../types/email-payload.type';

/**
 * Interface representing a pure email transport provider adapter.
 * The provider is responsible solely for delivering emails and normalizing
 * provider-specific errors into standard EmailDeliveryException instances.
 */
export interface IEmailProvider {
  /**
   * Sends an email payload through the provider.
   *
   * @param payload The structured email data including HTML and text fallback.
   * @returns An EmailResult indicating SUCCESS or FAILED with a provider response ID.
   * @throws {EmailDeliveryException} When the transport fundamentally fails or rejects the payload.
   */
  send(payload: EmailPayload): Promise<EmailResult>;
}

export const EMAIL_PROVIDER_TOKEN = Symbol('EMAIL_PROVIDER_TOKEN');
