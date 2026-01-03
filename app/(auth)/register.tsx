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
import { User, Building2, X, Eye, EyeOff } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

const { height } = Dimensions.get('window');

const createGym = async (
  gymDetails: {
    name: string;
    location: string;
    phone: string;
    description: string;
  },
  userId: string,
  userEmail: string // ⭐ Pass email to save in gym
) => {
  console.log('🏋️ createGym called', { gymDetails, userId, userEmail });

  try {
    /* ------------------ 1️⃣ CREATE GYM WITH EMAIL ------------------ */
    const { data: newGym, error: gymError } = await supabase
      .from('gyms')
      .insert({
        name: gymDetails.name.trim(),
        location: gymDetails.location || null,
        phone: gymDetails.phone || null,
        email: userEmail, // ⭐ ADD: Save email in gyms table
        description: gymDetails.description || null,
        owner_id: userId,
      })
      .select()
      .single();

    console.log('🏢 gym insert result:', { newGym, gymError });

    if (gymError) throw gymError;
    if (!newGym?.id) throw new Error('Gym not created');

    /* ------------------ 2️⃣ UPDATE PROFILE WITH GYM ------------------ */
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        gym_id: newGym.id,
        role: 'gym_owner',
        email: userEmail, // ⭐ Also update profile email
      })
      .eq('id', userId);

    console.log('👤 profile update result:', profileError);

    if (profileError) throw profileError;

    console.log('✅ Gym + profile linked successfully');

    return { success: true, gym: newGym };
  } catch (error) {
    console.error('❌ createGym FAILED:', error);
    return { success: false, error };
  }
};


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
  const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signUp , refreshProfile, refreshGym} = useAuth();

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
    gymPreview: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.primary + '15',
      borderWidth: 1,
      borderColor: theme.colors.primary + '30',
      marginBottom: 16,
    },
    gymPreviewLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.primary,
      marginBottom: 4,
    },
    gymPreviewName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    gymPreviewHint: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
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
    // Add these to your StyleSheet
