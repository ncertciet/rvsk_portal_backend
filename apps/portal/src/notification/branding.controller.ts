import { Controller, Get, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Public } from '@rvsk/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * RVSK-NOTIFY-EMAIL-003 — public logo endpoint for email branding.
 *
 * Emails reference the logo by absolute URL (image clients cannot use auth), so
 * this route is @Public and streams the file from uploads/logo. Set LOGO_URL to
 * `${PUBLIC_BASE_URL}/api/v1/branding/logo`.
 */
@Controller('branding')
export class BrandingController {
  constructor(private readonly configService: ConfigService) {}

  @Public()
  @Get('logo')
  serveLogo(@Res() res: Response): void {
    const dir =
      this.configService.get<string>('LOGO_UPLOAD_PATH') || './uploads/logo';
    // Serve the first image file found in the logo directory.
    const exts = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];
    let file: string | null = null;
    try {
      if (fs.existsSync(dir)) {
        const found = fs
          .readdirSync(dir)
          .find((f) => exts.includes(path.extname(f).toLowerCase()));
        if (found) {
          file = path.join(dir, found);
        }
      }
    } catch {
      file = null;
    }

    if (!file || !fs.existsSync(file)) {
      res.status(404).json({ message: 'Logo not configured' });
      return;
    }

    const ext = path.extname(file).toLowerCase();
    const contentType =
      ext === '.svg'
        ? 'image/svg+xml'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
              ? 'image/gif'
              : 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(file).pipe(res);
  }
}
