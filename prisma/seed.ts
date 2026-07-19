import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function main() {
  // Precios de ejemplo — modificar antes del evento real
  const productDefs = [
    { name: 'Chapa A4', defaultPrice: '5000.00' },
    { name: 'Chapa A5', defaultPrice: '3500.00' },
    { name: 'Gorra', defaultPrice: '12000.00' },
    { name: 'Remera', defaultPrice: '15000.00' },
    { name: 'Taza plástica', defaultPrice: '4000.00' },
    { name: 'Cerámica', defaultPrice: '8000.00' },
    { name: 'Longboard', defaultPrice: '45000.00' },
    { name: 'Stickers', defaultPrice: '1000.00' },
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
    ['Cerámica', 'San Lorenzo'],
    ['Cerámica', 'Messi'],
    ['Longboard', 'Racing'],
    ['Longboard', 'McLaren'],
  ];

  for (const [productName, motifName] of links) {
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

  console.log('Seed completado: productos, motivos y relaciones de ejemplo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
