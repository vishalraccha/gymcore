// screens/GymOwnerOnboardingScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { createGymAccount, getGymOwnerProfile, GymOwner } from '@/lib/marketplace';
import { Card } from '@/components/ui/Card';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react-native';

const BUSINESS_TYPES = [
  { value: 'individual', label: 'Individual / Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llp', label: 'LLP' },
  { value: 'private_limited', label: 'Private Limited' },
  { value: 'public_limited', label: 'Public Limited' },
  { value: 'trust', label: 'Trust' },
  { value: 'society', label: 'Society' },
  { value: 'ngo', label: 'NGO' },
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Puducherry', 'Chandigarh', 'Jammu and Kashmir', 'Ladakh',
];

export default function GymOwnerOnboardingScreen() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gymOwner, setGymOwner] = useState<GymOwner | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    gymName: '',
    gymAddress: '',
    gymCity: '',
    gymState: 'Delhi',
    gymPincode: '',
    gymPhone: '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    businessType: 'individual' as any,
    businessName: '',
    gstin: '',
  });

  useEffect(() => {
    loadGymOwnerProfile();
  }, []);

  const loadGymOwnerProfile = async () => {
    try {
      setLoading(true);
      const data = await getGymOwnerProfile();
      setGymOwner(data);

      if (data) {
        // Pre-fill form if data exists
        setFormData({
          gymName: data.gym_name || '',
          gymAddress: data.gym_address || '',
          gymCity: data.gym_city || '',
          gymState: data.gym_state || 'Delhi',
          gymPincode: data.gym_pincode || '',
          gymPhone: data.gym_phone || '',
          email: profile?.email || '',
          phone: data.gym_phone || profile?.phone || '',
          businessType: data.business_type as any || 'individual',
          businessName: data.business_name || '',
          gstin: data.gstin || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.gymName || !formData.email || !formData.phone) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (formData.phone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    if (formData.gymPincode && formData.gymPincode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit pincode');
      return;
    }

    try {
      setSubmitting(true);

      const result = await createGymAccount(formData);

      if (result.success) {
        Alert.alert(
          'Success! 🎉',
          'Your gym account has been created. Now complete your KYC to start receiving payments.',
          [
            {
              text: 'Complete KYC Now',
              onPress: () => {
                if (result.onboarding_link) {
                  Linking.openURL(result.onboarding_link);
                }
              },
            },
            {
              text: 'Later',
              style: 'cancel',
            },
          ]
        );

        // Reload profile
        await loadGymOwnerProfile();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteKYC = () => {
    if (gymOwner?.onboarding_link) {
      Linking.openURL(gymOwner.onboarding_link);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'activated':
        return '#10b981';
      case 'needs_clarification':
        return '#F97316';
      case 'suspended':
      case 'rejected':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'activated':
        return '✓ Active';
      case 'needs_clarification':
        return '⚠ Needs Clarification';
      case 'suspended':
        return '✗ Suspended';
      case 'rejected':
        return '✗ Rejected';
      case 'created':
        return '⏳ KYC Pending';
      default:
        return '⏳ Not Started';
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  // If gym owner exists and is activated
  if (gymOwner?.onboarding_completed && gymOwner?.razorpay_account_status === 'activated') {
    return (
      <SafeAreaWrapper>
        <View style={styles.container}>
          <Card style={[styles.statusCard, { backgroundColor: '#F0FDF4', borderColor: '#10b981' }]}>
            <View style={styles.statusIcon}>
              <CheckCircle size={48} color="#10b981" />
            </View>
            <Text style={styles.statusTitle}>Account Active! 🎉</Text>
            <Text style={styles.statusText}>
              Your gym is ready to receive payments from members.
            </Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Commission</Text>
                <Text style={styles.statValue}>{gymOwner.commission_percentage}%</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Status</Text>
                <Text style={[styles.statValue, { color: '#10b981' }]}>Active</Text>
              </View>
            </View>
          </Card>

          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>Gym Information</Text>
            <View style={styles.infoRow}>
              <Building2 size={20} color="#64748B" />
              <Text style={styles.infoText}>{gymOwner.gym_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <MapPin size={20} color="#64748B" />
              <Text style={styles.infoText}>
                {gymOwner.gym_city}, {gymOwner.gym_state}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Phone size={20} color="#64748B" />
              <Text style={styles.infoText}>{gymOwner.gym_phone}</Text>
            </View>
          </Card>
        </View>
      </SafeAreaWrapper>
    );
  }

  // If gym owner exists but KYC not completed
  if (gymOwner && !gymOwner.onboarding_completed) {
    return (
      <SafeAreaWrapper>
        <ScrollView style={styles.container}>
          <Card style={[styles.statusCard, { backgroundColor: '#FFF7ED', borderColor: '#F97316' }]}>
            <View style={styles.statusIcon}>
              <AlertCircle size={48} color="#F97316" />
            </View>
            <Text style={styles.statusTitle}>Complete Your KYC</Text>
            <Text style={styles.statusText}>
              Your account is created. Complete KYC verification to start receiving payments.
            </Text>
            
            <View style={styles.statusBadge}>
              <Text style={[styles.statusBadgeText, { color: getStatusColor(gymOwner.razorpay_account_status) }]}>
                {getStatusText(gymOwner.razorpay_account_status)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCompleteKYC}
            >
              <Sparkles size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Complete KYC</Text>
              <ExternalLink size={16} color="#fff" />
            </TouchableOpacity>
          </Card>

          <Card style={styles.infoCard}>
            <Text style={styles.infoTitle}>Why KYC?</Text>
            <Text style={styles.infoDescription}>
              • Verify your identity and business{'\n'}
              • Add your bank account details{'\n'}
              • Required by RBI regulations{'\n'}
              • Takes only 5-10 minutes{'\n'}
              • Secure and encrypted
            </Text>
          </Card>
        </ScrollView>
      </SafeAreaWrapper>
    );
  }

  // New gym owner - show onboarding form
  return (
    <SafeAreaWrapper>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Start Receiving Payments</Text>
          <Text style={styles.subtitle}>
            Set up your gym account to accept payments from members
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Gym Information</Text>

          <Text style={styles.label}>
            Gym Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={formData.gymName}
            onChangeText={(text) => setFormData({ ...formData, gymName: text })}
            placeholder="Enter gym name"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={formData.gymAddress}
            onChangeText={(text) => setFormData({ ...formData, gymAddress: text })}
            placeholder="Street address"
            placeholderTextColor="#94A3B8"
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={formData.gymCity}
                onChangeText={(text) => setFormData({ ...formData, gymCity: text })}
                placeholder="City"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.halfInput}>
              <Text style={styles.label}>Pincode</Text>
              <TextInput
                style={styles.input}
                value={formData.gymPincode}
                onChangeText={(text) => setFormData({ ...formData, gymPincode: text })}
                placeholder="000000"
                keyboardType="numeric"
                maxLength={6}
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <Text style={styles.label}>
            Phone Number <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            maxLength={10}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.sectionTitle}>Business Details</Text>

          <Text style={styles.label}>
            Business Type <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.radioGroup}>
            {BUSINESS_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.radioButton,
                  formData.businessType === type.value && styles.radioButtonSelected,
                ]}
                onPress={() => setFormData({ ...formData, businessType: type.value as any })}
              >
                <Text
                  style={[
                    styles.radioText,
                    formData.businessType === type.value && styles.radioTextSelected,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {formData.businessType !== 'individual' && (
            <>
              <Text style={styles.label}>Business Name</Text>
              <TextInput
                style={styles.input}
                value={formData.businessName}
                onChangeText={(text) => setFormData({ ...formData, businessName: text })}
                placeholder="Registered business name"
                placeholderTextColor="#94A3B8"
              />
            </>
          )}

          <Text style={styles.label}>GSTIN (Optional)</Text>
          <TextInput
            style={styles.input}
            value={formData.gstin}
            onChangeText={(text) => setFormData({ ...formData, gstin: text.toUpperCase() })}
            placeholder="22AAAAA0000A1Z5"
            autoCapitalize="characters"
            maxLength={15}
            placeholderTextColor="#94A3B8"
          />

          <Card style={styles.infoBox}>
            <AlertCircle size={20} color="#3B82F6" />
            <Text style={styles.infoBoxText}>
              Bank details will be collected securely via Razorpay in the next step
            </Text>
          </Card>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Continue</Text>
                <ExternalLink size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    padding: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  statusCard: {
    margin: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
  },
  statusIcon: {
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginBottom: 20,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCard: {
    margin: 24,
    marginTop: 0,
    padding: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#475569',
  },
  infoDescription: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
  },
  formCard: {
    margin: 24,
    marginTop: 0,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  radioGroup: {
    marginBottom: 16,
  },
  radioButton: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  radioButtonSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  radioText: {
    fontSize: 15,
    color: '#64748B',
  },
  radioTextSelected: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#EFF6FF',
    gap: 12,
    marginBottom: 20,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});