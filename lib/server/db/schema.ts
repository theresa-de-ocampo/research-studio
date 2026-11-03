import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// pgTable uses PostgreSQL's default public schema.
export const conversations = pgTable(
  "conversations",
  {
    // Reuse this UUID as LangGraph's thread_id; transcripts live in checkpoints.
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => {
    return [
      index("conversations_activity_idx").on(
        sql`(coalesce(${table.updatedAt}, ${table.createdAt})) desc`,
        table.id.desc(),
      ),
    ];
  },
);
