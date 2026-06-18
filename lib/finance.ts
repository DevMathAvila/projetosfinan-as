import { addMonths, format } from "date-fns";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { dateInputToISOString } from "@/lib/format";
import type { BillForm, CategoryForm, ExpenseForm, InstallmentForm, SettingsForm } from "@/lib/schemas";
import type { createClient } from "@/lib/supabase";

export type Client = Omit<ReturnType<typeof createClient>, "from" | "rpc"> & {
  from: (relation: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};
export type Tables = Database["public"]["Tables"];
export type Profile = Tables["profiles"]["Row"];
export type Household = Tables["households"]["Row"];
export type Settings = Tables["settings"]["Row"];
export type Category = Tables["categories"]["Row"];
export type Cycle = Tables["billing_cycles"]["Row"];
export type Expense = Tables["expenses"]["Row"] & { categories?: Pick<Category, "name"> | null; profiles?: Pick<Profile, "name" | "email"> | null };
export type Installment = Tables["installments"]["Row"];
export type Bill = Tables["bills"]["Row"];
export type AccessInvite = Tables["access_invites"]["Row"];

export async function getSessionUser(supabase: Client) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getHousehold(supabase: Client) {
  const memberResult = await supabase.from("household_members").select("household_id").limit(1).single();
  if (memberResult.error) throw memberResult.error;
  const member = memberResult.data as Tables["household_members"]["Row"];

  const householdResult = await supabase.from("households").select("*").eq("id", member.household_id).single();
  if (householdResult.error) throw householdResult.error;

  return householdResult.data as Household;
}

export async function getOverview(supabase: Client) {
  const household = await getHousehold(supabase);
  const [settingsResult, cycleResult, categoriesResult, expensesResult, installmentsResult, billsResult, historyResult, invitesResult] = await Promise.all([
    supabase.from("settings").select("*").eq("household_id", household.id).single(),
    supabase.from("billing_cycles").select("*").eq("household_id", household.id).eq("closed", false).single(),
    supabase.from("categories").select("*").eq("household_id", household.id).order("name"),
    supabase.from("expenses").select("*, categories(name), profiles(name,email)").eq("household_id", household.id).order("expense_date", { ascending: false }),
    supabase.from("installments").select("*").eq("household_id", household.id).order("start_date", { ascending: false }),
    supabase.from("bills").select("*").eq("household_id", household.id).order("due_date", { ascending: true }),
    supabase.from("billing_cycles").select("*").eq("household_id", household.id).eq("closed", true).order("end_date", { ascending: false }),
    supabase.from("access_invites").select("*").eq("household_id", household.id).order("created_at", { ascending: false }),
  ]);

  for (const result of [settingsResult, cycleResult, categoriesResult, expensesResult, installmentsResult, billsResult, historyResult, invitesResult]) {
    if (result.error) throw result.error;
  }

  return {
    household,
    settings: settingsResult.data as unknown as Settings,
    cycle: cycleResult.data as unknown as Cycle,
    categories: categoriesResult.data as unknown as Category[],
    expenses: expensesResult.data as unknown as Expense[],
    installments: installmentsResult.data as unknown as Installment[],
    bills: billsResult.data as unknown as Bill[],
    history: historyResult.data as unknown as Cycle[],
    invites: invitesResult.data as unknown as AccessInvite[],
  };
}

export async function saveSettings(supabase: Client, householdId: string, settings: SettingsForm) {
  const { error } = await supabase.from("settings").upsert({ household_id: householdId, ...settings, updated_at: new Date().toISOString() }, { onConflict: "household_id" });
  if (error) throw error;

  await supabase.from("billing_cycles").update({ monthly_limit: settings.monthly_limit }).eq("household_id", householdId).eq("closed", false);
}

export async function addCategory(supabase: Client, householdId: string, user: User, category: CategoryForm) {
  const { error } = await supabase.from("categories").insert({ household_id: householdId, created_by: user.id, name: category.name.trim() });
  if (error) throw error;
}

export async function deleteCategory(supabase: Client, categoryId: string) {
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) throw error;
}

export async function inviteMemberByEmail(supabase: Client, email: string) {
  const { error } = await supabase.rpc("invite_household_member_by_email", { target_email: email.trim().toLowerCase() });
  if (error) throw error;
}

export async function addExpense(supabase: Client, householdId: string, cycleId: string, user: User, expense: ExpenseForm) {
  const { error } = await supabase.from("expenses").insert({
    household_id: householdId,
    cycle_id: cycleId,
    category_id: expense.category_id,
    created_by: user.id,
    value: expense.value,
    description: expense.description?.trim() || null,
    expense_date: dateInputToISOString(expense.expense_date),
  });
  if (error) throw error;
}

export async function updateExpense(supabase: Client, expenseId: string, expense: ExpenseForm) {
  const { error } = await supabase
    .from("expenses")
    .update({
      category_id: expense.category_id,
      value: expense.value,
      description: expense.description?.trim() || null,
      expense_date: dateInputToISOString(expense.expense_date),
    })
    .eq("id", expenseId);
  if (error) throw error;
}

