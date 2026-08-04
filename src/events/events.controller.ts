import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import {
  CreateEventDto,
  CreateEventExpenseDto,
  UpdateEventDto,
  UpdateEventExpenseDto,
  UpdateEventProductDto,
  UpsertEventProductDto,
} from './dto/event.dto';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar eventos con gastos, recaudación y ganancia real' })
  findAll() {
    return this.eventsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Crear evento' })
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de evento' })
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar evento' })
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Get(':id/expenses')
  @ApiOperation({ summary: 'Listar gastos del evento' })
  listExpenses(@Param('id') id: string) {
    return this.eventsService.listExpenses(id);
  }

  @Post(':id/expenses')
  @ApiOperation({ summary: 'Agregar gasto al evento' })
  createExpense(@Param('id') id: string, @Body() dto: CreateEventExpenseDto) {
    return this.eventsService.createExpense(id, dto);
  }

  @Patch(':id/expenses/:expenseId')
  @ApiOperation({ summary: 'Editar gasto' })
  updateExpense(
    @Param('id') id: string,
    @Param('expenseId') expenseId: string,
    @Body() dto: UpdateEventExpenseDto,
  ) {
    return this.eventsService.updateExpense(id, expenseId, dto);
  }

  @Delete(':id/expenses/:expenseId')
  @ApiOperation({ summary: 'Eliminar gasto' })
  deleteExpense(
    @Param('id') id: string,
    @Param('expenseId') expenseId: string,
  ) {
    return this.eventsService.deleteExpense(id, expenseId);
  }

  @Get(':id/products/importable')
  @ApiOperation({ summary: 'Productos de otros eventos para importar' })
  listImportable(@Param('id') id: string) {
    return this.eventsService.listImportableProducts(id);
  }

  @Get(':id/products')
  @ApiOperation({ summary: 'Productos del evento (costo y precio)' })
  listProducts(@Param('id') id: string) {
    return this.eventsService.listProducts(id);
  }

  @Post(':id/products')
  @ApiOperation({ summary: 'Agregar o importar producto al evento' })
  upsertProduct(@Param('id') id: string, @Body() dto: UpsertEventProductDto) {
    return this.eventsService.upsertProduct(id, dto);
  }

  @Patch(':id/products/:eventProductId')
  @ApiOperation({ summary: 'Actualizar costo/precio del producto en el evento' })
  updateProduct(
    @Param('id') id: string,
    @Param('eventProductId') eventProductId: string,
    @Body() dto: UpdateEventProductDto,
  ) {
    return this.eventsService.updateProduct(id, eventProductId, dto);
  }
}
