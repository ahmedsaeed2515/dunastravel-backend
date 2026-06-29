import { IContactSubmissionPayload } from '../interfaces/contact-submission-payload.interface';

export const CONTACT_CREATED_EVENT = 'contact.created';

export class ContactCreatedEvent implements IContactSubmissionPayload {
  public readonly referenceCode: string;
  public readonly firstName: string;
  public readonly lastName: string;
  public readonly email: string;
  public readonly phone: string | undefined;
  public readonly subject: string;
  public readonly message: string;
  public readonly locale: string;
  public readonly submittedAt: Date;

  constructor(payload: IContactSubmissionPayload) {
    this.referenceCode = payload.referenceCode;
    this.firstName = payload.firstName;
    this.lastName = payload.lastName;
    this.email = payload.email;
    this.phone = payload.phone;
    this.subject = payload.subject;
    this.message = payload.message;
    this.locale = payload.locale;
    this.submittedAt = payload.submittedAt;
  }
}
