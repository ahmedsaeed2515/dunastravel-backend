import { Module } from '@nestjs/common';
import { CompanySelfController } from './company-self.controller';
import { CompanySelfService } from './company-self.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CompanySelfController],
  providers: [CompanySelfService],
})
export class CompanySelfModule {}
