/*
  # Complete Gym Management System Schema
  This schema includes all tables for:
  - Cash payments and invoices
  - Pending payments and installments
  - Personal training assignments
  - Day-wise workouts and diet plans
  - Gym owner payment accounts
  - Password reset functionality
*/

-- ============================================
-- NEW TABLES FOR CASH PAYMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS cash_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  gym_id uuid REFERENCES gyms(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'INR',
  receipt_number text UNIQUE NOT NULL,
  payment_date timestamptz DEFAULT now(),
  received_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- INVOICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  payment_id uuid, -- Can reference cash_payments or razorpay payments
  payment_type text NOT NULL CHECK (payment_type IN ('cash', 'online', 'razorpay')),
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'INR',
  total_amount numeric(10,2) NOT NULL,
  payment_status text DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'failed', 'refunded')),
  invoice_date timestamptz DEFAULT now(),
  due_date date,
  items jsonb, -- Array of items with description, quantity, price
  billing_address jsonb,
  gym_id uuid REFERENCES gyms(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- PENDING PAYMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS pending_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  total_amount numeric(10,2) NOT NULL,
  paid_amount numeric(10,2) DEFAULT 0,
  pending_amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'INR',
  due_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- PAYMENT INSTALLMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS payment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_payment_id uuid REFERENCES pending_payments(id) ON DELETE CASCADE NOT NULL,
  installment_number integer NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'INR',
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'online', 'razorpay')),
  payment_date timestamptz,
  receipt_number text,
  razorpay_order_id text,
  razorpay_payment_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(pending_payment_id, installment_number)
);

-- ============================================
-- PERSONAL TRAINING ASSIGNMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS personal_training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  gym_id uuid REFERENCES gyms(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  start_date date NOT NULL,
  end_date date,
  fee_amount numeric(10,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- DIET PLANS TABLE (Day-wise diet plans)
-- ============================================

CREATE TABLE IF NOT EXISTS diet_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid REFERENCES gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday, etc.
  meal_type text CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  meal_name text NOT NULL,
  calories numeric(8,2),
  protein numeric(6,2),
  carbs numeric(6,2),
  fat numeric(6,2),
  instructions text[],
  is_personal boolean DEFAULT false, -- true for personal training custom plans
  personal_training_id uuid REFERENCES personal_training_assignments(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- GYM PAYMENT ACCOUNTS (Razorpay/Bank details)
-- ============================================

CREATE TABLE IF NOT EXISTS gym_payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid REFERENCES gyms(id) ON DELETE CASCADE UNIQUE NOT NULL,
  razorpay_account_id text,
  razorpay_key_id text,
  razorpay_key_secret text, -- Encrypted
  bank_account_number text,
  bank_ifsc_code text,
  bank_name text,
  account_holder_name text,
  payment_gateway text DEFAULT 'razorpay' CHECK (payment_gateway IN ('razorpay', 'bank_transfer')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- PASSWORD RESET TOKENS
-- ============================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- UPDATE EXISTING TABLES
-- ============================================

-- Add day_of_week to workouts if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workouts' AND column_name = 'day_of_week'
  ) THEN
    ALTER TABLE workouts ADD COLUMN day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6);
  END IF;
END $$;

-- Update currency defaults to INR
ALTER TABLE subscriptions ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE user_subscriptions ALTER COLUMN currency SET DEFAULT 'INR' IF EXISTS;

-- Add currency to user_subscriptions if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'currency'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN currency text DEFAULT 'INR';
  END IF;
END $$;

-- Add personal_training flag to profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'has_personal_training'
  ) THEN
    ALTER TABLE profiles ADD COLUMN has_personal_training boolean DEFAULT false;
  END IF;
END $$;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cash_payments_user_id ON cash_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_payments_gym_id ON cash_payments(gym_id);
CREATE INDEX IF NOT EXISTS idx_cash_payments_receipt_number ON cash_payments(receipt_number);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_gym_id ON invoices(gym_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_user_id ON pending_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_status ON pending_payments(status);
CREATE INDEX IF NOT EXISTS idx_pending_payments_due_date ON pending_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_installments_pending_payment_id ON payment_installments(pending_payment_id);
CREATE INDEX IF NOT EXISTS idx_personal_training_user_id ON personal_training_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_training_gym_id ON personal_training_assignments(gym_id);
CREATE INDEX IF NOT EXISTS idx_diet_plans_gym_id ON diet_plans(gym_id);
CREATE INDEX IF NOT EXISTS idx_diet_plans_day_of_week ON diet_plans(day_of_week);
CREATE INDEX IF NOT EXISTS idx_diet_plans_personal_training_id ON diet_plans(personal_training_id);
CREATE INDEX IF NOT EXISTS idx_workouts_day_of_week ON workouts(day_of_week);
CREATE INDEX IF NOT EXISTS idx_gym_payment_accounts_gym_id ON gym_payment_accounts(gym_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE cash_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CASH PAYMENTS POLICIES
-- ============================================

CREATE POLICY "users_view_own_cash_payments" ON cash_payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "gym_owners_manage_cash_payments" ON cash_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      JOIN profiles AS member ON member.id = cash_payments.user_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'gym_owner')
      AND (p.gym_id = member.gym_id OR p.role = 'admin')
    )
  );

