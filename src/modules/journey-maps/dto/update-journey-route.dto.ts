import { PartialType } from '@nestjs/swagger';
import { CreateJourneyRouteDto } from './create-journey-route.dto';

export class UpdateJourneyRouteDto extends PartialType(CreateJourneyRouteDto) {}
