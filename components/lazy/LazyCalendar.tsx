/**
 * Lazy-loaded Calendar component
 * Only loads when needed - reduces initial bundle size
 */
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

let CalendarComponent: any = null;
let isLoadingCalendar = false;

// Load calendar dynamically
const loadCalendar = async () => {
  if (CalendarComponent || isLoadingCalendar) return;
  isLoadingCalendar = true;
  try {
    const module = await import('react-native-calendars');
    CalendarComponent = module.Calendar;
    isLoadingCalendar = false;
  } catch (error) {
    console.error('Failed to load calendar:', error);
    isLoadingCalendar = false;
  }
};

interface LazyCalendarProps {
  onDayPress?: (day: any) => void;
  markedDates?: any;
  current?: string;
  minDate?: string;
  maxDate?: string;
  theme?: any;
  style?: any;
  [key: string]: any;
}

export default function LazyCalendar(props: LazyCalendarProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load calendar when component mounts
    loadCalendar().then(() => {
      setIsLoaded(true);
    });
  }, []);

  if (!isLoaded || !CalendarComponent) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  }

  return <CalendarComponent {...props} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

