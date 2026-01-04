import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, Theme } from '@/constants/Themes';

interface ThemeContextType {
  theme: Theme;
  setTheme: (themeId: string) => void;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES.light,
  setTheme: () => {},
  availableThemes: Object.values(THEMES),
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(THEMES.light);

  useEffect(() => {
    // Load saved theme
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedThemeId = await AsyncStorage.getItem('app_theme');
      if (savedThemeId && THEMES[savedThemeId]) {
        setThemeState(THEMES[savedThemeId]);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const setTheme = async (themeId: string) => {
    try {
      if (THEMES[themeId]) {
        setThemeState(THEMES[themeId]);
        await AsyncStorage.setItem('app_theme', themeId);
      }
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        availableThemes: Object.values(THEMES),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};