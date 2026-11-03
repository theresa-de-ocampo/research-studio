import "server-only";

import { loadEnvConfig } from "@next/env";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { migrationOptions } from "../../drizzle.config";
import { readMigrationConfig } from "./config";

let step = "validating the command";

async function main() {
  const command = process.argv[2];

  if (
    process.argv.length !== 3 ||
    (command !== "migrate" &&
      command !== "checkpoint-setup" &&
      command !== "setup")
  ) {
    console.error(
      "Use npm.cmd run db:migrate, db:checkpoint-setup, or db:setup without additional arguments.",
    );
    process.exitCode = 1;
  } else {
    step = "loading environment configuration";
    loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", {
      info() {
        // Do not print loaded environment values.
      },
      error() {
        // Loader errors can include file contents; discard the original error.
        throw new Error("Could not load database environment configuration.");
      },
    });

    step = "validating DATABASE_URL and MIGRATION_DATABASE_URL";
    const { databaseUrl } = readMigrationConfig();
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 1,
      connectionTimeoutMillis: 10_000,
    });
    let idleConnectionFailed = false;

    pool.on("error", () => {
      idleConnectionFailed = true;
      process.exitCode = 1;
      console.error("An idle migration database connection failed.");
    });

    try {
      if (command === "migrate" || command === "setup") {
        step = "applying metadata migrations";
        console.info("Applying reviewed metadata migrations.");
        await migrate(drizzle(pool), migrationOptions);
      }

      if (idleConnectionFailed) {
        throw new Error("Migration connection failed.");
      }

      if (command === "checkpoint-setup" || command === "setup") {
        step = "setting up langgraph checkpoints";
        console.info("Setting up langgraph checkpoints.");
        const checkpointer = new PostgresSaver(pool, undefined, {
          schema: "langgraph",
        });
        await checkpointer.setup();
      }

      if (idleConnectionFailed) {
        throw new Error("Migration connection failed.");
      }

      step = "closing the temporary migration pool";
    } finally {
      // The checkpointer shares this temporary pool; close it exactly once.
      await pool.end();
    }

    if (!idleConnectionFailed) {
      console.info(
        "Database command completed. Human-managed grants must be verified separately.",
      );
    }
  }
}

main().catch(() => {
  // Never log driver errors, SQL, URLs, or error causes containing secrets.
  console.error(
    `Database setup failed while ${step}. Check configuration, reviewed migration artifacts, and human-managed database privileges.`,
  );
  process.exitCode = 1;
});
