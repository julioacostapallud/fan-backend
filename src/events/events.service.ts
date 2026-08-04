import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeText, normalizeText } from '../common/utils/normalize';
import { todayIsoDate } from '../common/utils/dates';
import {
  CreateEventDto,
  CreateEventExpenseDto,
  UpdateEventDto,
  UpdateEventExpenseDto,
  UpdateEventProductDto,
  UpsertEventProductDto,
} from './dto/event.dto';

function toDateOnly(iso: string): Date {
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new BadRequestException('Fecha inválida (usar YYYY-MM-DD)');
  }
  return new Date(`${day}T00:00:00.000Z`);
}

function dateOnlyIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const events = await this.prisma.event.findMany({
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        expenses: { select: { amount: true } },
        sales: {
          where: { deletedAt: null },
          select: {
            total: true,
            items: { select: { quantity: true, unitPrice: true, unitCost: true } },
          },
        },
      },
    });

    const today = todayIsoDate();

    return events.map((event) => {
      const start = dateOnlyIso(event.startDate);
      const end = dateOnlyIso(event.endDate);
      const expensesTotal = event.expenses.reduce(
        (acc, e) => acc.plus(e.amount),
        new Prisma.Decimal(0),
      );
      let revenue = new Prisma.Decimal(0);
      let contribution = new Prisma.Decimal(0);
      for (const sale of event.sales) {
        revenue = revenue.plus(sale.total);
        for (const item of sale.items) {
          const unitMargin = item.unitPrice.minus(item.unitCost);
          contribution = contribution.plus(unitMargin.mul(item.quantity));
        }
      }
      const realProfit = contribution.minus(expensesTotal);

      return {
        id: event.id,
        name: event.name,
        startDate: start,
        endDate: end,
        isCurrent: today >= start && today <= end,
        expensesTotal: expensesTotal.toDecimalPlaces(2),
        revenue: revenue.toDecimalPlaces(2),
        realProfit: realProfit.toDecimalPlaces(2),
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      };
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    const start = dateOnlyIso(event.startDate);
    const end = dateOnlyIso(event.endDate);
    const today = todayIsoDate();
    return {
      id: event.id,
      name: event.name,
      startDate: start,
      endDate: end,
      isCurrent: today >= start && today <= end,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  async create(dto: CreateEventDto) {
    this.assertDateRange(dto.startDate, dto.endDate);
    const event = await this.prisma.event.create({
      data: {
        name: sanitizeText(dto.name, 200),
        startDate: toDateOnly(dto.startDate),
        endDate: toDateOnly(dto.endDate),
      },
    });
    return this.findOne(event.id);
  }

  async update(id: string, dto: UpdateEventDto) {
    await this.findOne(id);
    const startDate = dto.startDate ?? undefined;
    const endDate = dto.endDate ?? undefined;
    if (startDate || endDate) {
      const current = await this.prisma.event.findUniqueOrThrow({ where: { id } });
      const start = startDate ?? dateOnlyIso(current.startDate);
      const end = endDate ?? dateOnlyIso(current.endDate);
      this.assertDateRange(start, end);
    }
    await this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: sanitizeText(dto.name, 200) } : {}),
        ...(startDate ? { startDate: toDateOnly(startDate) } : {}),
        ...(endDate ? { endDate: toDateOnly(endDate) } : {}),
      },
    });
    return this.findOne(id);
  }

  async listExpenses(eventId: string) {
    await this.findOne(eventId);
    const rows = await this.prisma.eventExpense.findMany({
      where: { eventId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => ({
      ...r,
      date: dateOnlyIso(r.date),
    }));
  }

  async createExpense(eventId: string, dto: CreateEventExpenseDto) {
    const event = await this.findOne(eventId);
    const date = dto.date ? toDateOnly(dto.date) : toDateOnly(event.startDate);
    return this.prisma.eventExpense.create({
      data: {
        eventId,
        amount: new Prisma.Decimal(dto.amount),
        description: sanitizeText(dto.description, 200),
        date,
      },
    }).then((r) => ({ ...r, date: dateOnlyIso(r.date) }));
  }

  async updateExpense(
    eventId: string,
    expenseId: string,
    dto: UpdateEventExpenseDto,
  ) {
    await this.getExpense(eventId, expenseId);
    const updated = await this.prisma.eventExpense.update({
      where: { id: expenseId },
      data: {
        ...(dto.amount !== undefined
          ? { amount: new Prisma.Decimal(dto.amount) }
          : {}),
        ...(dto.description !== undefined
          ? { description: sanitizeText(dto.description, 200) }
          : {}),
        ...(dto.date !== undefined ? { date: toDateOnly(dto.date) } : {}),
      },
    });
    return { ...updated, date: dateOnlyIso(updated.date) };
  }

  async deleteExpense(eventId: string, expenseId: string) {
    await this.getExpense(eventId, expenseId);
    await this.prisma.eventExpense.delete({ where: { id: expenseId } });
    return { id: expenseId, deleted: true };
  }

  async listProducts(eventId: string) {
    await this.findOne(eventId);
    return this.prisma.eventProduct.findMany({
      where: { eventId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            isActive: true,
            defaultPrice: true,
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });
  }

  async upsertProduct(eventId: string, dto: UpsertEventProductDto) {
    await this.findOne(eventId);

    let productId = dto.productId;
    if (!productId) {
      if (!dto.name?.trim()) {
        throw new BadRequestException(
          'Indicá productId o name para agregar el producto al evento',
        );
      }
      const name = sanitizeText(dto.name, 120);
      const normalizedName = normalizeText(name);
      const existing = await this.prisma.product.findFirst({
        where: { normalizedName },
      });
      if (existing) {
        productId = existing.id;
        await this.prisma.product.update({
          where: { id: existing.id },
          data: {
            defaultPrice: new Prisma.Decimal(dto.price),
            isActive: true,
          },
        });
      } else {
        const created = await this.prisma.product.create({
          data: {
            name,
            normalizedName,
            defaultPrice: new Prisma.Decimal(dto.price),
          },
        });
        productId = created.id;
      }
    } else {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new NotFoundException('Producto no encontrado');
      await this.prisma.product.update({
        where: { id: productId },
        data: { defaultPrice: new Prisma.Decimal(dto.price) },
      });
    }

    return this.prisma.eventProduct.upsert({
      where: {
        eventId_productId: { eventId, productId },
      },
      create: {
        eventId,
        productId,
        cost: new Prisma.Decimal(dto.cost),
        price: new Prisma.Decimal(dto.price),
      },
      update: {
        cost: new Prisma.Decimal(dto.cost),
        price: new Prisma.Decimal(dto.price),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            isActive: true,
            defaultPrice: true,
          },
        },
      },
    });
  }

  async updateProduct(
    eventId: string,
    eventProductId: string,
    dto: UpdateEventProductDto,
  ) {
    const row = await this.prisma.eventProduct.findFirst({
      where: { id: eventProductId, eventId },
    });
    if (!row) throw new NotFoundException('Producto del evento no encontrado');

    const updated = await this.prisma.eventProduct.update({
      where: { id: eventProductId },
      data: {
        ...(dto.cost !== undefined ? { cost: new Prisma.Decimal(dto.cost) } : {}),
        ...(dto.price !== undefined
          ? { price: new Prisma.Decimal(dto.price) }
          : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            isActive: true,
            defaultPrice: true,
          },
        },
      },
    });

    if (dto.price !== undefined) {
      await this.prisma.product.update({
        where: { id: updated.productId },
        data: { defaultPrice: new Prisma.Decimal(dto.price) },
      });
    }

    return updated;
  }

  /** Productos de otros eventos para importar (último precio/costo por producto). */
  async listImportableProducts(eventId: string) {
    await this.findOne(eventId);
    const already = await this.prisma.eventProduct.findMany({
      where: { eventId },
      select: { productId: true },
    });
    const exclude = new Set(already.map((p) => p.productId));

    const rows = await this.prisma.eventProduct.findMany({
      where: { eventId: { not: eventId } },
      include: {
        product: { select: { id: true, name: true, isActive: true } },
        event: { select: { id: true, name: true, startDate: true } },
      },
      orderBy: [{ event: { startDate: 'desc' } }, { product: { name: 'asc' } }],
    });

    const byProduct = new Map<
      string,
      {
        productId: string;
        productName: string;
        isActive: boolean;
        cost: Prisma.Decimal;
        price: Prisma.Decimal;
        sourceEventId: string;
        sourceEventName: string;
      }
    >();

    for (const row of rows) {
      if (exclude.has(row.productId) || byProduct.has(row.productId)) continue;
      byProduct.set(row.productId, {
        productId: row.productId,
        productName: row.product.name,
        isActive: row.product.isActive,
        cost: row.cost,
        price: row.price,
        sourceEventId: row.event.id,
        sourceEventName: row.event.name,
      });
    }

    return [...byProduct.values()].sort((a, b) =>
      a.productName.localeCompare(b.productName, 'es'),
    );
  }

  private async getExpense(eventId: string, expenseId: string) {
    const row = await this.prisma.eventExpense.findFirst({
      where: { id: expenseId, eventId },
    });
    if (!row) throw new NotFoundException('Gasto no encontrado');
    return row;
  }

  private assertDateRange(startDate: string, endDate: string) {
    const start = startDate.slice(0, 10);
    const end = endDate.slice(0, 10);
    if (start > end) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser posterior a la de fin',
      );
    }
  }
}
