import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CognitoIdentityProviderClient, AssociateSoftwareTokenCommand, VerifySoftwareTokenCommand, SetUserMFAPreferenceCommand, ChangePasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";

const region = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
const cognito = new CognitoIdentityProviderClient({ region });

async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  const lastAuthUser = store.get(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)?.value;
  if (!lastAuthUser) return null;
  return (
    store.get(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`)?.value ??
    store.get(`CognitoIdentityServiceProvider.${clientId}.${encodeURIComponent(lastAuthUser)}.accessToken`)?.value ??
    null
  );
}

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { cognitoSub: session.sub } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({ mfaEnabled: user.mfaEnabled });
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  const user = await prisma.user.findUnique({ where: { cognitoSub: session.sub } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  switch (action) {
    case "enable": {
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: true },
      });
      return NextResponse.json({ ok: true });
    }

    case "disable": {
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: false },
      });
      return NextResponse.json({ ok: true });
    }

    case "setup": {
      const accessToken = await getAccessToken();
      if (!accessToken) return NextResponse.json({ error: "No session." }, { status: 401 });
      const cmd = new AssociateSoftwareTokenCommand({ AccessToken: accessToken });
      const res = await cognito.send(cmd);
      return NextResponse.json({ secretCode: res.SecretCode });
    }

    case "verify-setup": {
      const { code } = body;
      if (!code || typeof code !== "string") {
        return NextResponse.json({ error: "Code is required." }, { status: 400 });
      }
      const accessToken = await getAccessToken();
      if (!accessToken) return NextResponse.json({ error: "No session." }, { status: 401 });
      await cognito.send(new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: code,
        FriendlyDeviceName: "Startline Authenticator",
      }));
      await cognito.send(new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
      }));
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: true },
      });
      return NextResponse.json({ ok: true });
    }

    case "change-password": {
      const { currentPassword, newPassword } = body;
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: "Current and new password required." }, { status: 400 });
      }
      const accessToken = await getAccessToken();
      if (!accessToken) return NextResponse.json({ error: "No session." }, { status: 401 });
      await cognito.send(new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: currentPassword,
        ProposedPassword: newPassword,
      }));
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
