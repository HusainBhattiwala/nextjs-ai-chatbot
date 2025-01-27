import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "./lib/session";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = await getSession();

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (session) {
    if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL("/login/12345678-1234-1234-1234-123456789abc", request.url)
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/:id*", "/api/:path*", "/login/:id*", "/register"],
};

// import { NextResponse } from "next/server";
// import type { NextRequest } from "next/server";

// export async function middleware(request: NextRequest) {
//   const access_token = request.cookies.get("access_token")?.value;
//   const pathname = request.nextUrl.pathname;

//   if (pathname.startsWith("/api")) {
//     return NextResponse.next();
//   }

//   if (access_token) {
//     if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
//       return NextResponse.redirect(new URL("/", request.url));
//     }
//     return NextResponse.next();
//   }

//   if (pathname === "/") {
//     // Here, you should redirect to your default login route
//     return NextResponse.redirect(new URL("/login", request.url));
//   }
//   return NextResponse.next();
// }

// export const config = {
//   matcher: ["/", "/:id*", "/api/:path*", "/login", "/register"],
// };
