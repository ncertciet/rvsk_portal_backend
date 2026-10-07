import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { VskInfraDto } from './vsk-infra.dto';

describe('VskInfraDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = { type: 'body' as const, metatype: VskInfraDto };
  const numericFields = [
    'roomLength',
    'roomWidth',
    'roomHeight',
    'screenLength',
    'screenHeight',
    'workstationCount',
  ];

  it.each(numericFields)('converts numeric strings for %s', async (field) => {
    const dto = await pipe.transform({ [field]: ' 12.5 ' }, metadata);

    expect(dto).toBeInstanceOf(VskInfraDto);
    expect(dto[field]).toBe(12.5);
  });

  it.each(numericFields)('preserves numbers and null for %s', async (field) => {
    for (const value of [0, 12.5, null]) {
      const dto = await pipe.transform({ [field]: value }, metadata);
      expect(dto[field]).toBe(value);
    }
  });

  it('accepts omitted numeric fields', async () => {
    const dto = await pipe.transform({}, metadata);

    for (const field of numericFields) {
      expect(dto[field]).toBeUndefined();
    }
  });

  it.each(numericFields)('rejects invalid numeric values for %s', async (field) => {
    for (const value of ['', ' ', 'invalid', '12ft', 'Infinity', 'NaN', true, [], {}, Infinity, NaN]) {
      await expect(pipe.transform({ [field]: value }, metadata))
        .rejects.toBeInstanceOf(BadRequestException);
    }
  });
});