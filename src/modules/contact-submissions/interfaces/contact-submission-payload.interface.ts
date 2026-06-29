export interface IContactSubmissionPayload {
  referenceCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | undefined;
  subject: string;
  message: string;
  locale: string;
  submittedAt: Date;
}
