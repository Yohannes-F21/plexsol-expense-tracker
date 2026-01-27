require("dotenv/config");
const { PrismaClient, Prisma } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaNeon } = require("@prisma/adapter-neon");
const { neonConfig } = require("@neondatabase/serverless");
const WebSocket = require("ws");
const { Pool } = require("pg");

function shouldUseNeonAdapter(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("neon.tech");
  } catch {
    return false;
  }
}

function shouldUseSsl(url) {
  try {
    const parsed = new URL(url);
    const sslMode = parsed.searchParams.get("sslmode");
    if (sslMode === "require" || sslMode === "verify-full") return true;
    if (parsed.hostname.endsWith("neon.tech")) return true;
    return false;
  } catch {
    return false;
  }
}

async function main() {
  console.log("Starting refund smoke test...");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  let adapter;
  if (shouldUseNeonAdapter(connectionString)) {
    if (typeof globalThis.WebSocket === "undefined") {
      neonConfig.webSocketConstructor = WebSocket;
    }
    adapter = new PrismaNeon({ connectionString });
  } else {
    const pool = new Pool({
      connectionString,
      ...(shouldUseSsl(connectionString)
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    });
    adapter = new PrismaPg(pool);
  }

  const prisma = new PrismaClient({ adapter });
  const suffix = Date.now().toString();

  console.log("Creating user...");
  const user = await prisma.user.create({
    data: {
      name: "Refund Tester",
      email: "refund-tester-" + suffix + "@example.com",
      passwordHash: "test",
      role: "ORG_ADMIN",
    },
  });

  console.log("Creating organization...");
  const org = await prisma.organization.create({
    data: {
      name: "Refund Org " + suffix,
      createdById: user.id,
    },
  });

  console.log("Linking user to organization...");
  await prisma.user.update({
    where: { id: user.id },
    data: { organizationId: org.id },
  });

  console.log("Creating bank account A...");
  const a1 = await prisma.bankAccount.create({
    data: {
      organizationId: org.id,
      bankName: "Bank A",
      accountHolderName: "Tester",
      accountNumber: "000-" + suffix + "-A",
      initialBalance: new Prisma.Decimal(1000),
      balance: new Prisma.Decimal(1000),
    },
  });

  console.log("Creating bank account B...");
  const a2 = await prisma.bankAccount.create({
    data: {
      organizationId: org.id,
      bankName: "Bank B",
      accountHolderName: "Tester",
      accountNumber: "000-" + suffix + "-B",
      initialBalance: new Prisma.Decimal(200),
      balance: new Prisma.Decimal(200),
    },
  });

  const amount = new Prisma.Decimal(150);
  console.log("Checking source balance...");
  const from = await prisma.bankAccount.findUnique({
    where: { id: a1.id },
    select: { balance: true },
  });

  if (!from || from.balance.lt(amount)) throw new Error("insufficient");

  console.log("Running refund transaction...");
  const result = await prisma.$transaction(async (tx) => {
    const updatedFrom = await tx.bankAccount.update({
      where: { id: a1.id },
      data: { balance: { decrement: amount } },
      select: { balance: true },
    });

    const updatedTo = await tx.bankAccount.update({
      where: { id: a2.id },
      data: { balance: { increment: amount } },
      select: { balance: true },
    });

    const refund = await tx.refund.create({
      data: {
        organizationId: org.id,
        fromAccountId: a1.id,
        toAccountId: a2.id,
        amount,
      },
    });

    return { updatedFrom, updatedTo, refund };
  });

  console.log("Refund OK", {
    fromBalance: result.updatedFrom.balance.toString(),
    toBalance: result.updatedTo.balance.toString(),
    refundId: result.refund.id,
    orgId: org.id,
  });

  await prisma.$disconnect();
  console.log("Completed refund smoke test.");
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
});
