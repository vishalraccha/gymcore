export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'member' | 'gym_owner';
  phone?: string;
  date_of_birth?: string;
  height?: number;
  weight?: number;
  fitness_goal?: string;
  level: number;
  total_points: number;
  current_streak: number;
  max_streak: number;
  profile_image?: string;
  gym_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Gym {
  id: string;
  name: string;
  logo_url?: string;
  location?: string;
  phone?: string;
  email?: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  name: string;
  duration_months: number;
  price: number;
  features: string[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  subscription_id: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  subscription?: Subscription;
}

export interface Workout {
  id: string;
  name: string;
  description?: string;
  category: string;
  duration_minutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];
  calories_per_minute: number;
  day_of_week?: number;
  muscle_group?: string;
  target_muscles?: string[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
}

export interface WorkoutLog {
  id: string;
  user_id: string;
  workout_id: string;
  duration_minutes: number;
  calories_burned: number;
  completed_at: string;
  notes?: string;
  log_date: string;
  workout?: Workout;
}

export interface DietLog {
  id: string;
  user_id: string;
  meal_name: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity: number;
  unit: string;
  log_date: string;
  logged_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  check_in_time: string;
  check_out_time?: string;
  duration_minutes?: number;
  attendance_date: string;
  notes?: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  title: string;
  description: string;
  type: string;
  icon: string;
  points: number;
  unlocked_at: string;
}

export interface GymSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  updated_by?: string;
  updated_at: string;
}

export interface DailyStats {
  calories_burned: number;
  workout_duration: number;
  workouts_completed: number;
  calories_consumed: number;
  protein_consumed: number;
  carbs_consumed: number;
  fat_consumed: number;
  water_intake: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  type: string;
  target_value: number;
  xp_reward: number;
  icon: string;
  is_active: boolean;
  created_at: string;
}

export interface UserGoal {
  id: string;
  user_id: string;
  goal_id: string;
  current_progress: number;
  target_value: number;
  is_completed: boolean;
  completed_at?: string;
  xp_earned: number;
  created_at: string;
}

export interface XPTransaction {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  reference_id?: string;
  reference_type?: string;
  created_at: string;
}