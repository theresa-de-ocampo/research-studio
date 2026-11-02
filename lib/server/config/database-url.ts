import "server-only";

import { z } from "zod";

function isPostgresUrl(value: string): boolean {
  let valid = false;

  try {
    const url = new URL(value);
    const database = decodeURI(url.pathname.slice(1));

    // Keep the target explicit. pg query parameters can override the URL host,
    // port, or even the entire connection string, defeating target comparison.
    const hasTargetOverride = ["host", "port", "connectionString"].some(
      (parameter) => url.searchParams.has(parameter),
    );

    valid =
      value === value.trim() &&
      (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
      url.hostname.length > 0 &&
      decodeURIComponent(url.username).length > 0 &&
      database.trim().length > 0 &&
      url.hash.length === 0 &&
      !hasTargetOverride;

    // Check credential encoding without retaining or reporting decoded secrets.
    decodeURIComponent(url.password);
    decodeURIComponent(url.hostname);
  } catch {
    // URL and decoding errors may include input values; discard them entirely.
    valid = false;
  }

  return valid;
}

export const databaseUrlSchema = z.string().min(1).refine(isPostgresUrl);

// Only call after databaseUrlSchema has validated the connection string.
export function getDatabaseTarget(connectionString: string) {
  const url = new URL(connectionString);

  return {
    host: decodeURIComponent(url.hostname).toLowerCase(),
    port: url.port || "5432",
    database: decodeURI(url.pathname.slice(1)),
  };
}
