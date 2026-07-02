"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addMonths, endOfMonth, format, isAfter, isBefore, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, CalendarCheck, CreditCard, ListFilter, LogOut, Pencil, Plus, ReceiptText, Settings, Tags, Trash2 } from "lucide-react";
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
  deleteBill,
  deleteCategory,
  deleteExpense,
  deleteInstallment,
  getOverview,
  getSessionUser,
  inviteMemberByEmail,
  payAllBills,
  payCardCycle,
  saveSettings,
  toggleBillPaid,
  updateBill,
  updateExpense,
  updateInstallment,
  type AccessInvite,
  type Bill,
  type Client,
  type Expense,
  type Installment,
} from "@/lib/finance";
import { currency, dateOnlyFromStored, shortDate, shortTime, toDateInput } from "@/lib/format";
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
  const [inviteMessage, setInviteMessage] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);

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
  const installmentForm = useForm<InstallmentForm>({ resolver: zodResolver(installmentSchema), defaultValues: { name: "", installment_value: 0, total_installments: 2, current_installment: 1, start_date: toDateInput(), notes: "" } });
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

  const cardCycle = getCardCycleRange(overview.settings.payment_day);
  const monthlyFinance = getMonthlyFinance(overview.expenses, overview.bills, overview.installments, cardCycle);
  const cardUpcomingItems = getCardUpcomingItems(overview.expenses, overview.installments, cardCycle);
  const cardCommitment = getCardCommitment(overview.installments);
  const cardOverdue = isAfter(startOfDay(new Date()), cardCycle.end);
  const spent = monthlyFinance.cardTotal;
  const limit = Number(overview.settings.monthly_limit);
  const remaining = limit - spent;
  const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const alert = getLimitAlert(percent, remaining, overview.expenses);
  const filteredExpenses = sortExpenses(
    overview.expenses.filter((expense) => (filterCategory === "all" || expense.category_id === filterCategory) && (filterUser === "all" || expense.created_by === filterUser)),
    sort,
  );
  const users = uniqueUsers(overview.expenses);
  const billTotals = getBillTotals(overview.bills);
  const total = monthlyFinance.installmentsTotal + monthlyFinance.expensesTotal + billTotals.total;
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
        {mutation.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-danger">
            {mutation.error instanceof Error ? mutation.error.message : "Nao foi possivel salvar a alteracao."}
          </div>
        )}

        {tab === "home" && (
          <>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-500">Ciclo atual: {shortDate.format(cardCycle.start)} ate {shortDate.format(cardCycle.end)}</p>
                  <h2 className="text-2xl font-bold">{percent}% utilizado</h2>
                  {cardOverdue && <p className="mt-1 text-sm font-semibold text-danger">Cartao em atraso. Pague para abrir o proximo ciclo.</p>}
                </div>
                <Button onClick={() => mutation.mutate(() => payCardCycle(supabase, overview.cycle, overview.settings.monthly_limit, cardCycle.end))}>
                  <CreditCard size={18} />
                  Pagar cartao
                </Button>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-mist">
                <div className={progressClass(percent)} style={{ width: `${Math.min(percent, 100)}%` }} />
              </div>
              {alert && <div className={alert.className}>{alert.text}</div>}
            </Card>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Limite mensal" value={currency.format(limit)} />
              <Stat label="Fatura atual" value={currency.format(spent)} tone={percent >= 100 ? "danger" : "default"} />
              <Stat label="Restante" value={currency.format(remaining)} tone={remaining >= 0 ? "good" : "danger"} />
              <Stat label="Cartao comprometido" value={currency.format(cardCommitment)} tone={cardCommitment > 0 ? "warn" : "good"} />
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <button className="text-left" onClick={() => setTab("installments")}>
                <Stat label="Parcelas Cartao" value={currency.format(monthlyFinance.installmentsTotal)} />
              </button>
              <button className="text-left" onClick={() => setTab("expenses")}>
                <Stat label="Gastos do cartao" value={currency.format(monthlyFinance.expensesTotal)} />
              </button>
              <button className="text-left" onClick={() => setTab("bills")}>
                <Stat label="Contas" value={currency.format(billTotals.total)} />
              </button>
              <Stat label="TOTAL" value={currency.format(total)} tone="good" />
            </div>

            <Card>
              <h2 className="mb-3 text-lg font-bold">Vencimentos do cartao</h2>
              <UpcomingList items={cardUpcomingItems} />
            </Card>

            <Card>
              <h2 className="mb-3 text-lg font-bold">Contas</h2>
              <BillList bills={overview.bills} onToggle={(bill) => mutation.mutate(() => toggleBillPaid(supabase, bill))} />
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
                    if (editingExpenseId) {
                      await updateExpense(supabase, editingExpenseId, values);
                      setEditingExpenseId(null);
                    } else {
                      await addExpense(supabase, overview.household.id, overview.cycle.id, user, values);
                    }
                    expenseForm.reset({ value: 0, category_id: "", description: "", expense_date: toDateInput() });
                  }),
                )}
              >
                <Label>Valor<Input type="number" step="0.01" {...expenseForm.register("value")} /></Label>
                <Label>Categoria<Select {...expenseForm.register("category_id")}><option value="">Selecione</option>{overview.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Label>
                <Label>Descricao<Input placeholder="Pao e leite" {...expenseForm.register("description")} /></Label>
                <Label>Data<Input type="date" {...expenseForm.register("expense_date")} /></Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="w-full" disabled={mutation.isPending}><Plus size={18} />{editingExpenseId ? "Atualizar gasto" : "Salvar gasto"}</Button>
                  {editingExpenseId && <GhostButton type="button" onClick={() => { setEditingExpenseId(null); expenseForm.reset({ value: 0, category_id: "", description: "", expense_date: toDateInput() }); }}>Cancelar</GhostButton>}
                </div>
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
              <ExpenseList
                expenses={filteredExpenses}
                onEdit={(expense) => {
                  setEditingExpenseId(expense.id);
                  expenseForm.reset({
                    value: Number(expense.value),
                    category_id: expense.category_id ?? "",
                    description: expense.description ?? "",
                    expense_date: toDateInput(dateOnlyFromStored(expense.expense_date)),
                  });
                }}
                onDelete={(expense) => {
                  if (window.confirm("Excluir este gasto?")) {
                    mutation.mutate(() => deleteExpense(supabase, expense.id));
                  }
                }}
              />
            </Card>
          </div>
        )}

        {tab === "installments" && (
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <Card>
              <h2 className="mb-4 text-lg font-bold">Compra parcelada</h2>
              <form
                className="space-y-3"
                onSubmit={installmentForm.handleSubmit((values) =>
                  mutation.mutate(async () => {
                    if (editingInstallmentId) {
                      await updateInstallment(supabase, editingInstallmentId, values);
                      setEditingInstallmentId(null);
                    } else {
                      await addInstallment(supabase, overview.household.id, user, values);
                    }
                    installmentForm.reset({ name: "", installment_value: 0, total_installments: 2, current_installment: 1, start_date: toDateInput(), notes: "" });
                  }),
                )}
              >
                <Label>Nome<Input placeholder="Notebook" {...installmentForm.register("name")} /></Label>
                <Label>Valor da parcela<Input type="number" step="0.01" {...installmentForm.register("installment_value")} /></Label>
                <Label>Total de parcelas<Input type="number" {...installmentForm.register("total_installments")} /></Label>
                <Label>
                  Parcela atual
                  <Input type="number" {...installmentForm.register("current_installment")} />
                  {installmentForm.formState.errors.current_installment && <span className="text-xs text-danger">{installmentForm.formState.errors.current_installment.message}</span>}
                </Label>
                <Label>Data inicial<Input type="date" {...installmentForm.register("start_date")} /></Label>
                <Label>Observacoes<Textarea {...installmentForm.register("notes")} /></Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="w-full" disabled={mutation.isPending}><Plus size={18} />{editingInstallmentId ? "Atualizar" : "Salvar parcela"}</Button>
                  {editingInstallmentId && <GhostButton type="button" onClick={() => { setEditingInstallmentId(null); installmentForm.reset({ name: "", installment_value: 0, total_installments: 2, current_installment: 1, start_date: toDateInput(), notes: "" }); }}>Cancelar</GhostButton>}
                </div>
              </form>
            </Card>
            <Card>
              <InstallmentList
                installments={overview.installments}
                onEdit={(installment) => {
                  setEditingInstallmentId(installment.id);
                  installmentForm.reset({
                    name: installment.name,
                    installment_value: Number(installment.installment_value),
                    total_installments: installment.total_installments,
                    current_installment: installment.current_installment,
                    start_date: installment.start_date,
                    notes: installment.notes ?? "",
                  });
                }}
                onDelete={(installment) => {
                  if (window.confirm("Excluir este parcelamento?")) {
                    mutation.mutate(() => deleteInstallment(supabase, installment.id));
                  }
                }}
              />
            </Card>
          </div>
        )}

        {tab === "bills" && (
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <Card>
              <h2 className="mb-4 text-lg font-bold">Conta fixa</h2>
              <form
                className="space-y-3"
                onSubmit={billForm.handleSubmit((values) =>
                  mutation.mutate(async () => {
                    if (editingBillId) {
                      await updateBill(supabase, editingBillId, values);
                      setEditingBillId(null);
                    } else {
                      await addBill(supabase, overview.household.id, user, values);
                    }
                    billForm.reset({ name: "", value: 0, due_date: toDateInput(), notes: "" });
                  }),
                )}
              >
                <Label>Nome<Input placeholder="Internet" {...billForm.register("name")} /></Label>
                <Label>Valor<Input type="number" step="0.01" {...billForm.register("value")} /></Label>
                <Label>Vencimento<Input type="date" {...billForm.register("due_date")} /></Label>
                <Label>Observacao<Textarea {...billForm.register("notes")} /></Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="w-full" disabled={mutation.isPending}><Plus size={18} />{editingBillId ? "Atualizar" : "Salvar conta"}</Button>
                  {editingBillId && <GhostButton type="button" onClick={() => { setEditingBillId(null); billForm.reset({ name: "", value: 0, due_date: toDateInput(), notes: "" }); }}>Cancelar</GhostButton>}
                </div>
              </form>
            </Card>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Total" value={currency.format(billTotals.total)} />
                <Stat label="Pago" value={currency.format(billTotals.paid)} tone="good" />
                <Stat label="Pendente" value={currency.format(billTotals.pending)} tone="warn" />
              </div>
              <Button className="w-full" disabled={mutation.isPending || !overview.bills.length} onClick={() => mutation.mutate(() => payAllBills(supabase, overview.bills))}>
                Todas estao pagas
              </Button>
              <Card>
                <BillList
                  bills={overview.bills}
                  onToggle={(bill) => mutation.mutate(() => toggleBillPaid(supabase, bill))}
                  onEdit={(bill) => {
                    setEditingBillId(bill.id);
                    billForm.reset({ name: bill.name, value: Number(bill.value), due_date: bill.due_date, notes: bill.notes ?? "" });
                  }}
                  onDelete={(bill) => {
                    if (window.confirm("Excluir esta conta fixa?")) {
                      mutation.mutate(() => deleteBill(supabase, bill.id));
                    }
                  }}
                />
              </Card>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-4">
            <Card>
              <Button className="w-full" disabled={mutation.isPending} onClick={() => mutation.mutate(() => payCardCycle(supabase, overview.cycle, overview.settings.monthly_limit, cardCycle.end))}>
                Pagar Cartao
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
              <h2 className="mb-4 text-lg font-bold">Convidar pessoa</h2>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate(async () => {
                    await inviteMemberByEmail(supabase, memberEmail);
                    setInviteMessage(`${memberEmail} foi liberado para criar conta. O convite nao envia e-mail automaticamente; envie o link do app para essa pessoa se cadastrar com esse mesmo e-mail.`);
                    setMemberEmail("");
                  });
                }}
              >
                <div className="flex gap-2">
                  <Input type="email" placeholder="email@familia.com" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} required />
                  <Button disabled={mutation.isPending || !memberEmail}><Plus size={18} /></Button>
                </div>
                {inviteMessage && <p className="rounded-lg bg-green-50 p-3 text-sm font-medium text-good">{inviteMessage}</p>}
              </form>
              <InviteList invites={overview.invites} />
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
    const detail = overExpense ? ` Compra: ${overExpense.categories?.name ?? "Sem categoria"}, ${currency.format(Number(overExpense.value))}, ${shortDate.format(dateOnlyFromStored(overExpense.expense_date))}.` : "";
    return { className: "mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-danger", text: `Limite excedido em ${currency.format(Math.abs(remaining))}.${detail}` };
  }
  if (percent >= 90) return { className: "mt-4 rounded-lg bg-orange-50 p-3 text-sm font-semibold text-orange-700", text: "90% do limite consumido." };
  return { className: "mt-4 rounded-lg bg-yellow-50 p-3 text-sm font-semibold text-warn", text: "80% do limite consumido." };
}

