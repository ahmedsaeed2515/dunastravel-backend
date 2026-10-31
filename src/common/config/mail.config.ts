import * as Joi from 'joi';
import { registerAs } from '@nestjs/config';

export const mailConfigSchema = {
  BREVO_API_KEY: Joi.string().min(16).optional().allow(''),
  MAIL_FROM_ADDRESS: Joi.string().email().required(),
  MAIL_FROM_NAME: Joi.string().max(100).required(),
  MAIL_INTERNAL_ALERT_RECIPIENT: Joi.string().email().required(),
  MAIL_TRANSPORT: Joi.string().valid('brevo', 'mock').optional(),
  ADMIN_DASHBOARD_BASE_URL: Joi.string().uri().required(),
};

export default registerAs('mail', () => ({
  apiKey: process.env.BREVO_API_KEY,
  brevoApiKey: process.env.BREVO_API_KEY,
  fromAddress: process.env.MAIL_FROM_ADDRESS,
  fromName: process.env.MAIL_FROM_NAME,
  internalAlertRecipient: process.env.MAIL_INTERNAL_ALERT_RECIPIENT,
  transport:
    process.env.MAIL_TRANSPORT ||
    (process.env.NODE_ENV === 'production' ? 'brevo' : 'mock'),
  adminDashboardBaseUrl: process.env.ADMIN_DASHBOARD_BASE_URL,
}));
