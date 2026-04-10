// components/LoginForm.jsx
'use client';

import { useEffect, useState } from 'react';
import { signInWithRedirect, GoogleAuthProvider, getRedirectResult } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { track, identifyUser } from "@/lib/analytics";

const mapFirebaseError = (code: string): string => {
  switch (code) {
    case 'INVALID_LOGIN_CREDENTIALS':
    case 'INVALID_PASSWORD':
      return 'Incorrect email or password.';
    case 'EMAIL_NOT_FOUND':
      return 'No account found with this email.';
    case 'USER_DISABLED':
      return 'This account has been disabled. Please contact support.';
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return 'Too many failed attempts. Please try again later.';
    case 'INVALID_EMAIL':
      return 'Invalid email address.';
    case 'EMAIL_EXISTS':
    case 'auth/email-already-exists':
      return 'An account with this email already exists.';
    case 'WEAK_PASSWORD':
      return 'Password must be at least 6 characters.';
    case 'SIGN_IN_ERROR':
      return 'Sign-in failed. Please try again.';
    default:
      return code ?? 'An unexpected error occurred. Please try again.';
  }
}

const internLogin = async (idToken: string) => {
  const internalLogin = await fetch(`/api/login`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    }
  );

  if (!internalLogin.ok) {
    throw new Error("Session setup failed. Please try again.");
  }
}

