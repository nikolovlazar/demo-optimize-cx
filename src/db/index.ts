import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL!;

// Use Neon's HTTP driver for better compatibility
const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
