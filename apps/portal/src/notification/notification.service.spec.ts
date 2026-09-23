import { NotificationService } from './notification.service';
import { NotificationConfig } from './entities/notification-config.entity';

/** Minimal in-memory fakes for the repos + services NotificationService uses. */
function makeConfig(over: Partial<NotificationConfig> = {}): NotificationConfig {
  return {
    id: 'cfg1',
    eventCode: 'USER_CREATED',
    eventName: 'User Created',
    description: null,
    emailEnabled: true,
    recipientType: 'USER',
    recipientValue: null,
    cc: null,
    bcc: null,
    subjectTemplate: 'Hi {{user_name}}',
    bodyTemplate: '<p>Welcome {{user_name}}</p>',
    textTemplate: null,
    defaultSubject: 'Default subj',
    defaultBody: '<p>Default body</p>',
    allowedTokens: 'user_name',
    isCustomized: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    setDefaults() {},
  } as NotificationConfig;
}

describe('NotificationService (RVSK-NOTIFY-EMAIL-003)', () => {
  let service: NotificationService;
  let configRepo: any;
  let logRepo: any;
  let layoutRepo: any;
  let emailService: any;
  let savedLogs: any[];
  let cfg: NotificationConfig;

  beforeEach(() => {
    cfg = makeConfig();
    savedLogs = [];
    configRepo = {
      findOne: jest.fn(async () => cfg),
      save: jest.fn(async (c: any) => c),
    };
    logRepo = {
      create: jest.fn((x: any) => x),
      save: jest.fn(async (l: any) => {
        savedLogs.push({ ...l });
        return l;
      }),
      findOne: jest.fn(async () => null),
    };
    layoutRepo = { findOne: jest.fn(async () => null) };
    emailService = {
      send: jest.fn(async () => ({ sent: true, attempts: 1 })),
    };
    const configService = {
      get: jest.fn((k: string, d?: any) => d),
    };
    service = new NotificationService(
      configRepo,
      logRepo,
      layoutRepo,
      emailService,
      configService as any,
    );
  });

  it('sends when enabled + active, logs SENT', async () => {
    await service.notify('USER_CREATED', {
      to: 'a@test',
      referenceId: 'u1',
      data: { user_name: 'Asha' },
    });
    expect(emailService.send).toHaveBeenCalledTimes(1);
    const last = savedLogs[savedLogs.length - 1];
    expect(last.status).toBe('SENT');
  });

  it('is a no-op when email_enabled is false', async () => {
    cfg.emailEnabled = false;
    await service.notify('USER_CREATED', { to: 'a@test', referenceId: 'u1' });
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('is a no-op when is_active is false', async () => {
    cfg.isActive = false;
    await service.notify('USER_CREATED', { to: 'a@test', referenceId: 'u1' });
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('skips when no recipient resolved', async () => {
    await service.notify('USER_CREATED', { to: '', referenceId: 'u1' });
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('dedupes when an identical notification already SENT', async () => {
    logRepo.findOne = jest.fn(async () => ({ id: 'existing', status: 'SENT' }));
    await service.notify('USER_CREATED', { to: 'a@test', referenceId: 'u1' });
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('marks FAILED and never throws when send fails', async () => {
    emailService.send = jest.fn(async () => ({
      sent: false,
      attempts: 3,
      error: 'smtp down',
    }));
    await expect(
      service.notify('USER_CREATED', { to: 'a@test', referenceId: 'u1' }),
    ).resolves.toBeUndefined();
    const last = savedLogs[savedLogs.length - 1];
    expect(last.status).toBe('FAILED');
    expect(last.errorMessage).toContain('smtp down');
  });

  it('testSend ignores email_enabled and marks is_test', async () => {
    cfg.emailEnabled = false;
    const res = await service.testSend('USER_CREATED', 'qa@test');
    expect(res.success).toBe(true);
    expect(emailService.send).toHaveBeenCalledTimes(1);
    const last = savedLogs[savedLogs.length - 1];
    expect(last.isTest).toBe(true);
  });

  it('resetToDefault restores factory subject/body and clears isCustomized', async () => {
    cfg.subjectTemplate = 'custom';
    cfg.bodyTemplate = 'custom body';
    cfg.isCustomized = true;
    const out = await service.resetToDefault('USER_CREATED', 'admin1');
    expect(out?.subjectTemplate).toBe(cfg.defaultSubject);
    expect(out?.bodyTemplate).toBe(cfg.defaultBody);
    expect(out?.isCustomized).toBe(false);
  });

  it('renderPreview returns branded html + subject + text', async () => {
    const p = await service.renderPreview('USER_CREATED');
    expect(p.subject).toContain('Hi');
    expect(p.html).toContain('<table'); // wrapped in branded layout
    expect(p.text.length).toBeGreaterThan(0);
  });
});
