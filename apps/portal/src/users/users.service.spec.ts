import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { AppException } from '@rvsk/common';
import { UsersService } from './users.service';
import { PortalUser } from '../auth/entities/portal-user.entity';
import { MasterDataService } from '../master-data/master-data.service';
import { NotificationService } from '../notification/notification.service';
import { CreateUserDto } from './dto/create-user.dto';

/**
 * Unit tests for UsersService (RVSK-USR-MGMT-001.1/.2/.4/.7/.8).
 * Focus: role-based create authority, role-conditional geo validation, chain
 * consistency, name snapshotting, and non-geo null enforcement.
 */
describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let master: {
    findState: jest.Mock;
    findDistrict: jest.Mock;
    findBlock: jest.Mock;
  };
  // Rows returned by the contact-email uniqueness query builder.
  let contactEmailMatches: Array<{ id: string }>;

  const baseDto = (over: Partial<CreateUserDto> = {}): CreateUserDto => ({
    username: 'newuser',
    displayName: 'New User',
    role: 'Viewer',
    contactEmail: 'contact@example.gov.in',
    ...over,
  });

  beforeEach(async () => {
    contactEmailMatches = []; // no contact-email clash by default
    repo = {
      findOne: jest.fn().mockResolvedValue(null), // username unique by default
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((e) => e),
      save: jest.fn().mockImplementation((e) => Promise.resolve({ ...e, id: e.id })),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(contactEmailMatches),
      })),
    };
    master = {
      findState: jest.fn(),
      findDistrict: jest.fn(),
      findBlock: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(PortalUser), useValue: repo },
        { provide: ConfigService, useValue: { get: () => 10 } },
        { provide: MasterDataService, useValue: master },
        {
          provide: NotificationService,
          useValue: { notify: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  const expectAppException = async (p: Promise<unknown>, status: HttpStatus, code?: string) => {
    await expect(p).rejects.toBeInstanceOf(AppException);
    try {
      await p;
    } catch (e) {
      const err = e as AppException;
      expect(err.httpStatus).toBe(status);
      if (code) expect(err.errorCode).toBe(code);
    }
  };

  // ── Requirement .1: role-based create authority ──
  describe('create authority', () => {
    it('lets Super_Admin create a Super_Admin', async () => {
      const res = await service.createUser(baseDto({ role: 'Super_Admin' }), 'admin', 'Super_Admin');
      expect(res.success).toBe(true);
      expect(repo.save).toHaveBeenCalled();
    });

    it('rejects RVSK_Admin creating a Super_Admin with 403', async () => {
      await expectAppException(
        service.createUser(baseDto({ role: 'Super_Admin' }), 'admin', 'RVSK_Admin'),
        HttpStatus.FORBIDDEN,
        'CREATE_ROLE_FORBIDDEN',
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('lets RVSK_Admin create a non-Super_Admin role', async () => {
      const res = await service.createUser(baseDto({ role: 'Viewer' }), 'admin', 'RVSK_Admin');
      expect(res.success).toBe(true);
    });

    it('rejects an unknown role with 400', async () => {
      await expectAppException(
        service.createUser(baseDto({ role: 'Wizard' }), 'admin', 'Super_Admin'),
        HttpStatus.BAD_REQUEST,
        'INVALID_ROLE',
      );
    });
  });

  // ── Requirement .2/.8: role-conditional geo + chain ──
  describe('geo validation', () => {
    it('persists null scope for a non-geo role and rejects stray keys', async () => {
      await service.createUser(baseDto({ role: 'Viewer' }), 'admin', 'Super_Admin');
      const saved = repo.create.mock.calls[0][0];
      expect(saved.stateKey).toBeNull();
      expect(saved.districtKey).toBeNull();
      expect(saved.blockKey).toBeNull();
    });

    it('rejects a non-geo role that carries a stateKey (400)', async () => {
      await expectAppException(
        service.createUser(baseDto({ role: 'Viewer', stateKey: '111' }), 'admin', 'Super_Admin'),
        HttpStatus.BAD_REQUEST,
        'GEO_NOT_ALLOWED',
      );
    });

    it('requires state for State_Admin (400)', async () => {
      await expectAppException(
        service.createUser(baseDto({ role: 'State_Admin' }), 'admin', 'Super_Admin'),
        HttpStatus.BAD_REQUEST,
        'STATE_REQUIRED',
      );
    });

    it('snapshots state name for a valid State_Admin', async () => {
      master.findState.mockResolvedValue({ stateKey: '111', stateName: 'UTTAR PRADESH' });
      await service.createUser(baseDto({ role: 'State_Admin', stateKey: '111' }), 'admin', 'Super_Admin');
      const saved = repo.create.mock.calls[0][0];
      expect(saved.stateKey).toBe('111');
      expect(saved.stateName).toBe('UTTAR PRADESH');
      expect(saved.districtKey).toBeNull();
    });

    it('rejects a State_Admin that also carries a district (400 GEO_TOO_DEEP)', async () => {
      master.findState.mockResolvedValue({ stateKey: '111', stateName: 'UP' });
      await expectAppException(
        service.createUser(baseDto({ role: 'State_Admin', stateKey: '111', districtKey: '999' }), 'admin', 'Super_Admin'),
        HttpStatus.BAD_REQUEST,
        'GEO_TOO_DEEP',
      );
    });

    it('rejects an unknown state (400 INVALID_STATE)', async () => {
      master.findState.mockResolvedValue(null);
      await expectAppException(
        service.createUser(baseDto({ role: 'State_Admin', stateKey: '111' }), 'admin', 'Super_Admin'),
        HttpStatus.BAD_REQUEST,
        'INVALID_STATE',
      );
    });

    it('requires district for District_Admin (400)', async () => {
      master.findState.mockResolvedValue({ stateKey: '111', stateName: 'UP' });
      await expectAppException(
        service.createUser(baseDto({ role: 'District_Admin', stateKey: '111' }), 'admin', 'Super_Admin'),
        HttpStatus.BAD_REQUEST,
        'DISTRICT_REQUIRED',
      );
    });

    it('rejects a district that does not belong to the state (400 CHAIN_MISMATCH)', async () => {
      master.findState.mockResolvedValue({ stateKey: '111', stateName: 'UP' });
      master.findDistrict.mockResolvedValue({ districtKey: '999', districtName: 'MEERUT', stateKey: '222', stateName: 'BIHAR' });
      await expectAppException(
        service.createUser(baseDto({ role: 'District_Admin', stateKey: '111', districtKey: '999' }), 'admin', 'Super_Admin'),
        HttpStatus.BAD_REQUEST,
        'CHAIN_MISMATCH',
      );
    });

    it('persists full chain + names for a valid Block_Admin', async () => {
      master.findState.mockResolvedValue({ stateKey: '111', stateName: 'UP' });
      master.findDistrict.mockResolvedValue({ districtKey: '999', districtName: 'MEERUT', stateKey: '111', stateName: 'UP' });
      master.findBlock.mockResolvedValue({ blockKey: '555', blockName: 'BLOCK A', districtKey: '999', districtName: 'MEERUT', stateKey: '111', stateName: 'UP' });
      await service.createUser(
        baseDto({ role: 'Block_Admin', stateKey: '111', districtKey: '999', blockKey: '555' }),
        'admin',
        'Super_Admin',
      );
      const saved = repo.create.mock.calls[0][0];
      expect(saved.stateKey).toBe('111');
      expect(saved.districtKey).toBe('999');
      expect(saved.blockKey).toBe('555');
      expect(saved.blockName).toBe('BLOCK A');
    });

    it('rejects a block that does not belong to the district (400 CHAIN_MISMATCH)', async () => {
      master.findState.mockResolvedValue({ stateKey: '111', stateName: 'UP' });
      master.findDistrict.mockResolvedValue({ districtKey: '999', districtName: 'MEERUT', stateKey: '111', stateName: 'UP' });
      master.findBlock.mockResolvedValue({ blockKey: '555', blockName: 'B', districtKey: '888', districtName: 'OTHER', stateKey: '111', stateName: 'UP' });
      await expectAppException(
        service.createUser(baseDto({ role: 'Block_Admin', stateKey: '111', districtKey: '999', blockKey: '555' }), 'admin', 'Super_Admin'),
        HttpStatus.BAD_REQUEST,
        'CHAIN_MISMATCH',
      );
    });
  });

  // ── Requirement .4: contact fields persisted ──
  describe('field persistence', () => {
    it('persists contact fields on create', async () => {
      await service.createUser(
        baseDto({ phone: '9876543210', mobileNumber: '9876500000', designation: 'SPOC', userEmail: 'u@x.gov.in' }),
        'admin',
        'Super_Admin',
      );
      const saved = repo.create.mock.calls[0][0];
      expect(saved.phone).toBe('9876543210');
      expect(saved.mobileNumber).toBe('9876500000');
      expect(saved.designation).toBe('SPOC');
      expect(saved.userEmail).toBe('u@x.gov.in');
      expect(saved.contactEmail).toBe('contact@example.gov.in');
      expect(saved.isFirstLogin).toBe(true);
    });

    it('rejects duplicate username with 409', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'existing' }); // username exists
      await expectAppException(
        service.createUser(baseDto(), 'admin', 'Super_Admin'),
        HttpStatus.CONFLICT,
        'USERNAME_EXISTS',
      );
    });

    it('rejects a contact email already used by another user with a clear 409', async () => {
      contactEmailMatches = [{ id: 'someone-else' }]; // email belongs to another user
      await expectAppException(
        service.createUser(baseDto(), 'admin', 'Super_Admin'),
        HttpStatus.CONFLICT,
        'CONTACT_EMAIL_EXISTS',
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('hashes the temp password without error when BCRYPT_STRENGTH is a string (regression)', async () => {
      // ConfigService returns env vars as strings; bcrypt.hash needs a number.
      // Rebuild the service with a string-returning config to reproduce the
      // "Invalid salt" failure that surfaced as a 500 on create.
      const stringConfigModule = await Test.createTestingModule({
        providers: [
          UsersService,
          { provide: getRepositoryToken(PortalUser), useValue: repo },
          { provide: ConfigService, useValue: { get: () => '10' } }, // string!
          { provide: MasterDataService, useValue: master },
          {
            provide: NotificationService,
            useValue: { notify: jest.fn().mockResolvedValue(undefined) },
          },
        ],
      }).compile();
      const svc = stringConfigModule.get(UsersService);

      const res = await svc.createUser(baseDto(), 'admin', 'Super_Admin');
      expect(res.success).toBe(true);
      expect(res.tempPassword).toMatch(/^Rvsk@\d{4}$/);
    });
  });

  // ── Requirement .8: list scope enforcement ──
  describe('listUsers scope', () => {
    it('forces stateKey filter for State_Admin', async () => {
      await service.listUsers('State_Admin', '111');
      expect(repo.find).toHaveBeenCalledWith({ where: { stateKey: '111' } });
    });

    it('applies optional stateKey filter for Super_Admin', async () => {
      await service.listUsers('Super_Admin', null, undefined, '222');
      expect(repo.find).toHaveBeenCalledWith({ where: { stateKey: '222' } });
    });

    it('no state filter for Super_Admin without stateKey', async () => {
      await service.listUsers('Super_Admin', null);
      expect(repo.find).toHaveBeenCalledWith({ where: {} });
    });
  });
});
