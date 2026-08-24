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
});
