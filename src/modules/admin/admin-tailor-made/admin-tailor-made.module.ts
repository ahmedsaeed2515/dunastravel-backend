import { Module } from '@nestjs/common';
import { AdminTailorMadeController } from './admin-tailor-made.controller';
import { AdminTailorMadeService } from './admin-tailor-made.service';
import { CommissionsModule } from '../../commissions/commissions.module';

@Module({
  imports: [CommissionsModule],
  controllers: [AdminTailorMadeController],
  providers: [AdminTailorMadeService],
  exports: [AdminTailorMadeService],
})
export class AdminTailorMadeModule {}
