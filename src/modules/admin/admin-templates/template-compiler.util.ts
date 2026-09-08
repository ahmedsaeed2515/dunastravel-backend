export interface EmailDesignConfig {
  presetId?: 'obsidian_gold' | 'royal_sapphire' | 'desert_amber' | 'minimalist_pearl';
  theme: {
    canvasBg: string;
    cardBg: string;
    accentColor: string;
    accentGradient: string;
    textColor: string;
    mutedColor: string;
    borderColor: string;
    headerBg?: string;
  };
  branding: {
    companyName: string;
    logoUrl?: string;
    bannerUrl?: string;
    badgeText?: string;
  };
  content: {
    subject?: string;
    preheader?: string;
    greeting?: string;
    bodyHtml: string;
  };
  highlightBox?: {
    enabled: boolean;
    type: 'OTP_CODE' | 'FEATURE_CARD';
    title?: string;
    value?: string;
    note?: string;
  };
  ctaButton?: {
    enabled: boolean;
    text: string;
    url: string;
    style?: 'GRADIENT' | 'SOLID' | 'OUTLINE';
  };
  footer: {
    address?: string;
    contactEmail?: string;
    contactPhone?: string;
    websiteUrl?: string;
    securityNotice?: string;
    copyrightYear?: string;
  };
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
    linkedin?: string;
  };
}

