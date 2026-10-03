import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { AppException } from '@rvsk/common';

/**
 * Result of persisting an uploaded file.
 */
export interface StoredFile {
  /** Absolute path on disk where the file was written. */
  absolutePath: string;
  /** Path relative to the upload base dir (useful for DB storage). */
  relativePath: string;
  /** Public URL (under the API prefix) the frontend can load the file from. */
  url: string;
  /** The generated on-disk file name (random UUID + extension). */
  fileName: string;
  /** The original client file name. */
  originalName: string;
  /** MIME type as reported by the client. */
  mimeType: string;
  /** Size in bytes. */
  size: number;
}

const DEFAULT_ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

/**
 * Centralized file storage for all upload features (VSK infra, gallery, events).
 *
 * All files live under UPLOAD_BASE_PATH (default ./uploads). Each feature gets a
 * sub-folder; files are served statically at `/<API_PREFIX>/uploads/<relative>`
 * (wired in main.ts). Keeping every write behind this service means the switch
 * to object storage later is a single, isolated change.
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly baseDir: string;
  private readonly apiPrefix: string;
  private readonly maxFileSize: number;

  constructor(private readonly configService: ConfigService) {
    this.baseDir = path.resolve(
      this.configService.get<string>('UPLOAD_BASE_PATH', './uploads'),
    );
    this.apiPrefix = (this.configService.get<string>('API_PREFIX', 'api/v1') || 'api/v1')
      .replace(/^\/+|\/+$/g, '');
    this.maxFileSize = Number(
      this.configService.get<string>('MAX_FILE_SIZE', '5242880'),
    );
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Persist an uploaded file under `<baseDir>/<...segments>`.
   *
   * @param file     the Multer file (buffer-backed)
   * @param segments sub-folder path segments under the upload base, e.g.
   *                 ['vsk', 'BR', 'room'] → uploads/vsk/BR/room/<uuid>.jpg
   */
  async saveImage(
    file: Express.Multer.File,
    segments: string[],
    opts: { allowedTypes?: string[] } = {},
  ): Promise<StoredFile> {
    if (!file || !file.buffer) {
      throw new AppException('No file provided', HttpStatus.BAD_REQUEST, 'FILE_REQUIRED');
    }

    const allowed = opts.allowedTypes ?? DEFAULT_ALLOWED_IMAGE_TYPES;
    if (file.mimetype && !allowed.includes(file.mimetype.toLowerCase())) {
      throw new AppException(
        `Unsupported file type: ${file.mimetype}. Allowed: ${allowed.join(', ')}`,
        HttpStatus.BAD_REQUEST,
        'UNSUPPORTED_FILE_TYPE',
      );
    }

    if (file.size > this.maxFileSize) {
      throw new AppException(
        `File too large. Maximum allowed size is ${Math.round(this.maxFileSize / 1024 / 1024)} MB.`,
        HttpStatus.BAD_REQUEST,
        'FILE_TOO_LARGE',
      );
    }

    const safeSegments = segments.map((s) => this.sanitizeSegment(s));
    const targetDir = path.join(this.baseDir, ...safeSegments);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const ext = this.resolveExtension(file);
    const fileName = `${crypto.randomUUID()}${ext}`;
    const absolutePath = path.join(targetDir, fileName);

    await fs.promises.writeFile(absolutePath, file.buffer);

    const relativePath = [...safeSegments, fileName].join('/');
    const url = `/${this.apiPrefix}/uploads/${relativePath}`;

    this.logger.log(`Stored file ${relativePath} (${file.size} bytes)`);

    return {
      absolutePath,
      relativePath,
      url,
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  /**
   * Resolve an absolute path from a stored relative path, guarding against path
   * traversal outside the upload base.
   */
  resolveRelative(relativePath: string): string {
    const resolved = path.resolve(this.baseDir, relativePath);
    if (!resolved.startsWith(this.baseDir)) {
      throw new AppException('Invalid file path', HttpStatus.BAD_REQUEST, 'INVALID_PATH');
    }
    return resolved;
  }

  /**
   * Delete a file by its relative path. Missing files are ignored.
   */
  async deleteRelative(relativePath: string): Promise<void> {
    try {
      const abs = this.resolveRelative(relativePath);
      if (fs.existsSync(abs)) {
        await fs.promises.unlink(abs);
      }
    } catch (err) {
      this.logger.warn(`Failed to delete file ${relativePath}: ${(err as Error).message}`);
    }
  }

  /** Read a stored file into a buffer (used e.g. to embed images into PDFs). */
  readRelative(relativePath: string): Buffer | null {
    try {
      const abs = this.resolveRelative(relativePath);
      if (!fs.existsSync(abs)) return null;
      return fs.readFileSync(abs);
    } catch {
      return null;
    }
  }

  /** Convert a stored public URL back into a relative path under the base dir. */
  urlToRelative(url: string): string | null {
    if (!url) return null;
    const marker = `/${this.apiPrefix}/uploads/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  }

  private sanitizeSegment(segment: string): string {
    const cleaned = String(segment || '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_{2,}/g, '_');
    return cleaned || 'misc';
  }

  private resolveExtension(file: Express.Multer.File): string {
    const fromName = path.extname(file.originalname || '').toLowerCase();
    if (fromName && /^\.[a-z0-9]{2,5}$/.test(fromName)) return fromName;
    // Fall back to mime-based extension
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return map[(file.mimetype || '').toLowerCase()] || '.bin';
  }
}
