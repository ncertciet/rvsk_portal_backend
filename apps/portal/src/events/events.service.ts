import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppException } from '@rvsk/common';

import { VskEvent } from './entities/vsk-event.entity';
import { VskEventImage } from './entities/vsk-event-image.entity';
import { FileStorageService } from '../storage/file-storage.service';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(VskEvent)
    private readonly eventRepo: Repository<VskEvent>,
    @InjectRepository(VskEventImage)
    private readonly imageRepo: Repository<VskEventImage>,
    private readonly fileStorage: FileStorageService,
  ) {}

  // ─── Admin: CRUD ──────────────────────────────────────────────────────────

  async listAll(): Promise<VskEvent[]> {
    return this.eventRepo.find({
      where: { isActive: true },
      relations: ['images'],
      order: { startDate: 'DESC' },
    });
  }

  async getById(id: string): Promise<VskEvent> {
    const event = await this.eventRepo.findOne({
      where: { id, isActive: true },
      relations: ['images'],
    });
    if (!event) {
      throw new AppException('Event not found', HttpStatus.NOT_FOUND, 'EVENT_NOT_FOUND');
    }
    // Only active images, ordered.
    event.images = (event.images || [])
      .filter((i) => i.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    return event;
  }

  async create(dto: CreateEventDto, userId: string): Promise<VskEvent> {
    this.validateDates(dto.startDate, dto.endDate);
    const event = this.eventRepo.create({
      id: uuidv4(),
      name: dto.name,
      description: dto.description,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      isPublished: false,
      isActive: true,
      createdBy: userId,
    });
    const saved = await this.eventRepo.save(event);
    this.logger.log(`Event created: ${saved.name} (${saved.id})`);
    return this.getById(saved.id);
  }

  async update(id: string, dto: UpdateEventDto, userId: string): Promise<VskEvent> {
    const event = await this.getById(id);
    const nextStart = dto.startDate ?? event.startDate;
    const nextEnd = dto.endDate !== undefined ? dto.endDate : event.endDate;
    this.validateDates(nextStart, nextEnd ?? undefined);

    // Targeted column update (avoid persisting the loaded `images` relation).
    const patch: Partial<VskEvent> = { updatedBy: userId };
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.startDate !== undefined) patch.startDate = dto.startDate;
    if (dto.endDate !== undefined) patch.endDate = dto.endDate ?? null;
    await this.eventRepo.update(id, patch);
    return this.getById(id);
  }

  async remove(id: string): Promise<void> {
    await this.eventRepo.update(id, { isActive: false, isPublished: false });
    this.logger.log(`Event soft-deleted: ${id}`);
  }

  // ─── Admin: images ──────────────────────────────────────────────────────────

  async addImage(
    eventId: string,
    file: Express.Multer.File,
    caption: string | undefined,
  ): Promise<VskEventImage> {
    const event = await this.getById(eventId);
    const stored = await this.fileStorage.saveImage(file, ['events', event.id]);

    const maxOrder = event.images.reduce((m, i) => Math.max(m, i.displayOrder), -1);
    const image = this.imageRepo.create({
      id: uuidv4(),
      eventId: event.id,
      imageUrl: stored.url,
      filePath: stored.relativePath,
      caption: caption || null,
      displayOrder: maxOrder + 1,
      isActive: true,
    });
    const saved = await this.imageRepo.save(image);

    // First image added becomes the default cover. Use a targeted column
    // update — saving the whole event entity (which has `images` eagerly in
    // memory) makes TypeORM try to persist the OneToMany relation and null out
    // event_id on the child rows.
    if (!event.coverImageId) {
      await this.eventRepo.update(event.id, { coverImageId: saved.id });
    }
    return saved;
  }

  async updateImageCaption(imageId: string, caption: string | undefined): Promise<VskEventImage> {
    const image = await this.imageRepo.findOne({ where: { id: imageId, isActive: true } });
    if (!image) {
      throw new AppException('Event image not found', HttpStatus.NOT_FOUND, 'EVENT_IMAGE_NOT_FOUND');
    }
    image.caption = caption || null;
    return this.imageRepo.save(image);
  }

  async removeImage(imageId: string): Promise<void> {
    const image = await this.imageRepo.findOne({ where: { id: imageId } });
    if (!image) {
      throw new AppException('Event image not found', HttpStatus.NOT_FOUND, 'EVENT_IMAGE_NOT_FOUND');
    }
    image.isActive = false;
    await this.imageRepo.save(image);
    if (image.filePath) {
      await this.fileStorage.deleteRelative(image.filePath);
    }
    // If this was the cover, pick another active image (or clear it).
    const event = await this.eventRepo.findOne({ where: { id: image.eventId }, relations: ['images'] });
    if (event && event.coverImageId === imageId) {
      const nextCover = (event.images || []).find((i) => i.isActive && i.id !== imageId);
      await this.eventRepo.update(event.id, { coverImageId: nextCover ? nextCover.id : null });
    }
  }

  async setCoverImage(eventId: string, imageId: string): Promise<VskEvent> {
    const event = await this.getById(eventId);
    const belongs = event.images.some((i) => i.id === imageId && i.isActive);
    if (!belongs) {
      throw new AppException(
        'Image does not belong to this event',
        HttpStatus.BAD_REQUEST,
        'INVALID_COVER_IMAGE',
      );
    }
    await this.eventRepo.update(eventId, { coverImageId: imageId });
    return this.getById(eventId);
  }

  // ─── Admin: publish workflow ────────────────────────────────────────────────

  async setPublished(id: string, publish: boolean): Promise<VskEvent> {
    const event = await this.getById(id);
    if (publish) {
      if (!event.images.length) {
        throw new AppException(
          'Add at least one image before publishing the event.',
          HttpStatus.BAD_REQUEST,
          'NO_IMAGES',
        );
      }
      if (!event.coverImageId) {
        throw new AppException(
          'Select a cover image before publishing the event.',
          HttpStatus.BAD_REQUEST,
          'NO_COVER',
        );
      }
      await this.eventRepo.update(id, { isPublished: true, publishedAt: new Date() });
    } else {
      await this.eventRepo.update(id, { isPublished: false });
    }
    return this.getById(id);
  }

  // ─── Public ──────────────────────────────────────────────────────────────

  async listPublished(): Promise<VskEvent[]> {
    const events = await this.eventRepo.find({
      where: { isPublished: true, isActive: true },
      relations: ['images'],
      order: { startDate: 'DESC' },
    });
    return events.map((e) => {
      e.images = (e.images || []).filter((i) => i.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
      return e;
    });
  }

  async getPublishedById(id: string): Promise<VskEvent> {
    const event = await this.eventRepo.findOne({
      where: { id, isPublished: true, isActive: true },
      relations: ['images'],
    });
    if (!event) {
      throw new AppException('Event not found', HttpStatus.NOT_FOUND, 'EVENT_NOT_FOUND');
    }
    event.images = (event.images || []).filter((i) => i.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
    return event;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private validateDates(startDate: string, endDate?: string | null): void {
    if (endDate && new Date(endDate) < new Date(startDate)) {
      throw new AppException(
        'Event end date cannot be before the start date.',
        HttpStatus.BAD_REQUEST,
        'INVALID_DATE_RANGE',
      );
    }
  }
}
