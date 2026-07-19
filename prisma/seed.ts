import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function main() {
  const users = [
    { id: 'user_maxifan', username: 'maxifan' },
    { id: 'user_camifan', username: 'camifan' },
    { id: 'user_lucifan', username: 'lucifan' },
    { id: 'user_juliofan', username: 'juliofan' },
    { id: 'user_dalafan', username: 'dalafan' },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.username, 10);
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        username: u.username,
        displayName: u.username,
        passwordHash,
      },
      update: {
        username: u.username,
        displayName: u.username,
      },
    });
  }

  // Precios oficiales del evento
  const productDefs = [
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
  ];

  const motifNames = [
    'Airbag',
    'Asado en familia',
    'Prohibido fumar',
    'Nirvana',
    'Racing',
    'Indio',
    'Minecraft',
    'Sony',
    'McLaren',
    'Malvinas',
    'San Lorenzo',
    'Cerati',
    'Messi',
  ];

  const products: Record<string, string> = {};
  for (const def of productDefs) {
    const existing = await prisma.product.findFirst({
      where: { normalizedName: normalizeName(def.name) },
    });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: def.name,
          defaultPrice: new Decimal(def.defaultPrice),
          isActive: true,
        },
      });
      products[def.name] = existing.id;
      continue;
    }
    const created = await prisma.product.create({
      data: {
        name: def.name,
        normalizedName: normalizeName(def.name),
        defaultPrice: new Decimal(def.defaultPrice),
        isActive: true,
      },
    });
    products[def.name] = created.id;
  }

  const motifs: Record<string, string> = {};
  for (const name of motifNames) {
    const normalizedName = normalizeName(name);
    const motif = await prisma.motif.upsert({
      where: { normalizedName },
      create: { name, normalizedName },
      update: {},
    });
    motifs[name] = motif.id;
  }

  const links: Array<[string, string]> = [
    ['Chapa A4', 'Airbag'],
    ['Chapa A4', 'Asado en familia'],
    ['Chapa A5', 'Prohibido fumar'],
    ['Gorra', 'Nirvana'],
    ['Gorra', 'Racing'],
    ['Gorra', 'Indio'],
    ['Remera', 'Indio'],
    ['Taza plástica', 'Minecraft'],
    ['Taza cerámica', 'San Lorenzo'],
    ['Taza cerámica', 'Messi'],
    ['Chapa Longitudinal', 'Racing'],
    ['Chapa Longitudinal', 'McLaren'],
  ];

  for (const [productName, motifName] of links) {
    if (!products[productName] || !motifs[motifName]) continue;
    await prisma.productMotif.upsert({
      where: {
        productId_motifId: {
          productId: products[productName],
          motifId: motifs[motifName],
        },
      },
      create: {
        productId: products[productName],
        motifId: motifs[motifName],
      },
      update: {},
    });
  }

  console.log('Seed completado: usuarios, productos y motivos.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
