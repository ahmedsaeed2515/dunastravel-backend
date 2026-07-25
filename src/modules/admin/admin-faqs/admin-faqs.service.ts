import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminFaqsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.faqItem.findMany();
  }
}
