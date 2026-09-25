export interface Profile {
  id: string;
  full_name: string | null;
  household_id: string | null;
  created_at: string;
}

export interface Household {
  id: string;
  name: string;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  household_id: string | null;
  amount: number;
  currency: string;
  category: string;
  description: string | null;
  expense_date: string;
  source: 'manual' | 'csv' | 'drive' | 'email';
  is_shared: boolean;
  created_at: string;
}

export interface Payslip {
  id: string;
  user_id: string;
  period_month: string;         // "YYYY-MM-01"
  gross_amount: number;
  net_amount: number;
  irpef: number;
  inps_contributions: number;
  regional_municipal_tax: number;
  overtime_hours: number;
  overtime_amount: number;
  meal_vouchers: number;
  tfr_accrued_this_period: number;
  tfr_total_accrued: number;
  source_file_url: string | null;
  employer_name: string | null;
  extraction_confidence: string | null;
  storage_path: string | null;
  created_at: string;
}
