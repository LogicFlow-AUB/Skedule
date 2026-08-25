import { requireSupabaseClient, requireAuthClient } from '../db/supabase.js';
import { AppError } from '../utils/app-error.js';

export type RegisterInput = {
  email: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
  major?: string;
  level?: string;
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

async function ensureProfile(
  userId: string,
  email: string,
  profileFields?: { firstName?: string; lastName?: string; major?: string; level?: string },
): Promise<void> {
  const profileRecord: Record<string, string> = {};
  if (profileFields?.firstName !== undefined) profileRecord.first_name = profileFields.firstName;
  if (profileFields?.lastName !== undefined) profileRecord.last_name = profileFields.lastName;
  if (profileFields?.major !== undefined) profileRecord.major = profileFields.major;
  if (profileFields?.level !== undefined) profileRecord.level = profileFields.level;

  const db = requireSupabaseClient();
  const { error } = await db.from('users').upsert(
    { id: userId, email, ...profileRecord },
    { onConflict: 'id' },
  );

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

  const authDb = requireAuthClient();
  const { data, error } = await authDb.auth.signUp({
    email: email,
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

  const profileFields: { firstName?: string; lastName?: string; major?: string; level?: string } = {};
  if (input.firstName !== undefined) profileFields.firstName = input.firstName;
  if (input.lastName !== undefined) profileFields.lastName = input.lastName;
  if (input.major !== undefined) profileFields.major = input.major;
  if (input.level !== undefined) profileFields.level = input.level;

  await ensureProfile(user.id, user.email ?? email, profileFields);

  const response: AuthResponse = {
    user: { id: user.id, email: user.email ?? email },
  };

  if (data.session) {
    response.tokens = tokensFromSession(data.session);
  }

  return response;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const authDb = requireAuthClient();
  const { data, error } = await authDb.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    if (error.code === 'email_not_confirmed') {
      throw new AppError(
        401,
        'EMAIL_NOT_CONFIRMED',
        'Please confirm your email address before signing in.',
      );
    }

    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const user = data.user;

  if (!user) {
    throw new AppError(500, 'AUTH_SESSION_MISSING', 'Login could not be completed.');
  }

  return {
    user: { id: user.id, email: user.email ?? input.email },
    tokens: tokensFromSession(data.session),
  };
}

export async function logout(userId: string): Promise<void> {
  const authDb = requireAuthClient();
  await authDb.auth.admin.signOut(userId, 'global');
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const authDb = requireAuthClient();
  const { data, error } = await authDb.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    throw new AppError(401, 'INVALID_TOKEN', 'Authentication token is invalid or expired.');
  }

  return tokensFromSession(data.session);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const authDb = requireAuthClient();
  const { error } = await authDb.auth.resetPasswordForEmail(email);

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

  const authDb = requireAuthClient();
  const { data, error } = await authDb.auth.verifyOtp({
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

  const { error: updateError } = await authDb.auth.admin.updateUserById(data.user.id, {
    password,
  });

  if (updateError) {
    throw updateError;
  }
}

export async function getUser(userId: string): Promise<AuthUser> {
  const authDb = requireAuthClient();
  const { data, error } = await authDb.auth.admin.getUserById(userId);

  if (error || !data.user) {
    throw new AppError(401, 'INVALID_TOKEN', 'Authentication token is invalid or expired.');
  }

  return { id: data.user.id, email: data.user.email ?? '' };
}
