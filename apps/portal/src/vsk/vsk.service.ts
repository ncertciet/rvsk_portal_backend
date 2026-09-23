import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppException } from '@rvsk/common';

import { VskProfile } from './entities/vsk-profile.entity';
import { VskPmuHeader } from './entities/vsk-pmu-header.entity';
import { VskPmuRoleStructure } from './entities/vsk-pmu-role-structure.entity';
import { VskSoftwareHeader } from './entities/vsk-software-header.entity';
import { VskSoftwareItem } from './entities/vsk-software-item.entity';
import { VskInfraHardware } from './entities/vsk-infra-hardware.entity';
import { VskOfficerHistory } from './entities/vsk-officer-history.entity';
import { VskCommitteeMember } from './entities/vsk-committee-member.entity';
import { VskProfileDto } from './dto/vsk-profile.dto';
import { VskPmuDto, PmuRoleDto } from './dto/vsk-pmu.dto';
import { VskSoftwareDto, SoftwareItemDto } from './dto/vsk-software.dto';
import { VskInfraDto } from './dto/vsk-infra.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class VskService {
  constructor(
    @InjectRepository(VskProfile)
    private readonly profileRepo: Repository<VskProfile>,
    @InjectRepository(VskPmuHeader)
    private readonly pmuHeaderRepo: Repository<VskPmuHeader>,
    @InjectRepository(VskPmuRoleStructure)
    private readonly pmuRoleRepo: Repository<VskPmuRoleStructure>,
    @InjectRepository(VskSoftwareHeader)
    private readonly softwareHeaderRepo: Repository<VskSoftwareHeader>,
    @InjectRepository(VskSoftwareItem)
    private readonly softwareItemRepo: Repository<VskSoftwareItem>,
    @InjectRepository(VskInfraHardware)
    private readonly infraRepo: Repository<VskInfraHardware>,
    @InjectRepository(VskOfficerHistory)
    private readonly officerRepo: Repository<VskOfficerHistory>,
    @InjectRepository(VskCommitteeMember)
    private readonly committeeMemberRepo: Repository<VskCommitteeMember>,
    private readonly auditService: AuditService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // PROFILE
  // ═══════════════════════════════════════════════════════════════

  async getProfile(stateCode: string): Promise<VskProfileDto | null> {
    const entity = await this.profileRepo.findOne({ where: { stateCode } });
    if (!entity) return null;
    return this.mapProfileToDto(entity);
  }

  async saveProfile(
    stateCode: string,
    dto: VskProfileDto,
    userId?: string,
    userName?: string,
  ): Promise<VskProfileDto> {
    let entity = await this.profileRepo.findOne({ where: { stateCode } });

    if (entity) {
      // Update existing
      Object.assign(entity, {
        addressLine1: dto.addressLine1 ?? entity.addressLine1,
        addressLine2: dto.addressLine2 ?? entity.addressLine2,
        city: dto.city ?? entity.city,
        pincode: dto.pincode ?? entity.pincode,
        facilitatedBy: dto.facilitatedBy ?? entity.facilitatedBy,
        otherSchemeName: dto.otherSchemeName ?? entity.otherSchemeName,
        step1Status: dto.step1Status ?? entity.step1Status,
        step2Status: dto.step2Status ?? entity.step2Status,
        step3Status: dto.step3Status ?? entity.step3Status,
        step4Status: dto.step4Status ?? entity.step4Status,
        submissionStatus: dto.submissionStatus ?? entity.submissionStatus,
        declarationCertified: dto.declarationCertified ?? entity.declarationCertified,
        updatedBy: userId ?? entity.updatedBy,
      });
      entity = await this.profileRepo.save(entity);
    } else {
      // Create new
      entity = this.profileRepo.create({
        id: uuidv4(),
        stateCode,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        pincode: dto.pincode,
        facilitatedBy: dto.facilitatedBy,
        otherSchemeName: dto.otherSchemeName,
        step1Status: dto.step1Status || 'PENDING',
        step2Status: dto.step2Status || 'PENDING',
        step3Status: dto.step3Status || 'PENDING',
        step4Status: dto.step4Status || 'PENDING',
        submissionStatus: dto.submissionStatus || 'DRAFT',
        declarationCertified: dto.declarationCertified ?? false,
        createdBy: userId,
      });
      entity = await this.profileRepo.save(entity);
    }

    await this.auditService.recordAndLog(
      {
        entityName: 'VSK_PROFILE',
        entityId: entity.id,
        actionType: 'UPDATE',
        userId: userId ?? null,
        userName: userName ?? null,
        userStateCode: stateCode,
        newValues: {
          submissionStatus: entity.submissionStatus,
          city: entity.city,
          pincode: entity.pincode,
        },
      },
      {
        module: 'VSK',
        action: 'UPDATE',
        description: `Updated VSK profile for state ${stateCode}`,
        performedBy: userId ?? null,
        entityId: entity.id,
        stateCode,
      },
    );

    return this.mapProfileToDto(entity);
  }

  // ═══════════════════════════════════════════════════════════════
  // PMU
  // ═══════════════════════════════════════════════════════════════

  async getPmu(stateCode: string): Promise<VskPmuDto | null> {
    const entity = await this.pmuHeaderRepo.findOne({
      where: { stateCode },
      relations: ['roles'],
    });
    if (!entity) return null;
    return this.mapPmuToDto(entity);
  }

  async savePmu(
    stateCode: string,
    dto: VskPmuDto,
    userId?: string,
    userName?: string,
  ): Promise<VskPmuDto> {
    let header = await this.pmuHeaderRepo.findOne({
      where: { stateCode },
      relations: ['roles'],
    });

    if (header) {
      // Update existing header
      header.pmuTeamType = dto.pmuTeamType ?? header.pmuTeamType;
      header.totalTeamMembers = dto.totalTeamMembers ?? header.totalTeamMembers;
      header.updatedBy = userId ?? header.updatedBy;

      // Replace roles: remove old, add new
      if (dto.roles !== undefined) {
        await this.pmuRoleRepo.delete({ headerId: header.id });
        header.roles = (dto.roles || []).map((roleDto) =>
          this.pmuRoleRepo.create({
            id: roleDto.id || uuidv4(),
            headerId: header.id,
            roleName: roleDto.roleName,
            customRoleName: roleDto.customRoleName,
            noOfMembers: roleDto.noOfMembers,
          }),
        );
      }

      header = await this.pmuHeaderRepo.save(header);
    } else {
      // Create new header
      const headerId = uuidv4();
      header = this.pmuHeaderRepo.create({
        id: headerId,
        stateCode,
        pmuTeamType: dto.pmuTeamType,
        totalTeamMembers: dto.totalTeamMembers,
        createdBy: userId,
        roles: (dto.roles || []).map((roleDto) =>
          this.pmuRoleRepo.create({
            id: roleDto.id || uuidv4(),
            headerId,
            roleName: roleDto.roleName,
            customRoleName: roleDto.customRoleName,
            noOfMembers: roleDto.noOfMembers,
          }),
        ),
      });
      header = await this.pmuHeaderRepo.save(header);
    }

    // Reload with relations
    header = await this.pmuHeaderRepo.findOne({
      where: { stateCode },
      relations: ['roles'],
    });
    return this.mapPmuToDto(header);
  }

  // ═══════════════════════════════════════════════════════════════
  // SOFTWARE
  // ═══════════════════════════════════════════════════════════════

  async getSoftware(stateCode: string): Promise<VskSoftwareDto | null> {
    const entity = await this.softwareHeaderRepo.findOne({
      where: { stateCode },
      relations: ['items'],
    });
    if (!entity) return null;
    return this.mapSoftwareToDto(entity);
  }

  async saveSoftware(
    stateCode: string,
    dto: VskSoftwareDto,
    userId?: string,
    userName?: string,
  ): Promise<VskSoftwareDto> {
    let header = await this.softwareHeaderRepo.findOne({
      where: { stateCode },
      relations: ['items'],
    });

    if (header) {
      // Update existing
      header.starterPack = dto.starterPack ?? header.starterPack;
      header.serverType = dto.serverType ?? header.serverType;
      header.updatedBy = userId ?? header.updatedBy;

      // Replace items: remove old, add new
      if (dto.items !== undefined) {
        await this.softwareItemRepo.delete({ headerId: header.id });
        header.items = (dto.items || []).map((itemDto) =>
          this.softwareItemRepo.create({
            id: itemDto.id || uuidv4(),
            headerId: header.id,
            softwareName: itemDto.softwareName,
            customSoftwareName: itemDto.customSoftwareName,
            softwareType: itemDto.softwareType,
          }),
        );
      }

      header = await this.softwareHeaderRepo.save(header);
    } else {
      // Create new
      const headerId = uuidv4();
      header = this.softwareHeaderRepo.create({
        id: headerId,
        stateCode,
        starterPack: dto.starterPack ?? false,
        serverType: dto.serverType,
        createdBy: userId,
        items: (dto.items || []).map((itemDto) =>
          this.softwareItemRepo.create({
            id: itemDto.id || uuidv4(),
            headerId,
            softwareName: itemDto.softwareName,
            customSoftwareName: itemDto.customSoftwareName,
            softwareType: itemDto.softwareType,
          }),
        ),
      });
      header = await this.softwareHeaderRepo.save(header);
    }

    // Reload with relations
    header = await this.softwareHeaderRepo.findOne({
      where: { stateCode },
      relations: ['items'],
    });
    return this.mapSoftwareToDto(header);
  }

  // ═══════════════════════════════════════════════════════════════
  // INFRA
  // ═══════════════════════════════════════════════════════════════

  async getInfra(stateCode: string): Promise<VskInfraDto | null> {
    const entity = await this.infraRepo.findOne({ where: { stateCode } });
    if (!entity) return null;
    return this.mapInfraToDto(entity);
  }

  async saveInfra(
    stateCode: string,
    dto: VskInfraDto,
    userId?: string,
    userName?: string,
  ): Promise<VskInfraDto> {
    let entity = await this.infraRepo.findOne({ where: { stateCode } });

    if (entity) {
      // Update existing
      Object.assign(entity, {
        roomLength: dto.roomLength ?? entity.roomLength,
        roomWidth: dto.roomWidth ?? entity.roomWidth,
        roomHeight: dto.roomHeight ?? entity.roomHeight,
        roomImageUrl: dto.roomImageUrl ?? entity.roomImageUrl,
        screenLength: dto.screenLength ?? entity.screenLength,
        screenHeight: dto.screenHeight ?? entity.screenHeight,
        screenImageUrl: dto.screenImageUrl ?? entity.screenImageUrl,
        workstationCount: dto.workstationCount ?? entity.workstationCount,
        workstationImageUrl: dto.workstationImageUrl ?? entity.workstationImageUrl,
        updatedBy: userId ?? entity.updatedBy,
      });
      entity = await this.infraRepo.save(entity);
    } else {
      // Create new
      entity = this.infraRepo.create({
        id: uuidv4(),
        stateCode,
        roomLength: dto.roomLength,
        roomWidth: dto.roomWidth,
        roomHeight: dto.roomHeight,
        roomImageUrl: dto.roomImageUrl,
        screenLength: dto.screenLength,
        screenHeight: dto.screenHeight,
        screenImageUrl: dto.screenImageUrl,
        workstationCount: dto.workstationCount,
        workstationImageUrl: dto.workstationImageUrl,
        createdBy: userId,
      });
      entity = await this.infraRepo.save(entity);
    }

    return this.mapInfraToDto(entity);
  }

  // ═══════════════════════════════════════════════════════════════
  // OFFICERS
  // ═══════════════════════════════════════════════════════════════

  async getActiveOfficers(stateCode: string): Promise<VskOfficerHistory[]> {
    return this.officerRepo.find({
      where: { stateCode, isActive: true },
      order: { officerRole: 'ASC', startDate: 'DESC' },
    });
  }

  async getOfficerHistory(stateCode: string, role?: string): Promise<VskOfficerHistory[]> {
    const where: Record<string, unknown> = { stateCode };
    if (role) {
      where.officerRole = role;
    }
    return this.officerRepo.find({
      where,
      order: { officerRole: 'ASC', startDate: 'DESC' },
    });
  }

  async createOfficer(stateCode: string, dto: Partial<VskOfficerHistory>, userId: string): Promise<VskOfficerHistory> {
    const entity = this.officerRepo.create({
      id: uuidv4(),
      stateCode,
      officerRole: dto.officerRole,
      name: dto.name,
      designation: dto.designation,
      phone: dto.phone,
      whatsapp: dto.whatsapp,
      email: dto.email,
      startDate: dto.startDate,
      endDate: dto.endDate,
      isActive: dto.isActive ?? true,
      createdBy: userId,
    });
    const saved = await this.officerRepo.save(entity);

    await this.auditService.recordAndLog(
      {
        entityName: 'VSK_OFFICER',
        entityId: saved.id,
        actionType: 'CREATE',
        userId,
        userStateCode: stateCode,
        newValues: { name: saved.name, officerRole: saved.officerRole },
      },
      {
        module: 'VSK',
        action: 'CREATE',
        description: `Added VSK officer "${saved.name}" (${saved.officerRole})`,
        performedBy: userId,
        entityId: saved.id,
        stateCode,
      },
    );

    return saved;
  }

  async appointNewOfficer(stateCode: string, dto: Partial<VskOfficerHistory>, userId: string): Promise<VskOfficerHistory> {
    // Deactivate current active officer for this role
    const currentOfficers = await this.officerRepo.find({
      where: { stateCode, officerRole: dto.officerRole, isActive: true },
    });

    for (const officer of currentOfficers) {
      officer.isActive = false;
      officer.endDate = new Date();
      officer.updatedBy = userId;
      await this.officerRepo.save(officer);
    }

    // Create new active officer
    const entity = this.officerRepo.create({
      id: uuidv4(),
      stateCode,
      officerRole: dto.officerRole,
      name: dto.name,
      designation: dto.designation,
      phone: dto.phone,
      whatsapp: dto.whatsapp,
      email: dto.email,
      startDate: dto.startDate || new Date(),
      isActive: true,
      createdBy: userId,
    });
    const saved = await this.officerRepo.save(entity);

    await this.auditService.recordAndLog(
      {
        entityName: 'VSK_OFFICER',
        entityId: saved.id,
        actionType: 'APPOINT',
        userId,
        userStateCode: stateCode,
        newValues: { name: saved.name, officerRole: saved.officerRole },
      },
      {
        module: 'VSK',
        action: 'APPOINT',
        description: `Appointed "${saved.name}" as ${saved.officerRole}`,
        performedBy: userId,
        entityId: saved.id,
        stateCode,
      },
    );

    return saved;
  }

  async typoCorrection(id: string, dto: Partial<VskOfficerHistory>, userId: string): Promise<VskOfficerHistory> {
    const entity = await this.officerRepo.findOne({ where: { id } });
    if (!entity) {
      throw new AppException('Officer not found', HttpStatus.NOT_FOUND, 'OFFICER_NOT_FOUND');
    }

    // Only allow updating name, designation, phone, whatsapp, email
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.designation !== undefined) entity.designation = dto.designation;
    if (dto.phone !== undefined) entity.phone = dto.phone;
    if (dto.whatsapp !== undefined) entity.whatsapp = dto.whatsapp;
    if (dto.email !== undefined) entity.email = dto.email;
    entity.updatedBy = userId;

    return this.officerRepo.save(entity);
  }

  // ═══════════════════════════════════════════════════════════════
  // COMMITTEE MEMBERS
  // ═══════════════════════════════════════════════════════════════

  async getCommitteeMembers(stateCode: string): Promise<VskCommitteeMember[]> {
    return this.committeeMemberRepo.find({
      where: { stateCode, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async addCommitteeMember(stateCode: string, dto: Partial<VskCommitteeMember>, userId: string): Promise<VskCommitteeMember> {
    const entity = this.committeeMemberRepo.create({
      id: uuidv4(),
      stateCode,
      name: dto.name,
      designation: dto.designation,
      phone: dto.phone,
      whatsapp: dto.whatsapp,
      email: dto.email,
      isActive: true,
      createdBy: userId,
    });
    return this.committeeMemberRepo.save(entity);
  }

  async updateCommitteeMember(id: string, dto: Partial<VskCommitteeMember>, userId: string): Promise<VskCommitteeMember> {
    const entity = await this.committeeMemberRepo.findOne({ where: { id } });
    if (!entity) {
      throw new AppException('Committee member not found', HttpStatus.NOT_FOUND, 'MEMBER_NOT_FOUND');
    }

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.designation !== undefined) entity.designation = dto.designation;
    if (dto.phone !== undefined) entity.phone = dto.phone;
    if (dto.whatsapp !== undefined) entity.whatsapp = dto.whatsapp;
    if (dto.email !== undefined) entity.email = dto.email;
    entity.updatedBy = userId;

    return this.committeeMemberRepo.save(entity);
  }

  async removeCommitteeMember(id: string): Promise<void> {
    const entity = await this.committeeMemberRepo.findOne({ where: { id } });
    if (!entity) {
      throw new AppException('Committee member not found', HttpStatus.NOT_FOUND, 'MEMBER_NOT_FOUND');
    }
    entity.isActive = false;
    await this.committeeMemberRepo.save(entity);
  }

  // ═══════════════════════════════════════════════════════════════
  // FULL DETAILS (all 4 sections combined)
  // ═══════════════════════════════════════════════════════════════

  async getFullDetails(stateCode: string): Promise<{
    profile: VskProfileDto | null;
    pmu: VskPmuDto | null;
    software: VskSoftwareDto | null;
    infra: VskInfraDto | null;
  }> {
    const [profile, pmu, software, infra] = await Promise.all([
      this.getProfile(stateCode),
      this.getPmu(stateCode),
      this.getSoftware(stateCode),
      this.getInfra(stateCode),
    ]);
    return { profile, pmu, software, infra };
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE MAPPERS
  // ═══════════════════════════════════════════════════════════════

  private mapProfileToDto(entity: VskProfile): VskProfileDto {
    return {
      id: entity.id,
      stateCode: entity.stateCode,
      addressLine1: entity.addressLine1,
      addressLine2: entity.addressLine2,
      city: entity.city,
      pincode: entity.pincode,
      facilitatedBy: entity.facilitatedBy,
      otherSchemeName: entity.otherSchemeName,
      step1Status: entity.step1Status,
      step2Status: entity.step2Status,
      step3Status: entity.step3Status,
      step4Status: entity.step4Status,
      submissionStatus: entity.submissionStatus,
      declarationCertified: entity.declarationCertified,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private mapPmuToDto(entity: VskPmuHeader): VskPmuDto {
    const roles: PmuRoleDto[] = (entity.roles || []).map((role) => ({
      id: role.id,
      roleName: role.roleName,
      customRoleName: role.customRoleName,
      noOfMembers: role.noOfMembers,
    }));

    return {
      id: entity.id,
      stateCode: entity.stateCode,
      pmuTeamType: entity.pmuTeamType,
      totalTeamMembers: entity.totalTeamMembers,
      roles,
    };
  }

  private mapSoftwareToDto(entity: VskSoftwareHeader): VskSoftwareDto {
    const items: SoftwareItemDto[] = (entity.items || []).map((item) => ({
      id: item.id,
      softwareName: item.softwareName,
      customSoftwareName: item.customSoftwareName,
      softwareType: item.softwareType,
    }));

    return {
      id: entity.id,
      stateCode: entity.stateCode,
      starterPack: entity.starterPack,
      serverType: entity.serverType,
      items,
    };
  }

  private mapInfraToDto(entity: VskInfraHardware): VskInfraDto {
    return {
      id: entity.id,
      stateCode: entity.stateCode,
      roomLength: entity.roomLength,
      roomWidth: entity.roomWidth,
      roomHeight: entity.roomHeight,
      roomImageUrl: entity.roomImageUrl,
      screenLength: entity.screenLength,
      screenHeight: entity.screenHeight,
      screenImageUrl: entity.screenImageUrl,
      workstationCount: entity.workstationCount,
      workstationImageUrl: entity.workstationImageUrl,
    };
  }
}
