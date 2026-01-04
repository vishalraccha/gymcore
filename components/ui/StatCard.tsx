import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  color?: string;
}

export function StatCard({ title, value, unit, icon, color }: StatCardProps) {
  const { theme } = useTheme();
  const borderColor = color || theme.colors.primary;
  
  // Ensure all values are properly converted to strings
  const safeValue = value !== null && value !== undefined ? String(value) : '0';
  const safeUnit = unit && typeof unit === 'string' && unit.trim() ? unit.trim() : '';
  const safeTitle = title || 'Stat';

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: theme.colors.card,
        borderLeftColor: borderColor,
        shadowColor: theme.colors.text,
      }
    ]}>
      <View style={styles.header}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <Text style={[styles.title, { color: theme.colors.textSecondary }]}>{safeTitle}</Text>
      </View>
      <View style={styles.valueContainer}>
        <Text style={[styles.value, { color: theme.colors.text }]}>{safeValue}</Text>
        {safeUnit && <Text style={[styles.unit, { color: theme.colors.textSecondary }]}>{safeUnit}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    margin: 4,
    borderLeftWidth: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    minHeight: 100,
    flex: 1,
    minWidth: '45%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    fontFamily: 'Inter-Regular',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  unit: {
    fontSize: 14,
    marginLeft: 4,
    fontFamily: 'Inter-Regular',
  },
});