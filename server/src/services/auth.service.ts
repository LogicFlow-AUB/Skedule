import { createAuthClient, requireSupabaseClient } from '../db/supabase.js';
import { AppError } from '../utils/app-error.js';

export type RegisterInput = {
  email: string;
  password: string;
  confirmPassword: string;
};

export type LoginInput = Pick<RegisterInput, 'email' | 'password'>;

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthResponse = {
  user: AuthUser;
  tokens?: AuthTokens;
};

function tokensFromSession(session: { access_token: string; refresh_token: string }): AuthTokens {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };
}

async function ensureProfile(userId: string, email: string): Promise<void> {
  const db = requireSupabaseClient();
  const { error } = await db.from('users').upsert({ id: userId, email }, { onConflict: 'id' });

  if (error) {
    throw error;
  }
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  if (input.password !== input.confirmPassword) {
    throw new AppError(400, 'PASSWORD_CONFIRMATION_MISMATCH', 'Passwords do not match.');
  }

  const email = input.email.trim().toLowerCase();

  if (!email.endsWith('@mail.aub.edu')) {
    throw new AppError(400, 'AUB_EMAIL_REQUIRED', 'Only AUB email addresses are allowed.');
  }

  const { data, error } = await createAuthClient().auth.signUp({
    email: input.email,
    password: input.password,
  });

  if (error) {
    if (error.code === 'user_already_exists') {
      throw new AppError(
        409,
        'EMAIL_ALREADY_REGISTERED',
        'An account with this email already exists.',
      );
    }

    throw error;
  }

  const user = data.user;

  if (!user) {
    throw new AppError(500, 'AUTH_SIGNUP_FAILED', 'Account was not created.');
  }

  await ensureProfile(user.id, user.email ?? input.email);

  const response: AuthResponse = {
    user: { id: user.id, email: user.email ?? input.email },
  };

  if (data.session) {
    response.tokens = tokensFromSession(data.session);
  }

  return response;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const { data, error } = await createAuthClient().auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const user = data.user;

  if (!user) {
    throw new AppError(500, 'AUTH_SESSION_MISSING', 'Login could not be completed.');
  }

  await ensureProfile(user.id, user.email ?? input.email);

  return {
    user: { id: user.id, email: user.email ?? input.email },
    tokens: tokensFromSession(data.session),
  };
}

export async function logout(userId: string): Promise<void> {
  const db = requireSupabaseClient();
  await db.auth.admin.signOut(userId, 'global');
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const { data, error } = await createAuthClient().auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    throw new AppError(401, 'INVALID_TOKEN', 'Authentication token is invalid or expired.');
  }

  return tokensFromSession(data.session);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await createAuthClient().auth.resetPasswordForEmail(email);

  if (error) {
    throw error;
  }
}

export async function resetPassword(
  tokenHash: string,
  password: string,
  confirmPassword: string,
): Promise<void> {
  if (password !== confirmPassword) {
    throw new AppError(400, 'PASSWORD_CONFIRMATION_MISMATCH', 'Passwords do not match.');
  }

  const { data, error } = await createAuthClient().auth.verifyOtp({
    type: 'recovery',
    token_hash: tokenHash,
  });

  if (error || !data.user) {
    throw new AppError(
      400,
      'INVALID_RESET_TOKEN',
      'Password reset token is invalid or has expired.',
    );
  }

  const db = requireSupabaseClient();
  const { error: updateError } = await db.auth.admin.updateUserById(data.user.id, {
    password,
  });

  if (updateError) {
    throw updateError;
  }
}

export async function getUser(userId: string): Promise<AuthUser> {
  const db = requireSupabaseClient();
  const { data, error } = await db.auth.admin.getUserById(userId);

  if (error || !data.user) {
    throw new AppError(401, 'INVALID_TOKEN', 'Authentication token is invalid or expired.');
  }

  return { id: data.user.id, email: data.user.email ?? '' };
}
