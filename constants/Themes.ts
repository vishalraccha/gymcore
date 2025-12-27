export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    secondary: string;
    accent: string;
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    error: string;
    warning: string;
    tabBarActive: string;
    tabBarInactive: string;
    lockBg: string;
    lockBorder: string;
  };
  indicators: string[]; // Color dots shown in theme picker
}

export const THEMES: Record<string, Theme> = {
  light: {
    id: 'light',
    name: 'Light',
    colors: {
      primary: '#3B82F6',
      primaryDark: '#2563EB',
      primaryLight: '#60A5FA',
      secondary: '#64748B',
      accent: '#F59E0B',
      background: '#F5F5F5',
      card: '#FFFFFF',
      text: '#111827',
      textSecondary: '#6B7280',
      border: '#E2E8F0',
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      tabBarActive: '#3B82F6',
      tabBarInactive: '#64748B',
      lockBg: '#FEF3C7',
      lockBorder: '#FDE047',
    },
    indicators: ['#FFFFFF', '#3B82F6'],
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    colors: {
      primary: '#60A5FA',
      primaryDark: '#3B82F6',
      primaryLight: '#93C5FD',
      secondary: '#94A3B8',
      accent: '#FBBF24',
      background: '#111827',
      card: '#1F2937',
      text: '#F9FAFB',
      textSecondary: '#D1D5DB',
      border: '#374151',
      success: '#34D399',
      error: '#F87171',
      warning: '#FBBF24',
      tabBarActive: '#60A5FA',
      tabBarInactive: '#94A3B8',
      lockBg: '#374151',
      lockBorder: '#FDE047',
    },
    indicators: ['#1F2937', '#60A5FA'],
  },
  cupcake: {
    id: 'cupcake',
    name: 'Cupcake',
    colors: {
      primary: '#EC4899',
      primaryDark: '#DB2777',
      primaryLight: '#F9A8D4',
      secondary: '#F472B6',
      accent: '#FBBF24',
      background: '#FFF7ED',
      card: '#FFFFFF',
      text: '#78350F',
      textSecondary: '#A16207',
      border: '#FED7AA',
      success: '#34D399',
      error: '#F87171',
      warning: '#FBBF24',
      tabBarActive: '#EC4899',
      tabBarInactive: '#F472B6',
      lockBg: '#FEF3C7',
      lockBorder: '#FDE047',
    },
    indicators: ['#FFFFFF', '#EC4899', '#FBBF24'],
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    colors: {
      primary: '#10B981',
      primaryDark: '#059669',
      primaryLight: '#34D399',
      secondary: '#6B7280',
      accent: '#84CC16',
      background: '#F0FDF4',
      card: '#FFFFFF',
      text: '#064E3B',
      textSecondary: '#047857',
      border: '#BBF7D0',
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      tabBarActive: '#10B981',
      tabBarInactive: '#6B7280',
      lockBg: '#FEF3C7',
      lockBorder: '#84CC16',
    },
    indicators: ['#10B981', '#84CC16', '#064E3B'],
  },
  bumblebee: {
    id: 'bumblebee',
    name: 'Bumblebee',
    colors: {
      primary: '#FBBF24',
      primaryDark: '#F59E0B',
      primaryLight: '#FDE047',
      secondary: '#1F2937',
      accent: '#EF4444',
      background: '#FFFBEB',
      card: '#FFFFFF',
      text: '#78350F',
      textSecondary: '#92400E',
      border: '#FDE68A',
      success: '#34D399',
      error: '#EF4444',
      warning: '#F59E0B',
      tabBarActive: '#FBBF24',
      tabBarInactive: '#1F2937',
      lockBg: '#FEF3C7',
      lockBorder: '#FDE047',
    },
    indicators: ['#FBBF24', '#1F2937', '#EF4444'],
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    colors: {
      primary: '#10B981',
      primaryDark: '#059669',
      primaryLight: '#34D399',
      secondary: '#3B82F6',
      accent: '#8B5CF6',
      background: '#F0FDF4',
      card: '#FFFFFF',
      text: '#064E3B',
      textSecondary: '#047857',
      border: '#BBF7D0',
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      tabBarActive: '#10B981',
      tabBarInactive: '#3B82F6',
      lockBg: '#FEF3C7',
      lockBorder: '#8B5CF6',
    },
    indicators: ['#10B981', '#3B82F6', '#8B5CF6'],
  },
  corporate: {
    id: 'corporate',
    name: 'Corporate',
    colors: {
      primary: '#1E40AF',
      primaryDark: '#1E3A8A',
      primaryLight: '#3B82F6',
      secondary: '#64748B',
      accent: '#0EA5E9',
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#475569',
      border: '#CBD5E1',
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      tabBarActive: '#1E40AF',
      tabBarInactive: '#64748B',
      lockBg: '#FEF3C7',
      lockBorder: '#0EA5E9',
    },
    indicators: ['#1E40AF', '#0EA5E9', '#64748B'],
  },
};