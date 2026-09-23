import sanitizeHtml from 'sanitize-html';

/**
 * RVSK-NOTIFY-EMAIL-003 — safe template rendering, validation and sanitization.
 *
 * - Placeholders use the `{{token}}` syntax.
 * - Unknown/unresolved placeholders are blanked (never leak raw tokens, never throw).
 * - Save-time validation ensures balanced braces and an allowed token set.
 * - Body HTML is sanitized with an allow-list to prevent stored XSS.
 */

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Render a template string, replacing {{token}} with context values (blank if missing). */
export function renderTemplate(
  template: string | null | undefined,
  context: Record<string, unknown>,
): string {
  if (!template) {
    return '';
  }
  return template.replace(TOKEN_RE, (_m, token: string) => {
    const val = context[token];
    if (val === undefined || val === null) {
      return '';
    }
    return String(val);
  });
}

/** Extract the distinct token names referenced by a template. */
export function extractTokens(template: string | null | undefined): string[] {
  if (!template) {
    return [];
  }
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, 'g');
  while ((m = re.exec(template)) !== null) {
    found.add(m[1]);
  }
  return [...found];
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a subject/body template: braces balanced and only allowed tokens used.
 * `allowedTokens` is the per-event allow-list (plus always-available brand tokens).
 */
export function validateTemplate(
  template: string,
  allowedTokens: string[],
): TemplateValidationResult {
  const errors: string[] = [];

  const opens = (template.match(/\{\{/g) || []).length;
  const closes = (template.match(/\}\}/g) || []).length;
  if (opens !== closes) {
    errors.push('Unbalanced placeholder braces ({{ }}).');
  }

  // Always-available tokens supplied by the layout/brand at render time.
  const always = ['brand_name', 'support_email', 'portal_url'];
  const allowed = new Set([...allowedTokens, ...always]);

  for (const token of extractTokens(template)) {
    if (!allowed.has(token)) {
      errors.push(`Unknown placeholder: {{${token}}}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Sanitize body HTML with a conservative allow-list (blocks scripts/handlers). */
export function sanitizeBodyHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
      'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
      'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'blockquote',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel', 'style'],
      span: ['style'],
      div: ['style'],
      p: ['style'],
      td: ['style', 'align', 'valign', 'colspan', 'rowspan'],
      th: ['style', 'align', 'valign', 'colspan', 'rowspan'],
      table: ['style', 'width', 'cellpadding', 'cellspacing', 'border'],
      tr: ['style'],
      h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'],
    },
    // Keep placeholder braces intact; only http(s)/mailto links allowed.
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
  });
}

/** Derive a readable plain-text alternative from rendered HTML. */
export function htmlToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
