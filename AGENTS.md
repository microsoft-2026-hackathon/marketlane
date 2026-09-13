# Contributor guidance

Read `README.md`, `docs/product-rules.md`, and any current `TASK.md` first.
Preserve the existing product behavior unless the work request changes it.

- Keep money in integer USD cents and timestamps in ISO 8601 UTC.
- Keep business rules in services or pure domain functions, not React views
  or route handlers.
- Validate HTTP input and preserve the structured error envelope.
- Use SQLite transactions for related writes. Add a versioned migration when
  the persisted schema changes; do not silently discard local data.
- Snapshot order content and prices rather than rebuilding old orders from
  the current catalog.
- Keep the browser draft distinct from an accepted order.
- Use `npm test` and `npm run build`; the project uses Node's built-in test
  runner and does not need an additional test framework.
- Prefer targeted coverage for the behavior being changed. Database tests
  should use isolated temporary or in-memory databases.
- Do not commit `.data`, generated builds, credentials, or personal data.
- Keep code and maintained documentation in English. Localized catalog
  content is an intentional exception.
