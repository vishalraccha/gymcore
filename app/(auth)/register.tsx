import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { User, Shield, Building2, X } from 'lucide-react-native';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'admin' | 'gym_owner'>('member');
  const [showGymDetails, setShowGymDetails] = useState(false);
  const [gymDetails, setGymDetails] = useState({
    name: '',
    location: '',
    phone: '',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();

  const handleRegister = async () => {
    if (!email || !password || !fullName || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (selectedRole === 'gym_owner' && !gymDetails.name) {
      Alert.alert('Error', 'Please provide gym details');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(email, password, fullName, selectedRole, gymDetails);
    setIsLoading(false);

    if (error) {
      Alert.alert('Registration Failed', error.message);
    } else {
      Alert.alert('Success', 'Account created successfully!', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') }
      ]);
    }
  };

  const handleRoleSelection = (role: 'member' | 'admin' | 'gym_owner') => {
    setSelectedRole(role);
    if (role === 'gym_owner') {
      setShowGymDetails(true);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Join FitLife</Text>
            <Text style={styles.subtitle}>Create your account and start your fitness journey</Text>
          </View>

          <Card style={styles.form}>
            {/* Role Selection */}
            <View style={styles.roleSection}>
              <Text style={styles.roleLabel}>Register as:</Text>
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    selectedRole === 'member' && styles.roleButtonActive,
                  ]}
                  onPress={() => handleRoleSelection('member')}
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
                  onPress={() => handleRoleSelection('admin')}
                >
                  <Shield size={20} color={selectedRole === 'admin' ? '#ffffff' : '#64748B'} />
                  <Text style={[
                    styles.roleButtonText,
                    selectedRole === 'admin' && styles.roleButtonTextActive,
                  ]}>
                    Admin
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    selectedRole === 'gym_owner' && styles.roleButtonActive,
                  ]}
                  onPress={() => handleRoleSelection('gym_owner')}
                >
                  <Building2 size={20} color={selectedRole === 'gym_owner' ? '#ffffff' : '#64748B'} />
                  <Text style={[
                    styles.roleButtonText,
                    selectedRole === 'gym_owner' && styles.roleButtonTextActive,
                  ]}>
                    Gym Owner
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
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
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <Button
              title="Create Account"
              onPress={handleRegister}
              isLoading={isLoading}
              style={styles.button}
            />
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.link}>
              <Text style={styles.linkText}>Sign In</Text>
            </Link>
          </View>
        </View>
      </ScrollView>

      {/* Gym Details Modal */}
      <Modal
        visible={showGymDetails}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Gym Details</Text>
            <TouchableOpacity onPress={() => setShowGymDetails(false)}>
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalSubtitle}>
              Please provide your gym information to complete registration
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Gym Name *"
              value={gymDetails.name}
              onChangeText={(text) => setGymDetails({ ...gymDetails, name: text })}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Location/Address"
              value={gymDetails.location}
              onChangeText={(text) => setGymDetails({ ...gymDetails, location: text })}
              multiline
            />
            
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={gymDetails.phone}
              onChangeText={(text) => setGymDetails({ ...gymDetails, phone: text })}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Gym Description"
              value={gymDetails.description}
              onChangeText={(text) => setGymDetails({ ...gymDetails, description: text })}
              multiline
              numberOfLines={4}
            />

            <Button
              title="Continue Registration"
              onPress={() => setShowGymDetails(false)}
              style={styles.continueButton}
            />
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
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
    gap: 8,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    fontFamily: 'Inter-Bold',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  continueButton: {
    marginTop: 24,
  },
});