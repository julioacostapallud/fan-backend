import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { StatisticsService } from './statistics.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StatisticsService', () => {
  let service: StatisticsService;
  let prisma: {
    sale: { findMany: jest.Mock };
    saleItem: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      sale: { findMany: jest.fn() },
      saleItem: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(StatisticsService);
  });

  it('calcula resumen general', async () => {
    prisma.sale.findMany.mockResolvedValue([
      {
        id: 's1',
        total: new Decimal('10000'),
        subtotal: new Decimal('10000'),
        generalDiscountAmount: new Decimal('0'),
        items: [{ quantity: 2, discountAmount: new Decimal('0') }],
      },
      {
        id: 's2',
        total: new Decimal('8000'),
        subtotal: new Decimal('9000'),
        generalDiscountAmount: new Decimal('1000'),
        items: [{ quantity: 1, discountAmount: new Decimal('500') }],
      },
    ]);

    const summary = await service.summary();
    expect(summary.salesCount).toBe(2);
    expect(summary.totalUnits).toBe(3);
    expect(summary.totalSold.toString()).toBe('18000');
    expect(summary.totalDiscounts.toString()).toBe('1500');
    expect(summary.averageTicket.toString()).toBe('9000');
  });

  it('agrega estadísticas por producto', async () => {
    prisma.saleItem.findMany.mockResolvedValue([
      {
        productId: 'p1',
        motifId: 'm1',
        quantity: 2,
        lineSubtotal: new Decimal('10000'),
        discountAmount: new Decimal('0'),
        lineTotal: new Decimal('10000'),
        saleId: 's1',
        product: { id: 'p1', name: 'Gorra' },
        motif: { id: 'm1', name: 'Nirvana' },
      },
      {
        productId: 'p1',
        motifId: 'm2',
        quantity: 1,
        lineSubtotal: new Decimal('12000'),
        discountAmount: new Decimal('2000'),
        lineTotal: new Decimal('10000'),
        saleId: 's2',
        product: { id: 'p1', name: 'Gorra' },
        motif: { id: 'm2', name: 'Racing' },
      },
    ]);

    const result = await service.byProducts();
    expect(result).toHaveLength(1);
    expect(result[0].units).toBe(3);
    expect(result[0].salesCount).toBe(2);
    expect(result[0].net.toString()).toBe('20000');
    expect(result[0].motifs).toHaveLength(2);
  });
});
