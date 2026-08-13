import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateJourneyRouteDto } from './dto/create-journey-route.dto';
import { UpdateJourneyRouteDto } from './dto/update-journey-route.dto';
import { getPaginationParams, paginate } from '../../common/utils';
import { Prisma } from '@prisma/client';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';

@Injectable()
export class JourneyMapsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- PUBLIC API ---

  async findAllPublic() {
    return this.prisma.journeyRoute.findMany({
      orderBy: { createdAt: 'desc' },
      include: { tour: { select: { id: true, slug: true, titleJsonb: true } } },
    });
  }

  async findByTourIdPublic(tourId: string) {
    const route = await this.prisma.journeyRoute.findFirst({
      where: {
        tourId,
        tour: { status: 'PUBLISHED', isActive: true, deletedAt: null },
      },
      include: { tour: { select: { id: true, slug: true, titleJsonb: true } } },
    });

    if (!route) {
      throw new NotFoundException(
        `No journey route found for tour '${tourId}'`,
      );
    }

    return route;
  }

  async findOnePublic(id: string) {
    const route = await this.prisma.journeyRoute.findUnique({
      where: { id },
      include: { tour: { select: { id: true, slug: true, titleJsonb: true } } },
    });

    if (
      !route ||
      !route.tourId ||
      !(await this.prisma.tour.findFirst({
        where: {
          id: route.tourId,
          status: 'PUBLISHED',
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Journey route not found');
    }

    return route;
  }

  // --- ADMIN API ---

  async findAllAdmin(pageVal: number = 1, limitVal: number = 20) {
    const { page, limit, skip } = getPaginationParams(pageVal, limitVal);

    const [total, items] = await Promise.all([
      this.prisma.journeyRoute.count(),
      this.prisma.journeyRoute.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tour: { select: { id: true, slug: true, titleJsonb: true } },
        },
      }),
    ]);

    return paginate(items, total, page, limit);
  }

  async createAdmin(dto: CreateJourneyRouteDto) {
    if (dto.tourId) {
      const tour = await this.prisma.tour.findFirst({
        where: { id: dto.tourId, deletedAt: null },
      });
      if (!tour) {
        throw new NotFoundException(`Tour '${dto.tourId}' not found`);
      }
    }

    return this.prisma.journeyRoute.create({
      data: {
        name: sanitizePlainText(dto.name).slice(0, 255),
        pointsJsonb: this.sanitizePoints(dto.points),
        tourId: dto.tourId || null,
      },
    });
  }

  async updateAdmin(id: string, dto: UpdateJourneyRouteDto) {
    const existing = await this.prisma.journeyRoute.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Journey route not found');

    if (dto.tourId) {
      const tour = await this.prisma.tour.findFirst({
        where: { id: dto.tourId, deletedAt: null },
      });
      if (!tour) {
        throw new NotFoundException(`Tour '${dto.tourId}' not found`);
      }
    }

    return this.prisma.journeyRoute.update({
      where: { id },
      data: {
        ...(dto.name && {
          name: sanitizePlainText(dto.name).slice(0, 255),
        }),
        ...(dto.points && {
          pointsJsonb: this.sanitizePoints(dto.points),
        }),
        ...(dto.tourId !== undefined && { tourId: dto.tourId || null }),
      },
    });
  }

  async deleteAdmin(id: string) {
    const exists = await this.prisma.journeyRoute.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Journey route not found');
    await this.prisma.journeyRoute.delete({ where: { id } });
    return { success: true, message: `Journey route '${id}' deleted.` };
  }

  private sanitizePoints(
    points: CreateJourneyRouteDto['points'],
  ): Prisma.InputJsonValue {
    return points.map((point) => ({
      lat: point.lat,
      lng: point.lng,
      ...(point.label && {
        label: sanitizePlainText(point.label).slice(0, 255),
      }),
      ...(point.description && {
        description: sanitizePlainText(point.description).slice(0, 2000),
      }),
      ...(point.order !== undefined && { order: point.order }),
    })) as Prisma.InputJsonValue;
  }
}
