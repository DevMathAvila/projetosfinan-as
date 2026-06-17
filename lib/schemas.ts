import { z } from "zod";

const money = z.coerce.number().positive("Informe um valor maior que zero.");

export const authSchema = z.object({
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().min(6, "Use pelo menos 6 caracteres."),
  name: z.string().optional(),
});

export const settingsSchema = z.object({
  payment_day: z.coerce.number().int().min(1).max(31),
  monthly_limit: money,
});

export const categorySchema = z.object({
  name: z.string().min(2, "Informe o nome da categoria."),
});

export const expenseSchema = z.object({
  value: money,
  category_id: z.string().min(1, "Escolha uma categoria."),
  description: z.string().min(2, "Descreva o gasto."),
  expense_date: z.string().min(1, "Informe a data."),
});

export const installmentSchema = z.object({
  name: z.string().min(2, "Informe o nome da compra."),
  total_value: money,
  total_installments: z.coerce.number().int().min(2),
  start_date: z.string().min(1),
});

export const billSchema = z.object({
  name: z.string().min(2, "Informe o nome da conta."),
  value: money,
  due_date: z.string().min(1),
  notes: z.string().optional(),
});

export type AuthForm = z.infer<typeof authSchema>;
export type SettingsForm = z.infer<typeof settingsSchema>;
export type CategoryForm = z.infer<typeof categorySchema>;
export type ExpenseForm = z.infer<typeof expenseSchema>;
export type InstallmentForm = z.infer<typeof installmentSchema>;
export type BillForm = z.infer<typeof billSchema>;
