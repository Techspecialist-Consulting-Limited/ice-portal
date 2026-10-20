import { NextResponse, type NextRequest } from "next/server";
import { getUserById, SESSION_USER_COOKIE, USERS } from "@/app/auth/current-user";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }
  if (
    typeof body !== "object"
    || body === null
    || !("userId" in body)
    || typeof body.userId !== "string"
    || !Object.values(USERS).some((user) => user.id === body.userId)
  ) {
    return NextResponse.json({ error: "Choose a supported demo user." }, { status: 400 });
  }

  const user = getUserById(body.userId);
  const response = NextResponse.json({ userId: user.id, role: user.role });
  response.cookies.set(SESSION_USER_COOKIE, user.id, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}
