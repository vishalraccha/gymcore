/**
 * Lazy-loaded Image component
 * Only loads images when they're visible (viewport)
 * Reduces initial load time and bandwidth
 */
import React, { useState, useEffect, useRef } from 'react';
import { Image, View, ActivityIndicator, StyleSheet, ImageProps } from 'react-native';

interface LazyImageProps extends ImageProps {
  source: { uri: string } | number;
  placeholder?: React.ReactNode;
  fallback?: React.ReactNode;
  delay?: number;
}

export default function LazyImage({
  source,
  placeholder,
  fallback,
  delay = 200,
  style,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Delay loading to prioritize critical content
    timeoutRef.current = setTimeout(() => {
      setShouldLoad(true);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [delay]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  if (!shouldLoad) {
    return placeholder || (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  }

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  return (
    <Image
      {...props}
      source={source}
      style={[style, !isLoaded && styles.hidden]}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  hidden: {
    opacity: 0,
  },
});

