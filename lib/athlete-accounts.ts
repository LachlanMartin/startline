import { randomBytes } from "crypto";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";

const region     = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2";
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const client     = new CognitoIdentityProviderClient({ region });

function generateTempPassword(): string {
  const rand = randomBytes(8).toString("hex");
  return rand + "A!";
}

export async function ensureAthleteCognitoUser(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();

  try {
    const result = await client.send(new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: normalized,
    }));
    return result.Username ?? normalized;
  } catch (err) {
    if (!(err instanceof UsernameExistsException) && (err as { name?: string }).name !== "UserNotFoundException") {
      throw err;
    }
  }

  try {
    await client.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: normalized,
      TemporaryPassword: generateTempPassword(),
      MessageAction: "SUPPRESS",
    }));
  } catch (err) {
    if (!(err instanceof UsernameExistsException)) throw err;
  }

  const result = await client.send(new AdminGetUserCommand({
    UserPoolId: userPoolId,
    Username: normalized,
  }));
  return result.Username ?? normalized;
}

export async function getCognitoUserStatus(email: string): Promise<{ exists: boolean; status: string | null }> {
  const normalized = email.toLowerCase().trim();

  try {
    const result = await client.send(new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: normalized,
    }));
    return { exists: true, status: result.UserStatus ?? null };
  } catch (err) {
    if ((err as { name?: string }).name === "UserNotFoundException") {
      return { exists: false, status: null };
    }
    throw err;
  }
}


