import { IsIn, IsOptional } from 'class-validator';

export class AdminReportPeriodQueryDto {
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly', 'yearly'])
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly';
}
