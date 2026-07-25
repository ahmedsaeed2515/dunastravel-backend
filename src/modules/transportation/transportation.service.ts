import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransportationBookingDto } from './dto/create-transportation-booking.dto';
import { generateReferenceCode } from '../../common/utils';

@Injectable()
export class TransportationService {
  constructor(private readonly prisma: PrismaService) {}

  async createBooking(
    userId: string | null,
    dto: CreateTransportationBookingDto,
  ) {
    const service = await this.prisma.transportationService.findUnique({
      where: { id: dto.serviceId },
    });

    if (!service || !service.isActive) {
      throw new NotFoundException(
        'Transportation service not found or inactive',
      );
    }

    // Example basic pricing: basePrice + (passengers - 1) * 20%
    let totalAmount = Number(service.basePriceUsd);
    if (dto.passengerCount > 1) {
      totalAmount += totalAmount * 0.2 * (dto.passengerCount - 1);
    }

    return this.prisma.transportationBooking.create({
      data: {
        referenceCode: generateReferenceCode('TR'),
        serviceId: service.id,
        userId: userId,
        pickupDate: new Date(dto.pickupDate),
        pickupTime: dto.pickupTime,
        pickupLocation: dto.pickupLocation,
        dropoffLocation: dto.dropoffLocation,
        passengerCount: dto.passengerCount,
        luggageCount: dto.luggageCount || 0,
        flightNumber: dto.flightNumber,
        totalAmountUsd: totalAmount,
        status: 'SUBMITTED',
      },
    });
  }

  async findAllServices() {
    return this.prisma.transportationService.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findUserBookings(userId: string) {
    return this.prisma.transportationBooking.findMany({
      where: { userId },
      include: { service: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
