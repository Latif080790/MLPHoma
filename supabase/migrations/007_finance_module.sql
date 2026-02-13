-- Migration: 007_finance_module.sql
-- Description: Adds Finance module tables (AP, AR, Cashflow).

-- 1. Invoices (Accounts Payable - Vendor Bills)
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text,
  po_id uuid REFERENCES public.purchase_orders(id), -- Optional link to PO
  
  vendor_name text not null,
  invoice_number text not null,
  description text,
  
  amount numeric default 0,
  tax_amount numeric default 0,
  total_amount numeric GENERATED ALWAYS AS (amount + tax_amount) STORED,
  
  due_date date,
  status text default 'UNPAID', -- UNPAID, PARTIAL, PAID, OVERDUE
  
  file_url text, -- Attachment
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Client Claims (Accounts Receivable - Progress Billings)
CREATE TABLE IF NOT EXISTS public.client_claims (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text,
  
  claim_number text not null,
  period_start date,
  period_end date,
  
  progress_percentage numeric default 0,
  amount numeric default 0,
  status text default 'DRAFT', -- DRAFT, SUBMITTED, APPROVED, PAID
  
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Transactions (Cash Flow Ledger)
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id text,
  
  transaction_date date default CURRENT_DATE,
  description text not null,
  category text, -- 'Material', 'Labor', 'Overhead', 'Payment In', 'Payment Out'
  
  amount numeric default 0, -- Negative for Expense, Positive for Income
  
  reference_type text, -- 'INVOICE', 'CLAIM', 'OTHER'
  reference_id uuid,
  
  created_at timestamptz default now()
);

-- Create index for faster ledger queries
CREATE INDEX IF NOT EXISTS idx_finance_project_date ON public.finance_transactions(project_id, transaction_date);
