import { cookies } from "next/headers";
import { getUserById, SESSION_USER_COOKIE } from "./current-user";
import { CurrentUserProvider } from "./current-user-provider";

export async function CurrentUserBoundary({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const user = getUserById(cookieStore.get(SESSION_USER_COOKIE)?.value);
  return <CurrentUserProvider user={user}>{children}</CurrentUserProvider>;
}
