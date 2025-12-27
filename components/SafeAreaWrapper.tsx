// components/SafeAreaWrapper.tsx
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
}

export default function SafeAreaWrapper({ 
  children, 
  style,
  edges = ['top', 'left', 'right'] // Don't include bottom by default (tab bar handles it)
}: SafeAreaWrapperProps) {
  const { theme } = useTheme();
  
  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.colors.background }, style]} 
      edges={edges}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});