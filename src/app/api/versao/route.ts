import { connection } from "next/server";

export async function GET() {
  await connection();
  return Response.json(
    { versao: process.env.FINBAST_BUILD_ID },
    { headers: { "Cache-Control": "no-store" } },
  );
}
