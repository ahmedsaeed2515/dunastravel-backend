import { validate } from 'class-validator';
import { PassengerDto } from './dto/passenger.dto';

describe('PassengerDto Validation', () => {
  it('should pass with valid future passport expiry and past date of birth', async () => {
    const dto = new PassengerDto();
    dto.passengerType = 'adult';
    dto.fullName = 'John Doe';
    dto.passportNumber = 'A1234567';
    dto.passportExpiry = '2030-12-31';
    dto.dateOfBirth = '1990-05-15';
    dto.nationality = 'ES';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail when passport expiry is in the past', async () => {
    const dto = new PassengerDto();
    dto.passengerType = 'adult';
    dto.fullName = 'John Doe';
    dto.passportExpiry = '2020-01-01'; // Expired

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'passportExpiry')).toBe(true);
  });

  it('should fail when date of birth is in the future', async () => {
    const dto = new PassengerDto();
    dto.passengerType = 'adult';
    dto.fullName = 'John Doe';
    dto.dateOfBirth = '2099-01-01'; // Future DOB

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'dateOfBirth')).toBe(true);
  });

  it('should fail when date is invalid calendar date like Feb 30', async () => {
    const dto = new PassengerDto();
    dto.passengerType = 'adult';
    dto.fullName = 'John Doe';
    dto.passportExpiry = '2030-02-30'; // Non-existent date

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'passportExpiry')).toBe(true);
  });
});
