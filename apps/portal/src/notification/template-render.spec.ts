import {
  renderTemplate,
  extractTokens,
  validateTemplate,
  sanitizeBodyHtml,
  htmlToText,
} from './template-render';

describe('template-render (RVSK-NOTIFY-EMAIL-003)', () => {
  describe('renderTemplate', () => {
    it('replaces known tokens', () => {
      expect(
        renderTemplate('Hi {{user_name}} ({{user_id}})', {
          user_name: 'Asha',
          user_id: 'asha01',
        }),
      ).toBe('Hi Asha (asha01)');
    });

    it('blanks unknown/missing tokens without leaking raw braces', () => {
      expect(renderTemplate('X {{missing}} Y', {})).toBe('X  Y');
    });

    it('handles null/empty template', () => {
      expect(renderTemplate(null, {})).toBe('');
      expect(renderTemplate(undefined, { a: 1 })).toBe('');
    });

    it('tolerates whitespace inside braces', () => {
      expect(renderTemplate('{{ user_name }}', { user_name: 'Q' })).toBe('Q');
    });
  });

  describe('extractTokens', () => {
    it('returns distinct token names', () => {
      expect(
        extractTokens('{{a}} {{b}} {{a}}').sort(),
      ).toEqual(['a', 'b']);
    });
  });

  describe('validateTemplate', () => {
    it('accepts allowed + always-available tokens', () => {
      const res = validateTemplate(
        'Hi {{user_name}}, visit {{portal_url}}',
        ['user_name'],
      );
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects unknown tokens', () => {
      const res = validateTemplate('Hi {{secret}}', ['user_name']);
      expect(res.valid).toBe(false);
      expect(res.errors.join(' ')).toContain('secret');
    });

    it('rejects unbalanced braces', () => {
      const res = validateTemplate('Hi {{user_name}', ['user_name']);
      expect(res.valid).toBe(false);
      expect(res.errors.join(' ')).toContain('Unbalanced');
    });
  });

  describe('sanitizeBodyHtml', () => {
    it('strips script tags and event handlers', () => {
      const dirty = '<p onclick="steal()">Hi</p><script>alert(1)</script>';
      const clean = sanitizeBodyHtml(dirty);
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('onclick');
      expect(clean).toContain('Hi');
    });

    it('keeps safe formatting and links', () => {
      const clean = sanitizeBodyHtml(
        '<p>Hello <strong>world</strong> <a href="https://x.test">link</a></p>',
      );
      expect(clean).toContain('<strong>world</strong>');
      expect(clean).toContain('href="https://x.test"');
    });

    it('preserves placeholder braces for later rendering', () => {
      expect(sanitizeBodyHtml('<p>Hi {{user_name}}</p>')).toContain(
        '{{user_name}}',
      );
    });
  });

  describe('htmlToText', () => {
    it('produces readable text from html', () => {
      const text = htmlToText('<p>Hello <strong>world</strong></p>');
      expect(text).toContain('Hello');
      expect(text).toContain('world');
      expect(text).not.toContain('<');
    });
  });
});
