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

  /**
   * Mark one image as the State's VSK Profile Image. Clears the flag from any
   * other image of the same state first, so exactly one profile image exists
   * per state. The image must belong to the given state.
   */
  async setProfileImage(id: string, stateCode: string): Promise<GalleryImage> {
    const image = await this.galleryRepo.findOne({ where: { id } });
    if (!image || !image.isActive) {
      throw new AppException(
        'Gallery image not found',
        HttpStatus.NOT_FOUND,
        'IMAGE_NOT_FOUND',
      );
    }
    if (stateCode && image.stateCode !== stateCode) {
      throw new AppException(
        'You can only set a profile image for your own state.',
        HttpStatus.FORBIDDEN,
        'STATE_MISMATCH',
      );
    }

    // Clear existing profile flag for this state, then set the new one.
    await this.galleryRepo
      .createQueryBuilder()
      .update(GalleryImage)
      .set({ isProfileImage: false })
      .where('state_code = :stateCode AND is_profile_image = true', {
        stateCode: image.stateCode,
      })
      .execute();

    image.isProfileImage = true;
    const saved = await this.galleryRepo.save(image);
    this.logger.log(`Profile image set for state ${image.stateCode}: ${saved.id}`);
    return saved;
  }

  /**
   * Return the current profile image for a state, or null if none selected.
   */
  async getProfileImage(stateCode: string): Promise<GalleryImage | null> {
    if (!stateCode) return null;
    return this.galleryRepo.findOne({
      where: { stateCode, isProfileImage: true, isActive: true },
    });
  }

  /**
   * Return every state's selected profile image (one per state). Powers the
   * RVSK/Super Admin home "VSK Gallery" slider, which shows one representative
   * image per state.
   */
  async listProfileImages(): Promise<GalleryImage[]> {
    return this.galleryRepo.find({
      where: { isProfileImage: true, isActive: true },
      order: { stateCode: 'ASC' },
    });
  }
}
