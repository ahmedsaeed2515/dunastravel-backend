import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTourDto } from './update-tour.dto';

describe('UpdateTourDto optimistic concurrency contract', () => {
  it('accepts an ISO updatedAt precondition', async () => {
    const dto = plainToInstance(UpdateTourDto, {
      expectedUpdatedAt: '2026-08-24T10:15:30.000Z',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a malformed updatedAt precondition before a write occurs', async () => {
    const dto = plainToInstance(UpdateTourDto, {
      expectedUpdatedAt: 'not-a-date',
    });

    expect((await validate(dto)).some((error) => error.property === 'expectedUpdatedAt')).toBe(true);
  });

  it('accepts routeMapJsonb when present as object or null without non-whitelisted errors', async () => {
    const dtoObject = plainToInstance(UpdateTourDto, {
      routeMapJsonb: { locations: [{ id: 'loc-1', lat: 30, lng: 31 }] },
    });
    const errorsObject = await validate(dtoObject, { whitelist: true, forbidNonWhitelisted: true });
    expect(errorsObject).toHaveLength(0);

    const dtoNull = plainToInstance(UpdateTourDto, {
      routeMapJsonb: null,
    });
    const errorsNull = await validate(dtoNull, { whitelist: true, forbidNonWhitelisted: true });
    expect(errorsNull).toHaveLength(0);
  });
});
