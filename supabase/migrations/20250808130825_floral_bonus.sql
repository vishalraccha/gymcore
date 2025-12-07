/*
  # Multi-Gym Management System - Complete Schema

  1. Tables
    - `gyms` - Gym master data
    - `profiles` - User profiles (members, admins, gym_owners)
    - `workouts` - Gym-specific workout plans
    - `workout_logs` - User workout completions
    - `diet_logs` - User meal tracking
    - `attendance` - Gym check-in/out records
    - `subscriptions` - Subscription plans per gym
    - `user_subscriptions` - User subscription enrollments

  2. Key Features
    - Multi-gym support with data isolation
    - Proper timestamps on all records
    - User-specific data (meals, workouts)
    - Gym-specific workouts and subscriptions
*/

-- ============================================
-- 1. GYMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS gyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  phone text,
  email text,
  description text,
  logo_url text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'gym_owner')),
  phone text,
  gym_id uuid REFERENCES gyms(id) ON DELETE SET NULL,
  level integer DEFAULT 1,
  total_points integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  max_streak integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. WORKOUTS TABLE (GYM-SPECIFIC)
-- ============================================
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid REFERENCES gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  muscle_group text,
  duration_minutes integer NOT NULL,
  difficulty text DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  calories_per_minute numeric(5,2) DEFAULT 5.0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 4. WORKOUT LOGS TABLE (USER-SPECIFIC)
-- ============================================
CREATE TABLE IF NOT EXISTS workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  workout_id uuid REFERENCES workouts(id) ON DELETE CASCADE NOT NULL,
  duration_minutes integer NOT NULL,
  calories_burned numeric(8,2) NOT NULL,
  notes text,
  completed_at timestamptz DEFAULT now(),
  log_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 5. DIET LOGS TABLE (USER-SPECIFIC)
-- ============================================
CREATE TABLE IF NOT EXISTS diet_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  meal_name text NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  calories numeric(8,2) NOT NULL,
  protein numeric(6,2) DEFAULT 0,
  carbs numeric(6,2) DEFAULT 0,
  fat numeric(6,2) DEFAULT 0,
  log_date date DEFAULT CURRENT_DATE,
  logged_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 6. ATTENDANCE TABLE (USER-SPECIFIC)
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  gym_id uuid REFERENCES gyms(id) ON DELETE CASCADE,
  check_in_time timestamptz NOT NULL,
  check_out_time timestamptz,
  duration_minutes integer,
  attendance_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 7. SUBSCRIPTIONS TABLE (GYM-SPECIFIC PLANS)
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid REFERENCES gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_days integer NOT NULL,
  duration_months integer NOT NULL DEFAULT 1,
  price numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  features text[],
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 8. USER SUBSCRIPTIONS TABLE (MEMBER ENROLLMENTS)
-- ============================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  amount_paid numeric(10,2) NOT NULL,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_method text,
  payment_date timestamptz,
  is_active boolean DEFAULT true,
  auto_renew boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_gym_id ON profiles(gym_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_workouts_gym_id ON workouts(gym_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id ON workout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_date ON workout_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_diet_logs_user_id ON diet_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_diet_logs_date ON diet_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_gym_id ON attendance(gym_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_gym_id ON subscriptions(gym_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- GYMS POLICIES
-- ============================================
-- Anyone authenticated can view gyms
CREATE POLICY "anyone_can_view_gyms" ON gyms
  FOR SELECT TO authenticated
  USING (true);

-- Gym owners can update their own gyms
CREATE POLICY "owners_can_update_own_gym" ON gyms
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.gym_id = gyms.id
      AND profiles.role = 'gym_owner'
    )
  );

-- Admins can manage all gyms
CREATE POLICY "admins_can_manage_gyms" ON gyms
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- PROFILES POLICIES
-- ============================================
-- Users can view their own profile
CREATE POLICY "users_can_view_own_profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "users_can_update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Gym owners can view members of their gym
CREATE POLICY "gym_owners_can_view_gym_members" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid()
      AND p.role IN ('gym_owner', 'admin')
      AND (p.gym_id = profiles.gym_id OR p.role = 'admin')
    )
  );

-- Gym owners can insert members to their gym
CREATE POLICY "gym_owners_can_insert_members" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gym_owner')
    )
  );

-- Gym owners can delete members from their gym
CREATE POLICY "gym_owners_can_delete_members" ON profiles
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'gym_owner')
      AND (p.gym_id = profiles.gym_id OR p.role = 'admin')
    )
  );

