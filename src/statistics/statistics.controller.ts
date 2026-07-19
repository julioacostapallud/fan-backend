import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';

@ApiTags('statistics')
@ApiBearerAuth()
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('sellers')
  @ApiOperation({ summary: 'Estadísticas de ventas por vendedor' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  sellers(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statisticsService.bySellers(from, to);
  }

  @Get('days')
  @ApiOperation({
    summary: 'Días de evento cerrados (para solapas de stats)',
  })
  days() {
    return this.statisticsService.availableDays();
  }

  @Get('restock')
  @ApiOperation({ summary: 'Reposición: unidades por producto y motivo' })
  restock() {
    return this.statisticsService.restock();
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumen general de estadísticas' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statisticsService.summary(from, to);
  }

  @Get('products')
  @ApiOperation({ summary: 'Estadísticas por producto y motivo' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  byProducts(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statisticsService.byProducts(from, to);
  }

  @Get('products/:productId')
  @ApiOperation({ summary: 'Estadísticas de un producto' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  byProduct(
    @Param('productId') productId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statisticsService.byProduct(productId, from, to);
  }
}
