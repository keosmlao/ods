import { readFileSync } from "node:fs";
import { SignJWT } from "jose";
for (const line of readFileSync(new URL("../.env.local", import.meta.url),"utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g,"");
}
console.log(await new SignJWT({ username: "22020", role: "manager" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h")
  .sign(new TextEncoder().encode(process.env.AUTH_SECRET)));