function sortExpenses(expenses: Expense[], sort: Sort) {
  return [...expenses].sort((a, b) => {
    if (sort === "oldest") return dateOnlyFromStored(a.expense_date).getTime() - dateOnlyFromStored(b.expense_date).getTime();
    if (sort === "highest") return Number(b.value) - Number(a.value);
    if (sort === "lowest") return Number(a.value) - Number(b.value);
    return dateOnlyFromStored(b.expense_date).getTime() - dateOnlyFromStored(a.expense_date).getTime();
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

type CycleRange = { start: Date; end: Date };
type UpcomingItem = {
  id: string;
  type: "Conta" | "Parcela" | "Gasto";
  title: string;
  subtitle: string;
  value: number;
  dueDate: Date;
  paid?: boolean;
};

function getMonthlyFinance(expenses: Expense[], bills: Bill[], installments: Installment[], cycle: CycleRange) {
  const expensesTotal = expenses
    .filter((expense) => isWithinInterval(dateOnlyFromStored(expense.expense_date), cycle))
    .reduce((sum, expense) => sum + Number(expense.value), 0);

  const billsTotal = getBillOccurrences(bills, cycle).reduce((sum, bill) => sum + bill.value, 0);

  const installmentsTotal = installments
    .filter((item) => item.active && item.current_installment <= item.total_installments)
    .filter((item) => isWithinInterval(getInstallmentDueDate(item, item.current_installment), cycle))
    .reduce((sum, item) => sum + Number(item.installment_value), 0);

  return {
    expensesTotal,
    billsTotal,
    installmentsTotal,
    cardTotal: expensesTotal + installmentsTotal,
  };
}

function getCardCommitment(installments: Installment[]) {
  return installments
    .filter((item) => item.active)
    .reduce((sum, item) => {
      const remaining = Math.max(item.total_installments - item.current_installment + 1, 0);
      return sum + Number(item.installment_value) * remaining;
    }, 0);
}

function getInstallmentDueDate(item: Installment, installmentNumber: number) {
  return addMonths(parseISO(item.start_date), installmentNumber - 1);
}

function getCardCycleRange(paymentDay: number): CycleRange {
  const today = startOfDay(new Date());
  const currentMonthPayment = makePaymentDate(today.getFullYear(), today.getMonth(), paymentDay);
  const start = today >= currentMonthPayment ? currentMonthPayment : makePaymentDate(today.getFullYear(), today.getMonth() - 1, paymentDay);
  return { start, end: makePaymentDate(start.getFullYear(), start.getMonth() + 1, paymentDay) };
}

function makePaymentDate(year: number, month: number, paymentDay: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = endOfMonth(firstDay).getDate();
  return startOfDay(new Date(year, month, Math.min(paymentDay, lastDay)));
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getCardUpcomingItems(expenses: Expense[], installments: Installment[], cycle: CycleRange) {
  const items: UpcomingItem[] = [];

  installments
    .filter((item) => item.active)
    .forEach((item) => {
      const dueDate = getInstallmentDueDate(item, item.current_installment);
      if (item.current_installment <= item.total_installments && isWithinInterval(dueDate, cycle)) {
        items.push({
          id: `installment-${item.id}-${item.current_installment}`,
          type: "Parcela",
          title: item.name,
          subtitle: `Parcela ${item.current_installment}/${item.total_installments} - fatura atual`,
          value: Number(item.installment_value),
          dueDate: cycle.end,
        });
      }
    });

  expenses
    .filter((expense) => isWithinInterval(dateOnlyFromStored(expense.expense_date), cycle))
    .sort((a, b) => dateOnlyFromStored(a.expense_date).getTime() - dateOnlyFromStored(b.expense_date).getTime())
    .forEach((expense) => {
      items.push({
        id: `expense-${expense.id}`,
        type: "Gasto",
        title: expense.categories?.name ?? "Gasto futuro",
        subtitle: `${expense.description || "Gasto do cartao"} - compra em ${shortDate.format(dateOnlyFromStored(expense.expense_date))}`,
        value: Number(expense.value),
        dueDate: cycle.end,
      });
    });

  return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

function getFutureItems(expenses: Expense[], bills: Bill[], installments: Installment[], cycle: CycleRange) {
  const items: UpcomingItem[] = [];

  bills
    .filter((bill) => parseISO(bill.due_date) > cycle.end)
    .forEach((bill) => {
      items.push({
        id: `future-bill-${bill.id}`,
        type: "Conta",
        title: bill.name,
        subtitle: bill.notes || "Conta futura",
        value: Number(bill.value),
        dueDate: parseISO(bill.due_date),
      });
    });

  installments
    .filter((item) => item.active)
    .forEach((item) => {
      for (let installmentNumber = item.current_installment + 1; installmentNumber <= item.total_installments; installmentNumber += 1) {
        const dueDate = getInstallmentDueDate(item, installmentNumber);
        if (dueDate > cycle.end) {
          items.push({
            id: `future-installment-${item.id}-${installmentNumber}`,
            type: "Parcela",
            title: item.name,
            subtitle: `Parcela ${installmentNumber}/${item.total_installments}`,
            value: Number(item.installment_value),
            dueDate,
          });
        }
      }
    });

  expenses
    .filter((expense) => dateOnlyFromStored(expense.expense_date) > cycle.end)
    .forEach((expense) => {
      items.push({
        id: `future-expense-${expense.id}`,
        type: "Gasto",
        title: expense.categories?.name ?? "Gasto futuro",
        subtitle: expense.description ?? "Lancamento futuro",
        value: Number(expense.value),
        dueDate: dateOnlyFromStored(expense.expense_date),
      });
    });

  return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

function getBillOccurrences(bills: Bill[], cycle: CycleRange) {
  return bills.flatMap((bill) => {
    if (bill.paid) return [];

    const occurrences: Array<Bill & { dueDate: Date; overdue: boolean; value: number }> = [];
    let dueDate = startOfDay(parseISO(bill.due_date));
    const dueDay = bill.due_day ?? dueDate.getDate();
    let guard = 0;

    while (dueDate <= cycle.end && guard < 36) {
      if (dueDate < cycle.start || isWithinInterval(dueDate, cycle)) {
        occurrences.push({
          ...bill,
          dueDate,
          overdue: dueDate < cycle.start,
          value: Number(bill.value),
        });
      }

      dueDate = makePaymentDate(dueDate.getFullYear(), dueDate.getMonth() + 1, dueDay);
      guard += 1;
    }

    return occurrences;
  });
}

function UpcomingList({ items, emptyText = "Nenhum vencimento encontrado." }: { items: UpcomingItem[]; emptyText?: string }) {
  if (!items.length) return <p className="text-sm text-zinc-500">{emptyText}</p>;

  return (
    <div className="divide-y divide-line">
      {items.map((item) => {
        const late = isBefore(item.dueDate, startOfDay(new Date()));
        return (
          <div key={item.id} className="flex items-start justify-between gap-3 py-3">
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-zinc-500">{item.type} - {item.subtitle}</p>
              <p className={late ? "text-xs font-semibold text-danger" : "text-xs text-zinc-500"}>{shortDate.format(item.dueDate)}{late ? " - atrasado" : ""}</p>
            </div>
            <p className="whitespace-nowrap font-bold">{currency.format(item.value)}</p>
          </div>
        );
      })}
    </div>
  );
}

function ExpenseList({ expenses, onEdit, onDelete }: { expenses: Expense[]; onEdit: (expense: Expense) => void; onDelete: (expense: Expense) => void }) {
  if (!expenses.length) return <p className="text-sm text-zinc-500">Nenhum gasto encontrado.</p>;
  return (
    <div className="divide-y divide-line">
      {expenses.map((expense) => (
        <div key={expense.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{expense.categories?.name ?? "Sem categoria"}</p>
              {expense.description && <p className="text-sm text-zinc-500">{expense.description}</p>}
              <p className="mt-1 text-xs text-zinc-500">{shortDate.format(dateOnlyFromStored(expense.expense_date))} as {shortTime.format(new Date(expense.created_at))} - {expense.profiles?.name ?? expense.profiles?.email ?? "Usuario"}</p>
            </div>
            <div className="text-right">
              <p className="whitespace-nowrap font-bold">{currency.format(Number(expense.value))}</p>
              <div className="mt-1 flex justify-end gap-1">
                <button className="tap rounded-lg p-2 text-zinc-600" onClick={() => onEdit(expense)} aria-label="Editar gasto"><Pencil size={16} /></button>
                <button className="tap rounded-lg p-2 text-danger" onClick={() => onDelete(expense)} aria-label="Excluir gasto"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InstallmentList({ installments, onEdit, onDelete }: { installments: Installment[]; onEdit: (installment: Installment) => void; onDelete: (installment: Installment) => void }) {
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
                <p className="text-xs text-zinc-500">Valor total: {currency.format(Number(item.total_value))} - termina em {format(endDate, "MMMM/yyyy", { locale: ptBR })}</p>
                {item.notes && <p className="text-xs text-zinc-500">{item.notes}</p>}
              </div>
              <div className="text-right">
                <p className="font-bold">{currency.format(Number(item.installment_value))}</p>
                <div className="mt-1 flex justify-end gap-1">
                  <button className="tap rounded-lg p-2 text-zinc-600" onClick={() => onEdit(item)} aria-label="Editar parcela"><Pencil size={16} /></button>
                  <button className="tap rounded-lg p-2 text-danger" onClick={() => onDelete(item)} aria-label="Excluir parcela"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BillList({ bills, onToggle, onEdit, onDelete }: { bills: Bill[]; onToggle: (bill: Bill) => void; onEdit?: (bill: Bill) => void; onDelete?: (bill: Bill) => void }) {
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
              <div className="mt-1 flex justify-end gap-1">
                <GhostButton className="!min-h-9 px-3 py-1 text-xs" onClick={() => onToggle(bill)}>{bill.paid ? "Desmarcar" : "Pagar"}</GhostButton>
                {onEdit && <button className="tap rounded-lg p-2 text-zinc-600" onClick={() => onEdit(bill)} aria-label="Editar conta"><Pencil size={16} /></button>}
                {onDelete && <button className="tap rounded-lg p-2 text-danger" onClick={() => onDelete(bill)} aria-label="Excluir conta"><Trash2 size={16} /></button>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InviteList({ invites }: { invites: AccessInvite[] }) {
  if (!invites.length) {
    return <p className="mt-4 text-sm text-zinc-500">Nenhum convite enviado ainda.</p>;
  }

  return (
    <div className="mt-4 divide-y divide-line">
      {invites.map((invite) => {
        const accepted = Boolean(invite.accepted_at);
        return (
          <div key={invite.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold">{invite.email}</p>
              <p className="text-xs text-zinc-500">Convidado em {shortDate.format(new Date(invite.created_at))}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accepted ? "bg-green-50 text-good" : "bg-yellow-50 text-warn"}`}>
              {accepted ? "Aceito" : "Pendente"}
            </span>
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