export function LoginForm({
  className,
  defaultEmail,
  next,
  onSuccess,
  onSwitchToRegister,
  ...props
}: React.ComponentProps<"form"> & {
  defaultEmail?: string;
  next?: string;
  onSuccess?: (user: any) => void;
  onSwitchToRegister?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    track({ name: "login_attempt", params: { method: "email" } });

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        body: JSON.stringify({
          mode: "login",
          email,
          password,
        }),
      });

      const data = await res.json()

      if (!res.ok) {
        throw new Error(mapFirebaseError(data.error));
      }

      const { idToken, uid, plan, credits, onboardingStep } = data

      await internLogin(idToken)

      track({ name: "login_success", params: { method: "email" } });
      if (uid) identifyUser(uid, { plan, credits, onboarding_step: onboardingStep, signup_method: "email" });
      window.location.href = next || "/dashboard";
    } catch (err: any) {
      track({ name: "login_error", params: { method: "email", error_code: err.code ?? err.message ?? "unknown" } });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleGoogleRedirect = async () => {
      setGoogleLoading(true);
      setError('');

      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          const now = new Date().toISOString();
          if (!userDoc.exists()) {
            // Crea il documento se non esiste
            await setDoc(userDocRef, {
              name: user.displayName || 'Google User',
              email: user.email,
              createdAt: now,
              lastLogin: now,
              onboardingStep: 1,
              plan: "free_trial",
              credits: 0,
              emailVerified: true,
            });
          } else {
            await updateDoc(userDocRef, {
              lastLogin: now,
            });
          }

          const idToken = await user.getIdToken();

          await fetch("/api/login", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          track({ name: "login_success", params: { method: "google" } });
          identifyUser(user.uid, { signup_method: "google" });
          const redirectTo = sessionStorage.getItem('loginNext') || '/dashboard';
          sessionStorage.removeItem('loginNext');
          router.push(redirectTo);
        }
      } catch (err: any) {
        console.error('Errore Google redirect:', err);
        track({ name: "login_error", params: { method: "google", error_code: err.code ?? err.message ?? "unknown" } });
        setError(err.message);
      } finally {
        setGoogleLoading(false);
      }
    };

    handleGoogleRedirect();
  }, [router, setError, setGoogleLoading]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      if (next) sessionStorage.setItem('loginNext', next);
      track({ name: "login_attempt", params: { method: "google" } });
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      //useDeviceLanguage(auth);
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error('Google login error:', err);
      let errorMessage = 'Google sign-in failed. Please try again.';

      switch (err.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in cancelled.';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Pop-up blocked by your browser. Please allow pop-ups and try again.';
          break;
        default:
          errorMessage = err.message;
      }

      track({ name: "login_error", params: { method: "google", error_code: err.code ?? "unknown" } });
      setError(errorMessage);
      setGoogleLoading(false);
    }
  };

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="text-gray-400 text-sm">
          Sign in to your CandidAI account
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-gray-300 text-sm">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            defaultValue={defaultEmail}
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50"
            required
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password" className="text-gray-300 text-sm">Password</Label>
            <Link
              href="/forgot-password"
              className="ml-auto text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50"
            required
          />
        </div>
        <Button type="submit" variant="primary" size="sm" className="w-full rounded-lg py-2.5 text-sm" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
        <div className="relative text-center text-sm">
          <div className="absolute inset-0 top-1/2 border-t border-white/10" />
          <span className="relative z-10 bg-transparent text-gray-500 px-3">or</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full rounded-lg py-2.5 text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-4 mr-2">
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor"
            />
          </svg>
          {googleLoading ? 'Signing in...' : 'Continue with Google'}
        </Button>
      </div>
      <p className="text-center text-sm text-gray-500">
        No account yet?{" "}
        <Link href="/register" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
          Create one
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({
  className,
  defaultEmail,
  onSuccess,
  onSwitchToLogin,
  ...props
}: React.ComponentProps<"form"> & {
  defaultEmail?: string;
  onSuccess?: (user: any) => void;
  onSwitchToLogin?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const name = formData.get('name') as string;

    // Validazione password
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    track({ name: "signup_attempt", params: { method: "email" } });

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        body: JSON.stringify({
          mode: "register",
          name,
          email,
          password,
        }),
      });

      const data = await res.json()

      if (!res.ok) {
        throw new Error(mapFirebaseError(data.error));
      }

      const { idToken, uid } = data

      await internLogin(idToken)

      track({ name: "signup_success", params: { method: "email" } });
      if (uid) identifyUser(uid, { plan: "free_trial", credits: 0, onboarding_step: 1, signup_method: "email" });
      window.location.href = "/dashboard";
    } catch (err: any) {
      track({ name: "signup_error", params: { method: "email", error_code: err.code ?? err.message ?? "unknown" } });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleGoogleRedirect = async () => {
      setGoogleLoading(true);
      setError('');

      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          const now = new Date().toISOString();
          if (!userDoc.exists()) {
            // Crea il documento se non esiste
            await setDoc(userDocRef, {
              name: user.displayName || 'Google User',
              email: user.email,
              createdAt: now,
              lastLogin: now,
              onboardingStep: 1,
              plan: "free_trial",
              credits: 0,
              emailVerified: true,
            });
          } else {
            await updateDoc(userDocRef, {
              lastLogin: now,
            });
          }

          const idToken = await user.getIdToken();

          await fetch("/api/login", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          track({ name: "signup_success", params: { method: "google" } });
          identifyUser(user.uid, { plan: "free_trial", credits: 0, onboarding_step: 1, signup_method: "google" });
          router.push('/dashboard');
        }
      } catch (err: any) {
        console.error('Errore Google redirect:', err);
        track({ name: "signup_error", params: { method: "google", error_code: err.code ?? err.message ?? "unknown" } });
        setError(err.message);
      } finally {
        setGoogleLoading(false);
      }
    };

    handleGoogleRedirect();
  }, [router, setError, setGoogleLoading]);

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setError('');

    try {
      track({ name: "signup_attempt", params: { method: "google" } });
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      //useDeviceLanguage(auth);
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error('Google login error:', err);
      let errorMessage = 'Google sign-up failed. Please try again.';

      switch (err.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-up cancelled.';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Pop-up blocked by your browser. Please allow pop-ups and try again.';
          break;
        default:
          errorMessage = err.message;
      }

      track({ name: "signup_error", params: { method: "google", error_code: err.code ?? "unknown" } });
      setError(errorMessage);
      setGoogleLoading(false);
    }
  };

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="text-gray-400 text-sm">
          Start landing more interviews today
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name" className="text-gray-300 text-sm">Full name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="John Doe"
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50"
            maxLength={30}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-gray-300 text-sm">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            defaultValue={defaultEmail}
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50"
            maxLength={50}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password" className="text-gray-300 text-sm">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Min. 6 characters"
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50"
            minLength={6}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword" className="text-gray-300 text-sm">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Repeat your password"
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50"
            minLength={6}
            required
          />
        </div>
        <Button type="submit" variant="primary" size="sm" className="w-full rounded-lg py-2.5 text-sm mt-1" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
        <div className="relative text-center text-sm">
          <div className="absolute inset-0 top-1/2 border-t border-white/10" />
          <span className="relative z-10 bg-transparent text-gray-500 px-3">or</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full rounded-lg py-2.5 text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300"
          onClick={handleGoogleSignup}
          disabled={googleLoading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-4 mr-2">
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor"
            />
          </svg>
          {googleLoading ? 'Creating account...' : 'Continue with Google'}
        </Button>
      </div>
      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm({
  className,
  defaultEmail,
  ...props
}: React.ComponentProps<"form"> & {
  defaultEmail?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    try {
      const res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      track({ name: "forgot_password_request", params: { success: true } });
      setSuccess("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      track({ name: "forgot_password_request", params: { success: false } });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold text-white">Reset your password</h1>
        <p className="text-gray-400 text-sm">
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg">
          {success}
        </div>
      )}

      <div className="grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-gray-300 text-sm">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            defaultValue={defaultEmail}
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50"
            required
          />
        </div>

        <Button type="submit" variant="primary" size="sm" className="w-full rounded-lg py-2.5 text-sm" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </div>

      <p className="text-center text-sm text-gray-500">
        Remember your password?{" "}
        <a href="/login" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
          Sign in
        </a>
      </p>
    </form>
  );
}
