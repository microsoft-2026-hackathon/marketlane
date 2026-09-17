import { createApp } from "./app.js";
import { databasePath, openDatabase } from "./db/database.js";
import { seedDatabase } from "./db/seed.js";

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 4310);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535.");
  const dev = process.argv.includes("--dev");
  const fault = process.env.MARKETLANE_FAULT;
  if (fault !== undefined && fault !== "drop-order-response-once") {
    throw new Error("MARKETLANE_FAULT must be unset or drop-order-response-once.");
  }
  if (fault && !dev) throw new Error("MARKETLANE_FAULT is available only with --dev.");
  const database = openDatabase(databasePath());
  try {
    seedDatabase(database);
    const app = await createApp({ database, port, logger: true, serveClient: !dev, dropOrderResponseOnce: Boolean(fault) });
    let closing: Promise<void> | undefined;
    function shutdown(): Promise<void> {
      return closing ??= app.close().finally(() => database.close());
    }
    const onSignal = (): void => {
      void shutdown().catch(error => {
        console.error(error);
        process.exitCode = 1;
      });
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    try {
      await app.listen({ port, host: "127.0.0.1" });
      console.log(`Marketlane is ready at http://127.0.0.1:${port}`);
    } catch (error) {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      await shutdown();
      throw error;
    }
  } catch (error) {
    if (database.open) database.close();
    throw error;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
