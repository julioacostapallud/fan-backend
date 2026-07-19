import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MotifsService } from './motifs.service';

@ApiTags('motifs')
@Controller('motifs')
export class MotifsController {
  constructor(private readonly motifsService: MotifsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Buscar motivos (prioriza los del producto si hay productId)' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  search(
    @Query('q') q?: string,
    @Query('productId') productId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.motifsService.search(
      q,
      limit ? Number(limit) : 20,
      productId,
    );
  }
}