passwordInputContainer: {
  position: 'relative',
  marginBottom: 16,
},
passwordInput: {
  borderWidth: 1.5,
  borderColor: theme.colors.border,
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingRight: 50, // ⭐ Space for icon
  paddingVertical: 14,
  fontSize: 16,
  backgroundColor: theme.colors.card,
  color: theme.colors.text,
  minHeight: 52,
},
eyeIconButton: {
  position: 'absolute',
  right: 16,
  top: 14,
  padding: 4,
},
  });

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async () => {
    console.log('🚀 handleRegister CALLED');

    try {
      console.log('📩 Form values:', {
        email,
        fullName,
        selectedRole,
        hasGymDetails: !!gymDetails?.name,
      });

      if (!email || !password || !fullName || !confirmPassword) {
        window.alert('❌ Missing fields');
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }

      if (password !== confirmPassword) {
        window.alert('❌ Password mismatch');
        Alert.alert('Error', 'Passwords do not match');
        return;
      }

      if (password.length < 6) {
        window.alert('❌ Password too short');
        Alert.alert('Error', 'Password must be at least 6 characters');
        return;
      }

      if (selectedRole === 'gym_owner' && !gymDetails?.name) {
        window.alert('❌ Gym owner without gym name');
        Alert.alert('Error', 'Please provide gym details first');
        setShowGymDetails(true);
        return;
      }

      setIsLoading(true);
      console.log('⏳ Starting signup...');

      // Store email for later use
      const userEmail = email.trim().toLowerCase();

      // 🔐 Sign up
      const { error: signUpError } = await signUp(
        userEmail,
        password,
        fullName,
        selectedRole
      );

      console.log('🧾 Signup response error:', signUpError);

      if (signUpError) {
        window.alert('Registration Failed');
        Alert.alert('Registration Failed', signUpError.message);
        setIsLoading(false);
        return;
      }

      // Get the user from Supabase auth after signup
      const { data: { user } } = await supabase.auth.getUser();
      
      console.log('👤 Current user after signup:', user?.id);

      if (!user) {
        Alert.alert('Error', 'Failed to get user information');
        setIsLoading(false);
        return;
      }

      // 🏋️ Gym owner flow
      if (selectedRole === 'gym_owner') {
        console.log('🏋️ Creating gym for owner:', user.id);
      
        // Wait a bit for the auth to settle
        await new Promise(resolve => setTimeout(resolve, 500));
      
        // ⭐ Pass email to createGym
        const result = await createGym(gymDetails, user.id, userEmail);
      
        console.log('🏢 Gym creation result:', result);
      
        if (!result?.success) {
          setIsLoading(false);
          if (Platform.OS === 'web') {
            if (window.confirm('Account created but gym setup failed. You can complete it later from your profile.\n\nClick OK to continue to dashboard.')) {
              // ⭐ FIX: Refresh profile before redirect
              await refreshProfile();
              router.replace('/(app)/admin');
            }
          } else {
            Alert.alert(
              'Warning',
              'Account created but gym setup failed. You can complete it later from your profile.',
              [
                { 
                  text: 'OK', 
                  onPress: async () => {
                    // ⭐ FIX: Refresh profile before redirect
                    await refreshProfile();
                    router.replace('/(app)/admin');
                  }
                }
              ]
            );
          }
          return;
        }
      
        // Clear gym details form
        setGymDetails({
          name: '',
          location: '',
          phone: '',
          description: '',
        });
      
        await new Promise(resolve => setTimeout(resolve, 1000));
        await refreshProfile();
        
        // Wait a bit for database to settle
        await new Promise(resolve => setTimeout(resolve, 500));
        await refreshGym();
        
        setIsLoading(false);
        if (Platform.OS === 'web') {
          alert('Account and gym created successfully! 🎉');
          setTimeout(() => {
            router.replace('/(app)/admin');
          }, 500);
        } else {
          Alert.alert('Success', 'Account and gym created successfully! 🎉', [
            { 
              text: 'OK', 
              onPress: () => {setTimeout(() => {
                router.replace('/(app)/admin');
              }, 300);}
            }
          ]);
        }
      } else {
        // 👤 Normal member
        
        await new Promise(resolve => setTimeout(resolve, 500));
        await refreshProfile();
        setIsLoading(false);
        
        if (Platform.OS === 'web') {
          alert('Account created successfully! 🎉');
          setTimeout(() => {
            router.replace('/(app)/(tabs)');
          }, 300);
        } else {
          Alert.alert('Success', 'Account created successfully! 🎉', [
            { 
              text: 'OK', 
              onPress: () => router.replace('/(app)/(tabs)')
            }
          ]);
        }
      }

    } catch (err) {
      console.error('🔥 handleRegister crashed:', err);
      setIsLoading(false);
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Unexpected error occurred'
      );
    }
  };

  const handleRoleSelection = (role: 'member' | 'gym_owner') => {
    setSelectedRole(role);
    if (role === 'gym_owner') {
      setShowGymDetails(true);
    }
  };

  const handleGymDetailsContinue = () => {
    if (!gymDetails.name.trim()) {
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
              <Text style={styles.title}>Join GymCore</Text>
              <Text style={styles.subtitle}>Create your account and start your fitness journey</Text>
            </View>

            {/* Main Form Card */}
            <Card style={styles.formCard}>
              {/* Role Selection */}
              <View style={styles.roleSection}>
                <Text style={styles.roleLabel}>Register as</Text>
                <View style={styles.roleSelector}>
                  {/* <TouchableOpacity
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
                  </TouchableOpacity> */}
                  
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

              {/* Password Input */}
<View style={styles.passwordInputContainer}>
  <TextInput
    style={styles.passwordInput}
    placeholder="Password (min. 6 characters)"
    placeholderTextColor={theme.colors.textSecondary}
    value={password}
    onChangeText={setPassword}
    secureTextEntry={!showPassword}
    autoCapitalize="none"
    textContentType="newPassword"
  />
  <TouchableOpacity
    onPress={() => setShowPassword(!showPassword)}
    style={styles.eyeIconButton}
    activeOpacity={0.7}
  >
    {showPassword ? (
      <EyeOff size={20} color={theme.colors.textSecondary} />
    ) : (
      <Eye size={20} color={theme.colors.textSecondary} />
    )}
  </TouchableOpacity>
</View>

{/* Confirm Password Input */}
<View style={styles.passwordInputContainer}>
  <TextInput
    style={styles.passwordInput}
    placeholder="Confirm Password"
    placeholderTextColor={theme.colors.textSecondary}
    value={confirmPassword}
    onChangeText={setConfirmPassword}
    secureTextEntry={!showConfirmPassword}
    autoCapitalize="none"
    textContentType="newPassword"
  />
  <TouchableOpacity
    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
    style={styles.eyeIconButton}
    activeOpacity={0.7}
  >
    {showConfirmPassword ? (
      <EyeOff size={20} color={theme.colors.textSecondary} />
    ) : (
      <Eye size={20} color={theme.colors.textSecondary} />
    )}
  </TouchableOpacity>
</View>
              {/* Gym Details Preview for Gym Owner */}
              {selectedRole === 'gym_owner' && gymDetails.name && (
                <TouchableOpacity
                  style={styles.gymPreview}
                  onPress={() => setShowGymDetails(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.gymPreviewLabel}>Gym Details Added ✓</Text>
                  <Text style={styles.gymPreviewName}>{gymDetails.name}</Text>
                  <Text style={styles.gymPreviewHint}>Tap to edit</Text>
                </TouchableOpacity>
              )}

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
                title="Save Gym Details"
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