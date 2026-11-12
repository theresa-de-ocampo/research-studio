import "server-only";

// Only call after databaseUrlSchema has validated the connection string.
export function getDatabaseTarget(connectionString: string) {
  const url = new URL(connectionString);

  return {
    host: decodeURIComponent(url.hostname).toLowerCase(),
    port: url.port || "5432",
    database: decodeURI(url.pathname.slice(1))
  };
}
