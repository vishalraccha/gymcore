import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { User, Shield, Building2 } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'admin' | 'gym_owner'>('member');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(email, password, selectedRole);
    setIsLoading(false);

    if (error) {
      Alert.alert('Login Failed', error.message);
    } else {
      router.replace('/(app)');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your fitness journey</Text>
        </View>

        <Card style={styles.form}>
          {/* Role Selection */}
          <View style={styles.roleSection}>
            <Text style={styles.roleLabel}>Login as:</Text>
            <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedRole === 'member' && styles.roleButtonActive,
                ]}
                onPress={() => setSelectedRole('member')}
              >
                <User size={20} color={selectedRole === 'member' ? '#ffffff' : '#64748B'} />
                <Text style={[
                  styles.roleButtonText,
                  selectedRole === 'member' && styles.roleButtonTextActive,
                ]}>
                  Member
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedRole === 'admin' && styles.roleButtonActive,
                ]}
                onPress={() => setSelectedRole('admin')}
              >
                <Shield size={20} color={selectedRole === 'admin' ? '#ffffff' : '#64748B'} />
                <Text style={[
                  styles.roleButtonText,
                  selectedRole === 'admin' && styles.roleButtonTextActive,
                ]}>
                  Admin
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <Button
            title="Sign In"
            onPress={handleLogin}
            isLoading={isLoading}
            style={styles.button}
          />
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" style={styles.link}>
            <Text style={styles.linkText}>Sign Up</Text>
          </Link>
        </View>

        {/* Demo Credentials */}
        <Card style={styles.demoCard}>
          <Text style={styles.demoTitle}>Demo Credentials</Text>
          <View style={styles.demoCredentials}>
            <View style={styles.demoItem}>
              <Text style={styles.demoRole}>👤 Member:</Text>
              <Text style={styles.demoEmail}>member@demo.com</Text>
              <Text style={styles.demoPassword}>password123</Text>
            </View>
            <View style={styles.demoItem}>
              <Text style={styles.demoRole}>🛡️ Admin:</Text>
              <Text style={styles.demoEmail}>admin@demo.com</Text>
              <Text style={styles.demoPassword}>admin123</Text>
            </View>
            <View style={styles.demoItem}>
              <Text style={styles.demoRole}>🏢 Gym Owner:</Text>
              <Text style={styles.demoEmail}>owner@demo.com</Text>
              <Text style={styles.demoPassword}>owner123</Text>
            </View>
          </View>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  form: {
    marginBottom: 24,
    padding: 24,
  },
  roleSection: {
    marginBottom: 24,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Inter-SemiBold',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  roleButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: 'Inter-SemiBold',
  },
  roleButtonTextActive: {
    color: '#ffffff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    fontFamily: 'Inter-Regular',
  },
  button: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  footerText: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
  link: {
    marginLeft: 4,
  },
  linkText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  demoCard: {
    padding: 20,
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  demoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
  },
  demoCredentials: {
    gap: 12,
  },
  demoItem: {
    alignItems: 'center',
  },
  demoRole: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  demoEmail: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
  demoPassword: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
});