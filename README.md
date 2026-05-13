# nect

A lightweight, type-safe Next.js utility library for building API routes and server actions — supports both **App Router** and **Pages Router**.

## Features

- 🔀 Works with both **App Router** (`app/api/`) and **Pages Router** (`pages/api/`)
- ✅ Built-in **Zod validation** for body, params, and query
- 🔗 **Handler chain** (middleware) support per route/method
- 🌐 Flexible **CORS** configuration (static, dynamic, per-origin)
- 💬 Chainable **Reply builder** with consistent JSON envelope
- ⚡ **Server Actions** support with middleware and validation
- 🛡️ Unified error recovery via `recover`
- 🔒 Type-safe request/response via `NectRequest` & `NectResponse`

---

## Installation

```bash
pnpm add nect zod
# or
npm install nect zod
```

> **Peer dependencies:** `next >= 16.2.6`, `zod >= 4.4.3`

---

## Quick Start

### App Router

```ts
// app/api/user/route.ts
import { createAppRouter } from "nect/route";

export const { GET, POST } = createAppRouter({
  GET: async (req, res, ctx) => {
    return ctx.reply.success({ data: "hello" }).ok();
  },
  POST: async (req, res, ctx) => {
    return ctx.reply.success({ data: ctx.validated.body }).send(201);
  },
});
```

### Pages Router

```ts
// pages/api/user.ts
import { createPagesRouter } from "nect/route";

export default createPagesRouter({
  GET: async (req, res, ctx) => {
    return ctx.reply.success({ data: "hello" }).ok();
  },
});
```

---

## Routing

### `createAppRouter(handlers, options?)`

Creates named exports for Next.js App Router. Each method key (`GET`, `POST`, etc.) becomes a separate named export.

```ts
export const { GET, POST } = createAppRouter({
  GET: handlerFn,
  POST: [authMiddleware, handlerFn], // handler chain
});
```

### `createPagesRouter(handlers, options?)`

Creates a default export handler for Next.js Pages Router.

```ts
export default createPagesRouter({
  GET: handlerFn,
  POST: [authMiddleware, handlerFn],
  FALLBACK: notFoundHandler, // catches unmatched methods
});
```

---

## Handler Signature

Every handler receives `(req, res, ctx)`:

```ts
async (req, res, ctx) => {
  const { reply, next, validated } = ctx;

  // validated.body   → parsed request body
  // validated.param  → parsed URL params
  // validated.query  → parsed query string

  return reply.success({ user: validated.body }).ok();
};
```

---

## Validation (Zod)

Pass Zod schemas per method in `options`:

```ts
import { z } from "zod";

export const { POST } = createAppRouter(
  {
    POST: async (req, res, ctx) => {
      const { name } = ctx.validated.body; // typed!
      return ctx.reply.success({ name }).created();
    },
  },
  {
    POST: {
      validator: {
        body: z.object({ name: z.string() }),
        param: z.object({ id: z.string() }),
        query: z.object({ page: z.coerce.number().optional() }),
      },
    },
  },
);
```

Validation failures automatically return a `400` with a structured error envelope.

---

## Reply Builder

The `reply` object provides a fluent API for building responses:

```ts
// Success responses
reply.success(data).ok(); // 200
reply.success(data).created(); // 201
reply.success(data).send(202); // custom status
reply.noContent(); // 204

// Error responses
reply.error({ code: "NOT_FOUND", message: "User not found" }).fail();
reply.error({ code: "BAD_INPUT", message: "..." }).fail(400);

// With metadata
reply.info("Profile updated").success(user).ok();
reply.success(users).paginate({ limit: 10, offset: 0 }).ok();

// Cookies & headers
reply.setCookies("token", value, { httpOnly: true }).success(user).ok();
reply.setHeader("X-Custom", "value").success(data).ok();

// Redirect & stream
reply.redirect("/login");
reply.stream(readableStream, { contentType: "text/event-stream" });
```

### Response Envelope

All JSON responses follow a consistent envelope structure:

