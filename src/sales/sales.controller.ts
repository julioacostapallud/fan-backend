import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@ApiTags('sales')
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar ventas (sin imágenes base64)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.salesService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      from,
      to,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de venta (incluye imágenes si existen)' })
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id, true);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar venta' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Body() dto: CreateSaleDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.salesService.create(dto, idempotencyKey);
  }
}
