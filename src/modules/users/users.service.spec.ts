import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('UsersService', () => {
  let service: UserService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest
              .fn()
              .mockImplementation(async (cb) => cb(prisma)),
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
              findMany: jest.fn(),
            },
            customerActivityLog: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should throw ConflictException if email is duplicated', async () => {
      jest
        .spyOn(prisma.user, 'findFirst')
        .mockResolvedValue({ id: 'existing-id' } as any);

      await expect(
        service.create({
          email: 'test@example.com',
          name: 'John Doe',
          passwordHash: 'hash',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a user if email is unique', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      jest
        .spyOn(prisma.user, 'create')
        .mockResolvedValue({ id: 'new-id', email: 'test@example.com' } as any);

      const result = await service.create({
        email: 'test@example.com',
        name: 'John Doe',
        passwordHash: 'hash',
      });
      expect(result.id).toBe('new-id');
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });

  describe('updateCustomerCrm (VIP assignment & status)', () => {
    it('should update VIP status and log activity', async () => {
      jest
        .spyOn(prisma.user, 'findFirst')
        .mockResolvedValue({ id: 'user-1', isVip: false } as any);
      jest
        .spyOn(prisma.user, 'update')
        .mockResolvedValue({ id: 'user-1', isVip: true } as any);

      await service.updateCustomerCrm('user-1', { isVip: true }, 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({ isVip: true }),
      });
      expect(prisma.customerActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'PROFILE_UPDATED' }),
        }),
      );
    });

    it('should throw NotFoundException if user to update does not exist', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      await expect(
        service.updateCustomerCrm('missing', {}, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findCustomersCrm (filtering and pagination)', () => {
    it('should return paginated and filtered users', async () => {
      jest.spyOn(prisma.user, 'count').mockResolvedValue(1);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([
        {
          id: 'user-1',
          email: 'test@example.com',
          bookings: [],
          _count: { bookings: 0, customerNotes: 0, customerDocuments: 0 },
        },
      ] as any);

      const query = {
        page: 1,
        limit: 10,
        search: 'test',
        isVip: 'true',
        status: 'ACTIVE',
      } as any;
      const result = await service.findCustomersCrm(query, 'admin-1');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
          where: expect.objectContaining({
            role: 'USER',
            isVip: true,
          }),
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('should soft delete user by setting deletedAt', async () => {
      jest
        .spyOn(prisma.user, 'findFirst')
        .mockResolvedValue({ id: 'user-1' } as any);

      await service.softDelete('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { deletedAt: expect.any(Date), status: 'INACTIVE' },
      });
    });

    it('should throw NotFoundException if user missing during soft delete', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      await expect(service.softDelete('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
