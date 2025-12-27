import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface ProgressBarProps {
  label: string;
  current: number;
  target: number;
  unit?: string;
  color?: string;
}

export function ProgressBar({ label, current, target, unit = '', color }: ProgressBarProps) {
  const { theme } = useTheme();
  const progressColor = color || theme.colors.primary;
  const percentage = Math.min((current / target) * 100, 100);
  const isOverTarget = current > target;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
        <View style={styles.valueContainer}>
          <Text style={[styles.currentValue, { color: isOverTarget ? theme.colors.error : progressColor }]}>
            {current.toFixed(0)}
          </Text>
          <Text style={[styles.targetValue, { color: theme.colors.textSecondary }]}>/{target} {unit}</Text>
        </View>
      </View>
      <View style={[styles.progressContainer, { backgroundColor: theme.colors.border }]}>
        <View 
          style={[
            styles.progressBar, 
            { 
              width: `${Math.min(percentage, 100)}%`, 
              backgroundColor: isOverTarget ? theme.colors.error : progressColor 
            }
          ]} 
        />
        {isOverTarget && (
          <View style={[styles.overflowBar, { width: `${Math.min(percentage - 100, 20)}%`, backgroundColor: theme.colors.error }]} />
        )}
      </View>
      <View style={styles.footer}>
        <Text style={[styles.percentageText, { color: theme.colors.textSecondary }]}>
          {percentage.toFixed(0)}% of goal
        </Text>
        {isOverTarget && (
          <Text style={[styles.overflowText, { color: theme.colors.error }]}>
            +{(current - target).toFixed(0)} {unit} over
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  currentValue: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  targetValue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  progressContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  overflowBar: {
    position: 'absolute',
    top: 0,
    left: '100%',
    height: '100%',
    opacity: 0.6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  percentageText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  overflowText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});