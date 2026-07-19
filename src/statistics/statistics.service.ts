import { Injectable } from '@nestjs/common';
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

  private buildDateFilter(from?: string, to?: string): Prisma.SaleWhereInput {
    const fromDate = parseFromDate(from);
    const toDate = parseToDate(to);
    const where: Prisma.SaleWhereInput = { deletedAt: null };
    if (!fromDate && !toDate) return where;
    const createdAt: Prisma.DateTimeFilter = {};
    if (fromDate) createdAt.gte = fromDate;
    if (toDate) createdAt.lte = toDate;
    where.createdAt = createdAt;
    return where;
  }

  /**
   * Días de evento ya cerrados (desde la 1ª venta hasta ayer, día operativo 06→06 AR).
   * Hoy no se incluye: va en la solapa "Hoy".
   */
  async availableDays() {
    const today = todayIsoDate();
    const first = await this.prisma.sale.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    if (!first) {
      return { days: [] as string[], today };
    }

    const firstDay = toBusinessDayIso(first.createdAt);
    const yesterday = yesterdayIsoDate();
    const days = firstDay < today ? eachIsoDay(firstDay, yesterday) : [];

    return { days, today };
  }

  async summary(from?: string, to?: string) {
    const where = this.buildDateFilter(from, to);
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

  async byProducts(from?: string, to?: string) {
    const where = this.buildDateFilter(from, to);
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

  async bySellers(from?: string, to?: string) {
    const where = this.buildDateFilter(from, to);
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

  async restock() {
    const items = await this.prisma.saleItem.findMany({
      where: { sale: { deletedAt: null } },
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

  async byProduct(productId: string, from?: string, to?: string) {
    const all = await this.byProducts(from, to);
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
}
