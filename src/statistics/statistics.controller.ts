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
  @ApiQuery({ name: 'eventId', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  sellers(
    @Query('eventId') eventId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statisticsService.bySellers(eventId, from, to);
  }

  @Get('days')
  @ApiOperation({ summary: 'Días de evento cerrados (para solapas de stats)' })
  @ApiQuery({ name: 'eventId', required: true })
  days(@Query('eventId') eventId: string) {
    return this.statisticsService.availableDays(eventId);
  }

  @Get('top-motifs')
  @ApiOperation({ summary: 'Top motivos vendidos por día operativo' })
  @ApiQuery({ name: 'eventId', required: true })
  @ApiQuery({ name: 'limit', required: false })
  topMotifs(
    @Query('eventId') eventId: string,
    @Query('limit') limit?: string,
  ) {
    return this.statisticsService.topMotifsByDay(
      eventId,
      limit ? Number(limit) : 10,
    );
  }

  @Get('daily-totals')
  @ApiOperation({ summary: 'Montos totales por día operativo (gráfico General)' })
  @ApiQuery({ name: 'eventId', required: true })
  dailyTotals(@Query('eventId') eventId: string) {
    return this.statisticsService.dailyTotals(eventId);
  }

  @Get('revenue-progress')
  @ApiOperation({ summary: 'Recaudación acumulada venta a venta (gráfico General)' })
  @ApiQuery({ name: 'eventId', required: true })
  revenueProgress(@Query('eventId') eventId: string) {
    return this.statisticsService.revenueProgress(eventId);
  }

  @Get('economics')
  @ApiOperation({ summary: 'Economía del evento (gastos, contribución, ganancia real)' })
  @ApiQuery({ name: 'eventId', required: true })
  economics(@Query('eventId') eventId: string) {
    return this.statisticsService.eventEconomics(eventId);
  }

  @Get('restock')
  @ApiOperation({ summary: 'Reposición: unidades por producto y motivo' })
  @ApiQuery({ name: 'eventId', required: true })
  restock(@Query('eventId') eventId: string) {
    return this.statisticsService.restock(eventId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumen general de estadísticas' })
  @ApiQuery({ name: 'eventId', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  summary(
    @Query('eventId') eventId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statisticsService.summary(eventId, from, to);
  }

  @Get('products')
  @ApiOperation({ summary: 'Estadísticas por producto y motivo' })
  @ApiQuery({ name: 'eventId', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  byProducts(
    @Query('eventId') eventId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statisticsService.byProducts(eventId, from, to);
  }

  @Get('products/:productId')
  @ApiOperation({ summary: 'Estadísticas de un producto' })
  @ApiQuery({ name: 'eventId', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  byProduct(
    @Param('productId') productId: string,
    @Query('eventId') eventId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statisticsService.byProduct(eventId, productId, from, to);
  }
}
