import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ReviewQueryDto extends PaginationQueryDto {}

export class AdminReviewQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  tourId?: string;

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: string;
}
