import { NextRequest, NextResponse } from "next/server";
import { getCognitoUserStatus } from "@/lib/athlete-accounts";
import { z } from "zod";

const userExistsSchema = z.object({ email: z.string().max(255) });

export async function POST(req: NextRequest) {
  try {
    const parsed = userExistsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }
    const { email } = parsed.data;
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const { exists, status } = await getCognitoUserStatus(email);
    return NextResponse.json({ exists, status });
  } catch {
    return NextResponse.json({ error: "Failed to check user." }, { status: 503 });
  }
}
