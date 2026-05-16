import { NextRequest, NextResponse } from "next/server";

const PASSWORD = process.env.APP_PASSWORD;

export function proxy(req: NextRequest) {
  if (!PASSWORD) {
    return NextResponse.json(
      { error: "APP_PASSWORD not configured" },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const [user, pass] = Buffer.from(auth.slice(6), "base64")
      .toString()
      .split(":");
    if (user === "demo" && pass === PASSWORD) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Accounting MVP", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
