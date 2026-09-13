import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { getProduct, listCatalog, updateProduct } from "./catalog/repository.js";
import { listCustomers } from "./customers/repository.js";
import type { Database } from "./db/database.js";
import { systemClock, type Clock } from "./domain/clock.js";
import { AppError } from "./domain/errors.js";
import { localeQuerySchema } from "./domain/validation.js";
import { adjustInventory, inventoryState } from "./inventory/service.js";
import { getOrder, listOrders } from "./orders/repository.js";
import { changeOrderStatus, placeOrder, quoteCart } from "./orders/service.js";
import { getOverview } from "./overview/repository.js";
import { storeConfig } from "./pricing/pricing.js";

export interface AppOptions {
  database: Database;
  clock?: Clock;
  logger?: boolean;
  serveClient?: boolean;
  port?: number;
}

export async function createApp(options: AppOptions): Promise<FastifyInstance> {
  const database = options.database;
  const clock = options.clock ?? systemClock;
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 64 * 1024 });
  const origins = new Set([
    "http://127.0.0.1:5178", "http://localhost:5178",
    `http://127.0.0.1:${options.port ?? 4310}`, `http://localhost:${options.port ?? 4310}`,
  ]);

  app.addHook("onRequest", async request => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
      const origin = request.headers.origin;
      if ((origin !== undefined && !origins.has(origin)) ||
          request.headers["sec-fetch-site"] === "cross-site") {
        throw new AppError(403, "ORIGIN_NOT_ALLOWED", "This request did not originate from the local application.");
      }
    }
  });
  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    if (request.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    if (options.serveClient) {
      reply.header("Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    }
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
      });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Some request fields are invalid.",
          details: { issues: error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) },
        },
      });
    }
    if (error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" &&
        error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        error: { code: "INVALID_REQUEST", message: "The request could not be read. Check its content type and JSON body." },
      });
    }
    request.log.error({ err: error }, "Request failed");
    return reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "The operation could not be completed." },
    });
  });

  app.get("/api/health", async () => ({ status: "ok", service: "marketlane" }));
  app.get("/api/config", async () => storeConfig);
  app.get("/api/customers", async () => ({ items: listCustomers(database) }));
  app.get("/api/catalog", async request => listCatalog(database, request.query));
  app.get<{ Params: { id: string } }>("/api/products/:id", async request => {
    const { locale } = localeQuerySchema.parse(request.query);
    return { product: getProduct(database, request.params.id, locale) };
  });
  app.patch<{ Params: { id: string } }>("/api/products/:id", async request => ({
    product: updateProduct(database, request.params.id, request.body, clock),
  }));
  app.post("/api/quotes", async request => {
    const { locale } = localeQuerySchema.parse(request.query);
    return quoteCart(database, request.body, locale, clock);
  });
  app.post("/api/orders", async (request, reply) => {
    const { locale } = localeQuerySchema.parse(request.query);
    const order = placeOrder(database, request.body, locale, clock);
    return reply.code(201).send({ order });
  });
  app.get("/api/orders", async request => ({ items: listOrders(database, request.query) }));
  app.get<{ Params: { id: string } }>("/api/orders/:id", async request => ({
    order: getOrder(database, request.params.id),
  }));
  app.patch<{ Params: { id: string } }>("/api/orders/:id/status", async request => ({
    order: changeOrderStatus(database, request.params.id, request.body, clock),
  }));
  app.get("/api/inventory", async request => {
    const { locale } = localeQuerySchema.parse(request.query);
    return inventoryState(database, locale);
  });
  app.post("/api/inventory/adjustments", async (request, reply) => {
    return reply.code(201).send(adjustInventory(database, request.body, clock));
  });
  app.get("/api/overview", async () => getOverview(database));

  if (options.serveClient) {
    const root = fileURLToPath(new URL("../client/", import.meta.url));
    if (!existsSync(`${root}/index.html`)) {
      await app.close();
      throw new Error("The client build is missing. Run npm run build before npm start.");
    }
    await app.register(fastifyStatic, { root, index: "index.html", maxAge: 0 });
  }
  app.setNotFoundHandler((request, reply) => {
    if (options.serveClient && request.method === "GET" && !request.url.startsWith("/api")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ error: { code: "NOT_FOUND", message: "This route was not found." } });
  });
  return app;
}
