export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string | null; name: string | null; created_at: string };
        Insert: { id: string; email?: string | null; name?: string | null; created_at?: string };
        Update: { email?: string | null; name?: string | null };
        Relationships: [];
      };
      households: {
        Row: { id: string; name: string; created_by: string; created_at: string };
        Insert: { id?: string; name: string; created_by: string; created_at?: string };
        Update: { name?: string };
        Relationships: [];
      };
      household_members: {
        Row: { household_id: string; user_id: string; role: "owner" | "member"; created_at: string };
        Insert: { household_id: string; user_id: string; role?: "owner" | "member"; created_at?: string };
        Update: { role?: "owner" | "member" };
        Relationships: [];
      };
      access_invites: {
        Row: { id: string; household_id: string; email: string; invited_by: string; accepted_at: string | null; created_at: string };
        Insert: { id?: string; household_id: string; email: string; invited_by: string; accepted_at?: string | null; created_at?: string };
        Update: { accepted_at?: string | null };
        Relationships: [];
      };
      settings: {
        Row: { id: string; household_id: string; payment_day: number; monthly_limit: number; created_at: string; updated_at: string };
        Insert: { id?: string; household_id: string; payment_day: number; monthly_limit: number; created_at?: string; updated_at?: string };
        Update: { payment_day?: number; monthly_limit?: number; updated_at?: string };
        Relationships: [];
      };
      categories: {
        Row: { id: string; household_id: string; name: string; created_by: string; created_at: string };
        Insert: { id?: string; household_id: string; name: string; created_by: string; created_at?: string };
        Update: { name?: string };
        Relationships: [];
      };
      billing_cycles: {
        Row: { id: string; household_id: string; start_date: string; end_date: string | null; closed: boolean; monthly_limit: number; total_spent: number; created_at: string };
        Insert: { id?: string; household_id: string; start_date: string; end_date?: string | null; closed?: boolean; monthly_limit: number; total_spent?: number; created_at?: string };
        Update: { end_date?: string | null; closed?: boolean; monthly_limit?: number; total_spent?: number };
        Relationships: [];
      };
      expenses: {
        Row: { id: string; household_id: string; cycle_id: string; category_id: string | null; created_by: string; value: number; description: string | null; expense_date: string; created_at: string };
        Insert: { id?: string; household_id: string; cycle_id: string; category_id?: string | null; created_by: string; value: number; description?: string | null; expense_date: string; created_at?: string };
        Update: { category_id?: string | null; value?: number; description?: string | null; expense_date?: string };
        Relationships: [];
      };
      installments: {
        Row: { id: string; household_id: string; name: string; total_value: number; installment_value: number; current_installment: number; total_installments: number; start_date: string; active: boolean; notes: string | null; created_by: string; created_at: string };
        Insert: { id?: string; household_id: string; name: string; total_value: number; installment_value: number; current_installment?: number; total_installments: number; start_date: string; active?: boolean; notes?: string | null; created_by: string; created_at?: string };
        Update: { name?: string; total_value?: number; installment_value?: number; current_installment?: number; total_installments?: number; start_date?: string; active?: boolean; notes?: string | null };
        Relationships: [];
      };
      bills: {
        Row: { id: string; household_id: string; name: string; value: number; due_date: string; due_day: number; paid: boolean; notes: string | null; created_by: string; created_at: string };
        Insert: { id?: string; household_id: string; name: string; value: number; due_date: string; due_day?: number; paid?: boolean; notes?: string | null; created_by: string; created_at?: string };
        Update: { name?: string; value?: number; due_date?: string; due_day?: number; paid?: boolean; notes?: string | null };
        Relationships: [];
      };
      bill_payments: {
        Row: { id: string; household_id: string; bill_id: string; payment_date: string; value: number; created_at: string };
        Insert: { id?: string; household_id: string; bill_id: string; payment_date: string; value: number; created_at?: string };
        Update: { payment_date?: string; value?: number };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
