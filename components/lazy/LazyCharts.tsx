/**
 * Lazy-loaded Chart components
 * Only loads when charts are displayed - reduces initial bundle size significantly
 */
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

let LineChartComponent: any = null;
let BarChartComponent: any = null;
let PieChartComponent: any = null;
let isLoadingCharts = false;

// Load charts dynamically - only when needed
const loadCharts = async () => {
  if ((LineChartComponent && BarChartComponent && PieChartComponent) || isLoadingCharts) return;
  isLoadingCharts = true;
  try {
    const module = await import('react-native-chart-kit');
    LineChartComponent = module.LineChart;
    BarChartComponent = module.BarChart;
    PieChartComponent = module.PieChart;
    isLoadingCharts = false;
  } catch (error) {
    console.error('Failed to load charts:', error);
    isLoadingCharts = false;
  }
};

interface ChartLoadingFallbackProps {
  height?: number;
}

function ChartLoadingFallback({ height = 200 }: ChartLoadingFallbackProps) {
  return (
    <View style={[styles.loadingContainer, { height }]}>
      <ActivityIndicator size="small" color="#3B82F6" />
    </View>
  );
}

export const LazyLineChart = (props: any) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadCharts().then(() => {
      setIsLoaded(true);
    });
  }, []);

  if (!isLoaded || !LineChartComponent) {
    return <ChartLoadingFallback height={props.height || props.chartHeight || 220} />;
  }

  return <LineChartComponent {...props} />;
};

export const LazyBarChart = (props: any) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadCharts().then(() => {
      setIsLoaded(true);
    });
  }, []);

  if (!isLoaded || !BarChartComponent) {
    return <ChartLoadingFallback height={props.height || props.chartHeight || 220} />;
  }

  return <BarChartComponent {...props} />;
};

export const LazyPieChart = (props: any) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadCharts().then(() => {
      setIsLoaded(true);
    });
  }, []);

  if (!isLoaded || !PieChartComponent) {
    return <ChartLoadingFallback height={props.height || props.chartHeight || 220} />;
  }

  return <PieChartComponent {...props} />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    width: width - 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
});

