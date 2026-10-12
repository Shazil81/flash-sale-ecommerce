# Shopping verification — 12 October 2026

## Executed checks

- PostgreSQL 18: a separate local cluster on `127.0.0.1:55432`, using disposable Django test databases. The application's existing PostgreSQL server/database was not modified.
- Redis: the user's existing Docker container `my-redis-stack`, accessed on port 6379, database 15, using unique test key prefixes. No shared cache flush was performed.
- Concurrent fulfillment: five rounds of twelve buyers competing for five units. Every round created exactly five orders, returned seven stock conflicts, and left stock at zero.
- Duplicate callbacks: eight simultaneous requests for one payment returned success and created exactly one order, decrementing stock once.
- Redis round-trip and one-second expiration passed.
- Catalog cache hit returned data with zero SQL queries.
- Successful fulfillment invalidated the catalog cache; the next catalog response and cached value contained the updated stock.
- All 15 backend tests passed together against real PostgreSQL and Redis (11 shopping regressions and 4 integration tests).

Only Razorpay calls were mocked for these checks. Database locking and caching used real PostgreSQL and Redis services. These tests demonstrate the exercised cases, not a throughput benchmark or a guarantee for all concurrent workloads.

## Browser and Razorpay test payments

The Codex browser runtime could not initialize. A standalone Playwright runner using installed Chrome succeeded instead, against an isolated PostgreSQL database and real Redis, without mocked app or Razorpay responses.

- Registered a synthetic customer and logged in through the UI.
- Browsed the catalog, used Buy Now, and verified quantity changes from 1 to 2 (total ₹20) and back to 1 (₹10).
- Entered a synthetic delivery address and opened real Razorpay Test Mode checkout.
- A card attempt was rejected by the provider because this account does not support international cards. The app displayed the provider error; no order was created, stock stayed at 20, and the cart remained intact.
- Completed a ₹10 netbanking test payment through Razorpay's mock bank Success button. The application verified the genuine provider signature and fetched captured status, then redirected to My Orders.
- PostgreSQL confirmed exactly one order at saved unit price ₹10, one fulfilled payment, an empty cart, and stock reduced from 20 to 19. Provider test payment reference: `pay_Tn5caR8vdzkkXC`.
- A subsequent netbanking test payment through the mock bank Failure button displayed the decline. The existing order count remained 1, stock stayed at 19, and the new cart item remained intact.

Razorpay's [official integration/testing documentation](https://razorpay.com/docs/payments/server-integration/python/integration-steps) describes the mock-bank Success/Failure flow. Successful payment was tested using netbanking; successful domestic card and UPI flows were not verified.

Test credentials were supplied by the user and used only in temporary backend process environment variables, not saved in source files. They were previously exposed and still require rotation.

Checkout cancellation did not complete successfully in the browser smoke test and remains unresolved. Successful domestic card and UPI payments were not verified. Do not interpret the successful netbanking test as coverage of all payment methods or browser paths.

Stock is checked after payment capture. A losing concurrent buyer receives an explicit fulfillment/refund-required error; automated refunds and stock reservation are not implemented. This behavior was asserted, not treated as successful fulfillment.
