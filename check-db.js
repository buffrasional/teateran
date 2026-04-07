const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const events = await db.event.findMany({
    select: { id: true, title: true, adminFee: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log('=== EVENTS ===');
  for (const e of events) {
    console.log(`${e.id} | ${e.title} | adminFee: ${e.adminFee}`);
  }

  const priceCats = await db.priceCategory.findMany({
    include: { event: { select: { title: true } } },
    orderBy: { price: 'desc' },
  });
  console.log('\n=== PRICE CATEGORIES ===');
  for (const pc of priceCats) {
    const seatCount = await db.seat.count({ where: { priceCategoryId: pc.id } });
    console.log(`${pc.name} | Rp ${pc.price.toLocaleString('id-ID')} | ${pc.event.title} | seats: ${seatCount}`);
  }

  // Check latest transactions
  const trxs = await db.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('\n=== LATEST TRANSACTIONS ===');
  for (const t of trxs) {
    console.log(`${t.transactionId} | ${t.customerName} | total: ${t.totalAmount} | status: ${t.paymentStatus}`);
  }
}
main().catch(console.error).finally(() => db.$disconnect());
