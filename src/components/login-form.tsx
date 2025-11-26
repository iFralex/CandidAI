// components/LoginForm.jsx
'use client';

import { useEffect, useState } from 'react';
import { signInWithRedirect, GoogleAuthProvider, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, updateProfile, getRedirectResult, useDeviceLanguage } from 'firebase/auth';
import app, { auth, db } from '@/lib/firebase';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const internLogin = async idToken => {
  const internalLogin = await fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/login`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    }
  );

  if (!internalLogin.ok) {
    throw new Error("Errore durante login interno");
  }
}

export function LoginForm({
  className,
  defaultEmail,
  onSuccess,
  onSwitchToRegister,
  ...props
}: React.ComponentProps<"form"> & {
  defaultEmail?: string;
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

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        body: JSON.stringify({
          mode: "login",
          email,
          password,
        }),
      });

      const { idToken } = await res.json()

      await internLogin(idToken)

      router.push("/dashboard");
    } catch (err: any) {
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

          if (!userDoc.exists()) {
            // Crea il documento se non esiste
            await setDoc(userDocRef, {
              name: user.displayName || 'Google User',
              email: user.email,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
            });
          } else {
            await updateDoc(userDocRef, {
              lastLogin: new Date().toISOString(),
            });
          }

          const idToken = await user.getIdToken();

          await fetch("/api/login", {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          router.push('/dashboard');
        }
      } catch (err: any) {
        console.error('Errore Google redirect:', err);
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
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      //useDeviceLanguage(auth);
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error('Google login error:', err);
      let errorMessage = 'Errore durante il login con Google';

      switch (err.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Login cancellato dall\'utente';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Popup bloccato dal browser';
          break;
        default:
          errorMessage = err.message;
      }

      setError(errorMessage);
      setGoogleLoading(false);
    }
  };

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Login to your account</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your email below to login to your account
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            defaultValue={defaultEmail}
            required
          />
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </Button>
        <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
          <span className="bg-background text-muted-foreground relative z-10 px-2">
            Or continue with
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-5 mr-2">
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor"
            />
          </svg>
          {googleLoading ? 'Logging in...' : 'Login with Google'}
        </Button>
      </div>
      <div className="text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="underline underline-offset-4"
        >
          Sign up
        </Link>
      </div>
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
      setError('Le password non coincidono');
      setLoading(false);
      return;
    }

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

      const { idToken } = await res.json()

      await internLogin(idToken)

      router.push("/dashboard");
    } catch (err: any) {
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

          if (!userDoc.exists()) {
            // Crea il documento se non esiste
            await setDoc(userDocRef, {
              name: user.displayName || 'Google User',
              email: user.email,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
            });
          } else {
            await updateDoc(userDocRef, {
              lastLogin: new Date().toISOString(),
            });
          }

          const idToken = await user.getIdToken();

          await fetch("/api/login", {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          router.push('/dashboard');
        }
      } catch (err: any) {
        console.error('Errore Google redirect:', err);
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
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      //useDeviceLanguage(auth);
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error('Google login error:', err);
      let errorMessage = 'Errore durante il login con Google';

      switch (err.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Login cancellato dall\'utente';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Popup bloccato dal browser';
          break;
        default:
          errorMessage = err.message;
      }

      setError(errorMessage);
      setGoogleLoading(false);
    }
  };

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Create an account</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your details below to create your account
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="John Doe"
            required
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            defaultValue={defaultEmail}
            required
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            minLength={6}
            required
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            minLength={6}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
        <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
          <span className="bg-background text-muted-foreground relative z-10 px-2">
            Or continue with
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignup}
          disabled={googleLoading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-5 mr-2">
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor"
            />
          </svg>
          {googleLoading ? 'Creating account...' : 'Sign up with Google'}
        </Button>
      </div>
      <div className="text-center text-sm">
        Already have an account?{" "}
        <Link
          type="button"
          href="/login"
          className="underline underline-offset-4"
        >
          Sign in
        </Link>
      </div>
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
  const router = useRouter();

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

      setSuccess("Password reset email sent! Check your inbox.");
    } catch (err: any) {
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
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
          {success}
        </div>
      )}

      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            defaultValue={defaultEmail}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </div>

      <div className="text-center text-sm">
        Remember your password?{" "}
        <a href="/login" className="underline underline-offset-4">
          Log in
        </a>
      </div>
    </form>
  );
}
