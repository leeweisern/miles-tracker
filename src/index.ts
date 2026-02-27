import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { Bindings, Variables } from "./env";
import { flightRoutes } from "./routes/flights";
import { programRoutes } from "./routes/programs";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", cors());
app.get("/ping", (c) => c.json({ status: "ok" }));

app.use("/api/*", (c, next) => {
  const expected = (c.env.AUTH_TOKEN ?? "").trim();
  return bearerAuth({ verifyToken: (token) => token === expected })(c, next);
});

app.route("/api", programRoutes);
app.route("/api", flightRoutes);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    if (err.status >= 500) {
      console.error("Unhandled error:", err);
    }
    return err.getResponse();
  }

  console.error("Unhandled error:", err);
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: err.message,
      },
    },
    500
  );
});

export default app;
