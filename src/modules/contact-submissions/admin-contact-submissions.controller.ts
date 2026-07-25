import {
  Controller,
  Get,
  Patch,
  Query,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { UserRole } from '@prisma/client';
import { ContactSubmissionsService } from './contact-submissions.service';
import { ListContactSubmissionsQueryDto } from '../admin/dto/list-contact-submissions-query.dto';
import { UpdateContactSubmissionStatusDto } from '../admin/dto/update-contact-submission-status.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
@ApiForbiddenResponse({ description: 'Forbidden: Requires ADMIN role' })
@Controller('admin/contact-submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminContactSubmissionsController {
  constructor(
    private readonly contactSubmissionsService: ContactSubmissionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all contact submissions with pagination and filtering.',
  })
  @ApiOkResponse({ description: 'Paginated list of contact submissions' })
  async listContactSubmissions(@Query() query: ListContactSubmissionsQueryDto) {
    return this.contactSubmissionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single contact submission by ID.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ description: 'Contact submission detail' })
  @ApiNotFoundResponse({ description: 'Contact submission not found' })
  async getContactSubmissionById(@Param('id') id: string) {
    return this.contactSubmissionsService.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update contact submission status.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateContactSubmissionStatusDto })
  @ApiOkResponse({ description: 'Status updated successfully' })
  async updateContactSubmissionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContactSubmissionStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contactSubmissionsService.updateStatus(id, dto.status, user.id);
  }
}
