import { IsIn, IsOptional } from 'class-validator';

export class LocaleQueryDto {
  @IsOptional()
  @IsIn(['en', 'ar', 'es', 'pt', 'it'])
  locale: string = 'en';
}
