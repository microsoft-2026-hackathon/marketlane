# Architecture

```text
React feature views
  -> typed /api client
  -> Fastify input validation and error mapping
  -> catalog / pricing / inventory / order services
  -> SQLite repositories and transactions
```

`shared/contracts.ts` defines the JSON boundary. Route input is validated at
runtime; TypeScript alone is not a request validator.

The catalog joins stable product data, the requested translation, and current
inventory. Price calculation is a pure function. Order placement composes
customer lookup, product lookup, pricing, stock changes, and snapshot
persistence under a single write transaction.

An injected `Clock` supplies business timestamps, allowing time-sensitive
behavior to be covered without sleeps. SQLite connections enable foreign keys
and use WAL for file-backed stores. Schema upgrades run in order through
`PRAGMA user_version`; seed data is separate from migrations.

The HTTP application factory accepts an open database and a clock. Tests can
call Fastify's in-process HTTP injection without opening a network port.
The executable entry point owns the file-backed database and shutdown.

The browser keeps only draft cart IDs/quantities in local storage. It requests
a fresh quote when the draft or account context changes. Quote responses are
not allowed to replace newer draft state. Checkout refreshes the live stock
and clears a draft only after receiving an accepted order.

Historical orders do not join current catalog/customer content. A report or
fulfillment view reads the stored snapshots.

The development process runs Vite and the API separately. A production build
is served by the same Fastify process as the API. All product assets are local;
there are no remote image or font dependencies.