export async function deleteExpense(supabase: Client, expenseId: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
  if (error) throw error;
}

export async function addInstallment(supabase: Client, householdId: string, user: User, installment: InstallmentForm) {
  const totalValue = Number((installment.installment_value * installment.total_installments).toFixed(2));
  const { error } = await supabase.from("installments").insert({
    household_id: householdId,
    created_by: user.id,
    name: installment.name.trim(),
    total_value: totalValue,
    installment_value: installment.installment_value,
    current_installment: installment.current_installment,
    total_installments: installment.total_installments,
    start_date: installment.start_date,
    notes: installment.notes?.trim() || null,
  });
  if (error) throw error;
}

export async function updateInstallment(supabase: Client, installmentId: string, installment: InstallmentForm) {
  const totalValue = Number((installment.installment_value * installment.total_installments).toFixed(2));
  const { error } = await supabase
    .from("installments")
    .update({
      name: installment.name.trim(),
      total_value: totalValue,
      installment_value: installment.installment_value,
      current_installment: installment.current_installment,
      total_installments: installment.total_installments,
      start_date: installment.start_date,
      notes: installment.notes?.trim() || null,
      active: installment.current_installment <= installment.total_installments,
    })
    .eq("id", installmentId);
  if (error) throw error;
}

export async function deleteInstallment(supabase: Client, installmentId: string) {
  const { error } = await supabase.from("installments").delete().eq("id", installmentId);
  if (error) throw error;
}

export async function addBill(supabase: Client, householdId: string, user: User, bill: BillForm) {
  const dueDate = new Date(`${bill.due_date}T00:00:00`);
  const { error } = await supabase.from("bills").insert({
    household_id: householdId,
    created_by: user.id,
    name: bill.name.trim(),
    value: bill.value,
    due_date: bill.due_date,
    due_day: dueDate.getDate(),
    notes: bill.notes?.trim() || null,
  });
  if (error) throw error;
}

export async function updateBill(supabase: Client, billId: string, bill: BillForm) {
  const dueDate = new Date(`${bill.due_date}T00:00:00`);
  const { error } = await supabase
    .from("bills")
    .update({
      name: bill.name.trim(),
      value: bill.value,
      due_date: bill.due_date,
      due_day: dueDate.getDate(),
      notes: bill.notes?.trim() || null,
    })
    .eq("id", billId);
  if (error) throw error;
}

export async function deleteBill(supabase: Client, billId: string) {
  const { error } = await supabase.from("bills").delete().eq("id", billId);
  if (error) throw error;
}

export async function toggleBillPaid(supabase: Client, bill: Bill) {
  if (!bill.paid) {
    const paymentResult = await supabase.from("bill_payments").insert({
      household_id: bill.household_id,
      bill_id: bill.id,
      payment_date: format(new Date(), "yyyy-MM-dd"),
      value: bill.value,
    });
    if (paymentResult.error) throw paymentResult.error;

    const { error } = await supabase
      .from("bills")
      .update({ paid: false, due_date: format(getNextBillDueDate(bill), "yyyy-MM-dd") })
      .eq("id", bill.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("bills").update({ paid: false }).eq("id", bill.id);
  if (error) throw error;
}

export async function payAllBills(supabase: Client, bills: Bill[]) {
  const pendingBills = bills.filter((bill) => !bill.paid);
  await Promise.all(pendingBills.map((bill) => toggleBillPaid(supabase, bill)));
}

export async function payCardCycle(supabase: Client, cycle: Cycle, monthlyLimit: number, nextStartDate: Date) {
  const { error: closeError } = await supabase
    .from("billing_cycles")
    .update({ closed: true, end_date: format(nextStartDate, "yyyy-MM-dd") })
    .eq("id", cycle.id);
  if (closeError) throw closeError;

  const { error: createError } = await supabase.from("billing_cycles").insert({
    household_id: cycle.household_id,
    start_date: format(nextStartDate, "yyyy-MM-dd"),
    monthly_limit: monthlyLimit,
  });
  if (createError) throw createError;

  const { data: activeInstallments, error: installmentsError } = await supabase
    .from("installments")
    .select("*")
    .eq("household_id", cycle.household_id)
    .eq("active", true);
  if (installmentsError) throw installmentsError;

  const installments = (activeInstallments ?? []) as Installment[];

  if (installments.length) {
    await Promise.all(
      installments.map((item) =>
        supabase
          .from("installments")
          .update({ current_installment: item.current_installment + 1, active: item.current_installment + 1 <= item.total_installments })
          .eq("id", item.id),
      ),
    );
  }
}

function getNextBillDueDate(bill: Bill) {
  const currentDueDate = new Date(`${bill.due_date}T00:00:00`);
  return makeBillDate(currentDueDate.getFullYear(), currentDueDate.getMonth() + 1, bill.due_day ?? currentDueDate.getDate());
}

function makeBillDate(year: number, month: number, dueDay: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dueDay, lastDay));
}
