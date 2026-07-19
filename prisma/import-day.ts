import 'dotenv/config';
import { PrismaClient, DiscountType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcryptjs';

/** Preferir DIRECT_URL (sin pgbouncer) para el wipe/import. */
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

const PRODUCT_DEFS = [
  { name: 'Gorra', defaultPrice: '20000.00' },
  { name: 'Remera', defaultPrice: '20000.00' },
  { name: 'Taza cerámica', defaultPrice: '10000.00' },
  { name: 'Taza plástica', defaultPrice: '5000.00' },
  { name: 'Cantimplora', defaultPrice: '6000.00' },
  { name: 'Chapa A4', defaultPrice: '10000.00' },
  { name: 'Chapa Longitudinal', defaultPrice: '10000.00' },
  { name: 'Chapa A5', defaultPrice: '5000.00' },
  { name: 'Stickers', defaultPrice: '1000.00' },
  { name: 'Otro', defaultPrice: '0.00' },
] as const;

const USERNAMES = ['maxifan', 'camifan', 'lucifan', 'juliofan', 'dalafan'] as const;

type Row = {
  at: string;
  user: (typeof USERNAMES)[number];
  product: (typeof PRODUCT_DEFS)[number]['name'];
  motif: string;
  price: number;
};

/** Cada fila = una venta independiente (1 artículo). */
const ROWS: Row[] = [
  { at: '2026-07-18T11:43:00', user: 'maxifan', product: 'Gorra', motif: 'Nirvana', price: 20000 },
  { at: '2026-07-18T11:43:00', user: 'maxifan', product: 'Chapa A4', motif: 'Airbag', price: 10000 },
  { at: '2026-07-18T12:00:00', user: 'maxifan', product: 'Stickers', motif: 'Sin motivo', price: 1000 },
  { at: '2026-07-18T14:12:00', user: 'camifan', product: 'Gorra', motif: 'Racing', price: 20000 },
  { at: '2026-07-18T14:19:00', user: 'camifan', product: 'Gorra', motif: 'Indio', price: 20000 },
  { at: '2026-07-18T14:19:00', user: 'camifan', product: 'Remera', motif: 'Indio, talle 4', price: 20000 },
  { at: '2026-07-18T16:13:00', user: 'camifan', product: 'Taza plástica', motif: 'Minecraft', price: 5000 },
  { at: '2026-07-18T16:13:00', user: 'camifan', product: 'Taza plástica', motif: 'Sony', price: 5000 },
  { at: '2026-07-18T18:00:00', user: 'camifan', product: 'Stickers', motif: 'Sin motivo', price: 1000 },
  { at: '2026-07-18T18:31:00', user: 'camifan', product: 'Stickers', motif: 'Sin motivo', price: 1000 },
  { at: '2026-07-18T18:38:00', user: 'camifan', product: 'Gorra', motif: 'McLaren', price: 20000 },
  { at: '2026-07-18T18:38:00', user: 'camifan', product: 'Stickers', motif: 'Sin motivo', price: 1000 },
  { at: '2026-07-18T19:03:00', user: 'camifan', product: 'Stickers', motif: 'Sin motivo', price: 1000 },
  { at: '2026-07-18T19:33:00', user: 'maxifan', product: 'Stickers', motif: 'Sin motivo', price: 1000 },
  { at: '2026-07-18T19:50:00', user: 'maxifan', product: 'Stickers', motif: 'Sin motivo', price: 1000 },
  { at: '2026-07-18T19:52:00', user: 'maxifan', product: 'Stickers', motif: 'Sin motivo', price: 3000 },
  { at: '2026-07-18T19:56:00', user: 'maxifan', product: 'Stickers', motif: 'Sin motivo', price: 1500 },
  { at: '2026-07-18T20:13:00', user: 'maxifan', product: 'Stickers', motif: 'Sin motivo', price: 1000 },
  { at: '2026-07-18T20:22:00', user: 'maxifan', product: 'Chapa Longitudinal', motif: 'Racing', price: 10000 },
  { at: '2026-07-18T20:22:00', user: 'maxifan', product: 'Chapa Longitudinal', motif: 'Malvinas', price: 10000 },
  { at: '2026-07-18T20:22:00', user: 'maxifan', product: 'Chapa A4', motif: 'Asado en familia', price: 10000 },
  { at: '2026-07-18T21:07:00', user: 'maxifan', product: 'Gorra', motif: 'Dumato', price: 20000 },
  { at: '2026-07-18T21:07:00', user: 'maxifan', product: 'Taza cerámica', motif: 'San Lorenzo', price: 10000 },
  { at: '2026-07-18T21:28:00', user: 'maxifan', product: 'Taza cerámica', motif: 'Cerati', price: 10000 },
  { at: '2026-07-18T21:30:00', user: 'maxifan', product: 'Otro', motif: 'Un aplauso para el asador', price: 0 },
  { at: '2026-07-18T21:41:00', user: 'maxifan', product: 'Chapa A5', motif: 'Prohibido fumar', price: 5000 },
  { at: '2026-07-18T21:49:00', user: 'maxifan', product: 'Gorra', motif: 'Surubí', price: 20000 },
  { at: '2026-07-18T22:05:00', user: 'maxifan', product: 'Stickers', motif: 'Sin motivo', price: 2000 },
  { at: '2026-07-18T22:05:00', user: 'maxifan', product: 'Taza cerámica', motif: 'Rivera', price: 10000 },
  { at: '2026-07-18T22:05:00', user: 'maxifan', product: 'Taza cerámica', motif: 'Messi', price: 10000 },
  { at: '2026-07-18T22:32:00', user: 'maxifan', product: 'Remera', motif: 'Linkin Park, talle M', price: 20000 },
  { at: '2026-07-18T22:35:00', user: 'maxifan', product: 'Otro', motif: 'Asado papá', price: 0 },
  { at: '2026-07-18T22:35:00', user: 'maxifan', product: 'Chapa Longitudinal', motif: 'Racing', price: 10000 },
  { at: '2026-07-18T22:43:00', user: 'maxifan', product: 'Gorra', motif: 'Pirelli', price: 20000 },
  { at: '2026-07-18T22:44:00', user: 'maxifan', product: 'Gorra', motif: 'Argentina', price: 20000 },
  { at: '2026-07-18T22:44:00', user: 'maxifan', product: 'Taza cerámica', motif: 'Gallardo', price: 10000 },
  { at: '2026-07-18T22:48:00', user: 'maxifan', product: 'Chapa A4', motif: 'Soda', price: 10000 },
  { at: '2026-07-18T22:53:00', user: 'maxifan', product: 'Stickers', motif: 'Sin motivo', price: 4000 },
  { at: '2026-07-18T22:59:00', user: 'maxifan', product: 'Stickers', motif: 'Sin motivo', price: 1000 },
  { at: '2026-07-18T23:19:00', user: 'dalafan', product: 'Gorra', motif: 'Scania', price: 20000 },
  { at: '2026-07-18T23:20:00', user: 'dalafan', product: 'Taza cerámica', motif: 'Boca', price: 10000 },
  { at: '2026-07-18T23:23:00', user: 'dalafan', product: 'Chapa A4', motif: 'Asado, familia y amigos', price: 10000 },
  { at: '2026-07-18T23:23:00', user: 'dalafan', product: 'Chapa A4', motif: 'Mentirosos', price: 10000 },
  { at: '2026-07-18T23:36:00', user: 'maxifan', product: 'Stickers', motif: 'Sin motivo', price: 1000 },
  { at: '2026-07-18T23:47:00', user: 'maxifan', product: 'Taza cerámica', motif: 'Caballeros', price: 10000 },
  { at: '2026-07-18T23:55:00', user: 'maxifan', product: 'Chapa A4', motif: 'Diego', price: 10000 },
  { at: '2026-07-18T23:55:00', user: 'maxifan', product: 'Chapa Longitudinal', motif: 'Córdoba', price: 10000 },
  { at: '2026-07-18T23:59:00', user: 'maxifan', product: 'Chapa A5', motif: 'Gato café', price: 5000 },
  { at: '2026-07-19T00:46:00', user: 'maxifan', product: 'Stickers', motif: 'Sin motivo', price: 3500 },
  { at: '2026-07-19T00:48:00', user: 'maxifan', product: 'Gorra', motif: 'AC/DC', price: 20000 },
  { at: '2026-07-19T00:48:00', user: 'maxifan', product: 'Gorra', motif: 'Rolling Stones', price: 20000 },
  { at: '2026-07-19T00:49:00', user: 'maxifan', product: 'Stickers', motif: 'Sin motivo', price: 2000 },
];

async function main() {
  console.log('1/5 Limpiando…');
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await prisma.idempotencyRecord.deleteMany();
      await prisma.saleItem.deleteMany();
      await prisma.sale.deleteMany();
      await prisma.productMotif.deleteMany();
      await prisma.motif.deleteMany();
      await prisma.product.deleteMany();
      console.log('   OK');
      break;
    } catch (err) {
      console.log(`   intento ${attempt} falló, reintento…`);
      if (attempt === 5) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  console.log('2/5 Usuarios…');
  for (const username of USERNAMES) {
    const passwordHash = await bcrypt.hash(username, 10);
    await prisma.user.upsert({
      where: { username },
      update: { passwordHash, displayName: username },
      create: { username, passwordHash, displayName: username },
    });
    console.log(`   + ${username}`);
  }

  console.log('3/5 Productos…');
  const productByName = new Map<string, string>();
  for (const def of PRODUCT_DEFS) {
    const p = await prisma.product.create({
      data: {
        name: def.name,
        normalizedName: normalizeName(def.name),
        defaultPrice: new Decimal(def.defaultPrice),
        isActive: true,
      },
    });
    productByName.set(def.name, p.id);
    console.log(`   + ${def.name} $${def.defaultPrice}`);
  }

  const users = await prisma.user.findMany({
    where: { username: { in: [...USERNAMES] } },
  });
  const userByName = new Map(users.map((u) => [u.username, u.id]));

  console.log('4/5 Motivos + vínculos…');
  const motifNames = [...new Set(ROWS.map((r) => r.motif))];
  const motifByName = new Map<string, string>();
  for (const name of motifNames) {
    const m = await prisma.motif.create({
      data: { name, normalizedName: normalizeName(name) },
    });
    motifByName.set(name, m.id);
  }

  const linked = new Set<string>();
  for (const row of ROWS) {
    const key = `${row.product}::${row.motif}`;
    if (linked.has(key)) continue;
    linked.add(key);
    await prisma.productMotif.create({
      data: {
        productId: productByName.get(row.product)!,
        motifId: motifByName.get(row.motif)!,
      },
    });
  }
  console.log(`   ${motifByName.size} motivos, ${linked.size} vínculos`);

  console.log(`5/5 Cargando ${ROWS.length} ventas…`);
  for (let i = 0; i < ROWS.length; i++) {
    const row = ROWS[i];
    const userId = userByName.get(row.user);
    const productId = productByName.get(row.product);
    const motifId = motifByName.get(row.motif);
    if (!userId || !productId || !motifId) {
      throw new Error(`Faltan refs en fila ${i + 1}`);
    }

    const price = new Decimal(row.price);
    const createdAt = new Date(row.at);

    const sale = await prisma.sale.create({
      data: {
        userId,
        subtotal: price,
        generalDiscountType: DiscountType.NONE,
        generalDiscountValue: new Decimal(0),
        generalDiscountAmount: new Decimal(0),
        total: price,
        notes: null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.saleItem.create({
      data: {
        saleId: sale.id,
        productId,
        motifId,
        quantity: 1,
        unitPrice: price,
        lineSubtotal: price,
        discountType: DiscountType.NONE,
        discountValue: new Decimal(0),
        discountAmount: new Decimal(0),
        lineTotal: price,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if ((i + 1) % 10 === 0 || i + 1 === ROWS.length) {
      console.log(`   ${i + 1}/${ROWS.length}`);
    }
  }

  const total = ROWS.reduce((s, r) => s + r.price, 0);
  console.log(`Listo: ${ROWS.length} ventas, total $${total.toLocaleString('es-AR')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
