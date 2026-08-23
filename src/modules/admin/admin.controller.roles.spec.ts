import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../common/constants/roles.constants';
import { AdminController } from './admin.controller';

describe('AdminController booking role contracts', () => {
  it.each(['listBookings', 'getBookingByReferenceCode', 'updateBookingStatus'])(
    'allows agents to use the scoped %s operation',
    (methodName) => {
      const handler = Object.getOwnPropertyDescriptor(
        AdminController.prototype,
        methodName,
      )?.value as object;
      const roles = Reflect.getMetadata(ROLES_KEY, handler) as UserRole[];

      expect(roles).toContain(UserRole.AGENT);
      expect(roles).toContain(UserRole.ADMIN);
    },
  );

  it('keeps manual booking creation under the controller admin policy', () => {
    const handler = Object.getOwnPropertyDescriptor(
      AdminController.prototype,
      'createManualBooking',
    )?.value as object;
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toBeUndefined();
  });
});