export const EMAIL_PRESETS: Record<string, { name: string; nameAr: string; config: EmailDesignConfig }> = {
  obsidian_gold: {
    name: 'Obsidian & Gold Luxury',
    nameAr: 'الأسود والذهبي الفاخر (DUNAS Signature)',
    config: {
      presetId: 'obsidian_gold',
      theme: {
        canvasBg: '#07060a',
        cardBg: '#121018',
        accentColor: '#c9a227',
        accentGradient: 'linear-gradient(135deg, #c9a227 0%, #8a6a12 100%)',
        textColor: '#f5edd6',
        mutedColor: '#8e8777',
        borderColor: 'rgba(201, 162, 39, 0.25)',
        headerBg: '#0b0a10',
      },
      branding: {
        companyName: 'DUNAS TRAVEL',
        logoUrl: 'https://www.dunastravel.com/logo-gold.png',
        badgeText: 'BESPOKE JOURNEYS & LUXURY EXPERIENCES',
      },
      content: {
        greeting: 'Dear {{name}},',
        bodyHtml:
          '<p>Welcome to DUNAS TRAVEL. We curate extraordinary, bespoke journeys across the ancient landscapes of Egypt, Jordan, and Turkey.</p><p>Please find your account security details and priority booking access below.</p>',
      },
      highlightBox: {
        enabled: true,
        type: 'OTP_CODE',
        title: 'Security Verification Code • رمز التحقق الأمني',
        value: '{{otpCode}}',
        note: '⏱️ Valid for 15 minutes • صالح لمدة 15 دقيقة فقط',
      },
      ctaButton: {
        enabled: true,
        text: 'Verify & Confirm Booking • تفعيل الحساب وتأكيد الحجز',
        url: '{{verifyUrl}}',
        style: 'GRADIENT',
      },
      footer: {
        address: 'Cairo Headquarters • Spain • Italy • Brazil • Mexico • Colombia',
        contactEmail: 'concierge@dunastravel.com',
        websiteUrl: 'https://www.dunastravel.com',
        securityNotice:
          'Never share your verification code or credentials with anyone. DUNAS TRAVEL concierges will never ask for your private code.',
      },
      socialLinks: {
        instagram: 'https://instagram.com/dunastravel',
        whatsapp: 'https://wa.me/201000000000',
      },
    },
  },

  royal_sapphire: {
    name: 'Royal Sapphire & Marble',
    nameAr: 'الأزرق الملكي والأبيض الرخامي (Executive)',
    config: {
      presetId: 'royal_sapphire',
      theme: {
        canvasBg: '#0b1120',
        cardBg: '#111827',
        accentColor: '#3b82f6',
        accentGradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        textColor: '#f8fafc',
        mutedColor: '#94a3b8',
        borderColor: 'rgba(59, 130, 246, 0.25)',
        headerBg: '#0f172a',
      },
      branding: {
        companyName: 'DUNAS TRAVEL GROUP',
        logoUrl: 'https://www.dunastravel.com/logo-gold.png',
        badgeText: 'CORPORATE & ELITE PRIVATE TRAVEL',
      },
      content: {
        greeting: 'Dear {{name}},',
        bodyHtml:
          '<p>Thank you for choosing DUNAS TRAVEL GROUP. Your private itinerary and confirmed travel arrangements are being coordinated with our dedicated destination directors.</p>',
      },
      highlightBox: {
        enabled: true,
        type: 'FEATURE_CARD',
        title: 'Important Travel Notice • تفاصيل هامة',
        value: '{{bookingRef}}',
        note: 'Reservation reference verified on secure DMC infrastructure',
      },
      ctaButton: {
        enabled: true,
        text: 'Access VIP Portal • الدخول للبوابة',
        url: '{{verifyUrl}}',
        style: 'GRADIENT',
      },
      footer: {
        address: 'Licensed Destination Management Company (DMC No. 1882)',
        contactEmail: 'sales@dunastravel.com',
        websiteUrl: 'https://www.dunastravel.com',
        securityNotice: 'This communication is SSL encrypted and digitally signed by Dunas Travel Group.',
      },
    },
  },

  desert_amber: {
    name: 'Warm Desert Amber',
    nameAr: 'عنبر الصحراء الدافئ (Nile & Sahara Heritage)',
    config: {
      presetId: 'desert_amber',
      theme: {
        canvasBg: '#140d07',
        cardBg: '#1f160e',
        accentColor: '#f59e0b',
        accentGradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
        textColor: '#fef3c7',
        mutedColor: '#a89078',
        borderColor: 'rgba(245, 158, 11, 0.25)',
        headerBg: '#19110a',
      },
      branding: {
        companyName: 'DUNAS HERITAGE',
        logoUrl: 'https://www.dunastravel.com/logo-gold.png',
        badgeText: 'TIMELESS LUXURY ALONG THE NILE & DUNES',
      },
      content: {
        greeting: 'Marhaban {{name}},',
        bodyHtml:
          '<p>The sands of Egypt, Jordan, and the ancient Mediterranean await you. We have prepared an unforgettable curated journey honoring centuries of authentic culture and unparalleled comfort.</p>',
      },
      highlightBox: {
        enabled: true,
        type: 'OTP_CODE',
        title: 'Your Private Access Code • رمز الدخول الخاص',
        value: '{{otpCode}}',
        note: 'Expires in 15 minutes • صالح لـ 15 دقيقة',
      },
      ctaButton: {
        enabled: true,
        text: 'Confirm Your Journey • تأكيد رحلتك',
        url: '{{verifyUrl}}',
        style: 'GRADIENT',
      },
      footer: {
        address: 'Cairo • Luxor • Aswan • Sharm El Sheikh • Amman • Istanbul',
        contactEmail: 'experience@dunastravel.com',
        websiteUrl: 'https://www.dunastravel.com',
      },
    },
  },

  minimalist_pearl: {
    name: 'Minimalist Editorial Pearl',
    nameAr: 'المينيماليست العصري الفاتح (Editorial Modern)',
    config: {
      presetId: 'minimalist_pearl',
      theme: {
        canvasBg: '#f8fafc',
        cardBg: '#ffffff',
        accentColor: '#0f172a',
        accentGradient: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
        textColor: '#0f172a',
        mutedColor: '#64748b',
        borderColor: '#e2e8f0',
        headerBg: '#f8fafc',
      },
      branding: {
        companyName: 'DUNAS TRAVEL',
        logoUrl: 'https://www.dunastravel.com/logo-dark.png',
        badgeText: 'EXPEDITIONS & HIGH-END HOSPITALITY',
      },
      content: {
        greeting: 'Hello {{name}},',
        bodyHtml:
          '<p>Here is the requested verification information for your account and upcoming itineraries. Our concierge team remains at your service 24/7.</p>',
      },
      highlightBox: {
        enabled: true,
        type: 'OTP_CODE',
        title: 'Verification Code',
        value: '{{otpCode}}',
        note: 'Expires in 15 minutes',
      },
      ctaButton: {
        enabled: true,
        text: 'Complete Verification',
        url: '{{verifyUrl}}',
        style: 'SOLID',
      },
      footer: {
        address: 'DUNAS TRAVEL • Egypt, Spain, Italy, Brazil',
        contactEmail: 'concierge@dunastravel.com',
        websiteUrl: 'https://www.dunastravel.com',
      },
    },
  },
};

