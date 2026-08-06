import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AgentsService } from './agents.service';
import { CreateAgentDto, UpdateAgentDto, AgentQueryDto } from './dto/agent.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { Request } from 'express';

@ApiTags('Admin - Agents')
@Controller('admin/agents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all agents (role=AGENT users)' })
  @ApiOkResponse({ description: 'Paginated agents list' })
  findAll(@Query() query: AgentQueryDto) {
    return this.agentsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single agent by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.agentsService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new agent account' })
  @ApiCreatedResponse({ description: 'Agent created' })
  async create(
    @Body() dto: CreateAgentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.agentsService.create(dto, actor, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update agent profile or linked company' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.agentsService.update(id, dto, actor, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft delete an agent account' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.agentsService.remove(id, actor, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
}
