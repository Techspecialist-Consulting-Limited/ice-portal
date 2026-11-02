import { NextResponse, type NextRequest } from "next/server";
import { getUserById, homePathForRole, SESSION_USER_COOKIE } from "@/app/auth/current-user";

export async function GET(request: NextRequest) {
  const user = getUserById(request.cookies.get(SESSION_USER_COOKIE)?.value);
  return NextResponse.redirect(new URL(homePathForRole(user.role), request.url));
}
