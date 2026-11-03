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
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return [
      index("conversations_activity_idx").on(
        table.updatedAt.desc(),
        table.id.desc(),
      ),
    ];
  },
);
