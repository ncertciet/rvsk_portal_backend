import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles, CurrentUser, AuthenticatedUser, Public } from '@rvsk/common';

import { EventsService } from './events.service';
import { VskEvent } from './entities/vsk-event.entity';
import { VskEventImage } from './entities/vsk-event-image.entity';
import { CreateEventDto, UpdateEventDto, UpdateImageCaptionDto } from './dto/event.dto';

const ADMIN_ROLES = ['Super_Admin', 'RVSK_Admin'] as const;

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC (portal gallery) — must precede ':id' routes
  // ═══════════════════════════════════════════════════════════════

  @Public()
  @Get('public')
  async listPublished(): Promise<VskEvent[]> {
    return this.eventsService.listPublished();
  }

  @Public()
  @Get('public/:id')
  async getPublished(@Param('id') id: string): Promise<VskEvent> {
    return this.eventsService.getPublishedById(id);
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN (RVSK/Super Admin)
  // ═══════════════════════════════════════════════════════════════

  @Roles(...ADMIN_ROLES)
  @Get()
  async listAll(): Promise<VskEvent[]> {
    return this.eventsService.listAll();
  }

  @Roles(...ADMIN_ROLES)
  @Get(':id')
  async getOne(@Param('id') id: string): Promise<VskEvent> {
    return this.eventsService.getById(id);
  }

  @Roles(...ADMIN_ROLES)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VskEvent> {
    return this.eventsService.create(dto, user.userId);
  }

  @Roles(...ADMIN_ROLES)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<VskEvent> {
    return this.eventsService.update(id, dto, user.userId);
  }

  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.eventsService.remove(id);
    return { success: true };
  }

  // ─── Images ─────────────────────────────────────────────────────────────

  @Roles(...ADMIN_ROLES)
  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file'))
  async addImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption: string,
  ): Promise<VskEventImage> {
    return this.eventsService.addImage(id, file, caption);
  }

  @Roles(...ADMIN_ROLES)
  @Put('images/:imageId/caption')
  async updateImageCaption(
    @Param('imageId') imageId: string,
    @Body() dto: UpdateImageCaptionDto,
  ): Promise<VskEventImage> {
    return this.eventsService.updateImageCaption(imageId, dto.caption);
  }

  @Roles(...ADMIN_ROLES)
  @Delete('images/:imageId')
  async removeImage(@Param('imageId') imageId: string): Promise<{ success: boolean }> {
    await this.eventsService.removeImage(imageId);
    return { success: true };
  }

  @Roles(...ADMIN_ROLES)
  @Put(':id/cover/:imageId')
  async setCover(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ): Promise<VskEvent> {
    return this.eventsService.setCoverImage(id, imageId);
  }

  // ─── Publish workflow ─────────────────────────────────────────────────────

  @Roles(...ADMIN_ROLES)
  @Put(':id/publish')
  async publish(@Param('id') id: string): Promise<VskEvent> {
    return this.eventsService.setPublished(id, true);
  }

  @Roles(...ADMIN_ROLES)
  @Put(':id/unpublish')
  async unpublish(@Param('id') id: string): Promise<VskEvent> {
    return this.eventsService.setPublished(id, false);
  }
}
