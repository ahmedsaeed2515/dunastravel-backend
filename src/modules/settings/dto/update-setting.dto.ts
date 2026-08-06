import { IsBoolean } from 'class-validator';

export class UpdateSettingDto {
  @IsBoolean()
  value!: boolean;
}
