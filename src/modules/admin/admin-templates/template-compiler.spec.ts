import {
  compileTemplateHtml,
  extractDesignConfigFromHtml,
  EMAIL_PRESETS,
  EmailDesignConfig,
} from './template-compiler.util';

describe('template-compiler.util', () => {
  it('should have 4 predefined luxury presets', () => {
    expect(EMAIL_PRESETS.obsidian_gold).toBeDefined();
    expect(EMAIL_PRESETS.royal_sapphire).toBeDefined();
    expect(EMAIL_PRESETS.desert_amber).toBeDefined();
    expect(EMAIL_PRESETS.minimalist_pearl).toBeDefined();
  });

  it('should compile valid responsive HTML from obsidian_gold config', () => {
    const config = EMAIL_PRESETS.obsidian_gold.config;
    const html = compileTemplateHtml(config);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain(config.theme.canvasBg);
    expect(html).toContain(config.theme.cardBg);
    expect(html).toContain(config.branding.companyName);
    expect(html).toContain('DUNAS_BUILDER_CONFIG');
  });

  it('should re-extract designConfig from compiled HTML', () => {
    const config: EmailDesignConfig = {
      presetId: 'desert_amber',
      theme: {
        canvasBg: '#140d07',
        cardBg: '#1f160e',
        accentColor: '#f59e0b',
        accentGradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
        textColor: '#fef3c7',
        mutedColor: '#a89078',
        borderColor: 'rgba(245, 158, 11, 0.25)',
      },
      branding: {
        companyName: 'DUNAS SAHARA',
      },
      content: {
        subject: 'Custom Journey Details',
        bodyHtml: '<p>Discover Egypt with Dunas.</p>',
      },
      footer: {
        address: 'Luxor HQ',
      },
    };

    const html = compileTemplateHtml(config);
    const extracted = extractDesignConfigFromHtml(html);

    expect(extracted).not.toBeNull();
    expect(extracted?.presetId).toBe('desert_amber');
    expect(extracted?.branding.companyName).toBe('DUNAS SAHARA');
    expect(extracted?.theme.accentColor).toBe('#f59e0b');
  });

  it('should render highlight box when enabled', () => {
    const config = EMAIL_PRESETS.obsidian_gold.config;
    const html = compileTemplateHtml(config);

    expect(html).toContain('{{otpCode}}');
    expect(html).toContain('Security Verification Code');
  });

  it('should render CTA button when enabled', () => {
    const config = EMAIL_PRESETS.obsidian_gold.config;
    const html = compileTemplateHtml(config);

    expect(html).toContain('{{verifyUrl}}');
    expect(html).toContain('Verify & Confirm Booking');
  });
});
