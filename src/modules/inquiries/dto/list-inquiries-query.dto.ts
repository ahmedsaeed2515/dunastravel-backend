/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'IsCreatedAtEndAfterStart', async: false })
class IsCreatedAtEndAfterStartConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const obj = args.object as any;
    if (!obj.createdAtStart || !value) return true;
    return new Date(value as string) >= new Date(obj.createdAtStart);
  }
  defaultMessage() {
    return 'createdAtEnd must not be before createdAtStart';
  }
}

export class ListInquiriesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number = 10;

  @ApiPropertyOptional({ enum: ['NEWLY_RECEIVED', 'IN_PROGRESS', 'CLOSED'] })
  @IsOptional()
  @IsEnum(['NEWLY_RECEIVED', 'IN_PROGRESS', 'CLOSED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by creation date (start)' })
  @IsOptional()
  @IsDateString()
  createdAtStart?: string;

  @ApiPropertyOptional({ description: 'Filter by creation date (end)' })
  @IsOptional()
  @IsDateString()
  @Validate(IsCreatedAtEndAfterStartConstraint)
  createdAtEnd?: string;
}
