import { wrapInLayout, BrandContext } from './layout';

const brand: BrandContext = {
  brandName: 'RVSK Portal',
  logoUrl: 'https://cdn.test/logo.png',
  primaryColor: '#0b5394',
  footerHtml: 'Automated message.',
  supportEmail: 'help@test',
};

describe('wrapInLayout (RVSK-NOTIFY-EMAIL-003)', () => {
  it('wraps inner body and includes the logo with alt text', () => {
    const html = wrapInLayout('<p>Body here</p>', null, brand);
    expect(html).toContain('<p>Body here</p>');
    expect(html).toContain('src="https://cdn.test/logo.png"');
    expect(html).toContain('alt="RVSK Portal"');
  });

  it('falls back to brand text when no logo URL', () => {
    const html = wrapInLayout('<p>x</p>', null, { ...brand, logoUrl: null });
    expect(html).toContain('RVSK Portal');
    expect(html).not.toContain('<img');
  });

  it('renders footer and support line', () => {
    const html = wrapInLayout('<p>x</p>', null, brand);
    expect(html).toContain('Automated message.');
    expect(html).toContain('help@test');
  });

  it('uses table-based structure and inline styles (email-safe)', () => {
    const html = wrapInLayout('<p>x</p>', null, brand);
    expect(html).toContain('<table');
    expect(html).toContain('style=');
    expect(html).not.toContain('<style');
  });

  it('honors a header override when provided', () => {
    const html = wrapInLayout('<p>x</p>', '<span>CUSTOM HEADER</span>', brand);
    expect(html).toContain('CUSTOM HEADER');
  });
});
