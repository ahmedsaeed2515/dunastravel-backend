import { PartialType } from '@nestjs/swagger';
import { AddTourItineraryDto } from './add-tour-itinerary.dto';

export class UpdateTourItineraryDto extends PartialType(AddTourItineraryDto) {}
