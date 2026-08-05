import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  eachIsoDay,
  parseFromDate,
  parseToDate,
  toBusinessDayIso,
  todayIsoDate,
  yesterdayIsoDate,
} from '../common/utils/dates';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureEvent(eventId: string) {
    if (!eventId?.trim()) {
      throw new BadRequestException('eventId es obligatorio');
    }
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  private dateOnlyIso(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private buildDateFilter(
    eventId: string,
    from?: string,
    to?: string,
  ): Prisma.SaleWhereInput {
    const fromDate = parseFromDate(from);
    const toDate = parseToDate(to);
    const where: Prisma.SaleWhereInput = { deletedAt: null, eventId };
    if (!fromDate && !toDate) return where;
    const createdAt: Prisma.DateTimeFilter = {};
    if (fromDate) createdAt.gte = fromDate;
    if (toDate) createdAt.lte = toDate;
    where.createdAt = createdAt;
    return where;
  }

  /**
   * Días cerrados del evento (desde max(inicio, 1ª venta) hasta min(ayer, fin evento)).
   * Hoy no se incluye: va en la solapa "Hoy".
   */
  async availableDays(eventId: string) {
    const event = await this.ensureEvent(eventId);
    const today = todayIsoDate();
    const eventStart = this.dateOnlyIso(event.startDate);
    const eventEnd = this.dateOnlyIso(event.endDate);

    const first = await this.prisma.sale.findFirst({
      where: { deletedAt: null, eventId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    if (!first) {
      return { days: [] as string[], today, eventStart, eventEnd };
    }

    const firstDay = toBusinessDayIso(first.createdAt);
    const rangeStart = firstDay > eventStart ? firstDay : eventStart;
    const yesterday = yesterdayIsoDate();
    const rangeEnd = yesterday < eventEnd ? yesterday : eventEnd;
    const days =
      rangeStart <= rangeEnd && rangeStart < today
        ? eachIsoDay(rangeStart, rangeEnd).filter((d) => d < today)
        : [];

    return { days, today, eventStart, eventEnd };
  }

  async summary(eventId: string, from?: string, to?: string) {
    await this.ensureEvent(eventId);
    const where = this.buildDateFilter(eventId, from, to);
    const sales = await this.prisma.sale.findMany({
      where,
      select: {
        id: true,
        total: true,
        subtotal: true,
        generalDiscountAmount: true,
        items: {
          select: {
            quantity: true,
            discountAmount: true,
          },
        },
      },
    });

    const salesCount = sales.length;
    let totalSold = new Prisma.Decimal(0);
    let totalUnits = 0;
    let totalDiscounts = new Prisma.Decimal(0);

    for (const sale of sales) {
      totalSold = totalSold.plus(sale.total);
      totalDiscounts = totalDiscounts.plus(sale.generalDiscountAmount);
      for (const item of sale.items) {
        totalUnits += item.quantity;
        totalDiscounts = totalDiscounts.plus(item.discountAmount);
      }
    }

    const averageTicket =
      salesCount > 0
        ? totalSold.div(salesCount).toDecimalPlaces(2)
        : new Prisma.Decimal(0);

    return {
      totalSold,
      salesCount,
      totalUnits,
      averageTicket,
      totalDiscounts,
    };
  }

  async byProducts(eventId: string, from?: string, to?: string) {
    await this.ensureEvent(eventId);
    const where = this.buildDateFilter(eventId, from, to);
    const items = await this.prisma.saleItem.findMany({
      where: { sale: where },
      select: {
        productId: true,
        motifId: true,
        quantity: true,
        lineSubtotal: true,
        discountAmount: true,
        lineTotal: true,
        saleId: true,
        product: { select: { id: true, name: true } },
        motif: { select: { id: true, name: true } },
      },
    });

    type MotifAgg = {
      motifId: string;
      motifName: string;
      units: number;
    };

    type ProductAgg = {
      productId: string;
      productName: string;
      units: number;
      salesCount: Set<string>;
      gross: Prisma.Decimal;
      discounts: Prisma.Decimal;
      net: Prisma.Decimal;
      motifs: Map<string, MotifAgg>;
    };

    const map = new Map<string, ProductAgg>();

    for (const item of items) {
      let agg = map.get(item.productId);
      if (!agg) {
        agg = {
          productId: item.productId,
          productName: item.product.name,
          units: 0,
          salesCount: new Set(),
          gross: new Prisma.Decimal(0),
          discounts: new Prisma.Decimal(0),
          net: new Prisma.Decimal(0),
          motifs: new Map(),
        };
        map.set(item.productId, agg);
      }
      agg.units += item.quantity;
      agg.salesCount.add(item.saleId);
      agg.gross = agg.gross.plus(item.lineSubtotal);
      agg.discounts = agg.discounts.plus(item.discountAmount);
      agg.net = agg.net.plus(item.lineTotal);

      let motifAgg = agg.motifs.get(item.motifId);
      if (!motifAgg) {
        motifAgg = {
          motifId: item.motifId,
          motifName: item.motif.name,
          units: 0,
        };
        agg.motifs.set(item.motifId, motifAgg);
      }
      motifAgg.units += item.quantity;
    }

    return [...map.values()]
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        units: p.units,
        salesCount: p.salesCount.size,
        gross: p.gross,
        discounts: p.discounts,
        net: p.net,
        motifs: [...p.motifs.values()].sort((a, b) =>
          a.motifName.localeCompare(b.motifName, 'es'),
        ),
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName, 'es'));
  }

  async bySellers(eventId: string, from?: string, to?: string) {
    await this.ensureEvent(eventId);
    const where = this.buildDateFilter(eventId, from, to);
    const [users, sales] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { displayName: 'asc' },
        select: { id: true, displayName: true, username: true },
      }),
      this.prisma.sale.findMany({
        where,
        select: {
          userId: true,
          total: true,
          items: { select: { quantity: true } },
        },
      }),
    ]);

    type Agg = { products: number; amount: Prisma.Decimal };
    const map = new Map<string, Agg>();
    for (const sale of sales) {
      let agg = map.get(sale.userId);
      if (!agg) {
        agg = { products: 0, amount: new Prisma.Decimal(0) };
        map.set(sale.userId, agg);
      }
      agg.amount = agg.amount.plus(sale.total);
      for (const item of sale.items) {
        agg.products += item.quantity;
      }
    }

    const sellers = users.map((u) => {
      const agg = map.get(u.id);
      return {
        userId: u.id,
        name: u.displayName || u.username,
        products: agg?.products ?? 0,
        amount: agg?.amount ?? new Prisma.Decimal(0),
      };
    });

    const total = sellers.reduce(
      (acc, s) => ({
        products: acc.products + s.products,
        amount: acc.amount.plus(s.amount),
      }),
      { products: 0, amount: new Prisma.Decimal(0) },
    );

    return { sellers, total };
  }

  async restock(eventId: string) {
    await this.ensureEvent(eventId);
    const items = await this.prisma.saleItem.findMany({
      where: { sale: { deletedAt: null, eventId } },
      select: {
        quantity: true,
        product: { select: { name: true } },
        motif: { select: { name: true } },
      },
    });

    const map = new Map<string, { productName: string; motifName: string; units: number }>();
    for (const item of items) {
      const key = `${item.product.name}||${item.motif.name}`;
      const existing = map.get(key);
      if (existing) {
        existing.units += item.quantity;
      } else {
        map.set(key, {
          productName: item.product.name,
          motifName: item.motif.name,
          units: item.quantity,
        });
      }
    }

    return [...map.values()].sort((a, b) => {
      const byProduct = a.productName.localeCompare(b.productName, 'es');
      if (byProduct !== 0) return byProduct;
      return a.motifName.localeCompare(b.motifName, 'es');
    });
  }

  async byProduct(eventId: string, productId: string, from?: string, to?: string) {
    const all = await this.byProducts(eventId, from, to);
    const found = all.find((p) => p.productId === productId);
    return (
      found ?? {
        productId,
        productName: null,
        units: 0,
        salesCount: 0,
        gross: new Prisma.Decimal(0),
        discounts: new Prisma.Decimal(0),
        net: new Prisma.Decimal(0),
        motifs: [],
      }
    );
  }

  async dailyTotals(eventId: string) {
    const event = await this.ensureEvent(eventId);
    const eventStart = this.dateOnlyIso(event.startDate);
    const eventEnd = this.dateOnlyIso(event.endDate);

    const sales = await this.prisma.sale.findMany({
      where: { deletedAt: null, eventId },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: 'asc' },
    });

    const map = new Map<string, Prisma.Decimal>();
    for (const sale of sales) {
      const day = toBusinessDayIso(sale.createdAt);
      if (day < eventStart || day > eventEnd) continue;
      map.set(day, (map.get(day) ?? new Prisma.Decimal(0)).plus(sale.total));
    }

    const today = todayIsoDate();
    const last = today < eventEnd ? today : eventEnd;

    return {
      days: eachIsoDay(eventStart, last).map((day) => ({
        day,
        amount: map.get(day) ?? new Prisma.Decimal(0),
      })),
      eventStart,
      eventEnd,
    };
  }

  async revenueProgress(eventId: string) {
    await this.ensureEvent(eventId);
    const sales = await this.prisma.sale.findMany({
      where: { deletedAt: null, eventId },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!sales.length) {
      return { points: [] as Array<{ at: Date; amount: Prisma.Decimal; cumulative: Prisma.Decimal }> };
    }

    let cumulative = new Prisma.Decimal(0);
    const points: Array<{ at: Date; amount: Prisma.Decimal; cumulative: Prisma.Decimal }> = [
      {
        at: sales[0].createdAt,
        amount: new Prisma.Decimal(0),
        cumulative: new Prisma.Decimal(0),
      },
    ];

    for (const sale of sales) {
      cumulative = cumulative.plus(sale.total);
      points.push({
        at: sale.createdAt,
        amount: sale.total,
        cumulative,
      });
    }

    return { points };
  }

  async topMotifsByDay(eventId: string, limit = 10) {
    await this.ensureEvent(eventId);
    const take = Math.min(Math.max(Number(limit) || 10, 1), 20);
    const items = await this.prisma.saleItem.findMany({
      where: { sale: { deletedAt: null, eventId } },
      select: {
        quantity: true,
        motif: { select: { name: true } },
        sale: { select: { createdAt: true } },
      },
    });

    const byDay = new Map<string, Map<string, number>>();
    for (const item of items) {
      if (this.isUnrankedMotif(item.motif.name)) continue;
      const day = toBusinessDayIso(item.sale.createdAt);
      let motifs = byDay.get(day);
      if (!motifs) {
        motifs = new Map();
        byDay.set(day, motifs);
      }
      motifs.set(item.motif.name, (motifs.get(item.motif.name) ?? 0) + item.quantity);
    }

    const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a));
    return {
      days: days.map((day) => ({
        day,
        motifs: [...byDay.get(day)!.entries()]
          .map(([motifName, units]) => ({ motifName, units }))
          .sort((a, b) => b.units - a.units || a.motifName.localeCompare(b.motifName, 'es'))
          .slice(0, take),
      })),
    };
  }

  /** "Sin motivo" (y vacíos) no rankean en Top motivos. */
  private isUnrankedMotif(name: string): boolean {
    const n = name.trim().toLowerCase();
    return n === '' || n === '-' || n === '—' || n === 'sin motivo';
  }

  /** Totales económicos del evento para el dashboard General. */
  async eventEconomics(eventId: string) {
    const event = await this.ensureEvent(eventId);
    const [expenses, sales] = await Promise.all([
      this.prisma.eventExpense.findMany({
        where: { eventId },
        select: { amount: true, description: true, date: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.sale.findMany({
        where: { deletedAt: null, eventId },
        select: {
          total: true,
          items: {
            select: { quantity: true, unitPrice: true, unitCost: true },
          },
        },
      }),
    ]);

    let revenue = new Prisma.Decimal(0);
    let contribution = new Prisma.Decimal(0);
    for (const sale of sales) {
      revenue = revenue.plus(sale.total);
      for (const item of sale.items) {
        contribution = contribution.plus(
          item.unitPrice.minus(item.unitCost).mul(item.quantity),
        );
      }
    }
    const expensesTotal = expenses.reduce(
      (acc, e) => acc.plus(e.amount),
      new Prisma.Decimal(0),
    );

    return {
      eventStart: this.dateOnlyIso(event.startDate),
      eventEnd: this.dateOnlyIso(event.endDate),
      expensesTotal: expensesTotal.toDecimalPlaces(2),
      revenue: revenue.toDecimalPlaces(2),
      contribution: contribution.toDecimalPlaces(2),
      realProfit: contribution.minus(expensesTotal).toDecimalPlaces(2),
      expenses: expenses.map((e) => ({
        amount: e.amount,
        description: e.description,
        date: this.dateOnlyIso(e.date),
      })),
    };
  }
}
