"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths, format, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, CalendarCheck, CreditCard, ListFilter, LogOut, Plus, ReceiptText, Settings, Tags, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, GhostButton, Input, Label, Select, Stat, Textarea } from "@/components/ui";
import {
  addBill,
  addCategory,
  addExpense,
  addInstallment,
  inviteMemberByEmail,
  closeCycle,
  deleteCategory,
  getOverview,
  getSessionUser,
  saveSettings,
  toggleBillPaid,
  type Bill,
  type Client,
  type Expense,
  type Installment,
} from "@/lib/finance";
import { currency, shortDate, shortTime, toDateInput } from "@/lib/format";
import { billSchema, categorySchema, expenseSchema, installmentSchema, settingsSchema, type BillForm, type CategoryForm, type ExpenseForm, type InstallmentForm, type SettingsForm } from "@/lib/schemas";
import { createClient } from "@/lib/supabase";

type Tab = "home" | "expenses" | "installments" | "bills" | "history" | "settings";
type Sort = "recent" | "oldest" | "highest" | "lowest";

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "home", label: "Inicio", icon: BarChart3 },
  { id: "expenses", label: "Gastos", icon: CreditCard },
  { id: "installments", label: "Parcelas", icon: ReceiptText },
  { id: "bills", label: "Contas", icon: CalendarCheck },
  { id: "history", label: "Historico", icon: ListFilter },
  { id: "settings", label: "Ajustes", icon: Settings },
];

