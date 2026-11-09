import { once } from "node:events";
import { AddressInfo } from "node:net";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { forwardAsyncErrors } from "./async-handler.js";

describe("Express async error forwarding", () => {
  let server: ReturnType<express.Express["listen"]> | undefined;

  afterEach(async () => {
    if (server?.listening) {
      server.close();
      await once(server, "close");
    }
    server = undefined;
  });

  it("forwards promise rejections from non-async handlers to Express error middleware", async () => {
    const app = express();
    app.get(
      "/failure",
      forwardAsyncErrors((_req: express.Request, _res: express.Response) =>
        Promise.reject(new Error("provider failed")),
      ),
    );
    app.use(
      (
        error: Error,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => res.status(500).json({ error: error.message }),
    );

    server = app.listen(0);
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/failure`);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "provider failed",
    });
  });
});
