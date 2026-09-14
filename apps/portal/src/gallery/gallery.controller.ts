import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { Roles, CurrentUser, AuthenticatedUser, Public } from '@rvsk/common';

import { GalleryService } from './gallery.service';
import { GalleryImage } from './gallery.entity';

@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  /**
   * GET /api/v1/gallery
   * List all active gallery images. State admin sees own state, super admin sees all.
   */
  @Public()
  @Get()
  async listImages(@Query('stateCode') stateCode?: string): Promise<GalleryImage[]> {
    if (stateCode) {
      return this.galleryService.listImages(stateCode);
    }
    return this.galleryService.listAllImages();
  }

  /**
   * GET /api/v1/gallery/images
   * Alias for listing images (frontend compatibility).
   */
  @Public()
  @Get('images')
  async listImagesAlias(@Query('stateCode') stateCode?: string): Promise<GalleryImage[]> {
    if (stateCode) {
      return this.galleryService.listImages(stateCode);
    }
    return this.galleryService.listAllImages();
  }

  /**
   * POST /api/v1/gallery
   * Upload a new image to the gallery (State_Admin for their state).
   */
  @Roles('Super_Admin', 'RVSK_Admin', 'State_Admin')
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption: string,
    @Body('title') title: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GalleryImage> {
    const effectiveCaption = caption || title || '';
    const stateCode = user.stateCode || 'ALL';
    return this.galleryService.uploadImage(file, effectiveCaption, stateCode, user.userId);
  }

  /**
   * POST /api/v1/gallery/upload
   * Upload endpoint (frontend alias).
   */
  @Roles('Super_Admin', 'RVSK_Admin', 'State_Admin')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImageAlias(
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption: string,
    @Body('title') title: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GalleryImage> {
    const effectiveCaption = caption || title || '';
    const stateCode = user.stateCode || 'ALL';
    return this.galleryService.uploadImage(file, effectiveCaption, stateCode, user.userId);
  }

  /**
   * GET /api/v1/gallery/files/:fileName
   * Serve gallery image file.
   */
  @Public()
  @Get('files/:fileName')
  async serveFile(@Param('fileName') fileName: string, @Res() res: Response): Promise<void> {
    // Find by filename in the path
    const images = await this.galleryService.listAllImages();
    const image = images.find(img => img.filePath && img.filePath.includes(fileName));
    if (!image || !fs.existsSync(image.filePath)) {
      res.status(404).json({ message: 'File not found' });
      return;
    }
    res.setHeader('Content-Type', image.fileType || 'application/octet-stream');
    const stream = fs.createReadStream(image.filePath);
    stream.pipe(res);
  }

  /**
   * DELETE /api/v1/gallery/:id
   * Soft-delete a gallery image.
   */
  @Roles('Super_Admin', 'RVSK_Admin', 'State_Admin')
  @Delete(':id')
  async deleteImage(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    await this.galleryService.deleteImage(id);
    return { success: true, message: 'Image deleted successfully' };
  }

  /**
   * DELETE /api/v1/gallery/images/:id
   * Alias for delete.
   */
  @Roles('Super_Admin', 'RVSK_Admin', 'State_Admin')
  @Delete('images/:id')
  async deleteImageAlias(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    await this.galleryService.deleteImage(id);
    return { success: true, message: 'Image deleted successfully' };
  }
}
