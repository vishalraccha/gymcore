import React, { useState } from 'react';
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
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, Mail } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${process.env.EXPO_PUBLIC_APP_URL || 'exp://localhost:8081'}/(auth)/reset-password`,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to send reset email');
        setIsLoading(false);
        return;
      }

      setEmailSent(true);
      Alert.alert(
        'Email Sent',
        'Please check your email for password reset instructions. The link will expire in 1 hour.',
        [{ text: 'OK' }]
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email';
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
    },
    input: {
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      minHeight: 52,
    },
    resetButton: {
      marginTop: 8,
      minHeight: 52,
    },
    successContainer: {
      alignItems: 'center',
      padding: 20,
    },
    successIcon: {
      marginBottom: 16,
    },
    successText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    successSubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 24,
      paddingHorizontal: 20,
    },
    footerText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
    },
    linkText: {
      fontSize: 15,
      color: theme.colors.primary,
      fontWeight: '600',
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
              <Text style={styles.title}>Reset Password</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Enter your email address and we'll send you a link to reset your password.
          </Text>

          {/* Form Card */}
          <Card style={styles.formCard}>
            {!emailSent ? (
              <>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Email address"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    editable={!isLoading}
                  />
                </View>

                <Button
                  title="Send Reset Link"
                  onPress={handleResetPassword}
                  isLoading={isLoading}
                  style={styles.resetButton}
                />
              </>
            ) : (
              <View style={styles.successContainer}>
                <Mail size={48} color={theme.colors.success} style={styles.successIcon} />
                <Text style={styles.successText}>Check Your Email</Text>
                <Text style={styles.successSubtext}>
                  We've sent password reset instructions to {email}. Please check your inbox and follow the link to reset your password.
                </Text>
              </View>
            )}
          </Card>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.linkText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