-- ============================================
-- WORKOUTS POLICIES
-- ============================================
-- Members can view workouts from their gym
CREATE POLICY "members_can_view_gym_workouts" ON workouts
  FOR SELECT TO authenticated
  USING (
    gym_id IN (
      SELECT gym_id FROM profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Gym owners can manage workouts for their gym
CREATE POLICY "gym_owners_can_manage_workouts" ON workouts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.gym_id = workouts.gym_id OR profiles.role = 'admin')
      AND profiles.role IN ('admin', 'gym_owner')
    )
  );

-- ============================================
-- WORKOUT LOGS POLICIES (USER-SPECIFIC)
-- ============================================
-- Users can only manage their own workout logs
CREATE POLICY "users_own_workout_logs" ON workout_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Gym owners can view logs from their gym members
CREATE POLICY "gym_owners_view_member_logs" ON workout_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      JOIN profiles AS member ON member.id = workout_logs.user_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'gym_owner')
      AND (p.gym_id = member.gym_id OR p.role = 'admin')
    )
  );

-- ============================================
-- DIET LOGS POLICIES (USER-SPECIFIC)
-- ============================================
-- Users can only manage their own diet logs
CREATE POLICY "users_own_diet_logs" ON diet_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Gym owners can view diet logs from their gym members
CREATE POLICY "gym_owners_view_member_diets" ON diet_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      JOIN profiles AS member ON member.id = diet_logs.user_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'gym_owner')
      AND (p.gym_id = member.gym_id OR p.role = 'admin')
    )
  );

-- ============================================
-- ATTENDANCE POLICIES
-- ============================================
-- Users can manage their own attendance
CREATE POLICY "users_own_attendance" ON attendance
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Gym owners can view attendance from their gym
CREATE POLICY "gym_owners_view_gym_attendance" ON attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.gym_id = attendance.gym_id OR profiles.role = 'admin')
      AND profiles.role IN ('admin', 'gym_owner')
    )
  );

-- ============================================
-- SUBSCRIPTIONS POLICIES
-- ============================================
-- Everyone can view subscriptions
CREATE POLICY "anyone_can_view_subscriptions" ON subscriptions
  FOR SELECT TO authenticated
  USING (true);

-- Gym owners can manage their gym subscriptions
CREATE POLICY "gym_owners_manage_subscriptions" ON subscriptions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.gym_id = subscriptions.gym_id OR profiles.role = 'admin')
      AND profiles.role IN ('admin', 'gym_owner')
    )
  );

-- ============================================
-- USER SUBSCRIPTIONS POLICIES
-- ============================================
-- Users can view their own subscriptions
CREATE POLICY "users_view_own_subscriptions" ON user_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Gym owners can view subscriptions of their gym members
CREATE POLICY "gym_owners_view_member_subscriptions" ON user_subscriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      JOIN profiles AS member ON member.id = user_subscriptions.user_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'gym_owner')
      AND (p.gym_id = member.gym_id OR p.role = 'admin')
    )
  );

-- Gym owners can manage subscriptions for their gym members
CREATE POLICY "gym_owners_manage_member_subscriptions" ON user_subscriptions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      JOIN profiles AS member ON member.id = user_subscriptions.user_id
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'gym_owner')
      AND (p.gym_id = member.gym_id OR p.role = 'admin')
    )
  );

-- ============================================
-- TRIGGER FUNCTION FOR NEW USER
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, phone, gym_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE((NEW.raw_user_meta_data->>'gym_id')::uuid, NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- SAMPLE DATA (OPTIONAL)
-- ============================================
-- Insert sample gym (you can modify or remove this)
INSERT INTO gyms (name, location, description, is_active) VALUES
('PowerFit Gym', '123 Main Street, City', 'Premier fitness center with state-of-the-art equipment', true)
ON CONFLICT DO NOTHING;

-- Insert default workouts (global, no gym_id)
INSERT INTO workouts (name, description, category, muscle_group, duration_minutes, difficulty, calories_per_minute) VALUES
('Morning Cardio', 'Start your day with energy', 'Cardio', 'Full Body', 30, 'beginner', 8.0),
('Strength Training', 'Build muscle and strength', 'Strength', 'Full Body', 45, 'intermediate', 6.0),
('HIIT Blast', 'High intensity interval training', 'HIIT', 'Full Body', 25, 'advanced', 12.0),
('Yoga Flow', 'Flexibility and mindfulness', 'Yoga', 'Full Body', 60, 'beginner', 3.0),
('Core Crusher', 'Strengthen your core', 'Core', 'Abs', 20, 'intermediate', 7.0)
ON CONFLICT DO NOTHING;