```json
// Success
{
  "data": { ... },
  "meta": { "status": "SUCCESS" }
}

// Error
{
  "data": { "code": "NOT_FOUND", "message": "User not found" },
  "meta": { "status": "ERROR" }
}
```

---

## CORS

```ts
// Allow all origins
createAppRouter({ GET: handler }, { cors: true });

// Allow a specific origin
createAppRouter({ GET: handler }, { cors: "https://example.com" });

// Allow multiple origins
createAppRouter({ GET: handler }, { cors: ["https://a.com", "https://b.com"] });

// Dynamic per-request (async supported)
createAppRouter(
  { GET: handler },
  {
    cors: (origin) => origin.endsWith(".example.com"),
  },
);

// Object config with credentials
createAppRouter(
  { GET: handler },
  {
    cors: { origin: "https://example.com", allowCredentials: true },
  },
);
```

---

## Error Recovery

Catch unhandled errors globally or per method:

```ts
import { Reply } from "nect/server";

export const { GET } = createAppRouter(
  { GET: handler },
  {
    recover: (err, req, res) => {
      return new Reply({ req, res }).error({ code: "SERVER_ERROR", message: "Something went wrong" }).fail(500);
    },
  },
);
```

---

## Server Actions

`nect` also supports Next.js **Server Actions** via `nect/actions`.

### Creating an Action

```ts
// actions/user.ts
import { createNectAction } from "nect/actions";
import { z } from "zod";

export const getUser = createNectAction().handle(({ outcome }, id: string) => {
  return outcome.success({ id }).ok();
});

export const createUser = createNectAction()
  .option({ validator: { args: [z.object({ name: z.string() })] } })
  .use(async ({ next, set }) => {
    set("role", "admin");
    return await next();
  })
  .handle(({ outcome, validated: [user], get }) => {
    const role = get("role");
    return outcome.success({ ...user, role }).ok();
  });
```

### Calling an Action (Client Side)

```ts
import { nectAction } from "nect/actions";

// Safe mode — always returns, check status manually
const result = await nectAction({ action: getUser }, "user-123");
if (result.meta.status === "ERROR") {
  console.error(result.data.message);
} else {
  console.log(result.data);
}

// Unsafe mode — throws NectOutcomeError on error
try {
  const result = await nectAction({ action: getUser, unsafe: true }, "user-123");
  console.log(result.data);
} catch (err) {
  if (err instanceof NectOutcomeError) {
    console.error(err.data.code);
  }
}
```

---

## `NectRequest` API

`NectRequest` is a unified request wrapper that works across both routers.

| Property / Method     | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `req.method`          | HTTP method (uppercased)                                   |
| `req.url`             | Full URL string                                            |
| `req.pathname`        | Pathname only (e.g. `/api/users`)                          |
| `req.query`           | Query params as `Record<string, string \| string[]>`       |
| `req.getQuery(key)`   | Get a single query param                                   |
| `req.headers`         | All headers as `Record<string, string>`                    |
| `req.getHeader(name)` | Get a single header value                                  |
| `req.cookies`         | All cookies as `Record<string, string>`                    |
| `req.getCookie(name)` | Get a single cookie                                        |
| `await req.body()`    | Parse request body (JSON, form, multipart, text)           |
| `req.ip`              | Best-effort client IP                                      |
| `req.isJson`          | Whether content-type is `application/json`                 |
| `req.isMultipart`     | Whether content-type is `multipart/form-data`              |
| `req.set(key, value)` | Store arbitrary data on the request (useful in middleware) |
| `req.get(key)`        | Retrieve stored data from the request                      |

---

## Package Exports

| Import path    | Contents                                                              |
| -------------- | --------------------------------------------------------------------- |
| `nect`         | `NectError`                                                           |
| `nect/route`   | `createAppRouter`, `createPagesRouter`                                |
| `nect/server`  | `NectRequest`, `NectResponse`, `Reply`, `nectRequest`, `nectResponse` |
| `nect/actions` | `createNectAction`, `nectAction`, `createOutcome`, `NectOutcomeError` |

---

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Build in watch mode
pnpm dev
```

---

## License

ISC
