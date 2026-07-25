import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateJourneyRouteDto } from './dto/create-journey-route.dto';
import { UpdateJourneyRouteDto } from './dto/update-journey-route.dto';
import { getPaginationParams, paginate } from '../../common/utils';
import { Prisma } from '@prisma/client';

@Injectable()
export class JourneyMapsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- PUBLIC API ---

  async findByTourIdPublic(tourId: string) {
    const route = await this.prisma.journeyRoute.findFirst({
      where: { tourId },
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

    if (!route) {
      throw new NotFoundException(`Journey route '${id}' not found`);
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
      const tour = await this.prisma.tour.findUnique({
        where: { id: dto.tourId },
      });
      if (!tour) {
        throw new NotFoundException(`Tour '${dto.tourId}' not found`);
      }
    }

    return this.prisma.journeyRoute.create({
      data: {
        name: dto.name,
        pointsJsonb: dto.points as unknown as Prisma.InputJsonValue,
        tourId: dto.tourId || null,
      },
    });
  }

  async updateAdmin(id: string, dto: UpdateJourneyRouteDto) {
    await this.findOnePublic(id);

    if (dto.tourId) {
      const tour = await this.prisma.tour.findUnique({
        where: { id: dto.tourId },
      });
      if (!tour) {
        throw new NotFoundException(`Tour '${dto.tourId}' not found`);
      }
    }

    return this.prisma.journeyRoute.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.points && {
          pointsJsonb: dto.points as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.tourId !== undefined && { tourId: dto.tourId || null }),
      },
    });
  }

  async deleteAdmin(id: string) {
    await this.findOnePublic(id);
    await this.prisma.journeyRoute.delete({ where: { id } });
    return { success: true, message: `Journey route '${id}' deleted.` };
  }
}