export function compileTemplateHtml(config: EmailDesignConfig): string {
  const t = config.theme;
  const b = config.branding;
  const c = config.content;
  const h = config.highlightBox;
  const btn = config.ctaButton;
  const f = config.footer;

  const preheaderHtml = c.preheader
    ? `<div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: ${t.canvasBg};">${c.preheader}</div>`
    : '';

  const logoOrBrand = b.logoUrl
    ? `<img src="${b.logoUrl}" alt="${b.companyName}" style="max-height: 48px; max-width: 220px; object-fit: contain; display: block; margin: 0 auto 10px auto;" />`
    : `<div style="font-family: 'Cinzel', Georgia, serif; font-size: 20px; font-weight: 700; letter-spacing: 4px; color: ${t.accentColor}; text-transform: uppercase;">${b.companyName}</div>`;

  const bannerHtml = b.bannerUrl
    ? `<tr>
        <td style="padding: 0; line-height: 0;">
          <img src="${b.bannerUrl}" alt="Banner" style="width: 100%; max-height: 240px; object-fit: cover; display: block;" />
        </td>
      </tr>`
    : '';

  const highlightHtml = h?.enabled
    ? `<div style="margin: 28px 0; background-color: rgba(255, 255, 255, 0.03); border: 1.5px dashed ${t.accentColor}; border-radius: 12px; padding: 22px 18px; text-align: center;">
        ${h.title ? `<div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: ${t.accentColor}; font-weight: 700; margin-bottom: 10px;">${h.title}</div>` : ''}
        <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: ${h.type === 'OTP_CODE' ? '34px' : '22px'}; font-weight: 800; letter-spacing: ${h.type === 'OTP_CODE' ? '10px' : '3px'}; color: ${t.accentColor}; line-height: 1.2; text-shadow: 0 0 20px ${t.accentColor}33;">
          ${h.value || '{{otpCode}}'}
        </div>
        ${h.note ? `<div style="font-size: 11.5px; color: ${t.mutedColor}; margin-top: 10px; font-weight: 500;">${h.note}</div>` : ''}
      </div>`
    : '';

  const ctaBtnHtml = btn?.enabled
    ? `<div style="margin: 28px 0 16px 0; text-align: center;">
        <a href="${btn.url || '{{verifyUrl}}'}" style="display: inline-block; background: ${btn.style === 'SOLID' ? t.accentColor : t.accentGradient}; color: ${t.cardBg === '#ffffff' ? '#ffffff' : '#07060a'}; font-size: 13px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; text-decoration: none; padding: 14px 34px; border-radius: 10px; box-shadow: 0 4px 20px ${t.accentColor}40; border: 1px solid ${t.accentColor};">
          ${btn.text || 'Confirm Action'}
        </a>
      </div>`
    : '';

  const securityHtml = f.securityNotice
    ? `<div style="margin-top: 24px; background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 12px 16px; font-size: 11.5px; color: ${t.mutedColor}; line-height: 1.5; text-align: left;">
        <span style="color: ${t.accentColor}; font-weight: 700;">🛡️ Security Notice:</span> ${f.securityNotice}
      </div>`
    : '';

  const configMeta = `<!-- DUNAS_BUILDER_CONFIG: ${JSON.stringify(config)} -->`;

  return `<!DOCTYPE html>
<html lang="en" dir="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${c.subject || b.companyName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    body { margin: 0; padding: 0; background-color: ${t.canvasBg}; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { color: ${t.accentColor}; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${t.canvasBg}; -webkit-font-smoothing: antialiased;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${t.canvasBg}; padding: 36px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: ${t.cardBg}; border-radius: 16px; border: 1px solid ${t.borderColor}; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 28px 30px; text-align: center; background-color: ${t.headerBg || t.cardBg}; border-bottom: 1px solid ${t.borderColor};">
              ${logoOrBrand}
              ${b.badgeText ? `<div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: ${t.accentColor}; font-weight: 600; margin-top: 6px;">${b.badgeText}</div>` : ''}
            </td>
          </tr>

          ${bannerHtml}

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 36px 28px 36px; color: ${t.textColor}; font-size: 14.5px; line-height: 1.7;">
              ${c.greeting ? `<div style="font-size: 17px; font-weight: 700; color: ${t.accentColor}; margin-bottom: 16px;">${c.greeting}</div>` : ''}
              
              <div style="color: ${t.textColor}; font-size: 14.5px; line-height: 1.7;">
                ${c.bodyHtml}
              </div>

              ${highlightHtml}
              ${ctaBtnHtml}
              ${securityHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 30px; background-color: ${t.canvasBg}; border-top: 1px solid ${t.borderColor}; text-align: center; font-size: 11.5px; color: ${t.mutedColor}; line-height: 1.6;">
              ${f.address ? `<div style="font-weight: 500; margin-bottom: 4px;">${f.address}</div>` : ''}
              <div style="margin-top: 8px;">
                ${f.websiteUrl ? `<a href="${f.websiteUrl}" style="color: ${t.accentColor}; text-decoration: none;">${f.websiteUrl.replace(/^https?:\/\//, '')}</a>` : ''}
                ${f.contactEmail ? ` &nbsp;|&nbsp; <a href="mailto:${f.contactEmail}" style="color: ${t.accentColor}; text-decoration: none;">${f.contactEmail}</a>` : ''}
              </div>
              <div style="margin-top: 12px; color: ${t.mutedColor}; opacity: 0.75;">
                &copy; ${f.copyrightYear || new Date().getFullYear()} ${b.companyName}. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  ${configMeta}
</body>
</html>`;
}

export function extractDesignConfigFromHtml(bodyHtml: string): EmailDesignConfig | null {
  if (!bodyHtml) return null;
  const match = bodyHtml.match(/<!-- DUNAS_BUILDER_CONFIG: ([\s\S]*?) -->/);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]) as EmailDesignConfig;
    } catch {
      return null;
    }
  }
  return null;
}
