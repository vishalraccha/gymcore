import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  Platform,
  Animated,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Profile, WorkoutLog, DietLog } from '@/types/database';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import InvoicesList from "@/components/InvoicesList";
import { getUserInvoices } from "@/lib/invoice";
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { uploadMemberPhoto } from '@/lib/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  Plus,
  Search,
  User,
  Mail,
  Phone,
  X,
  Eye,
  Activity,
  UtensilsCrossed,
  Flame,
  Clock,
  CreditCard,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  Users
} from 'lucide-react-native';

import { formatRupees } from '@/lib/currency';
import DateTimePicker from '@react-native-community/datetimepicker';

const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) {
      onConfirm();
    } else {
      onCancel?.();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
};



const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

interface MemberDetails extends Profile {
  has_personal_training?: boolean;
  workout_logs?: WorkoutLog[];
  diet_logs?: DietLog[];
  stats?: {
    totalWorkouts: number;
    totalCaloriesBurned: number;
    totalMinutes: number;
    totalMeals: number;
  };
  currentSubscription?: any | null;
  totalCheckIns?: number;
  expectedCheckIns?: number;
  subscriptionStatus?: 'active' | 'expired' | 'none';
  batch?: string;
  profile_photo_url?: string;
}

export default function MembersScreen() {
  const { theme } = useTheme();
  const { profile, setIsCreatingMember } = useAuth();
  const [members, setMembers] = useState<MemberDetails[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberDetails | null>(null);
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]); // Set to current date
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [newMember, setNewMember] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '123456',
    has_personal_training: false,
    weight: '',
    height: '',
    batch: 'morning',
    profile_photo_uri: '',
    member_id: '',
    notes: '',
    joining_date: new Date().toISOString().split('T')[0],
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [availableSubscriptions, setAvailableSubscriptions] = useState<any[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | 'none'>('none');
  const [amountReceived, setAmountReceived] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewSubscription, setRenewSubscription] = useState<any>(null);
  const [renewAmountReceived, setRenewAmountReceived] = useState('');
  const [renewPaymentMethod, setRenewPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [renewReceiptNumber, setRenewReceiptNumber] = useState('');
  const [renewPaymentNotes, setRenewPaymentNotes] = useState('');
  const [showPayPendingModal, setShowPayPendingModal] = useState(false);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState('');
  const [pendingReceiptNumber, setPendingReceiptNumber] = useState('');
  const [pendingPaymentNotes, setPendingPaymentNotes] = useState('');
  const [showAttendanceCalendar, setShowAttendanceCalendar] = useState(false);
  const [memberAttendance, setMemberAttendance] = useState<any[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [admissionFee, setAdmissionFee] = useState('50');
  const [discountAmount, setDiscountAmount] = useState('');
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
  const [showJoiningDatePicker, setShowJoiningDatePicker] = useState(false);

  // const [isCreatingMember, setIsCreatingMember] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      loadInvoices();
    }
  }, [profile?.id]);

  const pickImage = async () => {
    try {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (cameraStatus !== 'granted' && libraryStatus !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera and photo library access');
        return;
      }

      Alert.alert(
        'Upload Photo',
        'Choose an option',
        [
          {
            text: 'Take Photo',
            onPress: async () => {
              if (cameraStatus !== 'granted') {
                Alert.alert('Permission Denied', 'Camera access required');
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
                base64: false,
              });

              if (!result.canceled && result.assets[0]) {
                setNewMember({ ...newMember, profile_photo_uri: result.assets[0].uri });
              }
            },
          },
          {
            text: 'Choose from Gallery',
            onPress: async () => {
              if (libraryStatus !== 'granted') {
                Alert.alert('Permission Denied', 'Photo library access required');
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
                base64: false,
              });

              if (!result.canceled && result.assets[0]) {
                setNewMember({ ...newMember, profile_photo_uri: result.assets[0].uri });
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to open image picker');
    }
  };

  // ⭐ For creating new members (WORKS ✅)
  const uploadProfilePhoto = async (
    userId: string,
    photoUri: string
  ): Promise<string> => {
    try {
      console.log('📸 Uploading profile photo for:', userId);

      // ✅ Upload to storage
      const photoUrl = await uploadMemberPhoto(photoUri, userId);

      // ✅ Update DB
      const { error } = await supabase
        .from('profiles')
        .update({ profile_photo_url: photoUrl })
        .eq('id', userId);

      if (error) throw error;

      console.log('📸 Upload & DB update successful');
      return photoUrl;

    } catch (error: any) {
      console.error('📸 Upload failed:', error?.message || error);
      throw error;
    }
  };

  // ⭐ FIXED: Update existing member photo with cache busting
  const updateMemberPhoto = async (memberId: string) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo permission');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setUpdatingPhoto(true);

      console.log('📸 Updating photo for member:', memberId);
      console.log('📸 Image URI:', result.assets[0].uri);

      try {
        // ✅ Step 1: Upload photo to storage (upsert overwrites old file)
        const photoUrl = await uploadMemberPhoto(result.assets[0].uri, memberId);
        console.log('✅ Photo uploaded, URL:', photoUrl);

        // ✅ Step 2: Add cache-busting timestamp to URL
        const cacheBustedUrl = `${photoUrl}?t=${Date.now()}`;
        console.log('✅ Cache-busted URL:', cacheBustedUrl);

        // ✅ Step 3: Update database with cache-busted URL
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            profile_photo_url: cacheBustedUrl,
            updated_at: new Date().toISOString() // Force profile update
          })
          .eq('id', memberId);

        if (updateError) {
          console.error('❌ DB update error:', updateError);
          throw new Error('Failed to update profile photo in database');
        }

        console.log('✅ Database updated successfully');

        // ✅ Step 4: Update local state with cache-busted URL
        if (selectedMember) {
          setSelectedMember({
            ...selectedMember,
            profile_photo_url: cacheBustedUrl,
          });
        }

        // ✅ Step 5: Refresh member list
        await fetchMembers();

        Alert.alert('Success', 'Profile photo updated successfully');

      } catch (uploadError: any) {
        console.error('❌ Update failed:', uploadError);
        throw uploadError;
      }

    } catch (error: any) {
      console.error('❌ Update process failed:', error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to update photo. Please try again.'
      );
    } finally {
      setUpdatingPhoto(false);
    }
  };

  // Generate unique member ID
  const generateMemberId = async (gymId: string | null) => {
    try {
      if (!gymId) return `MEM-${Date.now()}`;

      // Get count of members in this gym
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .eq('role', 'member');

      const nextNumber = (count || 0) + 1;
      return `MEM-${String(nextNumber).padStart(4, '0')}`;
    } catch (error) {
      return `MEM-${Date.now()}`;
    }
  };

  const loadInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const data = await getUserInvoices(profile!.id);
      setInvoices(data);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };
  const ensurePaymentFields = (subscription: any) => {
    if (!subscription) return subscription;

    const subscriptionPrice = subscription.subscription?.price || 0;

    return {
      ...subscription,
      total_amount: subscription.total_amount || subscriptionPrice,
      paid_amount: subscription.paid_amount || 0,
      pending_amount: subscription.pending_amount !== undefined
        ? subscription.pending_amount
        : Math.max(0, (subscription.total_amount || subscriptionPrice) - (subscription.paid_amount || 0)),
      payment_status: (() => {
        const pending = subscription.pending_amount !== undefined
          ? subscription.pending_amount
          : Math.max(0, (subscription.total_amount || subscriptionPrice) - (subscription.paid_amount || 0));

        if (pending === 0) return 'completed';
        if ((subscription.paid_amount || 0) > 0) return 'partial';
        return 'pending';
      })()
    };
  };

  useEffect(() => {
    if (profile?.role === 'admin' || profile?.role === 'gym_owner') {
      fetchMembers();
      fetchAvailableSubscriptions();
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [profile]);

  const calculateFinalAmount = () => {
    if (!selectedSubscription) return 0;

    const planPrice = selectedSubscription.price || 0;
    const admission = parseFloat(admissionFee) || 0;
    const discount = parseFloat(discountAmount) || 0;

    const subtotal = planPrice + admission;
    const total = subtotal - discount;

    return Math.max(0, total);
  };

  // Add this helper function to calculate remaining after amount received
  const calculateRemainingAmount = () => {
    const finalAmount = calculateFinalAmount();
    const received = parseFloat(amountReceived) || 0;
    return Math.max(0, finalAmount - received);
  };

  const fetchAvailableSubscriptions = async () => {
    try {
      let query = supabase
        .from('subscriptions')
        .select('*')
        .eq('is_active', true)
        .order('duration_months', { ascending: true });

      if (profile?.role === 'gym_owner' && profile.gym_id) {
        query = query.eq('gym_id', profile.gym_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAvailableSubscriptions(data || []);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    }
  };

  useEffect(() => {
    let filtered = members;

    if (filterStatus === 'active') {
      filtered = filtered.filter(m => m.subscriptionStatus === 'active');
    } else if (filterStatus === 'expired') {
      filtered = filtered.filter(m => m.subscriptionStatus === 'expired' || m.subscriptionStatus === 'none');
    }

    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(
        (member) =>
          member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (member.phone && member.phone.includes(searchQuery))
      );
    }

    setFilteredMembers(filtered);
  }, [searchQuery, members, filterStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  const fetchMembers = async () => {
    try {
      let query = supabase.from('profiles').select('*');

      if (profile?.role === 'gym_owner' && profile.gym_id) {
        query = query.eq('gym_id', profile.gym_id).eq('role', 'member');
      } else {
        query = query.eq('role', 'member');
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split('T')[0];

      const membersWithDetails = await Promise.all(
        (data || []).map(async (member) => {
          const stats = await fetchMemberStats(member.id);

          const { data: allUserSubscriptions } = await supabase
            .from('user_subscriptions')
            .select(`
              *,
              subscription:subscription_id (
                name,
                price,
                duration_months,
                duration_days
              )
            `)
            .eq('user_id', member.id)
            .order('created_at', { ascending: false });

          let currentSubscription = null;
          let subscriptionStatus: 'active' | 'expired' | 'none' = 'none';

          if (allUserSubscriptions && allUserSubscriptions.length > 0) {
            const activeSubscription = allUserSubscriptions.find((sub: any) => {
              if (!sub.end_date) return false;
              return sub.end_date >= todayString;
            });

            if (activeSubscription) {
              currentSubscription = activeSubscription;
              subscriptionStatus = 'active';
            } else {
              currentSubscription = allUserSubscriptions[0];
              subscriptionStatus = 'expired';
            }

            if (currentSubscription) {
              // Get data ONLY from user_subscriptions (PRIMARY SOURCE)
              const subscriptionPrice = currentSubscription.subscription?.price || 0;

              // Ensure all amount fields exist
              currentSubscription.total_amount = currentSubscription.total_amount || subscriptionPrice;
              currentSubscription.paid_amount = currentSubscription.paid_amount || 0;
              currentSubscription.pending_amount = currentSubscription.pending_amount ||
                Math.max(0, currentSubscription.total_amount - currentSubscription.paid_amount);

              // Calculate payment status from pending_amount
              if (currentSubscription.pending_amount === 0) {
                currentSubscription.payment_status = 'completed';
              } else if (currentSubscription.paid_amount > 0) {
                currentSubscription.payment_status = 'partial';
              } else {
                currentSubscription.payment_status = 'pending';
              }
            }
          }

          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', member.id)
            .gte('attendance_date', startOfMonth.toISOString().split('T')[0]);

          const totalCheckIns = attendanceData?.length || 0;
          const daysInMonth = new Date().getDate();

          return {
            ...member,
            stats,
            currentSubscription: currentSubscription || null,
            totalCheckIns,
            expectedCheckIns: daysInMonth,
            subscriptionStatus,
          };
        })
      );

      setMembers(membersWithDetails);
    } catch (error) {
      console.error('Error fetching members:', error);
      Alert.alert('Error', 'Failed to fetch members');
    }
  };

  const fetchMemberStats = async (memberId: string) => {
    try {
      const { data: workoutLogs } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', memberId);

      const { data: dietLogs } = await supabase
        .from('diet_logs')
        .select('*')
        .eq('user_id', memberId);

      const totalWorkouts = workoutLogs?.length || 0;
      const totalCaloriesBurned = workoutLogs?.reduce((sum, log) => sum + Number(log.calories_burned), 0) || 0;
      const totalMinutes = workoutLogs?.reduce((sum, log) => sum + log.duration_minutes, 0) || 0;
      const totalMeals = dietLogs?.length || 0;

      return {
        totalWorkouts,
        totalCaloriesBurned: Math.round(totalCaloriesBurned),
        totalMinutes,
        totalMeals,
      };
    } catch (error) {
      return {
        totalWorkouts: 0,
        totalCaloriesBurned: 0,
        totalMinutes: 0,
        totalMeals: 0,
      };
    }
  };

  const calculateRemainingDays = (endDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const fetchMemberAttendance = async (memberId: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', memberId)
        .order('attendance_date', { ascending: false });

      if (error) throw error;

      setMemberAttendance(data || []);
      setShowAttendanceCalendar(true);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      Alert.alert('Error', 'Failed to fetch attendance records');
    }
  };

  const fetchMemberDetails = async (memberId: string) => {
    try {
      setIsLoading(true);

      const { data: memberData, error: memberError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', memberId)
        .single();

      if (memberError) throw memberError;

      const stats = await fetchMemberStats(memberId);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split('T')[0];

      const { data: allUserSubscriptions } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription:subscription_id (
            name,
            price,
            duration_months,
            duration_days
          )
        `)
        .eq('user_id', memberId)
        .order('created_at', { ascending: false });

      let currentSubscription = null;
      let subscriptionStatus: 'active' | 'expired' | 'none' = 'none';

      if (allUserSubscriptions && allUserSubscriptions.length > 0) {
        const activeSubscription = allUserSubscriptions.find((sub: any) => {
          if (!sub.end_date) return false;
          return sub.end_date >= todayString;
        });

        if (activeSubscription) {
          currentSubscription = activeSubscription;
          subscriptionStatus = 'active';
        } else {
          currentSubscription = allUserSubscriptions[0];
          subscriptionStatus = 'expired';
        }

        if (currentSubscription) {
          // Get data ONLY from user_subscriptions (PRIMARY SOURCE)
          const subscriptionPrice = currentSubscription.subscription?.price || 0;

          // Ensure all amount fields exist
          currentSubscription.total_amount = currentSubscription.total_amount || subscriptionPrice;
          currentSubscription.paid_amount = currentSubscription.paid_amount || 0;
          currentSubscription.pending_amount = currentSubscription.pending_amount ||
            Math.max(0, currentSubscription.total_amount - currentSubscription.paid_amount);

          // Calculate payment status from pending_amount
          if (currentSubscription.pending_amount === 0) {
            currentSubscription.payment_status = 'completed';
          } else if (currentSubscription.paid_amount > 0) {
            currentSubscription.payment_status = 'partial';
          } else {
            currentSubscription.payment_status = 'pending';
          }
        }
      }

      setSelectedMember({
        ...memberData,
        stats,
        currentSubscription,
        subscriptionStatus,
      });
      setShowMemberDetails(true);
    } catch (error) {
      console.error('Error fetching member details:', error);
      Alert.alert('Error', 'Failed to fetch member details');
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePendingAmount = () => {
    if (!selectedSubscription || !amountReceived) return selectedSubscription?.price || 0;
    const finalAmount = calculateFinalAmount();
    const received = parseFloat(amountReceived) || 0;
    const total = selectedSubscription.price || 0;
    return Math.max(0, total - received);
  };


  const addMember = async () => {
    if (!newMember.full_name || !newMember.email || !newMember.password || !newMember.phone) {
      if (Platform.OS === 'web') {
        window.alert('Please fill in all required fields');
      } else {
        Alert.alert('Error', 'Please fill in all required fields');
      }
      return;
    }

    if (newMember.password.length < 6) {
      if (Platform.OS === 'web') {
        window.alert('Password must be at least 6 characters');
      } else {
        Alert.alert('Error', 'Password must be at least 6 characters');
      }
      return;
    }

    if ((paymentMethod === 'cash' || paymentMethod === 'online') && selectedSubscription) {
      if (!amountReceived || parseFloat(amountReceived) <= 0) {
        if (Platform.OS === 'web') {
          window.alert('Please enter amount received');
        } else {
          Alert.alert('Error', 'Please enter amount received');
        }
        return;
      }
      if (parseFloat(amountReceived) > selectedSubscription.price + parseFloat(admissionFee)) {
        if (Platform.OS === 'web') {
          window.alert('Amount received cannot exceed plan price');
        } else {
          Alert.alert('Error', 'Amount received cannot exceed plan price');
        }
        return;
      }
    }

    setIsLoading(true);
    setIsCreatingMember(true);

    try {
      // Step 1: Save current admin session
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      console.log('📝 Creating new member account...');

      // Step 2: Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newMember.email,
        password: newMember.password,
        options: {
          emailRedirectTo: undefined,
          data: {
            full_name: newMember.full_name,
            phone: newMember.phone,
            role: 'member',
            gym_id: profile?.gym_id ? String(profile.gym_id) : null,
            has_personal_training: newMember.has_personal_training,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const userId = authData.user.id;
      console.log('✅ User created:', userId);

      // Step 3: Wait a moment for profile to be created by trigger
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Update profile with ALL required fields (BEFORE restoring session)
      console.log('📝 Updating profile with phone, weight, height, batch...');

      const profileUpdates: any = {
        gym_id: profile?.gym_id,
        phone: newMember.phone,
        weight: newMember.weight ? parseFloat(newMember.weight) : null,
        height: newMember.height ? parseFloat(newMember.height) : null,
        batch: newMember.batch,
        has_personal_training: newMember.has_personal_training,
        gender: selectedGender,
        member_id: newMember.member_id,
        notes: newMember.notes || null,
        joining_date: newMember.joining_date,
      };

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (profileUpdateError) {
        console.error('Profile update error:', profileUpdateError);
        throw new Error(`Failed to update profile: ${profileUpdateError.message}`);
      }

      console.log('✅ Profile updated with phone and other fields');

      // Step 5: Upload profile photo if provided (AFTER profile is created)
      let uploadedPhotoUrl: string | null = null;
      if (newMember.profile_photo_uri) {
        try {
          console.log('📸 Uploading profile photo...');
          uploadedPhotoUrl = await uploadProfilePhoto(userId, newMember.profile_photo_uri);

          if (uploadedPhotoUrl) {
            console.log('✅ Photo uploaded successfully');
          } else {
            console.warn('⚠️ Photo upload failed, but continuing...');
          }
        } catch (photoError: any) {
          console.error('❌ Photo upload failed:', photoError);
          // Don't fail member creation - just log it
        }
      }

      // Step 6: Restore admin session
      console.log('🔄 Restoring admin session...');
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
        console.log('✅ Admin session restored');
      }

      // Step 7: Verify phone and photo were saved
      const { data: verifyProfile } = await supabase
        .from('profiles')
        .select('phone, profile_photo_url, weight, height, batch')
        .eq('id', userId)
        .single();

      console.log('✅ Profile verification:', verifyProfile);

      if (!verifyProfile?.phone) {
        console.error('⚠️ WARNING: Phone was not saved!');
      }

      // Step 8: Handle personal training
      if (newMember.has_personal_training && profile?.gym_id) {
        await supabase.from('personal_training_assignments').insert([{
          user_id: userId,
          gym_id: profile.gym_id,
          assigned_by: profile.id,
          is_active: true,
          start_date: customStartDate,
        }]);
      }

      // Step 9: Handle subscription if selected
      if ((paymentMethod === 'cash' || paymentMethod === 'online') && selectedSubscription) {
        try {
          const finalAmount = calculateFinalAmount();
          const received = parseFloat(amountReceived);
          const pending = Math.max(0, finalAmount - received);
          const paymentStatus = pending === 0 ? 'completed' : 'partial';
          const startDateParts = customStartDate.split('-');
          const startDate = new Date(
            parseInt(startDateParts[0]),
            parseInt(startDateParts[1]) - 1,
            parseInt(startDateParts[2]),
            12, 0, 0
          );

          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + (selectedSubscription.duration_days || selectedSubscription.duration_months * 30));

          const { data: userSub, error: subError } = await supabase
            .from('user_subscriptions')
            .insert([{
              user_id: userId,
              subscription_id: selectedSubscription.id,
              start_date: customStartDate,
              end_date: endDate.toISOString().split('T')[0],
              custom_start_date: customStartDate,
              total_amount: finalAmount, // ⭐ CHANGED
              admission_fee: parseFloat(admissionFee) || 0, // ⭐ NEW
              discount_amount: parseFloat(discountAmount) || 0, // ⭐ NEW
              paid_amount: received,
              amount_paid: received,
              pending_amount: pending,
              payment_status: paymentStatus,
              payment_method: paymentMethod,
              is_active: true,
              currency: 'INR',
              gym_id: profile?.gym_id,
              created_by: profile?.id,
              payment_notes: paymentNotes || null,
              last_payment_date: received > 0 ? new Date().toISOString() : null,
            }])
            .select()
            .single();

          if (subError) throw subError;

          if (received > 0) {
            const receiptNum = receiptNumber || `REC-${Date.now()}`;

            const { data: payment, error: paymentError } = await supabase
              .from('cash_payments')
              .insert([{
                user_id: userId,
                gym_id: profile?.gym_id,
                amount: received,
                currency: 'INR',
                receipt_number: receiptNum,
                payment_date: new Date().toISOString(),
                received_by: profile?.id,
                notes: paymentNotes || `Initial payment for ${selectedSubscription.name}`,
              }])
              .select()
              .single();

            if (paymentError) throw paymentError;

            await supabase.from('invoices').insert([{
              invoice_number: `INV-${Date.now()}`,
              user_id: userId,
              gym_id: profile?.gym_id,
              subscription_id: userSub.id,
              payment_type: paymentMethod,
              amount: selectedSubscription.price,
              currency: 'INR',
              total_amount: selectedSubscription.price,
              remaining_amount: pending,
              payment_status: paymentStatus,
              invoice_date: new Date().toISOString(),
              payment_id: payment.id,
              items: JSON.stringify([{
                description: `${selectedSubscription.name} - New Subscription`,
                quantity: 1,
                rate: selectedSubscription.price,
                amount: selectedSubscription.price,
              }]),
            }]);
          }
        } catch (subError) {
          console.error('Error creating subscription:', subError);
          if (Platform.OS === 'web') {
            window.alert('Member created but subscription setup failed.');
          } else {
            Alert.alert('Warning', 'Member created but subscription setup failed.');
          }
        }
      }

      const addedMemberName = newMember.full_name;

      // Step 10: Reset form and close modal
      setShowAddMember(false);
      setNewMember({
        full_name: '',
        email: '',
        phone: '',
        password: '123456',
        has_personal_training: false,
        weight: '',
        height: '',
        batch: 'morning',
        profile_photo_uri: '',
        member_id: '',
        notes: '',
        joining_date: new Date().toISOString().split('T')[0],
      });
      setSelectedGender('male'); // ⭐ ADD THIS
      setAdmissionFee('50'); // ⭐ ADD THIS
      setDiscountAmount('');
      setSelectedSubscription(null);
      setPaymentMethod('none');
      setAmountReceived('');
      setReceiptNumber('');
      setPaymentNotes('');
      setCustomStartDate(new Date().toISOString().split('T')[0]);
      setShowDatePicker(false);

      // Step 11: Refresh member list
      await fetchMembers();

      // Step 12: Show success message
      setTimeout(() => {
        let successMessage = `${addedMemberName} added successfully!`;

        if (uploadedPhotoUrl) {
          successMessage = `${addedMemberName} added successfully with profile photo!`;
        } else if (newMember.profile_photo_uri) {
          successMessage = `${addedMemberName} added! Photo upload had issues, you can update it later.`;
        }

        if (Platform.OS === 'web') {
          window.alert(`Success\n\n${successMessage}`);
        } else {
          Alert.alert('Success', successMessage);
        }
      }, 300);

    } catch (error: any) {
      console.error('❌ Add member error:', error);
      const errorMessage = error?.message || 'Failed to add member';
      if (errorMessage.includes('already registered')) {
        if (Platform.OS === 'web') {
          window.alert('This email is already registered');
        } else {
          Alert.alert('Error', 'This email is already registered');
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert(`Error: ${errorMessage}`);
        } else {
          Alert.alert('Error', errorMessage);
        }
      }
    } finally {
      setIsLoading(false);
      setIsCreatingMember(false);
    }
  };

  const deleteMember = async (memberId: string, memberName: string) => {
    showConfirm(
      'Delete Member',
      `Are you sure you want to delete ${memberName}? This will permanently delete all their data.`,
      async () => {
        try {
          setIsLoading(true);

          const { error: rpcError } = await supabase.rpc('delete_user', {
            user_id: memberId
          });

          if (rpcError) {
            console.log('RPC failed, manual delete...', rpcError);

            await supabase.from('attendance').delete().eq('user_id', memberId);
            await supabase.from('workout_logs').delete().eq('user_id', memberId);
            await supabase.from('diet_logs').delete().eq('user_id', memberId);
            await supabase.from('cash_payments').delete().eq('user_id', memberId);
            await supabase.from('invoices').delete().eq('user_id', memberId);
            await supabase.from('user_subscriptions').delete().eq('user_id', memberId);
            await supabase.from('personal_training_assignments').delete().eq('user_id', memberId);

            const { error: profileError } = await supabase
              .from('profiles')
              .delete()
              .eq('id', memberId);

            if (profileError) throw profileError;
          }

          setShowMemberDetails(false);
          await fetchMembers();

          showAlert('Success', `${memberName} deleted successfully`);

        } catch (error: any) {
          console.error('Delete error:', error);
          showAlert('Error', error.message || 'Failed to delete member');
        } finally {
          setIsLoading(false);
        }
      }
    );
  };
  const getDateAsISO = (dateString: string) => {
    // Add time at start of day in UTC to avoid timezone issues
    return new Date(dateString + 'T00:00:00.000Z').toISOString();
  };
  const payPendingAmount = async () => {
    if (!selectedMember || !selectedMember.currentSubscription) {
      window.alert('No subscription found')
      Alert.alert('Error', 'No subscription found');
      return;
    }

    if (!pendingPaymentAmount || parseFloat(pendingPaymentAmount) <= 0) {
      window.alert('Please enter payment amount')
      Alert.alert('Error', 'Please enter payment amount');
      return;
    }

    const paymentAmount = parseFloat(pendingPaymentAmount);
    const currentPending = selectedMember.currentSubscription.pending_amount || 0;

    if (paymentAmount > currentPending) {
      window.alert(`Payment amount cannot exceed pending amount of ${formatRupees(currentPending)}`)
      Alert.alert('Error', `Payment amount cannot exceed pending amount of ${formatRupees(currentPending)}`);
      return;
    }

    setIsLoading(true);

    try {
      const receiptNum = pendingReceiptNumber || `REC-${Date.now()}`;
      const newPending = currentPending - paymentAmount;
      const newPaid = (selectedMember.currentSubscription.paid_amount || 0) + paymentAmount;
      const newStatus = newPending === 0 ? 'completed' : 'partial';

      // 1. Create cash payment record
      const { data: payment, error: paymentError } = await supabase
        .from('cash_payments')
        .insert([{
          user_id: selectedMember.id,
          gym_id: profile?.gym_id,
          amount: paymentAmount,
          currency: 'INR',
          receipt_number: receiptNum,
          payment_date: new Date().toISOString(),
          received_by: profile?.id,
          notes: pendingPaymentNotes || `Pending payment collection for subscription`,
        }])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // 2. Update user_subscriptions table (PRIMARY SOURCE OF TRUTH)
      const { error: subError } = await supabase
        .from('user_subscriptions')
        .update({
          paid_amount: newPaid,
          amount_paid: newPaid, // Keep both fields in sync
          pending_amount: newPending,
          payment_status: newStatus,
          last_payment_date: new Date().toISOString(),
        })
        .eq('id', selectedMember.currentSubscription.id);

      if (subError) throw subError;

      // 3. Sync or create invoice
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('user_id', selectedMember.id)
        .eq('subscription_id', selectedMember.currentSubscription.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingInvoice) {
        // Update existing invoice
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            remaining_amount: newPending,
            payment_status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingInvoice.id);

        if (updateError) {
          console.error('Invoice update error:', updateError);
        }
      } else {
        // Create new invoice if doesn't exist
        const subscriptionData = selectedMember.currentSubscription;
        const totalAmount = subscriptionData.total_amount || 0;

        const { error: createError } = await supabase.from('invoices').insert([{
          invoice_number: `INV-${Date.now()}`,
          user_id: selectedMember.id,
          gym_id: profile?.gym_id,
          subscription_id: selectedMember.currentSubscription.id,
          payment_type: 'cash',
          amount: totalAmount,
          currency: 'INR',
          start_date: getDateAsISO(customStartDate),
          total_amount: totalAmount,
          remaining_amount: newPending,
          payment_status: newStatus,
          invoice_date: new Date().toISOString(),
          payment_id: payment.id,
          items: JSON.stringify([{
            description: `${subscriptionData.subscription?.name || 'Subscription'} - Payment Collection`,
            quantity: 1,
            rate: totalAmount,
            amount: totalAmount,
          }]),
        }]);

        if (createError) {
          console.error('Invoice creation error:', createError);
        }
      }

      // Reset form
      setPendingPaymentAmount('');
      setPendingReceiptNumber('');
      setPendingPaymentNotes('');
      setShowPayPendingModal(false);

      // Refresh data
      await fetchMembers();
      await fetchMemberDetails(selectedMember.id);

      Alert.alert(
        'Success',
        newPending === 0
          ? 'Payment completed! No pending amount remaining.'
          : `Payment received! Remaining: ${formatRupees(newPending)}`
      );
    } catch (error: any) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', error.message || 'Failed to process payment');
    } finally {
      setIsLoading(false);
    }
  };

  const renewMemberSubscription = async () => {
    if (!selectedMember || !renewSubscription) {
      Alert.alert('Error', 'Please select a subscription plan');
      return;
    }

    // Check for pending amount on current subscription
    if (selectedMember.currentSubscription && selectedMember.currentSubscription.pending_amount > 0) {
      Alert.alert(
        'Pending Payment',
        `This member has a pending amount of ${formatRupees(selectedMember.currentSubscription.pending_amount)} on their current subscription. Please clear this before renewing.`,
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Pay Now',
            onPress: () => {
              setShowRenewModal(false);
              setTimeout(() => {
                setShowPayPendingModal(true);
              }, 300);
            }
          }
        ]
      );
      return;
    }

    if (!renewAmountReceived || parseFloat(renewAmountReceived) <= 0) {
      Alert.alert('Error', 'Please enter amount received');
      return;
    }

    const received = parseFloat(renewAmountReceived);
    const discount = parseFloat(discountAmount) || 0;
    const finalAmount = Math.max(0, renewSubscription.price - discount);

    if (received > finalAmount) {
      Alert.alert('Error', `Amount received cannot exceed final amount of ${formatRupees(finalAmount)}`);
      return;
    }

    setIsLoading(true);

    try {
      const startDateParts = customStartDate.split('-');
      const startDate = new Date(
        parseInt(startDateParts[0]),
        parseInt(startDateParts[1]) - 1,
        parseInt(startDateParts[2]),
        12, 0, 0
      );

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (renewSubscription.duration_days || renewSubscription.duration_months * 30));

      const pending = Math.max(0, finalAmount - received);
      const paymentStatus = pending === 0 ? 'completed' : 'partial';

      // Create new subscription
      const { data: newSubscription, error: subError } = await supabase
        .from('user_subscriptions')
        .insert([{
          user_id: selectedMember.id,
          subscription_id: renewSubscription.id,
          start_date: customStartDate,
          end_date: endDate.toISOString().split('T')[0],
          total_amount: finalAmount,  // ⭐ Changed
          discount_amount: discount,   // ⭐ Added
          paid_amount: received,
          amount_paid: received,
          pending_amount: pending,
          payment_status: paymentStatus,
          payment_method: renewPaymentMethod,
          is_active: true,
          currency: 'INR',
          gym_id: profile?.gym_id,
          created_by: profile?.id,
          payment_notes: renewPaymentNotes || null,
          last_payment_date: received > 0 ? new Date().toISOString() : null,
        }])
        .select()
        .single();

      if (subError) throw subError;

      // Create payment record if amount received
      if (received > 0) {
        const receiptNum = renewReceiptNumber || `REC-${Date.now()}`;

        const { data: payment, error: paymentError } = await supabase
          .from('cash_payments')
          .insert([{
            user_id: selectedMember.id,
            gym_id: profile?.gym_id,
            amount: received,
            currency: 'INR',
            receipt_number: receiptNum,
            payment_date: new Date().toISOString(),
            received_by: profile?.id,
            notes: renewPaymentNotes || `Renewal payment for ${renewSubscription.name}`,
          }])
          .select()
          .single();

        if (paymentError) throw paymentError;

        // Create invoice with error handling
        const { error: invoiceError } = await supabase.from('invoices').insert([{
          invoice_number: `INV-${Date.now()}`,
          user_id: selectedMember.id,
          gym_id: profile?.gym_id,
          subscription_id: newSubscription.id,
          payment_type: renewPaymentMethod,
          amount: renewSubscription.price,
          currency: 'INR',
          total_amount: renewSubscription.price,
          remaining_amount: pending,
          payment_status: paymentStatus,
          invoice_date: new Date().toISOString(),
          payment_id: payment.id,
          items: JSON.stringify([{
            description: `${renewSubscription.name} - Renewal`,
            quantity: 1,
            rate: renewSubscription.price,
            amount: renewSubscription.price,
          }]),
        }]);

        if (invoiceError) {
          console.error('Invoice creation error:', invoiceError);
          // Continue anyway - invoice is optional
        }
      }

      // Deactivate old subscription
      if (selectedMember.currentSubscription) {
        await supabase
          .from('user_subscriptions')
          .update({ is_active: false })
          .eq('id', selectedMember.currentSubscription.id);
      }

      // Reset form
      setRenewSubscription(null);
      setRenewAmountReceived('');
      setRenewPaymentMethod('cash');
      setRenewReceiptNumber('');
      setRenewPaymentNotes('');
      setShowRenewModal(false);

      // Refresh data
      await fetchMembers();
      await fetchMemberDetails(selectedMember.id);

      Alert.alert(
        'Success',
        `Subscription renewed! Paid: ${formatRupees(received)}, Pending: ${formatRupees(pending)}`
      );
    } catch (error: any) {
      console.error('Error renewing subscription:', error);
      Alert.alert('Error', error.message || 'Failed to renew subscription');
    } finally {
      setIsLoading(false);
    }
  };
  // Replace the handleSendPaymentReminder function with this corrected version:

  const handleSendPaymentReminder = async (member: MemberDetails) => {
    try {
      setIsLoading(true);

      // Check if member has pending payment
      if (!member.currentSubscription || (member.currentSubscription.pending_amount || 0) <= 0) {
        Alert.alert('No Pending Payment', 'This member has no pending payment.');
        return;
      }

      // Web platform check
      if (Platform.OS === 'web') {
        Alert.alert('Not Supported on Web', 'WhatsApp sharing is only available on mobile devices.');
        return;
      }

      // Fetch phone number
      let phoneNumber = member.phone?.replace(/[^0-9]/g, '');

      if (!phoneNumber) {
        Alert.alert('Error', 'Member phone number not found. Please add a phone number for this member in their profile.');
        return;
      }

      // Validate phone number length
      if (phoneNumber.length < 10) {
        Alert.alert('Error', 'Invalid phone number. Please check the member\'s phone number.');
        return;
      }

      // Add country code if not present
      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = '91' + phoneNumber;
      }

      const pendingAmount = member.currentSubscription.pending_amount || 0;
      const paidAmount = member.currentSubscription.paid_amount || 0;
      const totalAmount = member.currentSubscription.total_amount || 0;
      const planName = member.currentSubscription.subscription?.name || 'Subscription';
      const endDate = new Date(member.currentSubscription.end_date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      // ⭐ FIX: Get gym name from profile instead of non-existent gym variable
      let gymName = 'Gym';
      if (profile?.gym_id) {
        const { data: gymData } = await supabase
          .from('gyms')
          .select('name')
          .eq('id', profile.gym_id)
          .single();

        if (gymData) {
          gymName = gymData.name;
        }
      }

      const message = `Hi ${member.full_name} 👋

This is a friendly reminder about your pending payment.

*Payment Details:*
Plan: ${planName}
Total Amount: ${formatRupees(totalAmount)}
Paid: ${formatRupees(paidAmount)} ✅
*Pending: ${formatRupees(pendingAmount)}* ⚠️

Valid Till: ${endDate}

Please complete your payment at your earliest convenience to continue enjoying uninterrupted access to our facilities.

For any queries, feel free to contact us.

Thank you!
${gymName}`;

      // Try different WhatsApp URL formats
      const whatsappUrls = [
        `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`,
        `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`,
        `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`
      ];

      let whatsappOpened = false;

      // Try opening WhatsApp with message
      for (const url of whatsappUrls) {
        try {
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
            whatsappOpened = true;

            // Log reminder sent (only if table exists)
            try {
              await supabase.from('payment_reminders').insert({
                user_id: member.id,
                subscription_id: member.currentSubscription.id,
                pending_amount: pendingAmount,
                sent_by: profile?.id,
                gym_id: profile?.gym_id,
                sent_at: new Date().toISOString(),
              });
            } catch (logError) {
              // Ignore if table doesn't exist
              console.log('Payment reminders log skipped');
            }

            Alert.alert('Success', 'Payment reminder sent via WhatsApp!');
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!whatsappOpened) {
        Alert.alert(
          'WhatsApp Not Available',
          'WhatsApp is not installed on this device. Please install WhatsApp to send reminders.',
          [{ text: 'OK', style: 'cancel' }]
        );
      }

    } catch (error: any) {
      console.error('Error sending payment reminder:', error);
      Alert.alert('Error', 'Failed to send reminder: ' + (error?.message || 'Unknown error'));
    } finally {
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
      paddingBottom: 100,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 8 : 16,
      paddingBottom: 20,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    searchContainer: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    passwordContainer: {
      position: 'relative',
    },
    passwordInput: {
      paddingRight: 50,
    },
    eyeIcon: {
      position: 'absolute',
      right: 12,
      top: 12,
      padding: 8,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      gap: 12,
    },
    batchDropdown: {
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: 12,
      backgroundColor: theme.colors.card,
      overflow: 'hidden',
    },
    batchOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    batchOptionLast: {
      borderBottomWidth: 0,
    },
    batchOptionSelected: {
      backgroundColor: theme.colors.primary + '10',
    },
    batchOptionText: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '500',
    },
    batchOptionTextSelected: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    batchBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: theme.colors.primary + '20',
    },
    batchBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.primary,
      textTransform: 'capitalize',
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    noMembersCard: {
      marginHorizontal: 20,
      alignItems: 'center',
      paddingVertical: 48,
      borderRadius: 16,
    },
    noMembersText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    noMembersSubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    memberCard: {
      marginHorizontal: 20,
      marginBottom: 12,
      padding: 20,
      borderRadius: 16,
    },
    memberInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    memberAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    memberDetails: {
      flex: 1,
    },
    memberName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 6,
    },
    memberContact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    memberEmail: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    genderContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    genderOption: {
      flex: 1,
      minWidth: '45%',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
    },
    genderOptionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '15',
    },
    genderOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    genderOptionTextSelected: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    priceBreakdown: {
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 16,
      marginVertical: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    breakdownLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    breakdownValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    breakdownTotal: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: 12,
      marginTop: 8,
    },
    breakdownTotalLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    breakdownTotalValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    memberPhone: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    memberStatsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    memberActions: {
      alignItems: 'flex-end',
      gap: 8,
    },
    memberLevel: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    memberStreak: {
      fontSize: 12,
      color: theme.colors.warning,
    },


    fab: {
      position: 'absolute',
      bottom: 24 + 70,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    photoOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.card,
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
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
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
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
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
    inputReadonly: {
      backgroundColor: theme.colors.background,
      color: theme.colors.textSecondary,
    },
    helperText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 6,
      lineHeight: 18,
    },
    sectionDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 24,
    },
    overviewCard: {
      marginBottom: 24,
      padding: 20,
    },
    overviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    overviewInfo: {
      flex: 1,
    },
    overviewName: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    overviewEmail: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    overviewPhone: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    overviewStats: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 8,
    },
    overviewLevel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    toggleContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    toggleLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    toggleSwitch: {
      width: 50,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.border,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    toggleSwitchActive: {
      backgroundColor: theme.colors.primary,
    },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.card,
      alignSelf: 'flex-start',
    },
    toggleThumbActive: {
      alignSelf: 'flex-end',
    },
    overviewPoints: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    height: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    weight: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },

    overviewStreak: {
      fontSize: 14,
      color: theme.colors.warning,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      minWidth: '45%',
      alignItems: 'center',
      padding: 16,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginTop: 8,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    sectionCard: {
      marginBottom: 24,
      padding: 20,
    },
    memberAvatarLarge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberStats: {
      alignItems: 'flex-end',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 16,
    },
    subscriptionScroll: {
      marginTop: 12,
      marginBottom: 20,
    },
    subscriptionOption: {
      minWidth: 140,
      padding: 16,
      marginRight: 12,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    subscriptionOptionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '15',
    },
    subscriptionName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    subscriptionNameSelected: {
      color: theme.colors.primary,
    },
    subscriptionPrice: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 2,
    },
    subscriptionPriceSelected: {
      color: theme.colors.primary,
    },
    subscriptionDuration: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    subscriptionDurationSelected: {
      color: theme.colors.primary,
    },
    paymentMethodRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
      marginBottom: 20,
    },
    paymentMethodOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      gap: 8,
      minHeight: 52,
    },
    paymentMethodOptionSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    paymentMethodText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    paymentMethodTextSelected: {
      color: '#FFFFFF',
    },
    paymentSummary: {
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    paymentSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    paymentSummaryLabel: {
      fontSize: 14,
      color: theme.colors.text,
    },
    paymentSummaryValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    paymentSummaryTotal: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: 12,
      marginTop: 4,
    },
    paymentSummaryTotalLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    paymentSummaryTotalValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    paymentStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    workoutItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    workoutInfo: {
      flex: 1,
    },
    workoutName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    workoutDetails: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    workoutDate: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    mealItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    mealInfo: {
      flex: 1,
    },
    mealName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    mealDetails: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    mealDate: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    noDataText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 20,
    },
    datePickerButton: {
      justifyContent: 'center',
      paddingVertical: 16,
    },
    datePickerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    datePickerText: {
      fontSize: 16,
      color: theme.colors.text,
      fontFamily: 'Inter-Regular',
    },
    dangerCard: {
      marginBottom: 24,
      padding: 20,
      borderColor: theme.colors.error + '30',
      borderWidth: 1,
    },
    contactRow: {
      gap: 8,
      marginBottom: 8,
    },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    contactText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Regular',
      flex: 1,
    },
    dangerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.error,
      marginBottom: 8,
    },
    dangerSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 16,
    },
    deleteButton: {
      borderColor: theme.colors.error,
    },
    deleteButtonText: {
      color: theme.colors.error,
    },
    paymentStatusBadgeComplete: {
      backgroundColor: theme.colors.success + '20',
    },
    paymentStatusBadgePartial: {
      backgroundColor: theme.colors.warning + '20',
    },
    paymentStatusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    paymentStatusTextComplete: {
      color: theme.colors.success,
    },
    paymentStatusTextPartial: {
      color: theme.colors.warning,
    },
    addButton: {
      marginTop: 8,
      marginBottom: 10,
      minHeight: 52,
    },
    filterTabs: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 8,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    filterTab: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterTabActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterTabText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    filterTabTextActive: {
      color: '#FFFFFF',
    },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: theme.colors.success + '20',
    },
    activeBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.success,
    },
    expiredBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: theme.colors.error + '20',
    },
    expiredBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.error,
    },
    subscriptionDetails: {
      marginTop: 8,
      padding: 12,
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
    },
    subscriptionPlanName: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.primary,
      marginBottom: 6,
    },
    subscriptionDates: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 6,
    },
    subscriptionDate: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    paymentInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: 4,
    },
    paymentLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.success,
    },
    pendingAmount: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.warning,
    },
    paidBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: theme.colors.success + '20',
    },
    paidBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.success,
    },
    partialBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: theme.colors.warning + '20',
    },
    partialBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.warning,
    },
    checkInStats: {
      marginTop: 8,
      gap: 4,
    },
    checkInItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    checkInText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
    },
    checkInProgress: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    progressBar: {
      flex: 1,
      height: 6,
      backgroundColor: theme.colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: 3,
    },
    progressText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.primary,
      minWidth: 35,
      textAlign: 'right',
    },
    calendarGrid: {
      marginTop: 16,
    },


    attendanceCheckMark: {
      position: 'absolute',
      top: 2,
      right: 2,
    },

    attendanceHeaderContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },

    // Overall Stats Card
    attendanceStatsCard: {
      marginBottom: 20,
      padding: 20,
      borderRadius: 16,
    },
    attendanceStatsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    memberAvatarSmall: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attendanceStatsName: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    attendanceStatsSubtext: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },

    attendanceOverallStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    attendanceStatBox: {
      flex: 1,
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.colors.background,
      borderRadius: 12,
    },
    attendanceStatIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    attendanceStatValue: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 4,
    },
    attendanceStatLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      fontWeight: '600',
    },

    // Month Card
    monthCard: {
      marginBottom: 16,
      padding: 16,
      borderRadius: 16,
    },
    monthHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    monthTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    monthSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    monthStatsChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.colors.primary + '20',
      borderRadius: 20,
    },
    monthStatsChipText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.primary,
    },

    // Month Stats Row
    monthStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 20,
      paddingVertical: 12,
      backgroundColor: theme.colors.background,
      borderRadius: 12,
    },
    monthStatItem: {
      alignItems: 'center',
    },
    monthStatValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    monthStatLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontWeight: '600',
    },

    // Calendar Container (Responsive)
    calendarContainer: {
      marginBottom: 16,
    },
    calendarWeekRow: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    calendarHeaderCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
    },
    calendarHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },

    // Calendar Days Grid (Responsive)
    calendarDaysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4, // Space between cells
    },
    calendarDayCell: {
      width: '13.14%', // (100% - gaps) / 7 days - adjusted for gaps
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      backgroundColor: theme.colors.background,
      position: 'relative',
    },
    calendarDayCellAttended: {
      backgroundColor: theme.colors.success + '15',
      borderColor: theme.colors.success,
      borderWidth: 1.5,
    },
    calendarDayCellToday: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
      backgroundColor: theme.colors.primary + '10',
    },
    calendarDayText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
    },
    calendarDayTextAttended: {
      color: theme.colors.success,
      fontWeight: '700',
    },
    calendarDayTextToday: {
      color: theme.colors.primary,
      fontWeight: '800',
    },

    // Attendance Indicator
    attendanceIndicator: {
      position: 'absolute',
      top: 2,
      right: 2,
    },
    checkInBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.error,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    checkInBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // Legend
    legendContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },

    // Empty State
    emptyStateCard: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginTop: 20,
      marginBottom: 8,
    },
    emptyStateText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    inputHalf: {
      flex: 1,
    },

  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>Members</Text>
            <Text style={styles.subtitle}>
              Manage your gym members ({members.length} total)
            </Text>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Search size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, email, or phone..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <X size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.filterTabs}>
            <TouchableOpacity
              style={[styles.filterTab, filterStatus === 'all' && styles.filterTabActive]}
              onPress={() => setFilterStatus('all')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTabText, filterStatus === 'all' && styles.filterTabTextActive]}>
                All ({members.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, filterStatus === 'active' && styles.filterTabActive]}
              onPress={() => setFilterStatus('active')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTabText, filterStatus === 'active' && styles.filterTabTextActive]}>
                Active ({members.filter(m => m.subscriptionStatus === 'active').length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, filterStatus === 'expired' && styles.filterTabActive]}
              onPress={() => setFilterStatus('expired')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTabText, filterStatus === 'expired' && styles.filterTabTextActive]}>
                Expired ({members.filter(m => m.subscriptionStatus === 'expired' || m.subscriptionStatus === 'none').length})
              </Text>
            </TouchableOpacity>
          </View>

          {filteredMembers.length === 0 ? (
            <Card style={styles.noMembersCard}>
              <User size={48} color={theme.colors.textSecondary} />
              <Text style={styles.noMembersText}>
                {searchQuery ? 'No members found' : 'No members yet'}
              </Text>
              <Text style={styles.noMembersSubtext}>
                {searchQuery ? 'Try adjusting your search' : 'Add your first member'}
              </Text>
            </Card>
          ) : (
            filteredMembers.map((member) => (
              <TouchableOpacity
                key={member.id}
                onPress={() => fetchMemberDetails(member.id)}
                activeOpacity={0.7}
              >
                <Card key={member.id} style={styles.memberCard}>
                  <View style={styles.memberInfo}>
                    <View style={styles.memberAvatar}>
                      {member.profile_photo_url ? (
                        <Image
                          source={{ uri: member.profile_photo_url }}
                          style={{ width: 50, height: 50, borderRadius: 25 }}
                        />
                      ) : (
                        <User size={24} color="#FFFFFF" />
                      )}
                    </View>
                    <View style={styles.memberDetails}>
                      {/* Name and Status Badges */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Text style={styles.memberName}>{member.full_name}</Text>
                        {member.subscriptionStatus === 'active' && (
                          <View style={styles.activeBadge}>
                            <CheckCircle size={12} color={theme.colors.success} />
                            <Text style={styles.activeBadgeText}>Active</Text>
                          </View>
                        )}
                        {member.subscriptionStatus === 'expired' && (
                          <View style={styles.expiredBadge}>
                            <AlertCircle size={12} color={theme.colors.error} />
                            <Text style={styles.expiredBadgeText}>Expired</Text>
                          </View>
                        )}
                        {member.subscriptionStatus === 'none' && (
                          <View style={[styles.expiredBadge, { backgroundColor: theme.colors.warning + '20' }]}>
                            <AlertCircle size={12} color={theme.colors.warning} />
                            <Text style={[styles.expiredBadgeText, { color: theme.colors.warning }]}>No Plan</Text>
                          </View>
                        )}
                      </View>

                      {/* Contact Info */}
                      <View style={styles.contactRow}>
                        <View style={styles.contactItem}>
                          <Mail size={14} color={theme.colors.textSecondary} />
                          <Text style={styles.contactText} numberOfLines={1}>{member.email}</Text>
                        </View>
                        {member.phone && (
                          <View style={styles.contactItem}>
                            <Phone size={14} color={theme.colors.textSecondary} />
                            <Text style={styles.contactText}>{member.phone}</Text>
                          </View>
                        )}
                      </View>

                      {/* Subscription Details */}
                      {member.currentSubscription && (
                        <View style={styles.subscriptionDetails}>
                          <Text style={styles.subscriptionPlanName}>
                            {member.currentSubscription.subscription?.name || 'Plan'}
                          </Text>
                          <View style={styles.subscriptionDates}>

                            <Text style={styles.subscriptionDate}>
                              Start: {new Date(member.currentSubscription.start_date).toLocaleDateString()}
                            </Text>
                            <Text style={styles.subscriptionDate}>
                              End: {new Date(member.currentSubscription.end_date).toLocaleDateString()}
                            </Text>
                          </View>

                          <View style={styles.paymentInfo}>
                            <Text style={styles.paymentLabel}>
                              Paid: {formatRupees(member.currentSubscription.paid_amount || 0)}
                            </Text>
                            {(member.currentSubscription.pending_amount || 0) > 0 && (
                              <Text style={styles.pendingAmount}>
                                Pending: {formatRupees(member.currentSubscription.pending_amount)}
                              </Text>
                            )}
                            {member.currentSubscription.payment_status === 'completed' && (
                              <View style={styles.paidBadge}>
                                <Text style={styles.paidBadgeText}>Fully Paid</Text>
                              </View>
                            )}
                            {member.currentSubscription.payment_status === 'partial' && (
                              <View style={styles.partialBadge}>
                                <Text style={styles.partialBadgeText}>Partial</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.fab}
          onPress={async () => {
            const autoMemberId = await generateMemberId(profile?.gym_id || null);
            setNewMember(prev => ({ ...prev, member_id: autoMemberId }));
            setShowAddMember(true);
          }}
          activeOpacity={0.8}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Modal
          visible={showAddMember}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAddMember(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>

                  <Text style={styles.modalTitle}>Add New Member</Text>
                  <TouchableOpacity onPress={() => setShowAddMember(false)} style={styles.closeButton}>
                    <X size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Personal Information */}
                  {/* After Phone Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Profile Photo (Optional)</Text>

                    {newMember.profile_photo_uri ? (
                      <View style={{ alignItems: 'center', gap: 12 }}>
                        <Image
                          source={{ uri: newMember.profile_photo_uri }}
                          style={{
                            width: 120,
                            height: 120,
                            borderRadius: 60,
                            borderWidth: 3,
                            borderColor: theme.colors.primary,
                          }}
                        />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <Button
                            title="Change Photo"
                            onPress={pickImage}
                            variant="outline"
                            style={{ flex: 1 }}
                          />
                          <Button
                            title="Remove"
                            onPress={() => setNewMember({ ...newMember, profile_photo_uri: '' })}
                            variant="outline"
                            style={{ flex: 1, borderColor: theme.colors.error }}
                            textStyle={{ color: theme.colors.error }}
                          />
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={{
                          borderWidth: 2,
                          borderColor: theme.colors.border,
                          borderStyle: 'dashed',
                          borderRadius: 12,
                          padding: 32,
                          alignItems: 'center',
                          backgroundColor: theme.colors.background,
                        }}
                        onPress={pickImage}
                        activeOpacity={0.7}
                      >
                        <User size={48} color={theme.colors.textSecondary} />
                        <Text style={[styles.inputLabel, { marginTop: 12, marginBottom: 4 }]}>
                          Upload Photo
                        </Text>
                        <Text style={styles.helperText}>
                          Tap to take photo or choose from gallery
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Member ID *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Auto-generated or enter custom ID"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={newMember.member_id}
                      onChangeText={(text) => setNewMember({ ...newMember, member_id: text })}
                    />
                    <Text style={styles.helperText}>
                      Unique identifier for this member. Leave blank for auto-generation.
                    </Text>
                  </View>

                  {/* Joining Date Field */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Joining Date *</Text>
                    <TouchableOpacity
                      style={[styles.input, styles.datePickerButton]}
                      onPress={() => setShowJoiningDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.datePickerContent}>
                        <Calendar size={20} color={theme.colors.textSecondary} />
                        <Text style={styles.datePickerText}>
                          {new Date(newMember.joining_date + 'T12:00:00').toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {showJoiningDatePicker && (
                      <>
                        {Platform.OS === 'web' ? (
                          <input
                            type="date"
                            value={newMember.joining_date}
                            onChange={(e) => {
                              setNewMember({ ...newMember, joining_date: e.target.value });
                              setShowJoiningDatePicker(false);
                            }}
                            style={{
                              width: '100%',
                              padding: 16,
                              fontSize: 16,
                              borderRadius: 12,
                              border: `1.5px solid ${theme.colors.border}`,
                              backgroundColor: theme.colors.card,
                              color: theme.colors.text,
                              marginBottom: 16,
                            }}
                          />
                        ) : (
                          <DateTimePicker
                            value={new Date(newMember.joining_date + 'T12:00:00')}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, selectedDate) => {
                              setShowJoiningDatePicker(Platform.OS === 'ios');
                              if (selectedDate) {
                                const year = selectedDate.getFullYear();
                                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                const day = String(selectedDate.getDate()).padStart(2, '0');
                                setNewMember({ ...newMember, joining_date: `${year}-${month}-${day}` });
                              }
                            }}
                          />
                        )}
                      </>
                    )}
                  </View>


                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full Name *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter full name"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={newMember.full_name}
                      onChangeText={(text) => setNewMember({ ...newMember, full_name: text })}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter email address"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={newMember.email}
                      onChangeText={(text) => setNewMember({ ...newMember, email: text })}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter phone number "
                      placeholderTextColor={theme.colors.textSecondary}
                      value={newMember.phone}
                      onChangeText={(text) => setNewMember({ ...newMember, phone: text })}
                      keyboardType="phone-pad"

                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Password *</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={[styles.input, styles.passwordInput]}
                        placeholder="Min 6 characters"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={newMember.password}
                        onChangeText={(text) => setNewMember({ ...newMember, password: text })}
                        secureTextEntry={!showPassword}
                      />
                      <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowPassword(!showPassword)}
                      >
                        <Ionicons
                          name={showPassword ? "eye-off-outline" : "eye-outline"}
                          size={24}
                          color={theme.colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.helperText}>
                      Member will use this email and password to login.
                    </Text>

                  </View>

                  {/* Personal Training Toggle */}
                  <View style={styles.inputGroup}>
                    <View style={styles.toggleContainer}>
                      <View>
                        <Text style={styles.toggleLabel}>Personal Training</Text>
                        <Text style={styles.helperText}>
                          Enable custom diet plans for this member
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.toggleSwitch,
                          newMember.has_personal_training && styles.toggleSwitchActive,
                        ]}
                        onPress={() => setNewMember({ ...newMember, has_personal_training: !newMember.has_personal_training })}
                      >
                        <View
                          style={[
                            styles.toggleThumb,
                            newMember.has_personal_training && styles.toggleThumbActive,
                          ]}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Weight and Height (Optional) */}
                  <View style={styles.inputRow}>
                    <View style={styles.inputHalf}>
                      <Text style={styles.inputLabel}>Weight (kg)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., 70"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={newMember.weight}
                        onChangeText={(text) => setNewMember({ ...newMember, weight: text })}
                        keyboardType="decimal-pad"
                      />
                    </View>

                    <View style={styles.inputHalf}>
                      <Text style={styles.inputLabel}>Height (cm)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., 175"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={newMember.height}
                        onChangeText={(text) => setNewMember({ ...newMember, height: text })}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  {/* Batch Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Training Batch *</Text>
                    <View style={styles.batchDropdown}>
                      <TouchableOpacity
                        style={[
                          styles.batchOption,
                          newMember.batch === 'morning' && styles.batchOptionSelected,
                        ]}
                        onPress={() => setNewMember({ ...newMember, batch: 'morning' })}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={{ fontSize: 20 }}>🌅</Text>
                          <Text style={[
                            styles.batchOptionText,
                            newMember.batch === 'morning' && styles.batchOptionTextSelected,
                          ]}>
                            Morning
                          </Text>
                        </View>
                        {newMember.batch === 'morning' && (
                          <CheckCircle size={20} color={theme.colors.primary} />
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.batchOption,
                          newMember.batch === 'evening' && styles.batchOptionSelected,
                        ]}
                        onPress={() => setNewMember({ ...newMember, batch: 'evening' })}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={{ fontSize: 20 }}>🌆</Text>
                          <Text style={[
                            styles.batchOptionText,
                            newMember.batch === 'evening' && styles.batchOptionTextSelected,
                          ]}>
                            Evening
                          </Text>
                        </View>
                        {newMember.batch === 'evening' && (
                          <CheckCircle size={20} color={theme.colors.primary} />
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.batchOption,
                          styles.batchOptionLast,
                          newMember.batch === 'night' && styles.batchOptionSelected,
                        ]}
                        onPress={() => setNewMember({ ...newMember, batch: 'night' })}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={{ fontSize: 20 }}>🌙</Text>
                          <Text style={[
                            styles.batchOptionText,
                            newMember.batch === 'night' && styles.batchOptionTextSelected,
                          ]}>
                            Night
                          </Text>
                        </View>
                        {newMember.batch === 'night' && (
                          <CheckCircle size={20} color={theme.colors.primary} />
                        )}
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.helperText}>
                      Select the training batch for this member
                    </Text>
                  </View>

                  {/* Gender Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Gender *</Text>


                    <View style={styles.genderContainer}>
                      <TouchableOpacity
                        style={[
                          styles.genderOption,
                          selectedGender === 'male' && styles.genderOptionSelected,
                        ]}
                        onPress={() => setSelectedGender('male')}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="male"
                          size={24}
                          color={selectedGender === 'male' ? theme.colors.primary : theme.colors.textSecondary}
                        />
                        <Text style={[
                          styles.genderOptionText,
                          selectedGender === 'male' && styles.genderOptionTextSelected,
                        ]}>
                          Male
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.genderOption,
                          selectedGender === 'female' && styles.genderOptionSelected,
                        ]}
                        onPress={() => setSelectedGender('female')}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="female"
                          size={24}
                          color={selectedGender === 'female' ? theme.colors.primary : theme.colors.textSecondary}
                        />
                        <Text style={[
                          styles.genderOptionText,
                          selectedGender === 'female' && styles.genderOptionTextSelected,
                        ]}>
                          Female
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.sectionDivider} />
                  {/* Notes Field */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Notes (Optional)</Text>
                    <TextInput
                      style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
                      placeholder="Add any notes about this member..."
                      placeholderTextColor={theme.colors.textSecondary}
                      value={newMember.notes}
                      onChangeText={(text) => setNewMember({ ...newMember, notes: text })}
                      multiline
                      numberOfLines={4}
                    />
                    <Text style={styles.helperText}>
                      Any additional information about the member (medical conditions, preferences, etc.)
                    </Text>
                  </View>

                  <View style={styles.sectionDivider} />

                  {/* Subscription Section */}
                  <Text style={styles.sectionTitle}>Subscription (Optional)</Text>
                  <Text style={styles.helperText}>
                    Add a subscription plan with payment details or skip for later.
                  </Text>

                  {availableSubscriptions.length > 0 ? (
                    <>
                      <Text style={styles.inputLabel}>Select Plan</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.subscriptionScroll}
                      >
                        {availableSubscriptions.map((sub) => (
                          <TouchableOpacity
                            key={sub.id}
                            style={[
                              styles.subscriptionOption,
                              selectedSubscription?.id === sub.id && styles.subscriptionOptionSelected,
                            ]}
                            onPress={() => {
                              setSelectedSubscription(sub);
                              if (paymentMethod === 'none') {
                                setPaymentMethod('cash');
                              }
                              setAmountReceived('');
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[
                              styles.subscriptionName,
                              selectedSubscription?.id === sub.id && styles.subscriptionNameSelected,
                            ]}>
                              {sub.name}
                            </Text>
                            <Text style={[
                              styles.subscriptionPrice,
                              selectedSubscription?.id === sub.id && styles.subscriptionPriceSelected,
                            ]}>
                              ₹{sub.price}
                            </Text>
                            <Text style={[
                              styles.subscriptionDuration,
                              selectedSubscription?.id === sub.id && styles.subscriptionDurationSelected,
                            ]}>
                              {sub.duration_months} month{sub.duration_months > 1 ? 's' : ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      {/* Custom Start Date with DatePicker */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Subscription Start Date</Text>

                        <TouchableOpacity
                          style={[styles.input, styles.datePickerButton]}
                          onPress={() => setShowDatePicker(true)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.datePickerContent}>
                            <Calendar size={20} color={theme.colors.textSecondary} />
                            <Text style={styles.datePickerText}>
                              {new Date(customStartDate + 'T12:00:00').toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {showDatePicker && (
                          <>
                            {Platform.OS === 'web' ? (
                              <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => {
                                  setCustomStartDate(e.target.value);
                                  setShowDatePicker(false);
                                }}
                                min="2020-01-01"
                                style={{
                                  width: '100%',
                                  padding: 16,
                                  fontSize: 16,
                                  borderRadius: 12,
                                  border: `1.5px solid ${theme.colors.border}`,
                                  backgroundColor: theme.colors.card,
                                  color: theme.colors.text,
                                  marginBottom: 16,
                                }}
                              />
                            ) : (
                              <DateTimePicker
                                value={new Date(customStartDate + 'T12:00:00')}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, selectedDate) => {
                                  setShowDatePicker(Platform.OS === 'ios');
                                  if (selectedDate) {
                                    const year = selectedDate.getFullYear();
                                    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                    const day = String(selectedDate.getDate()).padStart(2, '0');
                                    setCustomStartDate(`${year}-${month}-${day}`);
                                  }
                                }}
                                minimumDate={new Date(2020, 0, 1)}
                              />
                            )}
                          </>
                        )}

                        <Text style={styles.helperText}>
                          Set a past date if member joined earlier. Default is today.
                        </Text>
                      </View>
                      {selectedSubscription && (
                        <>
                          <Text style={styles.inputLabel}>Payment Method</Text>
                          <View style={styles.paymentMethodRow}>
                            <TouchableOpacity
                              style={[
                                styles.paymentMethodOption,
                                paymentMethod === 'cash' && styles.paymentMethodOptionSelected,
                              ]}
                              onPress={() => setPaymentMethod('cash')}
                              activeOpacity={0.7}
                            >
                              <DollarSign size={20} color={paymentMethod === 'cash' ? '#FFFFFF' : theme.colors.textSecondary} />
                              <Text style={[
                                styles.paymentMethodText,
                                paymentMethod === 'cash' && styles.paymentMethodTextSelected,
                              ]}>
                                Cash
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.paymentMethodOption,
                                paymentMethod === 'online' && styles.paymentMethodOptionSelected,
                              ]}
                              onPress={() => setPaymentMethod('online')}
                              activeOpacity={0.7}
                            >
                              <CreditCard size={20} color={paymentMethod === 'online' ? '#FFFFFF' : theme.colors.textSecondary} />
                              <Text style={[
                                styles.paymentMethodText,
                                paymentMethod === 'online' && styles.paymentMethodTextSelected,
                              ]}>
                                Online
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.paymentMethodOption,
                                paymentMethod === 'none' && styles.paymentMethodOptionSelected,
                              ]}
                              onPress={() => {
                                setPaymentMethod('none');
                                setSelectedSubscription(null);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={[
                                styles.paymentMethodText,
                                paymentMethod === 'none' && styles.paymentMethodTextSelected,
                              ]}>
                                Skip
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Payment Fields (Same for both Cash and Online) */}
                          {(paymentMethod === 'cash' || paymentMethod === 'online') && (
                            <>
                              <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Plan Amount</Text>
                                <TextInput
                                  style={[styles.input, styles.inputReadonly]}
                                  value={`₹${selectedSubscription.price}`}
                                  editable={false}
                                />
                              </View>

                              <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Admission Fee</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Enter admission fee"
                                  placeholderTextColor={theme.colors.textSecondary}
                                  value={admissionFee}
                                  onChangeText={setAdmissionFee}
                                  keyboardType="decimal-pad"
                                />
                                <Text style={styles.helperText}>
                                  One-time admission/registration fee
                                </Text>
                              </View>

                              <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Discount Amount (Optional)</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Enter discount amount"
                                  placeholderTextColor={theme.colors.textSecondary}
                                  value={discountAmount}
                                  onChangeText={setDiscountAmount}
                                  keyboardType="decimal-pad"
                                />
                                <Text style={styles.helperText}>
                                  Enter discount amount to reduce from total
                                </Text>
                              </View>

                              {/* Price Breakdown */}
                              <View style={styles.priceBreakdown}>
                                <View style={styles.breakdownRow}>
                                  <Text style={styles.breakdownLabel}>Plan Price:</Text>
                                  <Text style={styles.breakdownValue}>₹{selectedSubscription.price}</Text>
                                </View>
                                <View style={styles.breakdownRow}>
                                  <Text style={styles.breakdownLabel}>Admission Fee:</Text>
                                  <Text style={styles.breakdownValue}>+ ₹{admissionFee || '0'}</Text>
                                </View>
                                {discountAmount && parseFloat(discountAmount) > 0 && (
                                  <View style={styles.breakdownRow}>
                                    <Text style={[styles.breakdownLabel, { color: theme.colors.success }]}>
                                      Discount:
                                    </Text>
                                    <Text style={[styles.breakdownValue, { color: theme.colors.success }]}>
                                      - ₹{discountAmount}
                                    </Text>
                                  </View>
                                )}
                                <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                                  <Text style={styles.breakdownTotalLabel}>Final Amount:</Text>
                                  <Text style={styles.breakdownTotalValue}>
                                    ₹{calculateFinalAmount().toFixed(2)}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Amount Received *</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Enter amount received now"
                                  placeholderTextColor={theme.colors.textSecondary}
                                  value={amountReceived}
                                  onChangeText={setAmountReceived}
                                  keyboardType="decimal-pad"
                                />
                                <Text style={styles.helperText}>
                                  Can be partial payment. Remaining will be tracked as pending.
                                </Text>
                              </View>

                              <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Remaining Amount</Text>
                                <TextInput
                                  style={[styles.input, styles.inputReadonly]}
                                  value={`₹${calculateRemainingAmount().toFixed(2)}`}
                                  editable={false}
                                />
                              </View>

                              {/* Payment Summary Card */}
                              <View style={styles.paymentSummary}>
                                <View style={styles.paymentSummaryRow}>
                                  <Text style={styles.paymentSummaryLabel}>Final Amount:</Text>
                                  <Text style={styles.paymentSummaryValue}>
                                    ₹{calculateFinalAmount().toFixed(2)}
                                  </Text>
                                </View>
                                <View style={styles.paymentSummaryRow}>
                                  <Text style={styles.paymentSummaryLabel}>Amount Received:</Text>
                                  <Text style={styles.paymentSummaryValue}>
                                    ₹{amountReceived ? parseFloat(amountReceived).toFixed(2) : '0.00'}
                                  </Text>
                                </View>
                                <View style={[styles.paymentSummaryRow, styles.paymentSummaryTotal]}>
                                  <Text style={styles.paymentSummaryTotalLabel}>Pending Amount:</Text>
                                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                                    <Text style={styles.paymentSummaryTotalValue}>
                                      ₹{calculateRemainingAmount().toFixed(2)}
                                    </Text>
                                    <View style={[
                                      styles.paymentStatusBadge,
                                      calculateRemainingAmount() === 0
                                        ? styles.paymentStatusBadgeComplete
                                        : styles.paymentStatusBadgePartial
                                    ]}>
                                      {calculateRemainingAmount() === 0 ? (
                                        <>
                                          <CheckCircle size={14} color={theme.colors.success} />
                                          <Text style={[styles.paymentStatusText, styles.paymentStatusTextComplete]}>
                                            Fully Paid
                                          </Text>
                                        </>
                                      ) : (
                                        <>
                                          <AlertCircle size={14} color={theme.colors.warning} />
                                          <Text style={[styles.paymentStatusText, styles.paymentStatusTextPartial]}>
                                            Partial Payment
                                          </Text>
                                        </>
                                      )}
                                    </View>
                                  </View>
                                </View>
                              </View>

                              {/* Rest of the payment fields (Receipt Number, Notes) remain the same */}
                              <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Receipt Number (Optional)</Text>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Auto-generated if left blank"
                                  placeholderTextColor={theme.colors.textSecondary}
                                  value={receiptNumber}
                                  onChangeText={setReceiptNumber}
                                />
                              </View>

                              <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Payment Notes (Optional)</Text>
                                <TextInput
                                  style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                                  placeholder="Add any notes about this payment..."
                                  placeholderTextColor={theme.colors.textSecondary}
                                  value={paymentNotes}
                                  onChangeText={setPaymentNotes}
                                  multiline
                                  numberOfLines={3}
                                />
                              </View>

                              {paymentMethod === 'online' && (
                                <Text style={styles.helperText}>
                                  💡 Member paid online. Amount will be recorded for tracking.
                                </Text>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <Text style={styles.helperText}>
                      No subscription plans available. Create plans in Subscriptions section.
                    </Text>
                  )}

                  <Button
                    title="Add Member"
                    onPress={addMember}
                    isLoading={isLoading}
                    style={styles.addButton}
                  />
                </ScrollView>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* ==================== PAY PENDING MODAL ==================== */}
        <Modal
          visible={showPayPendingModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowPayPendingModal(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Pay Pending Amount</Text>
                  <TouchableOpacity
                    onPress={() => setShowPayPendingModal(false)}
                    style={styles.closeButton}
                  >
                    <X size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {selectedMember?.currentSubscription && (
                    <>
                      <Card style={styles.overviewCard}>
                        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                          <Text style={styles.inputLabel}>Current Pending Amount</Text>
                          <Text style={[styles.paymentSummaryTotalValue, { fontSize: 36, marginTop: 8, color: theme.colors.warning }]}>
                            {formatRupees(selectedMember.currentSubscription.pending_amount || 0)}
                          </Text>
                        </View>
                      </Card>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Payment Amount *</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter payment amount"
                          placeholderTextColor={theme.colors.textSecondary}
                          value={pendingPaymentAmount}
                          onChangeText={setPendingPaymentAmount}
                          keyboardType="decimal-pad"
                        />
                        <Text style={styles.helperText}>
                          Maximum: {formatRupees(selectedMember.currentSubscription.pending_amount || 0)}
                        </Text>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Receipt Number (Optional)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Auto-generated if left blank"
                          placeholderTextColor={theme.colors.textSecondary}
                          value={pendingReceiptNumber}
                          onChangeText={setPendingReceiptNumber}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Payment Notes (Optional)</Text>
                        <TextInput
                          style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                          placeholder="Add notes about this payment..."
                          placeholderTextColor={theme.colors.textSecondary}
                          value={pendingPaymentNotes}
                          onChangeText={setPendingPaymentNotes}
                          multiline
                          numberOfLines={3}
                        />
                      </View>

                      <Button
                        title="Collect Payment"
                        onPress={payPendingAmount}
                        isLoading={isLoading}
                        disabled={!pendingPaymentAmount || parseFloat(pendingPaymentAmount) <= 0}
                        style={styles.addButton}
                      />
                    </>
                  )}
                </ScrollView>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* ==================== ATTENDANCE CALENDAR MODAL (IMPROVED) ==================== */}
        <Modal
          visible={showAttendanceCalendar}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowAttendanceCalendar(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
              <View style={styles.modalContainer}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.attendanceHeaderContent}>
                    <Calendar size={24} color={theme.colors.primary} />
                    <Text style={styles.modalTitle}>Attendance Calendar</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowAttendanceCalendar(false)}
                    style={styles.closeButton}
                  >
                    <X size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Overall Stats Card */}
                  <Card style={styles.attendanceStatsCard}>
                    <View style={styles.attendanceStatsHeader}>
                      <View style={styles.memberAvatarSmall}>
                        <User size={20} color="#ffffff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.attendanceStatsName}>{selectedMember?.full_name}</Text>
                        <Text style={styles.attendanceStatsSubtext}>Overall Attendance Summary</Text>
                      </View>
                    </View>

                    {(() => {
                      const totalCheckIns = memberAttendance.length;

                      // Calculate date range
                      let earliestDate = new Date();
                      let latestDate = new Date();

                      if (totalCheckIns > 0) {
                        const dates = memberAttendance.map(a => new Date(a.attendance_date));
                        earliestDate = new Date(Math.min(...dates.map(d => d.getTime())));
                        latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
                      }

                      // Calculate total days between first and last check-in
                      const daysDifference = totalCheckIns > 0
                        ? Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
                        : 0;

                      const attendanceRate = daysDifference > 0
                        ? ((totalCheckIns / daysDifference) * 100).toFixed(1)
                        : 0;

                      return (
                        <View style={styles.attendanceOverallStats}>
                          <View style={styles.attendanceStatBox}>
                            <View style={[styles.attendanceStatIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                              <CheckCircle size={24} color={theme.colors.primary} />
                            </View>
                            <Text style={styles.attendanceStatValue}>{totalCheckIns}</Text>
                            <Text style={styles.attendanceStatLabel}>Total Check-ins</Text>
                          </View>

                          <View style={styles.attendanceStatBox}>
                            <View style={[styles.attendanceStatIcon, { backgroundColor: theme.colors.success + '20' }]}>
                              <Calendar size={24} color={theme.colors.success} />
                            </View>
                            <Text style={styles.attendanceStatValue}>{daysDifference}</Text>
                            <Text style={styles.attendanceStatLabel}>Total Days</Text>
                          </View>

                          <View style={styles.attendanceStatBox}>
                            <View style={[styles.attendanceStatIcon, { backgroundColor: theme.colors.warning + '20' }]}>
                              <TrendingUp size={24} color={theme.colors.warning} />
                            </View>
                            <Text style={styles.attendanceStatValue}>{attendanceRate}%</Text>
                            <Text style={styles.attendanceStatLabel}>Attendance Rate</Text>
                          </View>
                        </View>
                      );
                    })()}
                  </Card>

                  {/* Monthly Breakdown */}
                  {(() => {
                    const monthlyData: { [key: string]: any[] } = {};
                    const dailyCheckIns: { [key: string]: number } = {};

                    // Group by month and count daily check-ins
                    memberAttendance.forEach((att) => {
                      const date = new Date(att.attendance_date);
                      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      const dateKey = att.attendance_date;

                      if (!monthlyData[monthKey]) {
                        monthlyData[monthKey] = [];
                      }
                      monthlyData[monthKey].push(att);

                      dailyCheckIns[dateKey] = (dailyCheckIns[dateKey] || 0) + 1;
                    });

                    return Object.keys(monthlyData)
                      .sort()
                      .reverse()
                      .map((monthKey) => {
                        const [year, month] = monthKey.split('-');
                        const monthDate = new Date(parseInt(year), parseInt(month) - 1);
                        const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
                        const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1).getDay();

                        const attendanceDates = new Set(
                          monthlyData[monthKey].map(a => new Date(a.attendance_date).getDate())
                        );

                        const attendedDays = attendanceDates.size;
                        const monthAttendanceRate = ((attendedDays / daysInMonth) * 100).toFixed(1);
                        const totalCheckInsThisMonth = monthlyData[monthKey].length;

                        return (
                          <Card key={monthKey} style={styles.monthCard}>
                            {/* Month Header */}
                            <View style={styles.monthHeader}>
                              <View>
                                <Text style={styles.monthTitle}>{monthName}</Text>
                                <Text style={styles.monthSubtitle}>
                                  {attendedDays} of {daysInMonth} days attended
                                </Text>
                              </View>
                              <View style={styles.monthStatsChip}>
                                <Text style={styles.monthStatsChipText}>{monthAttendanceRate}%</Text>
                              </View>
                            </View>

                            {/* Month Stats Row */}
                            <View style={styles.monthStatsRow}>
                              <View style={styles.monthStatItem}>
                                <Text style={styles.monthStatValue}>{totalCheckInsThisMonth}</Text>
                                <Text style={styles.monthStatLabel}>Check-ins</Text>
                              </View>
                              <View style={styles.monthStatItem}>
                                <Text style={styles.monthStatValue}>{attendedDays}</Text>
                                <Text style={styles.monthStatLabel}>Days Present</Text>
                              </View>
                              <View style={styles.monthStatItem}>
                                <Text style={styles.monthStatValue}>{daysInMonth - attendedDays}</Text>
                                <Text style={styles.monthStatLabel}>Days Missed</Text>
                              </View>
                            </View>

                            {/* Calendar Grid */}
                            <View style={styles.calendarContainer}>
                              {/* Week days header */}
                              <View style={styles.calendarWeekRow}>
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                                  <View key={index} style={styles.calendarHeaderCell}>
                                    <Text style={styles.calendarHeaderText}>{day}</Text>
                                  </View>
                                ))}
                              </View>

                              {/* Days grid */}
                              <View style={styles.calendarDaysGrid}>
                                {/* Empty cells for days before month starts */}
                                {Array.from({ length: firstDay }).map((_, i) => (
                                  <View key={`empty-${i}`} style={styles.calendarDayCell} />
                                ))}

                                {/* Actual days */}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                  const dayNumber = i + 1;
                                  const hasAttendance = attendanceDates.has(dayNumber);
                                  const dateKey = `${year}-${month}-${String(dayNumber).padStart(2, '0')}`;
                                  const checkInCount = dailyCheckIns[dateKey] || 0;

                                  const isToday =
                                    new Date().getDate() === dayNumber &&
                                    new Date().getMonth() === parseInt(month) - 1 &&
                                    new Date().getFullYear() === parseInt(year);

                                  return (
                                    <View
                                      key={dayNumber}
                                      style={[
                                        styles.calendarDayCell,
                                        hasAttendance && styles.calendarDayCellAttended,
                                        isToday && styles.calendarDayCellToday,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.calendarDayText,
                                          hasAttendance && styles.calendarDayTextAttended,
                                          isToday && styles.calendarDayTextToday,
                                        ]}
                                      >
                                        {dayNumber}
                                      </Text>
                                      {hasAttendance && (
                                        <>
                                          <View style={styles.attendanceIndicator}>
                                            <CheckCircle size={10} color={theme.colors.success} />
                                          </View>
                                          {checkInCount > 1 && (
                                            <View style={styles.checkInBadge}>
                                              <Text style={styles.checkInBadgeText}>{checkInCount}</Text>
                                            </View>
                                          )}
                                        </>
                                      )}
                                    </View>
                                  );
                                })}
                              </View>
                            </View>

                            {/* Legend */}
                            <View style={styles.legendContainer}>
                              <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} />
                                <Text style={styles.legendText}>Present</Text>
                              </View>
                              <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
                                <Text style={styles.legendText}>Today</Text>
                              </View>
                              <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: theme.colors.border }]} />
                                <Text style={styles.legendText}>Absent</Text>
                              </View>
                            </View>
                          </Card>
                        );
                      });
                  })()}

                  {memberAttendance.length === 0 && (
                    <Card style={styles.emptyStateCard}>
                      <Calendar size={64} color={theme.colors.textSecondary} />
                      <Text style={styles.emptyStateTitle}>No Attendance Records</Text>
                      <Text style={styles.emptyStateText}>
                        This member hasn't checked in yet
                      </Text>
                    </Card>
                  )}
                </ScrollView>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* ==================== MEMBER DETAILS MODAL ==================== */}
        <Modal
          visible={showMemberDetails}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowMemberDetails(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedMember?.full_name}</Text>
                  <TouchableOpacity onPress={() => setShowMemberDetails(false)} style={styles.closeButton}>
                    <X size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalContent}
                  showsVerticalScrollIndicator={false}
                >
                  {selectedMember && (
                    <>
                      {/* Member Overview - UPDATED AVATAR WITH ANIMATION */}
                      <Card style={styles.overviewCard}>
                        <View style={styles.overviewHeader}>
                          {/* Photo with Update Option and Loading Animation */}
                          <TouchableOpacity
                            style={styles.memberAvatarLarge}
                            onPress={() => updateMemberPhoto(selectedMember.id)}
                            activeOpacity={0.7}
                            disabled={updatingPhoto}
                          >
                            {updatingPhoto ? (
                              // ⭐ Upload Animation
                              <View style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: theme.colors.primary + '20',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                <ActivityIndicator size="small" color={theme.colors.card} />

                              </View>
                            ) : selectedMember.profile_photo_url ? (
                              <Image
                                source={{ uri: selectedMember.profile_photo_url }}
                                style={{ width: 64, height: 64, borderRadius: 32 }}
                              />
                            ) : (
                              <User size={32} color="#ffffff" />
                            )}

                            {/* Camera Icon Overlay - Only show when not uploading */}
                            {!updatingPhoto && (
                              <View style={styles.photoOverlay}>
                                <Ionicons name="camera" size={16} color="#FFFFFF" />
                              </View>
                            )}
                          </TouchableOpacity>

                          <View style={styles.overviewInfo}>
                            <Text style={styles.overviewName}>{selectedMember.full_name}</Text>
                            <View style={styles.overviewStats}>
                              <Text style={styles.overviewLevel}>Level {selectedMember.level}</Text>
                              <Text style={styles.overviewPoints}>{selectedMember.total_points} XP</Text>
                            </View>
                            <View style={styles.overviewStats}>
                              <Text style={styles.height}>
                                Height: {selectedMember.height ? `${selectedMember.height} cm` : 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.overviewStats}>
                              <Text style={styles.weight}>
                                Weight: {selectedMember.weight ? `${selectedMember.weight} kg` : 'N/A'}
                              </Text>
                            </View>
                          </View>

                          {selectedMember.batch && (
                            <View style={styles.batchBadge}>
                              <Text style={styles.batchBadgeText}>
                                {selectedMember.batch === 'morning' && '🌅 '}
                                {selectedMember.batch === 'evening' && '🌆 '}
                                {selectedMember.batch === 'night' && '🌙 '}
                                {selectedMember.batch.charAt(0).toUpperCase() + selectedMember.batch.slice(1)}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* ⭐ REMOVED: Update Photo Button */}

                        {/* Attendance Calendar Button */}
                        <Button
                          title="View Attendance Calendar"
                          onPress={() => fetchMemberAttendance(selectedMember.id)}
                          variant="outline"
                          style={{ marginTop: 12 }}
                        />
                      </Card>


                      <InvoicesList userId={selectedMember.id} onRefresh={loadInvoices} />

                      {/* Personal Training Toggle */}
                      <Card style={styles.overviewCard}>
                        <View style={styles.toggleContainer}>
                          <Text style={styles.toggleLabel}>Personal Training</Text>
                          <TouchableOpacity
                            style={[
                              styles.toggleSwitch,
                              selectedMember.has_personal_training && styles.toggleSwitchActive,
                            ]}
                            onPress={async () => {
                              try {
                                const newValue = !selectedMember.has_personal_training;
                                const { error } = await supabase
                                  .from('profiles')
                                  .update({ has_personal_training: newValue })
                                  .eq('id', selectedMember.id);

                                if (error) throw error;

                                if (newValue) {
                                  const { data: existing } = await supabase
                                    .from('personal_training_assignments')
                                    .select('id')
                                    .eq('user_id', selectedMember.id)
                                    .single();

                                  if (!existing && profile?.gym_id) {
                                    await supabase.from('personal_training_assignments').insert([
                                      {
                                        user_id: selectedMember.id,
                                        gym_id: profile.gym_id,
                                        assigned_by: profile.id,
                                        is_active: true,
                                        start_date: customStartDate,
                                      },
                                    ]);
                                  }
                                } else {
                                  await supabase
                                    .from('personal_training_assignments')
                                    .update({ is_active: false })
                                    .eq('user_id', selectedMember.id);
                                }

                                setSelectedMember({
                                  ...selectedMember,
                                  has_personal_training: newValue,
                                });
                                Alert.alert('Success', `Personal training ${newValue ? 'enabled' : 'disabled'}`);
                              } catch (error) {
                                console.error('Error updating personal training:', error);
                                Alert.alert('Error', 'Failed to update personal training status');
                              }
                            }}
                          >
                            <View
                              style={[
                                styles.toggleThumb,
                                selectedMember.has_personal_training && styles.toggleThumbActive,
                              ]}
                            />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.helperText}>
                          {selectedMember.has_personal_training
                            ? 'Member has access to personal training diet plans'
                            : 'Enable to provide custom diet plans for this member'}
                        </Text>
                      </Card>

                      {/* Subscription Details */}
                      <Card style={styles.overviewCard}>
                        <Text style={styles.sectionTitle}>Subscription Details</Text>

                        {selectedMember.currentSubscription ? (
                          <>
                            <View style={{ gap: 12 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={styles.inputLabel}>Plan Name:</Text>
                                <Text style={styles.overviewName}>
                                  {selectedMember.currentSubscription.subscription?.name || 'N/A'}
                                </Text>
                              </View>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={styles.inputLabel}>Status:</Text>
                                {selectedMember.subscriptionStatus === 'active' && (
                                  <View style={styles.activeBadge}>
                                    <CheckCircle size={14} color={theme.colors.success} />
                                    <Text style={styles.activeBadgeText}>Active</Text>
                                  </View>
                                )}
                                {selectedMember.subscriptionStatus === 'expired' && (
                                  <View style={styles.expiredBadge}>
                                    <AlertCircle size={14} color={theme.colors.error} />
                                    <Text style={styles.expiredBadgeText}>Expired</Text>
                                  </View>
                                )}
                              </View>

                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={styles.inputLabel}>Start Date:</Text>
                                <Text style={styles.subscriptionDate}>
                                  {new Date(selectedMember.currentSubscription.start_date).toLocaleDateString()}
                                </Text>
                              </View>

                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={styles.inputLabel}>End Date:</Text>
                                <Text style={styles.subscriptionDate}>
                                  {new Date(selectedMember.currentSubscription.end_date).toLocaleDateString()}
                                </Text>
                              </View>

                              <View style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                backgroundColor: selectedMember.subscriptionStatus === 'active'
                                  ? theme.colors.success + '20'
                                  : theme.colors.error + '20',
                                borderRadius: 8,
                              }}>
                                <Text style={[styles.inputLabel, {
                                  color: selectedMember.subscriptionStatus === 'active'
                                    ? theme.colors.success
                                    : theme.colors.error,
                                  fontWeight: '700',
                                }]}>
                                  {selectedMember.subscriptionStatus === 'active' ? 'Days Remaining:' : 'Days Expired:'}
                                </Text>
                                <Text style={[styles.overviewName, {
                                  color: selectedMember.subscriptionStatus === 'active'
                                    ? theme.colors.success
                                    : theme.colors.error,
                                  fontSize: 24,
                                }]}>
                                  {Math.abs(calculateRemainingDays(selectedMember.currentSubscription.end_date))} days
                                </Text>
                              </View>

                              <View style={styles.sectionDivider} />

                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={styles.inputLabel}>Total Amount:</Text>
                                <Text style={styles.paymentSummaryValue}>
                                  {formatRupees(selectedMember.currentSubscription.total_amount || selectedMember.currentSubscription.subscription?.price || 0)}
                                </Text>
                              </View>

                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={styles.inputLabel}>Amount Paid:</Text>
                                <Text style={[styles.paymentSummaryValue, { color: theme.colors.success }]}>
                                  {formatRupees(selectedMember.currentSubscription.paid_amount || 0)}
                                </Text>
                              </View>

                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={styles.inputLabel}>Pending Amount:</Text>
                                <Text style={[styles.paymentSummaryValue, { color: theme.colors.warning }]}>
                                  {formatRupees(selectedMember.currentSubscription.pending_amount || 0)}
                                </Text>
                              </View>
                            </View>


                            {/* Payment Actions - Pay Pending & Reminder */}
                            {(selectedMember.currentSubscription.pending_amount || 0) > 0 && (
                              <View style={{ gap: 12, marginTop: 16 }}>
                                {/* Pay Pending Button */}
                                <Button
                                  title={`Pay Pending ${formatRupees(selectedMember.currentSubscription.pending_amount)}`}
                                  onPress={() => {
                                    setPendingPaymentAmount('');
                                    setPendingReceiptNumber('');
                                    setPendingPaymentNotes('');
                                    setShowMemberDetails(false);
                                    setTimeout(() => {
                                      setShowPayPendingModal(true);
                                    }, 300);
                                  }}
                                  variant="outline"
                                  style={{
                                    borderColor: theme.colors.warning,
                                    // backgroundColor: theme.colors.warning + '10',
                                  }}
                                  textStyle={{ color: theme.colors.warning }}
                                />

                                {/* Payment Reminder Button */}
                                <TouchableOpacity
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 14,
                                    paddingHorizontal: 16,
                                    borderRadius: 12,
                                    borderWidth: 1.5,
                                    borderColor: theme.colors.success,
                                    backgroundColor: theme.colors.success + '10',
                                    gap: 8,
                                  }}
                                  onPress={() => handleSendPaymentReminder(selectedMember)}
                                  activeOpacity={0.7}
                                  disabled={isLoading}
                                >
                                  <Ionicons name="logo-whatsapp" size={20} color={theme.colors.success} />
                                  <Text style={{
                                    fontSize: 15,
                                    fontWeight: '600',
                                    color: theme.colors.success,
                                    fontFamily: 'Inter-SemiBold',
                                  }}>
                                    Send Payment Reminder
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                            <Button
                              title="Renew Subscription"
                              onPress={() => {
                                setShowRenewModal(true);
                                setRenewSubscription(null);
                                setRenewAmountReceived('');
                                setRenewPaymentMethod('cash');
                                setDiscountAmount(''); // ⭐ Reset discount
                                setRenewReceiptNumber('');
                                setRenewPaymentNotes('');
                              }}
                              style={{ marginTop: 12 }}
                            />
                          </>
                        ) : (
                          <>
                            <Text style={styles.noDataText}>No active subscription</Text>
                            <Button
                              title="Add Subscription"
                              onPress={() => {
                                setShowRenewModal(true);
                                setRenewSubscription(null);
                                setRenewAmountReceived('');
                                setRenewPaymentMethod('cash');
                                setDiscountAmount(''); // ⭐ Reset discount
                                setRenewReceiptNumber('');
                                setRenewPaymentNotes('');
                              }}
                              style={{ marginTop: 12 }}
                            />
                          </>
                        )}
                      </Card>

                      {/* Stats Cards */}
                      <View style={styles.statsGrid}>
                        <Card style={styles.statCard}>
                          <Activity size={24} color={theme.colors.primary} />
                          <Text style={styles.statValue}>{selectedMember.stats?.totalWorkouts || 0}</Text>
                          <Text style={styles.statLabel}>Total Workouts</Text>
                        </Card>
                        <Card style={styles.statCard}>
                          <Flame size={24} color={theme.colors.error} />
                          <Text style={styles.statValue}>{selectedMember.stats?.totalCaloriesBurned || 0}</Text>
                          <Text style={styles.statLabel}>Calories Burned</Text>
                        </Card>
                        <Card style={styles.statCard}>
                          <Clock size={24} color={theme.colors.success} />
                          <Text style={styles.statValue}>{selectedMember.stats?.totalMinutes || 0}</Text>
                          <Text style={styles.statLabel}>Total Minutes</Text>
                        </Card>
                        <Card style={styles.statCard}>
                          <UtensilsCrossed size={24} color={theme.colors.warning} />
                          <Text style={styles.statValue}>{selectedMember.stats?.totalMeals || 0}</Text>
                          <Text style={styles.statLabel}>Meals Logged</Text>
                        </Card>
                      </View>

                      {/* Danger Zone */}
                      <Card style={styles.dangerCard}>
                        <Text style={styles.dangerTitle}>Danger Zone</Text>
                        <Text style={styles.dangerSubtitle}>
                          Permanently delete this member and all their data
                        </Text>
                        <Button
                          title="Delete Member"
                          onPress={() => deleteMember(selectedMember.id, selectedMember.full_name)}
                          variant="outline"
                          style={styles.deleteButton}
                          textStyle={styles.deleteButtonText}
                        />
                      </Card>
                    </>
                  )}
                </ScrollView>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>


        {/* ==================== RENEW SUBSCRIPTION MODAL ==================== */}
        <Modal
          visible={showRenewModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowRenewModal(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {selectedMember?.currentSubscription ? 'Renew Subscription' : 'Add Subscription'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowRenewModal(false)}
                    style={styles.closeButton}
                  >
                    <X size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.helperText}>
                    Select a new subscription plan for {selectedMember?.full_name}
                  </Text>

                  <View style={styles.sectionDivider} />

                  {availableSubscriptions.length > 0 ? (
                    <>
                      <Text style={styles.inputLabel}>Select Plan *</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.subscriptionScroll}
                      >
                        {availableSubscriptions.map((sub) => (
                          <TouchableOpacity
                            key={sub.id}
                            style={[
                              styles.subscriptionOption,
                              renewSubscription?.id === sub.id && styles.subscriptionOptionSelected,
                            ]}
                            onPress={() => {
                              setRenewSubscription(sub);
                              setRenewAmountReceived('');
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[
                              styles.subscriptionName,
                              renewSubscription?.id === sub.id && styles.subscriptionNameSelected,
                            ]}>
                              {sub.name}
                            </Text>
                            <Text style={[
                              styles.subscriptionPrice,
                              renewSubscription?.id === sub.id && styles.subscriptionPriceSelected,
                            ]}>
                              ₹{sub.price}
                            </Text>
                            <Text style={[
                              styles.subscriptionDuration,
                              renewSubscription?.id === sub.id && styles.subscriptionDurationSelected,
                            ]}>
                              {sub.duration_months} month{sub.duration_months > 1 ? 's' : ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {renewSubscription && (
                        <>
                          <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Subscription Start Date</Text>
                            <TouchableOpacity
                              style={[styles.input, styles.datePickerButton]}
                              onPress={() => setShowDatePicker(true)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.datePickerContent}>
                                <Calendar size={20} color={theme.colors.textSecondary} />
                                <Text style={styles.datePickerText}>
                                  {new Date(customStartDate + 'T12:00:00').toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </Text>
                              </View>
                            </TouchableOpacity>
                            <Text style={styles.helperText}>
                              Set subscription start date (default is today)
                            </Text>
                          </View>

                          <Text style={styles.inputLabel}>Payment Method</Text>
                          <View style={styles.paymentMethodRow}>
                            <TouchableOpacity
                              style={[
                                styles.paymentMethodOption,
                                renewPaymentMethod === 'cash' && styles.paymentMethodOptionSelected,
                              ]}
                              onPress={() => setRenewPaymentMethod('cash')}
                              activeOpacity={0.7}
                            >
                              <DollarSign size={20} color={renewPaymentMethod === 'cash' ? '#FFFFFF' : theme.colors.textSecondary} />
                              <Text style={[
                                styles.paymentMethodText,
                                renewPaymentMethod === 'cash' && styles.paymentMethodTextSelected,
                              ]}>
                                Cash
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.paymentMethodOption,
                                renewPaymentMethod === 'online' && styles.paymentMethodOptionSelected,
                              ]}
                              onPress={() => setRenewPaymentMethod('online')}
                              activeOpacity={0.7}
                            >
                              <CreditCard size={20} color={renewPaymentMethod === 'online' ? '#FFFFFF' : theme.colors.textSecondary} />
                              <Text style={[
                                styles.paymentMethodText,
                                renewPaymentMethod === 'online' && styles.paymentMethodTextSelected,
                              ]}>
                                Online
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Payment Fields */}
                          <>
                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Plan Amount</Text>
                              <TextInput
                                style={[styles.input, styles.inputReadonly]}
                                value={`₹${renewSubscription.price}`}
                                editable={false}
                              />
                            </View>

                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Discount Amount (Optional)</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="Enter discount amount"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={discountAmount}
                                onChangeText={setDiscountAmount}
                                keyboardType="decimal-pad"
                              />
                              <Text style={styles.helperText}>
                                Enter discount amount to reduce from total
                              </Text>
                            </View>

                            {/* Price Breakdown with Discount */}
                            <View style={styles.priceBreakdown}>
                              <View style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>Plan Price:</Text>
                                <Text style={styles.breakdownValue}>₹{renewSubscription.price}</Text>
                              </View>
                              {discountAmount && parseFloat(discountAmount) > 0 && (
                                <View style={styles.breakdownRow}>
                                  <Text style={[styles.breakdownLabel, { color: theme.colors.success }]}>
                                    Discount:
                                  </Text>
                                  <Text style={[styles.breakdownValue, { color: theme.colors.success }]}>
                                    - ₹{discountAmount}
                                  </Text>
                                </View>
                              )}
                              <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                                <Text style={styles.breakdownTotalLabel}>Final Amount:</Text>
                                <Text style={styles.breakdownTotalValue}>
                                  ₹{Math.max(0, renewSubscription.price - (parseFloat(discountAmount) || 0)).toFixed(2)}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Amount Received *</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="Enter amount received"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={renewAmountReceived}
                                onChangeText={setRenewAmountReceived}
                                keyboardType="decimal-pad"
                              />
                              <Text style={styles.helperText}>
                                Enter the amount customer paid (can be partial)
                              </Text>
                            </View>

                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Remaining Amount</Text>
                              <TextInput
                                style={[styles.input, styles.inputReadonly]}
                                value={`₹${Math.max(0,
                                  (renewSubscription.price - (parseFloat(discountAmount) || 0)) - (parseFloat(renewAmountReceived) || 0)
                                ).toFixed(2)}`}
                                editable={false}
                              />
                            </View>

                            {/* Payment Summary */}
                            <View style={styles.paymentSummary}>
                              <View style={styles.paymentSummaryRow}>
                                <Text style={styles.paymentSummaryLabel}>Plan Amount:</Text>
                                <Text style={styles.paymentSummaryValue}>₹{renewSubscription.price}</Text>
                              </View>
                              {discountAmount && parseFloat(discountAmount) > 0 && (
                                <View style={styles.paymentSummaryRow}>
                                  <Text style={[styles.paymentSummaryLabel, { color: theme.colors.success }]}>
                                    Discount:
                                  </Text>
                                  <Text style={[styles.paymentSummaryValue, { color: theme.colors.success }]}>
                                    - ₹{parseFloat(discountAmount).toFixed(2)}
                                  </Text>
                                </View>
                              )}
                              <View style={styles.paymentSummaryRow}>
                                <Text style={styles.paymentSummaryLabel}>Final Amount:</Text>
                                <Text style={[styles.paymentSummaryValue, { fontWeight: '700' }]}>
                                  ₹{Math.max(0, renewSubscription.price - (parseFloat(discountAmount) || 0)).toFixed(2)}
                                </Text>
                              </View>
                              <View style={styles.paymentSummaryRow}>
                                <Text style={styles.paymentSummaryLabel}>Amount Received:</Text>
                                <Text style={styles.paymentSummaryValue}>
                                  ₹{renewAmountReceived ? parseFloat(renewAmountReceived).toFixed(2) : '0.00'}
                                </Text>
                              </View>
                              <View style={[styles.paymentSummaryRow, styles.paymentSummaryTotal]}>
                                <Text style={styles.paymentSummaryTotalLabel}>Pending Amount:</Text>
                                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                                  <Text style={styles.paymentSummaryTotalValue}>
                                    ₹{Math.max(0,
                                      (renewSubscription.price - (parseFloat(discountAmount) || 0)) - (parseFloat(renewAmountReceived) || 0)
                                    ).toFixed(2)}
                                  </Text>
                                  <View style={[
                                    styles.paymentStatusBadge,
                                    Math.max(0,
                                      (renewSubscription.price - (parseFloat(discountAmount) || 0)) - (parseFloat(renewAmountReceived) || 0)
                                    ) === 0
                                      ? styles.paymentStatusBadgeComplete
                                      : styles.paymentStatusBadgePartial,
                                  ]}>
                                    {Math.max(0,
                                      (renewSubscription.price - (parseFloat(discountAmount) || 0)) - (parseFloat(renewAmountReceived) || 0)
                                    ) === 0 ? (
                                      <>
                                        <CheckCircle size={14} color={theme.colors.success} />
                                        <Text style={[styles.paymentStatusText, styles.paymentStatusTextComplete]}>
                                          Fully Paid
                                        </Text>
                                      </>
                                    ) : (
                                      <>
                                        <AlertCircle size={14} color={theme.colors.warning} />
                                        <Text style={[styles.paymentStatusText, styles.paymentStatusTextPartial]}>
                                          Partial Payment
                                        </Text>
                                      </>
                                    )}
                                  </View>
                                </View>
                              </View>
                            </View>

                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Receipt Number (Optional)</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="Auto-generated if left blank"
                                placeholderTextColor={theme.colors.textSecondary}
                                value={renewReceiptNumber}
                                onChangeText={setRenewReceiptNumber}
                              />
                            </View>

                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Payment Notes (Optional)</Text>
                              <TextInput
                                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                                placeholder="Add any notes about this payment..."
                                placeholderTextColor={theme.colors.textSecondary}
                                value={renewPaymentNotes}
                                onChangeText={setRenewPaymentNotes}
                                multiline
                                numberOfLines={3}
                              />
                            </View>

                            {renewPaymentMethod === 'online' && (
                              <Text style={styles.helperText}>
                                💡 Member paid online. Amount will be recorded for tracking.
                              </Text>
                            )}
                          </>
                        </>
                      )}
                    </>
                  ) : (
                    <Text style={styles.helperText}>
                      No subscription plans available. Create plans in Subscriptions section.
                    </Text>
                  )}

                  <Button
                    title={selectedMember?.currentSubscription ? 'Renew Subscription' : 'Add Subscription'}
                    onPress={renewMemberSubscription}
                    isLoading={isLoading}
                    disabled={!renewSubscription}
                    style={styles.addButton}
                  />
                </ScrollView>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>
      </Animated.View>
    </SafeAreaView>
  );
}