-- ============================================
-- INVOICES POLICIES
-- ============================================

CREATE POLICY "users_view_own_invoices" ON invoices
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "gym_owners_view_gym_invoices" ON invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gym_owner')
      AND (profiles.gym_id = invoices.gym_id OR profiles.role = 'admin')
    )
  );

CREATE POLICY "gym_owners_create_invoices" ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gym_owner')
    )
  );

-- ============================================
-- PENDING PAYMENTS POLICIES
-- ============================================

CREATE POLICY "users_view_own_pending_payments" ON pending_payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "gym_owners_manage_pending_payments" ON pending_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      JOIN profiles AS member ON member.id = pending_payments.user_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'gym_owner')
      AND (p.gym_id = member.gym_id OR p.role = 'admin')
    )
  );

-- ============================================
-- PAYMENT INSTALLMENTS POLICIES
-- ============================================

CREATE POLICY "users_view_own_installments" ON payment_installments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pending_payments
      WHERE pending_payments.id = payment_installments.pending_payment_id
      AND pending_payments.user_id = auth.uid()
    )
  );

CREATE POLICY "gym_owners_manage_installments" ON payment_installments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      JOIN pending_payments pp ON pp.id = payment_installments.pending_payment_id
      JOIN profiles AS member ON member.id = pp.user_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'gym_owner')
      AND (p.gym_id = member.gym_id OR p.role = 'admin')
    )
  );

-- ============================================
-- PERSONAL TRAINING POLICIES
-- ============================================

CREATE POLICY "users_view_own_personal_training" ON personal_training_assignments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "gym_owners_manage_personal_training" ON personal_training_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gym_owner')
      AND (profiles.gym_id = personal_training_assignments.gym_id OR profiles.role = 'admin')
    )
  );

-- ============================================
-- DIET PLANS POLICIES
-- ============================================

CREATE POLICY "members_view_gym_diet_plans" ON diet_plans
  FOR SELECT TO authenticated
  USING (
    (is_personal = false AND gym_id IN (SELECT gym_id FROM profiles WHERE id = auth.uid()))
    OR
    (is_personal = true AND personal_training_id IN (
      SELECT id FROM personal_training_assignments WHERE user_id = auth.uid()
    ))
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gym_owner')
      AND (profiles.gym_id = diet_plans.gym_id OR profiles.role = 'admin')
    )
  );

CREATE POLICY "gym_owners_manage_diet_plans" ON diet_plans
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gym_owner')
      AND (profiles.gym_id = diet_plans.gym_id OR profiles.role = 'admin')
    )
  );

