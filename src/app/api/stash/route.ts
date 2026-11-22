import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public drop-box for the Safari shortcut. The shortcut posts the recipe data
// here (no login possible inside Shortcuts) and then opens /i/<id>. Only signed-in
// users can read a stash entry; anonymous callers can only insert.
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { id?: string; d?: unknown };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  const id = String(body.id ?? "");
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id) || !body.d) return new NextResponse("bad request", { status: 400 });
  const json = JSON.stringify(body.d);
  if (json.length > 290_000) return new NextResponse("too large", { status: 413 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await sb.from("import_stash").insert({ id, payload: body.d });
  if (error) return new NextResponse(error.message, { status: 500, headers: { "access-control-allow-origin": "*" } });
  return new NextResponse(null, { status: 204, headers: { "access-control-allow-origin": "*" } });
}
