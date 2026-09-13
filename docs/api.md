# HTTP API

All routes use `/api`. Bodies are JSON. Unknown body properties are rejected.
Errors have the shape:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "There is not enough stock for this product.",
    "details": { "sku": "DSK-001", "available": 2, "requested": 3 }
  }
}
```

| Method and path | Input | Response |
| --- | --- | --- |
| `GET /health` | None | `{ status, service }` |
| `GET /config` | None | `StoreConfig` |
| `GET /customers` | None | `{ items: Customer[] }` |
| `GET /catalog` | `locale`, `q`, `category`, `sort`, `page`, `pageSize`, `inStock` | `CatalogPage` |
| `GET /products/:id` | `locale` | `{ product: Product }` |
| `PATCH /products/:id` | `ProductUpdate` | `{ product: Product }` |
| `POST /quotes` | `QuoteRequest`; query `locale` | `CartQuote` |
| `POST /orders` | `CheckoutRequest`; query `locale` | `201 { order: Order }` |
| `GET /orders` | Optional `customerId`, `status`, `limit` | `{ items: Order[] }` |
| `GET /orders/:id` | None | `{ order: Order }` |
| `PATCH /orders/:id/status` | `{ status: "packing" \| "shipped" }` | `{ order: Order }` |
| `GET /inventory` | `locale` | `InventoryState` |
| `POST /inventory/adjustments` | `InventoryAdjustment` | `201 { product, movement }` |
| `GET /overview` | None | `Overview` |

See `shared/contracts.ts` for exact response fields.

`locale` defaults to `en`. Catalog `page` defaults to 1, `pageSize` to 6
(maximum 24), and `sort` to `featured`. Available sorts are `featured`,
`price-asc`, `price-desc`, and `name`. `inStock` accepts `true` or `false`.
Order listing defaults to the latest 50 orders, maximum 100.

```sh
curl 'http://127.0.0.1:4310/api/catalog?locale=ko&category=desk&pageSize=6'
curl -X POST http://127.0.0.1:4310/api/quotes \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"customer-ava","items":[{"productId":"product-arc-lamp","quantity":1}],"couponCode":"WELCOME10"}'
```

The API is local, unauthenticated, and intended for a trusted operator.
Mutating browser requests are accepted only from the configured local UI
origins. This is not a substitute for authentication in a network deployment.