-- ============================================
-- GYM PAYMENT ACCOUNTS POLICIES
-- ============================================

CREATE POLICY "gym_owners_view_own_payment_account" ON gym_payment_accounts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gym_owner')
      AND (profiles.gym_id = gym_payment_accounts.gym_id OR profiles.role = 'admin')
    )
  );

CREATE POLICY "gym_owners_manage_own_payment_account" ON gym_payment_accounts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gym_owner')
      AND (profiles.gym_id = gym_payment_accounts.gym_id OR profiles.role = 'admin')
    )
  );

-- ============================================
-- PASSWORD RESET TOKENS POLICIES
-- ============================================

CREATE POLICY "users_manage_own_reset_tokens" ON password_reset_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  timestamp_part text;
  random_part text;
BEGIN
  timestamp_part := to_char(now(), 'YYYYMMDDHH24MISS');
  random_part := upper(substring(md5(random()::text) from 1 for 6));
  RETURN 'INV-' || timestamp_part || '-' || random_part;
END;
$$ LANGUAGE plpgsql;

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS text AS $$
DECLARE
  timestamp_part text;
  random_part text;
BEGIN
  timestamp_part := to_char(now(), 'YYYYMMDDHH24MISS');
  random_part := upper(substring(md5(random()::text) from 1 for 6));
  RETURN 'RCP-' || timestamp_part || '-' || random_part;
END;
$$ LANGUAGE plpgsql;

-- Function to update pending payment status
CREATE OR REPLACE FUNCTION update_pending_payment_status()
RETURNS trigger AS $$
BEGIN
  -- Update pending_amount
  UPDATE pending_payments
  SET 
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM payment_installments
      WHERE pending_payment_id = NEW.pending_payment_id
      AND status = 'paid'
    ),
    pending_amount = total_amount - (
      SELECT COALESCE(SUM(amount), 0)
      FROM payment_installments
      WHERE pending_payment_id = NEW.pending_payment_id
      AND status = 'paid'
    ),
    status = CASE
      WHEN total_amount - (
        SELECT COALESCE(SUM(amount), 0)
        FROM payment_installments
        WHERE pending_payment_id = NEW.pending_payment_id
        AND status = 'paid'
      ) <= 0 THEN 'paid'
      WHEN total_amount - (
        SELECT COALESCE(SUM(amount), 0)
        FROM payment_installments
        WHERE pending_payment_id = NEW.pending_payment_id
        AND status = 'paid'
      ) < total_amount THEN 'partial'
      WHEN due_date < CURRENT_DATE THEN 'overdue'
      ELSE 'pending'
    END,
    updated_at = now()
  WHERE id = NEW.pending_payment_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating pending payment status
DROP TRIGGER IF EXISTS trigger_update_pending_payment_status ON payment_installments;
CREATE TRIGGER trigger_update_pending_payment_status
  AFTER INSERT OR UPDATE ON payment_installments
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_payment_status();

-- Function to auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_cash_payments_updated_at BEFORE UPDATE ON cash_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pending_payments_updated_at BEFORE UPDATE ON pending_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_installments_updated_at BEFORE UPDATE ON payment_installments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personal_training_updated_at BEFORE UPDATE ON personal_training_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_diet_plans_updated_at BEFORE UPDATE ON diet_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gym_payment_accounts_updated_at BEFORE UPDATE ON gym_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check and update overdue payments
CREATE OR REPLACE FUNCTION check_overdue_payments()
RETURNS void AS $$
BEGIN
  UPDATE pending_payments
  SET status = 'overdue',
      updated_at = now()
  WHERE status IN ('pending', 'partial')
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Schedule function to run daily (requires pg_cron extension)
-- SELECT cron.schedule('check-overdue-payments', '0 0 * * *', 'SELECT check_overdue_payments();');

