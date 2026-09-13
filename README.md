# Marketlane

Thoughtful goods for the working day. Marketlane combines a workspace-goods
storefront with a small order and inventory operations console.

Browse localized product information, prepare a cart, request authoritative
pricing, place an order, and move it through fulfillment. Operators can update
catalog content, record stock adjustments, and inspect the movement ledger.

## Run locally

Requires Node.js 20.19 or newer, npm 10 or newer, and a modern browser.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5178**. The API runs on port **4310** and Vite proxies
`/api` to it. The SQLite database is created and seeded on first startup at
`.data/marketlane.sqlite`. No external accounts, API keys, or network services
are required after dependencies have been installed.

For a single-process build:

```sh
npm run build
npm start
```

Open **http://127.0.0.1:4310**. Set `PORT` to choose a different API/production
port. `MARKETLANE_DB` can point to a different database file.

```sh
npm test
npm run typecheck
npm run db:reset -- --confirm
```

The last command resets only the configured Marketlane database and restores
the initial catalog, customers, stock movements, and orders. Stop the running
server first. Local database files are not version controlled.

When working on a feature branch, use a separate `MARKETLANE_DB` file, especially
for schema changes. Follow the current `TASK.md` startup command when one is
present. Stop the server before switching branches; a newer schema is never
silently downgraded or reset.

## Product surface

- **Shop:** search, categories, sorting, pagination, English/Korean catalog
  content, and a cart with server-calculated prices.
- **Orders:** customer selection, order details, historical price snapshots,
  packing, and shipment transitions.
- **Inventory:** current stock, a movement ledger, manual adjustments, and
  localized product editing.
- **Overview:** booked sales, open orders, and low-stock counts.

The initial catalog contains 18 products across Desk, Carry, and Paper.
`WELCOME10` gives 10% off eligible carts with at least $50 in merchandise.
Shipping is $5.90, waived when discounted merchandise reaches $100. Prices
are USD integer cents; changing the catalog language does not convert currency.

## Boundaries

Marketlane currently serves a trusted single operator. Customer selection is
an account context selector, not authentication. The server binds to loopback;
do not expose it to the internet without adding authentication and appropriate
deployment controls. Customer records are fictional and use example.com.
Checkout records an order; it does not charge a card or contact a payment
provider.

A cart is a browser draft, not a stock reservation. A quote does not promise
availability or lock a price. Checkout reads current prices and stock inside
one transaction. Each successful checkout request creates a new order.
Fulfillment supports `placed -> packing -> shipped`.

## Code map

| Directory | Responsibility |
| --- | --- |
| `client/` | React application, API client, cart state, and feature views |
| `shared/` | JSON API contracts shared by client and server |
| `server/db/` | SQLite connection, versioned migrations, and initial data |
| `server/catalog/` | Localized catalog reads and content updates |
| `server/pricing/` | Integer-money calculations and coupon rules |
| `server/inventory/` | Stock changes and movement history |
| `server/orders/` | Checkout transaction, immutable order lines, fulfillment |
| `test/` | Isolated domain, persistence, and HTTP contract coverage |

Read [product rules](docs/product-rules.md),
[architecture](docs/architecture.md), and the [HTTP API](docs/api.md) before
changing behavior. An active work request, when present, is in `TASK.md`.
