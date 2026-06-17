"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn, Mail, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Card, GhostButton, Input, Label } from "@/components/ui";
import { createClient } from "@/lib/supabase";
import { authSchema, type AuthForm } from "@/lib/schemas";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup" | "recover">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useForm<AuthForm>({
    resolver: zodResolver(mode === "recover" ? authSchema.pick({ email: true }) : authSchema),
    defaultValues: { email: "", password: "", name: "" },
  });

  async function onSubmit(values: AuthForm) {
    setBusy(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { data: { name: values.name }, emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        setMessage("Cadastro criado. Confirme seu e-mail se o Supabase exigir.");
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
        if (error) throw error;
        router.push("/dashboard");
      }

      if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, { redirectTo: `${location.origin}/auth/callback` });
        if (error) throw error;
        setMessage("Enviamos o link de recuperacao para o e-mail informado.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel continuar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-mist px-4 py-8">
      <Card className="w-full max-w-md">
        <div className="mb-6">
          <p className="text-sm font-semibold text-good">Finance Family</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">{mode === "signup" ? "Criar conta" : mode === "recover" ? "Recuperar senha" : "Entrar"}</h1>
        </div>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          {mode === "signup" && (
            <Label>
              Nome
              <Input placeholder="Seu nome" {...form.register("name")} />
            </Label>
          )}

          <Label>
            E-mail
            <Input type="email" placeholder="voce@email.com" {...form.register("email")} />
            {form.formState.errors.email && <span className="text-xs text-danger">{form.formState.errors.email.message}</span>}
          </Label>

          {mode !== "recover" && (
            <Label>
              Senha
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="Sua senha" {...form.register("password")} />
                <button className="absolute right-3 top-2.5 text-zinc-500" type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Mostrar senha">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {form.formState.errors.password && <span className="text-xs text-danger">{form.formState.errors.password.message}</span>}
            </Label>
          )}

          {message && <p className="rounded-lg bg-mist p-3 text-sm text-zinc-700">{message}</p>}

          <Button className="w-full" disabled={busy}>
            {mode === "signup" ? <UserPlus size={18} /> : mode === "recover" ? <Mail size={18} /> : <LogIn size={18} />}
            {busy ? "Aguarde..." : mode === "signup" ? "Cadastrar" : mode === "recover" ? "Enviar link" : "Entrar"}
          </Button>
        </form>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <GhostButton type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Criar conta" : "Ja tenho conta"}
          </GhostButton>
          <GhostButton type="button" onClick={() => setMode("recover")}>
            Esqueci a senha
          </GhostButton>
        </div>
      </Card>
    </main>
  );
}
