import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':invoiceNumber')
  @ApiOperation({ summary: 'Get invoice details by invoice number' })
  @ApiOkResponse({ description: 'Full invoice for display or printing' })
  @ApiBadRequestResponse({ description: 'Invalid invoice number format' })
  @ApiNotFoundResponse({ description: 'Invoice not found' })
  @ApiParam({ name: 'invoiceNumber', example: 'INV-2026-001' })
  async findByInvoiceNumber(@Param('invoiceNumber') invoiceNumber: string) {
    if (!/^INV-\d{4}-\d+$/.test(invoiceNumber)) {
      throw new BadRequestException('Invalid invoice number format');
    }
    return this.invoicesService.findByInvoiceNumber(invoiceNumber);
  }
}
