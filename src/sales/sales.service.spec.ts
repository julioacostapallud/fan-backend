import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SalesService } from './sales.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SalesService', () => {
  let service: SalesService;
  let prisma: {
    idempotencyRecord: { findUnique: jest.Mock; create: jest.Mock };
    product: { findMany: jest.Mock };
    sale: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };

  const product = {
    id: 'prod-1',
    name: 'Gorra',
    defaultPrice: new Decimal('12000'),
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([product]),
      },
      sale: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: () => 409600 },
        },
      ],
    }).compile();

    service = module.get(SalesService);
  });

  it('exige Idempotency-Key', async () => {
    await expect(
      service.create(
        {
          items: [
            {
              productId: 'prod-1',
              motifName: 'Nirvana',
              quantity: 1,
              discountType: DiscountType.NONE,
              discountValue: 0,
            },
          ],
          generalDiscountType: DiscountType.NONE,
          generalDiscountValue: 0,
        },
        '',
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('devuelve venta existente ante misma clave de idempotencia', async () => {
    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      key: 'abc',
      saleId: 'sale-1',
    });
    const saleDetail = { id: 'sale-1', items: [], total: new Decimal(12000) };
    prisma.sale.findFirst.mockResolvedValue(saleDetail);

    const result = await service.create(
      {
        items: [
          {
            productId: 'prod-1',
            motifName: 'Nirvana',
            quantity: 1,
            discountType: DiscountType.NONE,
            discountValue: 0,
          },
        ],
        generalDiscountType: DiscountType.NONE,
        generalDiscountValue: 0,
      },
      'abc',
      'user-1',
    );

    expect(result).toEqual(saleDetail);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('persiste el precio unitario enviado (no el default)', async () => {
    const createdSale = {
      id: 'sale-new',
      items: [],
      total: new Decimal(9999),
    };

    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<string>) => {
      const tx = {
        idempotencyRecord: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        sale: {
          create: jest.fn().mockResolvedValue({ id: 'sale-new' }),
        },
        motif: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'motif-1', name: 'Nirvana' }),
        },
        productMotif: { upsert: jest.fn() },
        saleItem: {
          create: jest.fn().mockImplementation(({ data }) => {
            expect(data.unitPrice.toString()).toBe('9999');
            return Promise.resolve(data);
          }),
        },
      };
      return fn(tx);
    });

    prisma.sale.findFirst.mockResolvedValue(createdSale);

    await service.create(
      {
        items: [
          {
            productId: 'prod-1',
            motifName: 'Nirvana',
            quantity: 1,
            unitPrice: 9999,
            discountType: DiscountType.NONE,
            discountValue: 0,
          },
        ],
        generalDiscountType: DiscountType.NONE,
        generalDiscountValue: 0,
      },
      'key-price',
      'user-1',
    );

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('crea venta con varios artículos recalculando totales', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<string>) => {
      const tx = {
        idempotencyRecord: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        sale: {
          create: jest.fn().mockImplementation(({ data }) => {
            expect(data.total.toString()).toBe('19500');
            return Promise.resolve({ id: 'sale-multi' });
          }),
        },
        motif: {
          findUnique: jest.fn().mockResolvedValue({ id: 'm1', name: 'X' }),
          create: jest.fn(),
        },
        productMotif: { upsert: jest.fn() },
        saleItem: { create: jest.fn() },
      };
      return fn(tx);
    });

    prisma.product.findMany.mockResolvedValue([
      product,
      {
        id: 'prod-2',
        name: 'Chapa A4',
        defaultPrice: new Decimal('5000'),
        isActive: true,
      },
    ]);

    prisma.sale.findFirst.mockResolvedValue({ id: 'sale-multi', items: [] });

    await service.create(
      {
        items: [
          {
            productId: 'prod-1',
            motifName: 'Nirvana',
            quantity: 1,
            unitPrice: 12000,
            discountType: DiscountType.FIXED,
            discountValue: 1000,
          },
          {
            productId: 'prod-2',
            motifName: 'Airbag',
            quantity: 2,
            unitPrice: 5000,
            discountType: DiscountType.PERCENTAGE,
            discountValue: 10,
          },
        ],
        generalDiscountType: DiscountType.FIXED,
        generalDiscountValue: 500,
      },
      'key-multi',
      'user-1',
    );

    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
