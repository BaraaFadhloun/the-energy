"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, loading, error } = useAuth();
  const { t } = useLanguage();
  const authCopy = t<any>("auth");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setFormError(authCopy.passwordMismatch);
      return;
    }

    const { error: signUpError, confirmationEmailSent } = await signUp({ email, password });
    if (signUpError) {
      setFormError(signUpError);
      return;
    }

    if (confirmationEmailSent) {
      setSuccessMessage(authCopy.signUpEmailNotice);
    } else {
      router.replace("/analytics");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold text-foreground">{authCopy.signUpTitle}</h1>
            <p className="text-sm text-muted-foreground">{authCopy.signUpSubtitle}</p>
          </div>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">{authCopy.emailLabel}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{authCopy.passwordLabel}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{authCopy.confirmPasswordLabel}</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            {(formError || error) && (
              <p className="text-sm text-destructive">
                {authCopy.signUpErrorPrefix}
                {formError || error}
              </p>
            )}
            {successMessage && <p className="text-sm text-primary">{successMessage}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? authCopy.signUpSubmittingLabel : authCopy.signUpSubmitLabel}
            </Button>
          </form>
          <div className="text-center text-sm text-muted-foreground">
            {authCopy.haveAccountCta}{" "}
            <Link className="text-primary underline-offset-2 hover:underline" href="/sign-in">
              {authCopy.backToSignIn}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
