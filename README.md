# Finance Family App

Aplicacao web mobile-first para controle financeiro familiar com Next.js, React, TypeScript, TailwindCSS e Supabase.

## Funcionalidades

- Login, cadastro e recuperacao de senha com Supabase Auth.
- Dashboard de limite mensal com gasto, restante, percentual e alertas de 80%, 90% e 100%.
- Lancamento de gastos com categoria, descricao, data, hora e usuario responsavel.
- Categorias personalizadas.
- Extrato com filtros por categoria e usuario, alem de ordenacao por data ou valor.
- Compras parceladas com parcela atual, parcelas restantes e previsao de termino.
- Fechamento de fatura com historico de ciclos.
- Contas fixas com totais pagos, pendentes, vencimentos proximos e atrasos.
- Relatorio por categoria com total, percentual e quantidade.
- Cadastro privado: depois do primeiro usuario, novas contas precisam de convite por e-mail.
- Compartilhamento familiar por convite para marido/esposa usarem os mesmos dados.

## Stack

- Next.js App Router
- React + TypeScript
- TailwindCSS
- Supabase Auth + PostgreSQL + Row Level Security
- React Query
- React Hook Form + Zod

## Instalacao

```bash
npm install
cp .env.example .env.local
npm run dev
```

Preencha `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Banco Supabase

1. Crie um projeto no Supabase.
2. Abra `SQL Editor`.
3. Execute o arquivo `supabase/schema.sql`.
4. Em `Authentication > URL Configuration`, configure:
   - Site URL: URL local ou Vercel.
   - Redirect URL: `https://seu-dominio.vercel.app/auth/callback`.

O SQL cria tabelas, triggers, RLS, politicas de seguranca, categorias iniciais, ciclo inicial e o fluxo de convite por e-mail.

## Acesso privado

O primeiro cadastro cria a familia inicial. Depois disso, qualquer novo cadastro sem convite e bloqueado pelo trigger `handle_new_user`.

Para liberar outra pessoa:

1. Entre no app com o usuario principal.
2. Abra `Ajustes`.
3. Informe o e-mail em `Convidar pessoa`.
4. A pessoa cria conta com exatamente esse e-mail.

O convite nao envia e-mail automaticamente. Ele libera aquele e-mail no banco; envie o link do app manualmente para a pessoa criar a conta. Se a pessoa ja tiver conta, o convite adiciona esse usuario a familia imediatamente. Se ainda nao tiver, o convite fica pendente ate o cadastro.

Se aparecer `email rate limit exceeded`, o limite de envio de e-mails do Supabase foi atingido. Aguarde alguns minutos ou desative temporariamente a confirmacao de e-mail em `Authentication > Providers > Email` durante os testes.

## Tipos TypeScript

Depois de conectar o Supabase CLI, gere tipos oficiais com:

```bash
npx supabase gen types typescript --project-id seu-project-id --schema public > lib/database.types.ts
```

## Deploy

1. Suba o projeto para um repositorio Git.
2. Importe na Vercel.
3. Configure as variaveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Rode o deploy.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Observacoes de producao

- O build funciona mesmo sem `.env.local`, mas o app so opera corretamente com as credenciais Supabase reais.
- Para compartilhar dados, a segunda pessoa precisa criar conta antes de ser adicionada por e-mail em `Ajustes`.
- As politicas RLS isolam dados por familia (`household`).
