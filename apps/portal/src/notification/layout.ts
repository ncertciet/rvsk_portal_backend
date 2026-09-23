/**
 * RVSK-NOTIFY-EMAIL-003 — branded email layout builder.
 *
 * Wraps an event's inner body HTML in a professional, email-client-safe shell:
 * table-based, inline CSS, ~600px wide, logo header + footer. Logo is a hosted
 * absolute URL with alt text so blocked images degrade gracefully.
 */

export interface BrandContext {
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  footerHtml: string | null;
  supportEmail: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build the full branded HTML document wrapping the given inner body. */
export function wrapInLayout(
  innerBodyHtml: string,
  headerHtmlOverride: string | null,
  brand: BrandContext,
): string {
  const brandName = escapeHtml(brand.brandName || 'RVSK Portal');
  const color = brand.primaryColor || '#0b5394';

  const header =
    headerHtmlOverride && headerHtmlOverride.trim().length > 0
      ? headerHtmlOverride
      : brand.logoUrl
        ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${brandName}" height="40" style="display:block;border:0;outline:none;text-decoration:none;height:40px;" />`
        : `<span style="font-size:20px;font-weight:bold;color:#ffffff;">${brandName}</span>`;

  const footerInner =
    brand.footerHtml && brand.footerHtml.trim().length > 0
      ? brand.footerHtml
      : 'This is an automated message. Please do not reply.';

  const supportLine = brand.supportEmail
    ? `<div style="margin-top:8px;">Need help? Contact <a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:${color};text-decoration:none;">${escapeHtml(brand.supportEmail)}</a></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${brandName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#222222;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background-color:${color};padding:20px 28px;" align="left">
              ${header}
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-size:15px;line-height:1.55;color:#222222;">
              ${innerBodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:#fafafa;border-top:1px solid #eeeeee;font-size:12px;line-height:1.5;color:#888888;">
              ${footerInner}
              ${supportLine}
            </td>
          </tr>
        </table>
        <div style="font-size:11px;color:#aaaaaa;margin-top:12px;">&copy; ${new Date().getFullYear()} ${brandName}</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
