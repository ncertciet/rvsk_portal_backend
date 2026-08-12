import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { AppException } from '@rvsk/common';

import { GalleryImage } from './gallery.entity';

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(GalleryImage)
    private readonly galleryRepo: Repository<GalleryImage>,
    private readonly configService: ConfigService,
  ) {
    this.uploadDir = this.configService.get<string>('GALLERY_UPLOAD_PATH', './uploads/gallery');
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * List all active gallery images, optionally filtered by state code.
   */
  async listImages(stateCode?: string): Promise<GalleryImage[]> {
    const where: any = { isActive: true };
    if (stateCode) {
      where.stateCode = stateCode;
    }
    return this.galleryRepo.find({
      where,
      order: { uploadedAt: 'DESC' },
    });
  }

  /**
   * List all active gallery images across all states (for super admin slider).
   */
  async listAllImages(): Promise<GalleryImage[]> {
    return this.galleryRepo.find({
      where: { isActive: true },
      order: { uploadedAt: 'DESC' },
    });
  }

  /**
   * Upload a new image to the gallery.
   * Saves the file to disk and creates a database record.
   */
  async uploadImage(
    file: Express.Multer.File,
    caption: string,
    stateCode: string,
    userId: string,
  ): Promise<GalleryImage> {
    if (!file) {
      throw new AppException(
        'No file provided',
        HttpStatus.BAD_REQUEST,
        'FILE_REQUIRED',
      );
    }

    // Generate unique filename
    const ext = path.extname(file.originalname);
    const storedFilename = `${crypto.randomUUID()}${ext}`;
    const storedPath = path.join(this.uploadDir, storedFilename);

    // Write file to disk
    fs.writeFileSync(storedPath, file.buffer);

    // Create the gallery image record
    const image = new GalleryImage();
    image.id = crypto.randomUUID();
    image.stateCode = stateCode;
    image.fileName = file.originalname;
    image.filePath = storedPath;
    image.caption = caption || null;
    image.fileType = file.mimetype;
    image.fileSize = file.size;
    image.uploadedBy = userId;
    image.isActive = true;

    const saved = await this.galleryRepo.save(image);
    this.logger.log(`Gallery image uploaded: ${saved.fileName} by user ${userId} for state ${stateCode}`);

    return saved;
  }

  /**
   * Soft-delete a gallery image by setting isActive=false.
   */
  async deleteImage(id: string): Promise<void> {
    const image = await this.galleryRepo.findOne({ where: { id } });

    if (!image) {
      throw new AppException(
        'Gallery image not found',
        HttpStatus.NOT_FOUND,
        'IMAGE_NOT_FOUND',
      );
    }

    image.isActive = false;
    await this.galleryRepo.save(image);
    this.logger.log(`Gallery image soft-deleted: ${image.fileName}`);
  }

  /**
   * Get a single gallery image by ID (for file serving).
   */
  async getImage(id: string): Promise<GalleryImage> {
    const image = await this.galleryRepo.findOne({ where: { id } });
    if (!image) {
      throw new AppException(
        'Gallery image not found',
        HttpStatus.NOT_FOUND,
        'IMAGE_NOT_FOUND',
      );
    }
    return image;
  }
}
