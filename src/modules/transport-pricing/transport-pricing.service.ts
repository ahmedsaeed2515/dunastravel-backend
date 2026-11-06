import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, TransportPricing } from '@prisma/client';

@Injectable()
export class TransportPricingService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTour(tourId?: string): Promise<TransportPricing[]> {
    return this.prisma.transportPricing.findMany({
      where: { ...(tourId ? { tourId } : {}), isActive: true },
      orderBy: { passengerRange: 'asc' },
    });
  }

  async findByBooking(bookingId: string): Promise<TransportPricing[]> {
    return this.prisma.transportPricing.findMany({
      where: { bookingId, isActive: true },
      orderBy: { passengerRange: 'asc' },
    });
  }

  async findByCategory(category: string): Promise<TransportPricing[]> {
    return this.prisma.transportPricing.findMany({
      where: { category, isActive: true },
      orderBy: { passengerRange: 'asc' },
    });
  }

  async findById(id: string): Promise<TransportPricing | null> {
    return this.prisma.transportPricing.findUnique({
      where: { id },
    });
  }

  async findOne(
    tourId: string,
    category: string,
    passengerRange: string,
  ): Promise<TransportPricing | null> {
    return this.prisma.transportPricing.findFirst({
      where: {
        tourId,
        category,
        passengerRange,
        isActive: true,
      },
    });
  }

  async create(
    dto: {
      tourId?: string;
      bookingId?: string;
      category: string;
      passengerRange: string;
      priceUsd: number;
      currency?: string;
    },
  ): Promise<TransportPricing> {
    return this.prisma.transportPricing.create({
      data: {
        tourId: dto.tourId,
        bookingId: dto.bookingId,
        category: dto.category,
        passengerRange: dto.passengerRange,
        priceUsd: new Prisma.Decimal(dto.priceUsd.toString()),
        currency: dto.currency || 'USD',
        isActive: true,
      },
    });
  }

  async update(
    id: string,
    priceUsd: number,
  ): Promise<TransportPricing> {
    return this.prisma.transportPricing.update({
      where: { id },
      data: {
        priceUsd: new Prisma.Decimal(priceUsd.toString()),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.transportPricing.delete({ where: { id } });
  }

  async toggleActive(id: string, isActive: boolean): Promise<TransportPricing> {
    return this.prisma.transportPricing.update({
      where: { id },
      data: { isActive },
    });
  }

  /** Resolve a tour slug to its UUID, throwing 404 if not found. */
  private async resolveTourId(slug: string): Promise<string> {
    const tour = await this.prisma.tour.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!tour) throw new NotFoundException(`Tour not found: ${slug}`);
    return tour.id;
  }

  /** Get all active transport pricing rows for a tour identified by slug. */
  async findByTourSlug(slug: string): Promise<any[]> {
    const tourId = await this.resolveTourId(slug);
    const rows = await this.prisma.transportPricing.findMany({
      where: { tourId, isActive: true },
      orderBy: [{ category: 'asc' }, { passengerRange: 'asc' }],
    });
    return rows.map(r => ({
      id: r.id,
      transportType: r.category,
      category: r.category,
      passengerRange: r.passengerRange,
      pricePerPerson: Number(r.priceUsd),
      priceUsd: Number(r.priceUsd),
      currency: r.currency || 'USD',
      isActive: r.isActive,
    }));
  }

  /**
   * Upsert all transport pricing rows for a tour (by slug).
   * Deletes all existing rows for the tour first, then inserts fresh ones.
   */
  async upsertByTourSlug(
    slug: string,
    items: { transportType?: string; category?: string; passengerRange: string; pricePerPerson?: number; priceUsd?: number; currency?: string }[],
  ): Promise<any[]> {
    const tourId = await this.resolveTourId(slug);

    // Delete all existing rows for this tour first
    await this.prisma.transportPricing.deleteMany({ where: { tourId } });

    // Create all fresh rows
    if (items.length === 0) return [];

    await this.prisma.transportPricing.createMany({
      data: items
        .filter(i => (i.transportType || i.category)?.trim() && i.passengerRange?.trim())
        .map(item => ({
          tourId,
          category: (item.transportType || item.category || 'Vehicle').trim(),
          passengerRange: item.passengerRange.trim(),
          priceUsd: new Prisma.Decimal((item.pricePerPerson ?? item.priceUsd ?? 0).toString()),
          currency: item.currency || 'USD',
          isActive: true,
        })),
      skipDuplicates: true,
    });

    return this.findByTourSlug(slug);
  }

  /** Delete all transport pricing rows for a tour (by slug). */
  async deleteByTourSlug(slug: string): Promise<void> {
    const tourId = await this.resolveTourId(slug);
    await this.prisma.transportPricing.deleteMany({ where: { tourId } });
  }
}
