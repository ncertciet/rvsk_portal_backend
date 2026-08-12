import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpStatus, StreamableFile } from '@nestjs/common';
import { AppException } from '@rvsk/common';
import { GrievanceFileService } from './file.service';
import { GrievanceAttachment } from '../grievance/entities/grievance-attachment.entity';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    createReadStream: jest.fn().mockReturnValue({ pipe: jest.fn(), on: jest.fn() }),
  };
});

describe('GrievanceFileService', () => {
  let service: GrievanceFileService;
  let attachmentRepo: any;

  const mockAttachmentRepo = {
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('./uploads/grievances'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrievanceFileService,
        {
          provide: getRepositoryToken(GrievanceAttachment),
          useValue: mockAttachmentRepo,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GrievanceFileService>(GrievanceFileService);
    attachmentRepo = module.get(getRepositoryToken(GrievanceAttachment));

    jest.clearAllMocks();
  });

  describe('upload', () => {
    const grievanceId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = '660e8400-e29b-41d4-a716-446655440001';

    const validFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'document.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('test content'),
      size: 1024,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    it('should upload a valid file and return attachment record', async () => {
      mockAttachmentRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.upload(grievanceId, validFile, userId);

      expect(result).toBeDefined();
      expect(result.grievanceId).toBe(grievanceId);
      expect(result.originalFileName).toBe('document.pdf');
      expect(result.contentType).toBe('application/pdf');
      expect(result.fileSize).toBe(1024);
      expect(result.uploadedBy).toBe(userId);
      expect(result.id).toBeDefined();
      expect(result.storedPath).toMatch(/uploads[/\\]grievances/);
      expect(result.storedPath).toContain(grievanceId);
      expect(mockAttachmentRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should throw FILE_EMPTY when file is null', async () => {
      await expect(
        service.upload(grievanceId, null as any, userId),
      ).rejects.toThrow(AppException);

      try {
        await service.upload(grievanceId, null as any, userId);
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect((error as AppException).errorCode).toBe('FILE_EMPTY');
      }
    });

    it('should throw FILE_EMPTY when file size is 0', async () => {
      const emptyFile = { ...validFile, size: 0 };

      await expect(
        service.upload(grievanceId, emptyFile, userId),
      ).rejects.toThrow(AppException);

      try {
        await service.upload(grievanceId, emptyFile, userId);
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).errorCode).toBe('FILE_EMPTY');
      }
    });

    it('should throw FILE_TOO_LARGE when file exceeds 5MB', async () => {
      const largeFile = { ...validFile, size: 6 * 1024 * 1024 };

      await expect(
        service.upload(grievanceId, largeFile, userId),
      ).rejects.toThrow(AppException);

      try {
        await service.upload(grievanceId, largeFile, userId);
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).errorCode).toBe('FILE_TOO_LARGE');
      }
    });

    it('should throw FILE_TYPE_NOT_ALLOWED for unsupported mime type', async () => {
      const invalidTypeFile = { ...validFile, mimetype: 'application/zip' };

      await expect(
        service.upload(grievanceId, invalidTypeFile, userId),
      ).rejects.toThrow(AppException);

      try {
        await service.upload(grievanceId, invalidTypeFile, userId);
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).errorCode).toBe('FILE_TYPE_NOT_ALLOWED');
      }
    });

    it('should accept image/jpeg files', async () => {
      const jpegFile = { ...validFile, mimetype: 'image/jpeg', originalname: 'photo.jpg' };
      mockAttachmentRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.upload(grievanceId, jpegFile, userId);
      expect(result.contentType).toBe('image/jpeg');
    });

    it('should accept image/png files', async () => {
      const pngFile = { ...validFile, mimetype: 'image/png', originalname: 'screenshot.png' };
      mockAttachmentRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.upload(grievanceId, pngFile, userId);
      expect(result.contentType).toBe('image/png');
    });

    it('should accept application/msword files', async () => {
      const docFile = { ...validFile, mimetype: 'application/msword', originalname: 'letter.doc' };
      mockAttachmentRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.upload(grievanceId, docFile, userId);
      expect(result.contentType).toBe('application/msword');
    });

    it('should accept DOCX files', async () => {
      const docxFile = {
        ...validFile,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        originalname: 'report.docx',
      };
      mockAttachmentRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.upload(grievanceId, docxFile, userId);
      expect(result.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });

    it('should accept files exactly at 5MB limit', async () => {
      const maxFile = { ...validFile, size: 5 * 1024 * 1024 };
      mockAttachmentRepo.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.upload(grievanceId, maxFile, userId);
      expect(result.fileSize).toBe(5 * 1024 * 1024);
    });
  });

  describe('download', () => {
    it('should return a StreamableFile when attachment exists', async () => {
      const attachment = {
        id: 'file-id-123',
        grievanceId: 'grv-123',
        originalFileName: 'document.pdf',
        storedPath: './uploads/grievances/grv-123/uuid_document.pdf',
        contentType: 'application/pdf',
        fileSize: 1024,
        uploadedBy: 'user-123',
      };

      mockAttachmentRepo.findOne.mockResolvedValue(attachment);

      const result = await service.download('file-id-123');

      expect(result).toBeInstanceOf(StreamableFile);
      expect(mockAttachmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'file-id-123' },
      });
    });

    it('should throw ATTACHMENT_NOT_FOUND when attachment does not exist', async () => {
      mockAttachmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.download('non-existent-id'),
      ).rejects.toThrow(AppException);

      try {
        await service.download('non-existent-id');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect((error as AppException).errorCode).toBe('ATTACHMENT_NOT_FOUND');
      }
    });
  });
});
