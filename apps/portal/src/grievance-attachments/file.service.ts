import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { StreamableFile, HttpStatus } from '@nestjs/common';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AppException } from '@rvsk/common';
import { GrievanceAttachment } from '../grievance/entities/grievance-attachment.entity';

@Injectable()
export class GrievanceFileService {
  private readonly uploadPath: string;
  private readonly maxFileSize = 5 * 1024 * 1024; // 5 MB
  private readonly allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  constructor(
    @InjectRepository(GrievanceAttachment)
    private readonly attachmentRepo: Repository<GrievanceAttachment>,
    private readonly config: ConfigService,
  ) {
    this.uploadPath = this.config.get<string>(
      'GRIEVANCE_UPLOAD_PATH',
      './uploads/grievances',
    );
  }

  /**
   * Upload a file attachment for a grievance.
   * Validates file size (max 5MB), mime type, and non-empty content.
   * Stores on disk with UUID-prefixed filename and creates DB record.
   */
  async upload(
    grievanceId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<GrievanceAttachment> {
    // Validate file not empty
    if (!file || file.size === 0) {
      throw new AppException(
        'Uploaded file is empty',
        HttpStatus.BAD_REQUEST,
        'FILE_EMPTY',
      );
    }

    // Validate size <= 5MB
    if (file.size > this.maxFileSize) {
      throw new AppException(
        'File size exceeds the maximum allowed limit of 5 MB',
        HttpStatus.BAD_REQUEST,
        'FILE_TOO_LARGE',
      );
    }

    // Validate mime type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new AppException(
        'File type is not allowed. Allowed types: PDF, JPEG, PNG, DOC, DOCX',
        HttpStatus.BAD_REQUEST,
        'FILE_TYPE_NOT_ALLOWED',
      );
    }

    // Store file on disk (use UUID filename to avoid collisions)
    const storedFileName = `${uuidv4()}_${file.originalname}`;
    const storedPath = path.join(
      this.uploadPath,
      grievanceId,
      storedFileName,
    );

    // Ensure directory exists
    await fs.mkdir(path.dirname(storedPath), { recursive: true });
    await fs.writeFile(storedPath, file.buffer);

    // Create attachment record
    const attachment = new GrievanceAttachment();
    attachment.id = uuidv4();
    attachment.grievanceId = grievanceId;
    attachment.originalFileName = file.originalname;
    attachment.storedPath = storedPath;
    attachment.contentType = file.mimetype;
    attachment.fileSize = file.size;
    attachment.uploadedBy = userId;

    return this.attachmentRepo.save(attachment);
  }

  /**
   * Download a file attachment by its ID.
   * Returns a StreamableFile with appropriate content type and disposition headers.
   */
  async download(fileId: string): Promise<StreamableFile> {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: fileId },
    });

    if (!attachment) {
      throw new AppException(
        'Attachment not found',
        HttpStatus.NOT_FOUND,
        'ATTACHMENT_NOT_FOUND',
      );
    }

    const fileStream = createReadStream(attachment.storedPath);
    return new StreamableFile(fileStream, {
      type: attachment.contentType,
      disposition: `attachment; filename="${attachment.originalFileName}"`,
    });
  }
}
