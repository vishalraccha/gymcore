import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react-native';

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Check if we have the token from the email link
    if (params.token) {
      console.log('Reset token received');
    }
  }, [params]);

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to reset password');
        setIsLoading(false);
        return;
      }

      Alert.alert(
        'Success',
        'Your password has been reset successfully. Please login with your new password.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset password';
      Alert.alert('Error', errorMessage);
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 32,
    },
    backButton: {
      marginRight: 16,
      padding: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      lineHeight: 22,
      marginBottom: 32,
    },
    formCard: {
      padding: 20,
      borderRadius: 16,
    },
    inputContainer: {
      marginBottom: 20,
      position: 'relative',
    },
    input: {
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingRight: 50,
      paddingVertical: 14,
      fontSize: 16,
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      minHeight: 52,
    },
    passwordToggle: {
      position: 'absolute',
      right: 16,
      top: 14,
      padding: 8,
    },
    resetButton: {
      marginTop: 8,
      minHeight: 52,
    },
    passwordRequirements: {
      marginTop: -12,
      marginBottom: 20,
      paddingHorizontal: 4,
    },
    requirementText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>New Password</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Enter your new password. Make sure it's at least 6 characters long.
          </Text>

          {/* Form Card */}
          <Card style={styles.formCard}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor={theme.colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                {showPassword ? (
                  <EyeOff size={20} color={theme.colors.textSecondary} />
                ) : (
                  <Eye size={20} color={theme.colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={theme.colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                activeOpacity={0.7}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color={theme.colors.textSecondary} />
                ) : (
                  <Eye size={20} color={theme.colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.passwordRequirements}>
              <Text style={styles.requirementText}>
                • Password must be at least 6 characters long{'\n'}
                • Use a combination of letters and numbers for better security
              </Text>
            </View>

            <Button
              title="Reset Password"
              onPress={handleResetPassword}
              isLoading={isLoading}
              style={styles.resetButton}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

