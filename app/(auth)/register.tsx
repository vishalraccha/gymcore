import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  TouchableOpacity, 
  Modal,
  Animated,
  Dimensions
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { User, Building2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

const { height } = Dimensions.get('window');

export default function RegisterScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'gym_owner'>('member');
  const [showGymDetails, setShowGymDetails] = useState(false);
  const [gymDetails, setGymDetails] = useState({
    name: '',
    location: '',
    phone: '',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const { signUp } = useAuth();

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
    content: {
      flex: 1,
      justifyContent: 'center',
      minHeight: height - 100,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 20,
    },
    formCard: {
      marginBottom: 20,
      padding: 20,
      borderRadius: 16,
    },
    roleSection: {
      marginBottom: 24,
    },
    roleLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
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
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      gap: 8,
      minHeight: 48,
    },
    roleButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    roleButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    roleButtonTextActive: {
      color: theme.colors.card,
    },
    inputContainer: {
      marginBottom: 16,
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
    textArea: {
      minHeight: 120,
      paddingTop: 14,
    },
    registerButton: {
      marginTop: 8,
      minHeight: 52,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginTop: 12,
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
    modalSafeArea: {
      flex: 1,
      backgroundColor: theme.colors.card,
    },
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalHeaderContent: {
      flex: 1,
      paddingRight: 16,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    closeButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.background,
    },
    modalScrollView: {
      flex: 1,
    },
    modalContent: {
      padding: 20,
      paddingBottom: 40,
    },
    continueButton: {
      marginTop: 8,
      minHeight: 52,
    },
  });

  const handleRegister = async () => {
    if (!email || !password || !fullName || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
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

    if (selectedRole === 'gym_owner' && !gymDetails.name) {
      Alert.alert('Error', 'Please provide gym details');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await signUp(email, password, fullName, selectedRole);
      
      setIsLoading(false);

      if (error) {
        Alert.alert('Registration Failed', error.message);
      }
      if (selectedRole === 'gym_owner') {
        router.replace('/(app)/admin');
      } else {
        router.replace('/(app)/(tabs)');
      }
    } catch (err) {
      setIsLoading(false);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleRoleSelection = (role: 'member' | 'gym_owner') => {
    setSelectedRole(role);
    if (role === 'gym_owner') {
      setShowGymDetails(true);
    }
  };

  const handleGymDetailsContinue = () => {
    if (!gymDetails.name) {
      Alert.alert('Error', 'Please enter gym name');
      return;
    }
    setShowGymDetails(false);
  };

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
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Join FitLife</Text>
              <Text style={styles.subtitle}>Create your account and start your fitness journey</Text>
            </View>

            {/* Main Form Card */}
            <Card style={styles.formCard}>
              {/* Role Selection */}
              <View style={styles.roleSection}>
                <Text style={styles.roleLabel}>Register as</Text>
                <View style={styles.roleSelector}>
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      selectedRole === 'member' && styles.roleButtonActive,
                    ]}
                    onPress={() => handleRoleSelection('member')}
                    activeOpacity={0.7}
                  >
                    <User size={20} color={selectedRole === 'member' ? theme.colors.card : theme.colors.textSecondary} />
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
                      selectedRole === 'gym_owner' && styles.roleButtonActive,
                    ]}
                    onPress={() => handleRoleSelection('gym_owner')}
                    activeOpacity={0.7}
                  >
                    <Building2 size={20} color={selectedRole === 'gym_owner' ? theme.colors.card : theme.colors.textSecondary} />
                    <Text style={[
                      styles.roleButtonText,
                      selectedRole === 'gym_owner' && styles.roleButtonTextActive,
                    ]}>
                      Gym Owner
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Form Inputs */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  textContentType="name"
                />
              </View>

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
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Password (min. 6 characters)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="newPassword"
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  textContentType="newPassword"
                />
              </View>

              {/* Register Button */}
              <Button
                title="Create Account"
                onPress={handleRegister}
                isLoading={isLoading}
                style={styles.registerButton}
              />
            </Card>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.linkText}>Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Gym Details Modal */}
      <Modal
        visible={showGymDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        transparent={false}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderContent}>
                <Text style={styles.modalTitle}>Gym Details</Text>
                <Text style={styles.modalSubtitle}>
                  Tell us about your gym
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowGymDetails(false)}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Gym Name *"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={gymDetails.name}
                  onChangeText={(text) => setGymDetails({ ...gymDetails, name: text })}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Location/Address"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={gymDetails.location}
                  onChangeText={(text) => setGymDetails({ ...gymDetails, location: text })}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={gymDetails.phone}
                  onChangeText={(text) => setGymDetails({ ...gymDetails, phone: text })}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Gym Description"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={gymDetails.description}
                  onChangeText={(text) => setGymDetails({ ...gymDetails, description: text })}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <Button
                title="Continue Registration"
                onPress={handleGymDetailsContinue}
                style={styles.continueButton}
              />
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}