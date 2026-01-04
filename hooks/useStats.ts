import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { DailyStats } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export function useStats(date: string = new Date().toISOString().split('T')[0]) {
  const { user } = useAuth();
  const [stats, setStats] = useState<DailyStats>({
    calories_burned: 0,
    workout_duration: 0,
    workouts_completed: 0,
    calories_consumed: 0,
    protein_consumed: 0,
    carbs_consumed: 0,
    fat_consumed: 0,
    water_intake: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [streak, setStreak] = useState(0);

  const calculateStreak = useCallback(async () => {
    if (!user) return;

    try {
      const { data: workoutLogs } = await supabase
        .from('workout_logs')
        .select('log_date')
        .eq('user_id', user.id)
        .order('log_date', { ascending: false });

      if (!workoutLogs || workoutLogs.length === 0) {
        setStreak(0);
        return;
      }

      const uniqueDates = [...new Set(workoutLogs.map(log => log.log_date))].sort().reverse();
      let currentStreak = 0;
      const today = new Date().toISOString().split('T')[0];

      const latestWorkoutDate = uniqueDates[0];
      const daysDiff = Math.floor(
        (new Date(today).getTime() - new Date(latestWorkoutDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff > 1) {
        setStreak(0);
        return;
      }

      for (let i = 0; i < uniqueDates.length; i++) {
        const workoutDate = uniqueDates[i];
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedDateStr = expectedDate.toISOString().split('T')[0];

        if (workoutDate === expectedDateStr) {
          currentStreak++;
        } else {
          break;
        }
      }

      setStreak(currentStreak);
    } catch (error) {
      console.warn('Error calculating streak:', error);
      setStreak(0);
    }
  }, [user]);

  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      const { data: workoutLogs } = await supabase
        .from('workout_logs')
        .select('duration_minutes, calories_burned')
        .eq('user_id', user.id)
        .eq('log_date', date);

      const { data: dietLogs } = await supabase
        .from('diet_logs')
        .select('calories, protein, carbs, fat')
        .eq('user_id', user.id)
        .eq('log_date', date);

      const workoutStats = workoutLogs?.reduce(
        (acc, log) => ({
          calories_burned: acc.calories_burned + (Number(log.calories_burned) || 0),
          workout_duration: acc.workout_duration + (log.duration_minutes || 0),
          workouts_completed: acc.workouts_completed + 1,
        }),
        { calories_burned: 0, workout_duration: 0, workouts_completed: 0 }
      ) ?? { calories_burned: 0, workout_duration: 0, workouts_completed: 0 };

      const dietStats = dietLogs?.reduce(
        (acc, log) => ({
          calories_consumed: acc.calories_consumed + (Number(log.calories) || 0),
          protein_consumed: acc.protein_consumed + (Number(log.protein) || 0),
          carbs_consumed: acc.carbs_consumed + (Number(log.carbs) || 0),
          fat_consumed: acc.fat_consumed + (Number(log.fat) || 0),
        }),
        { calories_consumed: 0, protein_consumed: 0, carbs_consumed: 0, fat_consumed: 0 }
      ) ?? { calories_consumed: 0, protein_consumed: 0, carbs_consumed: 0, fat_consumed: 0 };

      setStats({
        ...workoutStats,
        ...dietStats,
        water_intake: 0,
      });
    } catch (error) {
      console.warn('Error fetching stats:', error);
      setStats({
        calories_burned: 0,
        workout_duration: 0,
        workouts_completed: 0,
        calories_consumed: 0,
        protein_consumed: 0,
        carbs_consumed: 0,
        fat_consumed: 0,
        water_intake: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, date]);

  useEffect(() => {
    if (user) {
      fetchStats();
      calculateStreak();
    }
  }, [user, fetchStats, calculateStreak]);

  return { stats, isLoading, streak, refreshStats: fetchStats };
}
