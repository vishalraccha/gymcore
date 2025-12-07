import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProgressBarProps {
  label: string;
  current: number;
  target: number;
  unit?: string;
  color?: string;
}

export function ProgressBar({ label, current, target, unit = '', color = '#3B82F6' }: ProgressBarProps) {
  const percentage = Math.min((current / target) * 100, 100);
  const isOverTarget = current > target;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueContainer}>
          <Text style={[styles.currentValue, { color: isOverTarget ? '#EF4444' : color }]}>
            {current.toFixed(0)}
          </Text>
          <Text style={styles.targetValue}>/{target} {unit}</Text>
        </View>
      </View>
      <View style={styles.progressContainer}>
        <View 
          style={[
            styles.progressBar, 
            { 
              width: `${Math.min(percentage, 100)}%`, 
              backgroundColor: isOverTarget ? '#EF4444' : color 
            }
          ]} 
        />
        {isOverTarget && (
          <View style={[styles.overflowBar, { width: `${Math.min(percentage - 100, 20)}%` }]} />
        )}
      </View>
      <View style={styles.footer}>
        <Text style={styles.percentageText}>
          {percentage.toFixed(0)}% of goal
        </Text>
        {isOverTarget && (
          <Text style={styles.overflowText}>
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
    color: '#374151',
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
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#E2E8F0',
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
    backgroundColor: '#EF4444',
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
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
  overflowText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});