export function DashboardApp() {
  const supabase = useMemo(() => createClient() as Client, []);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("home");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [memberEmail, setMemberEmail] = useState("");

  const userQuery = useQuery({ queryKey: ["user"], queryFn: () => getSessionUser(supabase), retry: false });
  const overviewQuery = useQuery({
    queryKey: ["overview"],
    queryFn: () => getOverview(supabase),
    enabled: Boolean(userQuery.data),
    retry: false,
  });

  useEffect(() => {
    if (userQuery.isError) router.replace("/login");
  }, [router, userQuery.isError]);

  const overview = overviewQuery.data;
  const user = userQuery.data;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["overview"] });
  const expenseForm = useForm<ExpenseForm>({ resolver: zodResolver(expenseSchema), defaultValues: { value: 0, category_id: "", description: "", expense_date: toDateInput() } });
  const categoryForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema), defaultValues: { name: "" } });
  const installmentForm = useForm<InstallmentForm>({ resolver: zodResolver(installmentSchema), defaultValues: { name: "", total_value: 0, total_installments: 2, start_date: toDateInput() } });
  const billForm = useForm<BillForm>({ resolver: zodResolver(billSchema), defaultValues: { name: "", value: 0, due_date: toDateInput(), notes: "" } });
  const settingsForm = useForm<SettingsForm>({ resolver: zodResolver(settingsSchema), values: overview ? { payment_day: overview.settings.payment_day, monthly_limit: overview.settings.monthly_limit } : undefined });

  const mutation = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: refresh,
  });

  if (userQuery.isLoading || overviewQuery.isLoading) {
    return <main className="grid min-h-screen place-items-center bg-mist p-6 text-sm font-semibold text-zinc-600">Carregando financas...</main>;
  }

  if (!overview || !user) {
    return <main className="grid min-h-screen place-items-center bg-mist p-6 text-sm font-semibold text-zinc-600">Abrindo sessao...</main>;
  }

  const spent = Number(overview.cycle.total_spent);
  const limit = Number(overview.cycle.monthly_limit);
  const remaining = limit - spent;
  const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const alert = getLimitAlert(percent, remaining, overview.expenses);
  const filteredExpenses = sortExpenses(
    overview.expenses.filter((expense) => (filterCategory === "all" || expense.category_id === filterCategory) && (filterUser === "all" || expense.created_by === filterUser)),
    sort,
  );
  const users = uniqueUsers(overview.expenses);
  const billTotals = getBillTotals(overview.bills);
  const reports = getReports(overview.expenses);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-mist pb-24">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-good">{overview.household.name}</p>
            <h1 className="text-xl font-bold text-ink">Finance Family</h1>
          </div>
          <button className="tap rounded-lg border border-line p-2" onClick={signOut} aria-label="Sair">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 p-4">
        {tab === "home" && (
          <>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-500">Ciclo atual</p>
                  <h2 className="text-2xl font-bold">{percent}% utilizado</h2>
                </div>
                <Button onClick={() => setTab("expenses")}>
                  <Plus size={18} />
                  Gasto
                </Button>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-mist">
                <div className={progressClass(percent)} style={{ width: `${Math.min(percent, 100)}%` }} />
              </div>
              {alert && <div className={alert.className}>{alert.text}</div>}
            </Card>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Limite mensal" value={currency.format(limit)} />
              <Stat label="Valor gasto" value={currency.format(spent)} tone={percent >= 100 ? "danger" : "default"} />
              <Stat label="Restante" value={currency.format(remaining)} tone={remaining >= 0 ? "good" : "danger"} />
              <Stat label="Contas pendentes" value={currency.format(billTotals.pending)} tone={billTotals.pending > 0 ? "warn" : "good"} />
            </div>

            <Card>
              <h2 className="mb-3 text-lg font-bold">Proximos vencimentos</h2>
              <BillList bills={overview.bills.slice(0, 5)} onToggle={(bill) => mutation.mutate(() => toggleBillPaid(supabase, bill))} />
            </Card>
          </>
        )}

        {tab === "expenses" && (
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <Card>
              <h2 className="mb-4 text-lg font-bold">Adicionar gasto</h2>
              <form
                className="space-y-3"
                onSubmit={expenseForm.handleSubmit((values) =>
                  mutation.mutate(async () => {
                    await addExpense(supabase, overview.household.id, overview.cycle.id, user, values);
                    expenseForm.reset({ value: 0, category_id: "", description: "", expense_date: toDateInput() });
                  }),
                )}
              >
                <Label>Valor<Input type="number" step="0.01" {...expenseForm.register("value")} /></Label>
                <Label>Categoria<Select {...expenseForm.register("category_id")}><option value="">Selecione</option>{overview.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Label>
                <Label>Descricao<Input placeholder="Pao e leite" {...expenseForm.register("description")} /></Label>
                <Label>Data<Input type="date" {...expenseForm.register("expense_date")} /></Label>
                <Button className="w-full" disabled={mutation.isPending}><Plus size={18} />Salvar gasto</Button>
              </form>
            </Card>

            <Card>
              <div className="mb-4 flex flex-col gap-2 md:flex-row">
                <Select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}>
                  <option value="all">Todas categorias</option>
                  {overview.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </Select>
                <Select value={filterUser} onChange={(event) => setFilterUser(event.target.value)}>
                  <option value="all">Todos usuarios</option>
                  {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
                <Select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                  <option value="recent">Mais recente</option>
                  <option value="oldest">Mais antigo</option>
                  <option value="highest">Maior valor</option>
                  <option value="lowest">Menor valor</option>
                </Select>
              </div>
              <ExpenseList expenses={filteredExpenses} />
            </Card>
            <Card>
              <h2 className="mb-4 text-lg font-bold">Convidar pessoa</h2>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate(async () => {
                    await inviteMemberByEmail(supabase, memberEmail);
                    setMemberEmail("");
                  });
                }}
              >
                <Input type="email" placeholder="email@familia.com" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} required />
                <Button disabled={mutation.isPending || !memberEmail}><Plus size={18} /></Button>
              </form>
            </Card>
          </div>
        )}

        {tab === "installments" && (
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <Card>
              <h2 className="mb-4 text-lg font-bold">Compra parcelada</h2>
              <form className="space-y-3" onSubmit={installmentForm.handleSubmit((values) => mutation.mutate(() => addInstallment(supabase, overview.household.id, user, values)))}>
                <Label>Nome<Input placeholder="Notebook" {...installmentForm.register("name")} /></Label>
                <Label>Valor total<Input type="number" step="0.01" {...installmentForm.register("total_value")} /></Label>
                <Label>Parcelas<Input type="number" {...installmentForm.register("total_installments")} /></Label>
                <Label>Data inicial<Input type="date" {...installmentForm.register("start_date")} /></Label>
                <Button className="w-full" disabled={mutation.isPending}><Plus size={18} />Salvar parcela</Button>
              </form>
            </Card>
            <Card><InstallmentList installments={overview.installments} /></Card>
          </div>
        )}

        {tab === "bills" && (
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <Card>
              <h2 className="mb-4 text-lg font-bold">Conta fixa</h2>
              <form className="space-y-3" onSubmit={billForm.handleSubmit((values) => mutation.mutate(() => addBill(supabase, overview.household.id, user, values)))}>
                <Label>Nome<Input placeholder="Internet" {...billForm.register("name")} /></Label>
                <Label>Valor<Input type="number" step="0.01" {...billForm.register("value")} /></Label>
                <Label>Vencimento<Input type="date" {...billForm.register("due_date")} /></Label>
                <Label>Observacao<Textarea {...billForm.register("notes")} /></Label>
                <Button className="w-full" disabled={mutation.isPending}><Plus size={18} />Salvar conta</Button>
              </form>
            </Card>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Total" value={currency.format(billTotals.total)} />
                <Stat label="Pago" value={currency.format(billTotals.paid)} tone="good" />
                <Stat label="Pendente" value={currency.format(billTotals.pending)} tone="warn" />
              </div>
              <Card><BillList bills={overview.bills} onToggle={(bill) => mutation.mutate(() => toggleBillPaid(supabase, bill))} /></Card>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-4">
            <Card>
              <Button className="w-full" disabled={mutation.isPending} onClick={() => mutation.mutate(() => closeCycle(supabase, overview.cycle, overview.settings.monthly_limit))}>
                Fechar Fatura
              </Button>
            </Card>
            <Card><HistoryList cycles={overview.history} /></Card>
            <Card><Reports reports={reports} /></Card>
          </div>
        )}

        {tab === "settings" && (
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <Card>
              <h2 className="mb-4 text-lg font-bold">Ciclo do cartao</h2>
              <form className="space-y-3" onSubmit={settingsForm.handleSubmit((values) => mutation.mutate(() => saveSettings(supabase, overview.household.id, values)))}>
                <Label>Dia de pagamento<Input type="number" min={1} max={31} {...settingsForm.register("payment_day")} /></Label>
                <Label>Limite mensal<Input type="number" step="0.01" {...settingsForm.register("monthly_limit")} /></Label>
                <Button className="w-full" disabled={mutation.isPending}>Salvar ajustes</Button>
              </form>
            </Card>
            <Card>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Tags size={20} />Categorias</h2>
              <form className="mb-4 flex gap-2" onSubmit={categoryForm.handleSubmit((values) => mutation.mutate(async () => { await addCategory(supabase, overview.household.id, user, values); categoryForm.reset({ name: "" }); }))}>
                <Input placeholder="Nova categoria" {...categoryForm.register("name")} />
                <Button disabled={mutation.isPending}><Plus size={18} /></Button>
              </form>
              <div className="grid gap-2">
                {overview.categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2">
                    <span className="font-medium">{category.name}</span>
                    <button className="tap rounded-lg p-2 text-danger" onClick={() => mutation.mutate(() => deleteCategory(supabase, category.id))} aria-label="Excluir categoria"><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-6">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={`tap flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold ${tab === item.id ? "text-good" : "text-zinc-500"}`} onClick={() => setTab(item.id)}>
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

function progressClass(percent: number) {
  const color = percent >= 100 ? "bg-danger" : percent >= 90 ? "bg-orange-500" : percent >= 80 ? "bg-warn" : "bg-good";
  return `h-full rounded-full ${color}`;
}

function getLimitAlert(percent: number, remaining: number, expenses: Expense[]) {
  if (percent < 80) return null;
  const overExpense = remaining < 0 ? expenses.find((expense) => Number(expense.value) >= Math.abs(remaining)) ?? expenses[0] : null;
  if (percent >= 100) {
    const detail = overExpense ? ` Compra: ${overExpense.categories?.name ?? "Sem categoria"}, ${currency.format(Number(overExpense.value))}, ${shortDate.format(new Date(overExpense.expense_date))}.` : "";
    return { className: "mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-danger", text: `Limite excedido em ${currency.format(Math.abs(remaining))}.${detail}` };
  }
  if (percent >= 90) return { className: "mt-4 rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-700", text: "90% do limite consumido." };
  return { className: "mt-4 rounded-lg bg-yellow-50 p-3 text-sm font-semibold text-warn", text: "80% do limite consumido." };
}

function sortExpenses(expenses: Expense[], sort: Sort) {
  return [...expenses].sort((a, b) => {
    if (sort === "oldest") return new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime();
    if (sort === "highest") return Number(b.value) - Number(a.value);
    if (sort === "lowest") return Number(a.value) - Number(b.value);
    return new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime();
  });
}

function uniqueUsers(expenses: Expense[]) {
  const map = new Map<string, string>();
  expenses.forEach((expense) => map.set(expense.created_by, expense.profiles?.name ?? expense.profiles?.email ?? "Usuario"));
  return Array.from(map, ([id, name]) => ({ id, name }));
}

function getBillTotals(bills: Bill[]) {
  return bills.reduce(
    (totals, bill) => {
      totals.total += Number(bill.value);
      totals[bill.paid ? "paid" : "pending"] += Number(bill.value);
      return totals;
    },
    { total: 0, paid: 0, pending: 0 },
  );
}

function getReports(expenses: Expense[]) {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.value), 0);
  const categories = new Map<string, { total: number; count: number }>();
  expenses.forEach((expense) => {
    const name = expense.categories?.name ?? "Sem categoria";
    const current = categories.get(name) ?? { total: 0, count: 0 };
    categories.set(name, { total: current.total + Number(expense.value), count: current.count + 1 });
  });
  return Array.from(categories, ([name, item]) => ({ name, ...item, percent: total ? Math.round((item.total / total) * 100) : 0 })).sort((a, b) => b.total - a.total);
}

function ExpenseList({ expenses }: { expenses: Expense[] }) {
  if (!expenses.length) return <p className="text-sm text-zinc-500">Nenhum gasto encontrado.</p>;
  return (
    <div className="divide-y divide-line">
      {expenses.map((expense) => (
        <div key={expense.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{expense.categories?.name ?? "Sem categoria"}</p>
              <p className="text-sm text-zinc-500">{expense.description}</p>
              <p className="mt-1 text-xs text-zinc-500">{shortDate.format(new Date(expense.expense_date))} as {shortTime.format(new Date(expense.expense_date))} - {expense.profiles?.name ?? expense.profiles?.email ?? "Usuario"}</p>
            </div>
            <p className="whitespace-nowrap font-bold">{currency.format(Number(expense.value))}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function InstallmentList({ installments }: { installments: Installment[] }) {
  if (!installments.length) return <p className="text-sm text-zinc-500">Nenhuma compra parcelada cadastrada.</p>;
  return (
    <div className="divide-y divide-line">
      {installments.map((item) => {
        const remaining = Math.max(item.total_installments - item.current_installment + 1, 0);
        const endDate = addMonths(parseISO(item.start_date), item.total_installments - 1);
        return (
          <div key={item.id} className="py-3">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-zinc-500">Parcela {Math.min(item.current_installment, item.total_installments)}/{item.total_installments} - restam {remaining}</p>
                <p className="text-xs text-zinc-500">Termina em {format(endDate, "MMMM/yyyy", { locale: ptBR })}</p>
              </div>
              <p className="font-bold">{currency.format(Number(item.installment_value))}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BillList({ bills, onToggle }: { bills: Bill[]; onToggle: (bill: Bill) => void }) {
  if (!bills.length) return <p className="text-sm text-zinc-500">Nenhuma conta fixa cadastrada.</p>;
  return (
    <div className="divide-y divide-line">
      {bills.map((bill) => {
        const late = !bill.paid && isBefore(parseISO(bill.due_date), new Date());
        return (
          <div key={bill.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold">{bill.name}</p>
              <p className={`text-sm ${late ? "text-danger" : "text-zinc-500"}`}>{shortDate.format(parseISO(bill.due_date))} - {bill.paid ? "Pago" : late ? "Atrasada" : "Pendente"}</p>
              {bill.notes && <p className="text-xs text-zinc-500">{bill.notes}</p>}
            </div>
            <div className="text-right">
              <p className="font-bold">{currency.format(Number(bill.value))}</p>
              <GhostButton className="mt-1 !min-h-9 px-3 py-1 text-xs" onClick={() => onToggle(bill)}>{bill.paid ? "Desmarcar" : "Pagar"}</GhostButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryList({ cycles }: { cycles: Array<{ id: string; start_date: string; end_date: string | null; monthly_limit: number; total_spent: number }> }) {
  if (!cycles.length) return <p className="text-sm text-zinc-500">Nenhuma fatura fechada ainda.</p>;
  return (
    <div className="divide-y divide-line">
      {cycles.map((cycle) => {
        const exceeded = Math.max(Number(cycle.total_spent) - Number(cycle.monthly_limit), 0);
        return (
          <div key={cycle.id} className="grid grid-cols-2 gap-2 py-3 md:grid-cols-4">
            <span className="font-semibold">{format(parseISO(cycle.start_date), "MMMM/yyyy", { locale: ptBR })}</span>
            <span>{currency.format(Number(cycle.monthly_limit))}</span>
            <span>{currency.format(Number(cycle.total_spent))}</span>
            <span className={exceeded > 0 ? "font-semibold text-danger" : "text-good"}>{currency.format(exceeded)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Reports({ reports }: { reports: Array<{ name: string; total: number; count: number; percent: number }> }) {
  if (!reports.length) return <p className="text-sm text-zinc-500">Relatorios aparecem apos os primeiros gastos.</p>;
  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">Relatorio por categoria</h2>
      <div className="space-y-3">
        {reports.map((item) => (
          <div key={item.name}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold">{item.name} - {item.count} gastos</span>
              <span>{currency.format(item.total)} - {item.percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-mist"><div className="h-full rounded-full bg-good" style={{ width: `${item.percent}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
