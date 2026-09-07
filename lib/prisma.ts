import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prisma: PrismaClient | undefined;
}

// Amplify WEB_COMPUTE scales horizontally, so the connection ceiling that
// matters is per container multiplied by however many are warm. node-postgres
// defaults to 10 each, which a db.t4g.micro (~110 connections) exhausts after a
// dozen containers; past that every query throws, and the organiser routes
// answer 503 rather than pretending the account has no organiser.
const POOL_MAX = Number(process.env.DATABASE_POOL_MAX ?? 5);

const client = global.prisma || new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: POOL_MAX }),
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});
if (process.env.NODE_ENV !== "production") global.prisma = client;

export default client;
