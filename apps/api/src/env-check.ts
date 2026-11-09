import "./env.js";

const value = process.env.DATABASE_URL;
if (!value) throw Error("DATABASE_URL is not configured");
const url = new URL(value);
console.log(
  JSON.stringify({
    databaseUrlPresent: true,
    protocol: url.protocol,
    host: url.hostname,
    port: url.port || "default",
    queryOptionNames: [...url.searchParams.keys()].sort(),
    sslRequested:
      url.searchParams.get("sslmode") ?? url.searchParams.get("ssl"),
  }),
);
