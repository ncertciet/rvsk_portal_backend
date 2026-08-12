import { createOracleDataSource } from './oracle.config';
import { ConfigService } from '@nestjs/config';

describe('createOracleDataSource', () => {
  let configService: ConfigService;
  let envMap: Record<string, string>;

  beforeEach(() => {
    envMap = {
      DB_USER: 'testuser',
      DB_PASSWORD: 'testpass',
      DB_CONNECT_STRING: '(description=(address=(host=adb.region.oraclecloud.com)))',
      TNS_ADMIN: '/opt/wallet',
      DB_POOL_SIZE: '10',
      DB_LOGGING: 'false',
      DB_SCHEMA: 'RTIWARI',
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        return envMap[key] ?? defaultValue;
      }),
    } as unknown as ConfigService;
  });

  it('should return oracle type configuration', () => {
    const result = createOracleDataSource(configService);
    expect(result.type).toBe('oracle');
  });

  it('should set synchronize to false always', () => {
    const result = createOracleDataSource(configService);
    expect(result.synchronize).toBe(false);
  });

  it('should use DB_USER and DB_PASSWORD from config', () => {
    const result = createOracleDataSource(configService) as any;
    expect(result.username).toBe('testuser');
    expect(result.password).toBe('testpass');
  });

  it('should set schema from DB_SCHEMA env var', () => {
    const result = createOracleDataSource(configService) as any;
    expect(result.schema).toBe('RTIWARI');
  });

  it('should default schema to RTIWARI when not set', () => {
    delete envMap.DB_SCHEMA;
    const result = createOracleDataSource(configService) as any;
    expect(result.schema).toBe('RTIWARI');
  });

  it('should set configDir from TNS_ADMIN', () => {
    const result = createOracleDataSource(configService) as any;
    expect(result.extra.configDir).toBe('/opt/wallet');
  });

  it('should default pool size to 10', () => {
    const result = createOracleDataSource(configService) as any;
    expect(result.poolSize).toBe(10);
  });

  it('should clamp pool size to minimum 1', () => {
    envMap.DB_POOL_SIZE = '0';
    const result = createOracleDataSource(configService) as any;
    expect(result.poolSize).toBe(1);
  });

  it('should clamp pool size to maximum 50', () => {
    envMap.DB_POOL_SIZE = '100';
    const result = createOracleDataSource(configService) as any;
    expect(result.poolSize).toBe(50);
  });

  it('should default pool size to 10 for non-numeric input', () => {
    envMap.DB_POOL_SIZE = 'abc';
    const result = createOracleDataSource(configService) as any;
    expect(result.poolSize).toBe(10);
  });

  it('should set retryAttempts to 3', () => {
    const result = createOracleDataSource(configService) as any;
    expect(result.retryAttempts).toBe(3);
  });

  it('should set retryDelay to 5000ms', () => {
    const result = createOracleDataSource(configService) as any;
    expect(result.retryDelay).toBe(5000);
  });

  it('should enable logging when DB_LOGGING is "true"', () => {
    envMap.DB_LOGGING = 'true';
    const result = createOracleDataSource(configService) as any;
    expect(result.logging).toBe(true);
  });

  it('should disable logging when DB_LOGGING is not "true"', () => {
    envMap.DB_LOGGING = 'false';
    const result = createOracleDataSource(configService) as any;
    expect(result.logging).toBe(false);
  });

  it('should use connect string from DB_CONNECT_STRING', () => {
    const result = createOracleDataSource(configService) as any;
    expect(result.connectString).toBe(envMap.DB_CONNECT_STRING);
  });
});
