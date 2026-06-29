import * as Joi from 'joi';
import { registerAs } from '@nestjs/config';

export const mailConfigSchema = {
  RESEND_API_KEY: Joi.string()
    .pattern(/^re_[a-zA-Z0-9_]{8,}$/)
    .required(),
  MAIL_FROM_ADDRESS: Joi.string().email().required(),
  MAIL_FROM_NAME: Joi.string().max(100).required(),
  MAIL_INTERNAL_ALERT_RECIPIENT: Joi.string().email().required(),
  MAIL_TRANSPORT: Joi.string().valid('resend', 'mock').optional(),
  ADMIN_DASHBOARD_BASE_URL: Joi.string().uri().required(),
};

export default registerAs('mail', () => ({
  apiKey: process.env.RESEND_API_KEY,
  fromAddress: process.env.MAIL_FROM_ADDRESS,
  fromName: process.env.MAIL_FROM_NAME,
  internalAlertRecipient: process.env.MAIL_INTERNAL_ALERT_RECIPIENT,
  transport:
    process.env.MAIL_TRANSPORT ||
    (process.env.NODE_ENV === 'production' ? 'resend' : 'mock'),
  adminDashboardBaseUrl: process.env.ADMIN_DASHBOARD_BASE_URL,
}));
