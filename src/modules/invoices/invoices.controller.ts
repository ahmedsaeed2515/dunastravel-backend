import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { ParseInvoiceNumberPipe } from '../../common/pipes';

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
  async findByInvoiceNumber(
    @Param('invoiceNumber', ParseInvoiceNumberPipe) invoiceNumber: string,
  ) {
    return this.invoicesService.findByInvoiceNumber(invoiceNumber);
  }
}
