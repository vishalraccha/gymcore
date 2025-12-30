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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Profile, WorkoutLog, DietLog, Attendance } from '@/types/database';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
} from 'lucide-react-native';
import { createSubscriptionWithCashPayment } from '@/lib/cashPayment';
import { createSubscriptionInvoice } from '@/lib/invoice';
import { formatRupees } from '@/lib/currency';

const COLORS = {
  primary: '#3B82F6',
  primaryLight: '#EEF2FF',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  background: '#F8FAFC',
  cardBg: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
};

interface MemberDetails extends Profile {
  has_personal_training?: boolean;
  workout_logs?: WorkoutLog[];
  diet_logs?: DietLog[];
  attendance?: Attendance[];
  stats?: {
    totalWorkouts: number;
    totalCaloriesBurned: number;
    totalMinutes: number;
    totalMeals: number;
    avgSessionDuration: number;
    lastWorkout: string;
  };
  currentSubscription?: UserSubscription | null;
  totalCheckIns?: number;
  expectedCheckIns?: number;
  subscriptionStatus?: 'active' | 'expired' | 'none';
}

export default function MembersScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [members, setMembers] = useState<MemberDetails[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberDetails | null>(null);
  const [newMember, setNewMember] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    has_personal_training: false,
  });
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

    // Apply status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter(m => m.subscriptionStatus === 'active');
    } else if (filterStatus === 'expired') {
      filtered = filtered.filter(m => m.subscriptionStatus === 'expired' || m.subscriptionStatus === 'none');
    }

    // Apply search filter
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

      const membersWithDetails = await Promise.all(
        (data || []).map(async (member) => {
          // Fetch stats
          const stats = await fetchMemberStats(member.id);

          // Fetch active subscription
          // Fetch active subscription with correct payment amounts
          const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select(`
  *,
  subscription:subscription_id (
    name,
    price,
    duration_months
  )
`)
            .eq('user_id', member.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // If subscription exists, ensure amounts are calculated correctly
          if (subscription) {
            const totalAmount = subscription.total_amount || subscription.subscription?.price || 0;
            const paidAmount = subscription.paid_amount || subscription.amount_paid || 0;
            const pendingAmount = subscription.pending_amount !== undefined
              ? subscription.pending_amount
              : Math.max(0, totalAmount - paidAmount);

            subscription.paid_amount = paidAmount;
            subscription.pending_amount = pendingAmount;
            subscription.total_amount = totalAmount;
          }

          // Fetch attendance for current month
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', member.id)
            .gte('attendance_date', startOfMonth.toISOString().split('T')[0]);

          const totalCheckIns = attendanceData?.length || 0;

          // Calculate expected check-ins (assume 30 days in month, can be adjusted)
          const today = new Date();
          const daysInMonth = today.getDate();
          const expectedCheckIns = daysInMonth; // Expected 1 per day

          // Determine subscription status
          let subscriptionStatus: 'active' | 'expired' | 'none' = 'none';
          if (subscription) {
            const endDate = new Date(subscription.end_date);
            const isActive = endDate >= new Date() && subscription.is_active;
            subscriptionStatus = isActive ? 'active' : 'expired';
          }

          return {
            ...member,
            stats,
            currentSubscription: subscription || null,
            totalCheckIns,
            expectedCheckIns,
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
        avgSessionDuration: 0,
        lastWorkout: '',
      };
    } catch (error) {
      return {
        totalWorkouts: 0,
        totalCaloriesBurned: 0,
        totalMinutes: 0,
        totalMeals: 0,
        avgSessionDuration: 0,
        lastWorkout: '',
      };
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
      setSelectedMember({ ...memberData, stats });
      setShowMemberDetails(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch member details');
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePendingAmount = () => {
    if (!selectedSubscription || !amountReceived) return selectedSubscription?.price || 0;
    const received = parseFloat(amountReceived) || 0;
    const total = selectedSubscription.price || 0;
    return Math.max(0, total - received);
  };

  const addMember = async () => {
    if (!newMember.full_name || !newMember.email || !newMember.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (newMember.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (paymentMethod === 'cash' && selectedSubscription) {
      try {
        const received = parseFloat(amountReceived);
        const pending = calculatePendingAmount();

        const { paymentId, userSubscriptionId, receiptNumber: generatedReceipt } =
          await createSubscriptionWithCashPayment(
            userId,
            selectedSubscription.id,
            received,
            profile?.gym_id,
            profile?.id,
            receiptNumber || undefined
          );

        // Update with payment notes if provided
        if (paymentNotes) {
          await supabase
            .from('user_subscriptions')
            .update({
              payment_notes: paymentNotes,
            })
            .eq('id', userSubscriptionId);
        }

        // Create invoice
        await createSubscriptionInvoice(
          userId,
          selectedSubscription.id,
          received,
          'cash',
          paymentId,
          profile?.gym_id
        );

        subscriptionCreated = true;

        // Show success message with payment details
        const successMsg = pending > 0
          ? `Member added! Paid: ₹${received}, Pending: ₹${pending.toFixed(2)}`
          : 'Member added with full payment!';

        Alert.alert('Success', successMsg);
      } catch (subError) {
        console.error('Error creating subscription:', subError);
        Alert.alert('Warning', 'Member created but subscription setup failed.');
      }
    }

    setIsLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newMember.email,
        password: newMember.password,
        options: {
          data: {
            full_name: newMember.full_name,
            phone: newMember.phone || null,
            role: 'member',
            gym_id: profile?.gym_id ? String(profile.gym_id) : null,
            has_personal_training: newMember.has_personal_training,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const userId = authData.user.id;
      let subscriptionCreated = false;

      if (newMember.has_personal_training) {
        await supabase
          .from('profiles')
          .update({ has_personal_training: true })
          .eq('id', userId);

        if (profile?.gym_id) {
          await supabase.from('personal_training_assignments').insert([{
            user_id: userId,
            gym_id: profile.gym_id,
            assigned_by: profile.id,
            is_active: true,
            start_date: new Date().toISOString().split('T')[0],
          }]);
        }
      }

      if (paymentMethod === 'cash' && selectedSubscription) {
        try {
          const received = parseFloat(amountReceived);
          const pending = calculatePendingAmount();
          const paymentStatus = pending === 0 ? 'completed' : 'partial';

          const { paymentId, userSubscriptionId } = await createSubscriptionWithCashPayment(
            userId,
            selectedSubscription.id,
            received,
            profile?.gym_id,
            profile?.id,
            receiptNumber || undefined
          );

          // Update subscription with pending amount and notes
          await supabase
            .from('user_subscriptions')
            .update({
              payment_status: paymentStatus,
              pending_amount: pending,
              payment_notes: paymentNotes || null,
            })
            .eq('id', userSubscriptionId);

          await createSubscriptionInvoice(
            userId,
            selectedSubscription.id,
            received,
            'cash',
            paymentId,
            profile?.gym_id
          );

          subscriptionCreated = true;
        } catch (subError) {
          console.error('Error creating subscription:', subError);
          Alert.alert('Warning', 'Member created but subscription setup failed.');
        }
      } else if (paymentMethod === 'online' && selectedSubscription) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + selectedSubscription.duration_days);

        await supabase.from('user_subscriptions').insert([{
          user_id: userId,
          subscription_id: selectedSubscription.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          amount_paid: 0,
          pending_amount: selectedSubscription.price,
          payment_status: 'pending',
          payment_method: 'online',
          is_active: false,
          currency: 'INR',
        }]);
      }

      setNewMember({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        has_personal_training: false,
      });
      setSelectedSubscription(null);
      setPaymentMethod('none');
      setAmountReceived('');
      setReceiptNumber('');
      setPaymentNotes('');
      setShowAddMember(false);
      await fetchMembers();

      Alert.alert('Success', `Member ${newMember.full_name} added successfully!`);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to add member';
      if (errorMessage.includes('already registered')) {
        Alert.alert('Error', 'This email is already registered');
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMember = async (memberId: string, memberName: string) => {
    Alert.alert(
      'Delete Member',
      `Are you sure you want to delete ${memberName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_user', { user_id: memberId });

              if (error) {
                const { error: profileError } = await supabase
                  .from('profiles')
                  .delete()
                  .eq('id', memberId);
                if (profileError) throw profileError;
              }

              setShowMemberDetails(false);
              await fetchMembers();
              Alert.alert('Success', 'Member deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete member');
            }
          },
        },
      ]
    );
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
      backgroundColor: COLORS.cardBg,
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
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.cardBg,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      gap: 12,
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
    viewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primaryLight,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 4,
    },
    viewButtonText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
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
    modalSafeArea: {
      flex: 1,
      backgroundColor: COLORS.cardBg,
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
      backgroundColor: COLORS.cardBg,
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
      color: COLORS.cardBg,
    },
    paymentSummary: {
      // backgroundColor: theme.colors.primaryLight,
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
      color: theme.colors.primaryDark,
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
    dangerCard: {
      marginBottom: 24,
      padding: 20,
      borderColor: theme.colors.error + '30',
      borderWidth: 1,
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
      backgroundColor: COLORS.successLight,
    },
    paymentStatusBadgePartial: {
      backgroundColor: COLORS.warningLight,
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
      minHeight: 52,
    },
    // Add these styles inside StyleSheet.create
    filterTabs: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 8,
      backgroundColor: COLORS.cardBg,
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
      color: COLORS.cardBg,
    },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: COLORS.successLight,
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
      backgroundColor: COLORS.errorLight,
    },
    expiredBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.error,
    },
    subscriptionDetails: {
      marginTop: 8,
      padding: 10,
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
      backgroundColor: COLORS.successLight,
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
      backgroundColor: COLORS.warningLight,
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
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
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
              <Search size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, email, or phone..."
                placeholderTextColor={COLORS.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <X size={20} color={COLORS.textSecondary} />
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
              <User size={48} color={COLORS.textSecondary} />
              <Text style={styles.noMembersText}>
                {searchQuery ? 'No members found' : 'No members yet'}
              </Text>
              <Text style={styles.noMembersSubtext}>
                {searchQuery ? 'Try adjusting your search' : 'Add your first member'}
              </Text>
            </Card>
          ) : (
            filteredMembers.map((member) => (
              <Card key={member.id} style={styles.memberCard}>
                <View style={styles.memberInfo}>
                  <View style={styles.memberAvatar}>
                    <User size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.memberDetails}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Text style={styles.memberName}>{member.full_name}</Text>
                      {member.subscriptionStatus === 'active' && (
                        <View style={styles.activeBadge}>
                          <CheckCircle size={12} color={COLORS.success} />
                          <Text style={styles.activeBadgeText}>Active</Text>
                        </View>
                      )}
                      {member.subscriptionStatus === 'expired' && (
                        <View style={styles.expiredBadge}>
                          <AlertCircle size={12} color={COLORS.error} />
                          <Text style={styles.expiredBadgeText}>Expired</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.memberContact}>
                      <Mail size={14} color={COLORS.textSecondary} />
                      <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text>
                    </View>

                    {member.phone && (
                      <View style={styles.memberContact}>
                        <Phone size={14} color={COLORS.textSecondary} />
                        <Text style={styles.memberPhone}>{member.phone}</Text>
                      </View>
                    )}

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

                        {/* Payment Status */}
                        <View style={styles.paymentInfo}>
                          <Text style={styles.paymentLabel}>
                            Paid: {formatRupees(member.currentSubscription.paid_amount || member.currentSubscription.amount_paid || 0)}
                          </Text>
                          {(member.currentSubscription.pending_amount || 0) >= 0 && (
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

                    {/* Check-in Stats */}
                    <View style={styles.checkInStats}>
                      <View style={styles.checkInItem}>
                        <Activity size={14} color={COLORS.primary} />
                        <Text style={styles.checkInText}>
                          Check-ins: {member.totalCheckIns}/{member.expectedCheckIns}
                        </Text>
                      </View>
                      <View style={styles.checkInProgress}>
                        <View style={styles.progressBar}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${Math.min((member.totalCheckIns / member.expectedCheckIns) * 100, 100)}%` }
                            ]}
                          />
                        </View>
                        <Text style={styles.progressText}>
                          {Math.round((member.totalCheckIns / member.expectedCheckIns) * 100)}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.memberStatsRow}>
                      <View style={styles.statItem}>
                        <Flame size={12} color={COLORS.error} />
                        <Text style={styles.statText}>{member.stats?.totalCaloriesBurned || 0} cal</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.memberLevel}>Lv {member.level}</Text>
                        <Text style={styles.memberStreak}>{member.current_streak}🔥</Text>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => fetchMemberDetails(member.id)}
                    activeOpacity={0.7}
                  >
                    <Eye size={16} color={COLORS.cardBg} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={() => setShowAddMember(true)} activeOpacity={0.8}>
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Add Member Modal */}
        <Modal visible={showAddMember} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddMember(false)}>
          <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Member</Text>
                <TouchableOpacity onPress={() => setShowAddMember(false)} style={styles.closeButton} activeOpacity={0.7}>
                  <X size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter full name"
                    placeholderTextColor={COLORS.textSecondary}
                    value={newMember.full_name}
                    onChangeText={(text) => setNewMember({ ...newMember, full_name: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter email address"
                    placeholderTextColor={COLORS.textSecondary}
                    value={newMember.email}
                    onChangeText={(text) => setNewMember({ ...newMember, email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter phone number (optional)"
                    placeholderTextColor={COLORS.textSecondary}
                    value={newMember.phone}
                    onChangeText={(text) => setNewMember({ ...newMember, phone: text })}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Min 6 characters"
                    placeholderTextColor={COLORS.textSecondary}
                    value={newMember.password}
                    onChangeText={(text) => setNewMember({ ...newMember, password: text })}
                    secureTextEntry
                  />
                  <Text style={styles.helperText}>
                    Member will use this email and password to login.
                  </Text>
                </View>

                <View style={styles.sectionDivider} />

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
                            <DollarSign size={20} color={paymentMethod === 'cash' ? COLORS.cardBg : theme.colors.textSecondary} />
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
                            <CreditCard size={20} color={paymentMethod === 'online' ? COLORS.cardBg : theme.colors.textSecondary} />
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

                        {paymentMethod === 'cash' && (
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
                              <Text style={styles.inputLabel}>Amount Received *</Text>
                              <TextInput
                                style={styles.input}
                                placeholder="Enter amount received"
                                placeholderTextColor={COLORS.textSecondary}
                                value={amountReceived}
                                onChangeText={setAmountReceived}
                                keyboardType="decimal-pad"
                              />
                              <Text style={styles.helperText}>
                                Enter the amount customer paid (can be partial)
                              </Text>
                            </View>

                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Pending Amount </Text>
                              <TextInput
                                style={[styles.input, styles.inputReadonly]}
                                value={`₹${calculatePendingAmount()}`}
                                editable={false}
                              />
                            </View>

                            {/* Payment Summary Card */}
                            <View style={styles.paymentSummary}>
                              <View style={styles.paymentSummaryRow}>
                                <Text style={styles.paymentSummaryLabel}>Plan Amount:</Text>
                                <Text style={styles.paymentSummaryValue}>₹{selectedSubscription.price}</Text>
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
                                    ₹{calculatePendingAmount().toFixed(2)}
                                  </Text>
                                  <View style={[
                                    styles.paymentStatusBadge,
                                    calculatePendingAmount() === 0
                                      ? styles.paymentStatusBadgeComplete
                                      : styles.paymentStatusBadgePartial
                                  ]}>
                                    {calculatePendingAmount() === 0 ? (
                                      <>
                                        <CheckCircle size={14} color={COLORS.success} />
                                        <Text style={[styles.paymentStatusText, styles.paymentStatusTextComplete]}>
                                          Fully Paid
                                        </Text>
                                      </>
                                    ) : (
                                      <>
                                        <AlertCircle size={14} color={COLORS.warning} />
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
                                placeholderTextColor={COLORS.textSecondary}
                                value={receiptNumber}
                                onChangeText={setReceiptNumber}
                              />
                            </View>

                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Payment Notes (Optional)</Text>
                              <TextInput
                                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                                placeholder="Add any notes about this payment..."
                                placeholderTextColor={COLORS.textSecondary}
                                value={paymentNotes}
                                onChangeText={setPaymentNotes}
                                multiline
                                numberOfLines={3}
                              />
                            </View>
                          </>
                        )}

                        {paymentMethod === 'online' && (
                          <Text style={styles.helperText}>
                            Member will complete online payment through the app after registration. Subscription will be activated once payment is completed.
                          </Text>
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
        </Modal>

        {/* Member Details Modal - Simplified for space */}
        <Modal
          visible={showMemberDetails}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowMemberDetails(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedMember?.full_name}</Text>
              <TouchableOpacity onPress={() => setShowMemberDetails(false)}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedMember && (
                <>
                  {/* Member Overview */}
                  <Card style={styles.overviewCard}>
                    <View style={styles.overviewHeader}>
                      <View style={styles.memberAvatarLarge}>
                        <User size={32} color="#ffffff" />
                      </View>
                      <View style={styles.overviewInfo}>
                        <Text style={styles.overviewName}>
                          {selectedMember.full_name}
                        </Text>
                        <Text style={styles.overviewEmail}>
                          {selectedMember.email}
                        </Text>
                        {selectedMember.phone && (
                          <Text style={styles.overviewPhone}>
                            {selectedMember.phone}
                          </Text>
                        )}
                        <View style={styles.overviewStats}>
                          <Text style={styles.overviewLevel}>
                            Level {selectedMember.level}
                          </Text>
                          <Text style={styles.overviewPoints}>
                            {selectedMember.total_points} XP
                          </Text>
                          <Text style={styles.overviewStreak}>
                            {selectedMember.current_streak} day streak
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Card>

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

                            // Update personal training assignment
                            if (newValue) {
                              // Create assignment if doesn't exist
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
                                    start_date: new Date().toISOString().split('T')[0],
                                  },
                                ]);
                              }
                            } else {
                              // Deactivate assignment
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

                  {/* Stats Cards */}
                  <View style={styles.statsGrid}>
                    <Card style={styles.statCard}>
                      <Activity size={24} color={theme.colors.primary} />
                      <Text style={styles.statValue}>
                        {selectedMember.stats?.totalWorkouts || 0}
                      </Text>
                      <Text style={styles.statLabel}>Total Workouts</Text>
                    </Card>
                    <Card style={styles.statCard}>
                      <Flame size={24} color={theme.colors.error} />
                      <Text style={styles.statValue}>
                        {selectedMember.stats?.totalCaloriesBurned || 0}
                      </Text>
                      <Text style={styles.statLabel}>Calories Burned</Text>
                    </Card>
                    <Card style={styles.statCard}>
                      <Clock size={24} color={theme.colors.success} />
                      <Text style={styles.statValue}>
                        {selectedMember.stats?.totalMinutes || 0}
                      </Text>
                      <Text style={styles.statLabel}>Total Minutes</Text>
                    </Card>
                    <Card style={styles.statCard}>
                      <UtensilsCrossed size={24} color={theme.colors.warning} />
                      <Text style={styles.statValue}>
                        {selectedMember.stats?.totalMeals || 0}
                      </Text>
                      <Text style={styles.statLabel}>Meals Logged</Text>
                    </Card>
                  </View>

                  {/* Recent Workouts */}
                  <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Recent Workouts</Text>
                    {selectedMember.workout_logs &&
                      selectedMember.workout_logs.length > 0 ? (
                      selectedMember.workout_logs
                        .slice(0, 5)
                        .map((workout, index) => (
                          <View key={index} style={styles.workoutItem}>
                            <View style={styles.workoutInfo}>
                              <Text style={styles.workoutName}>
                                {(workout.workout as { name: string } | undefined)?.name ||
                                  'Unknown Workout'}
                              </Text>
                              <Text style={styles.workoutDetails}>
                                {workout.duration_minutes} min •{' '}
                                {Number(workout.calories_burned).toFixed(0)} cal
                              </Text>
                            </View>
                            <Text style={styles.workoutDate}>
                              {new Date(
                                workout.completed_at
                              ).toLocaleDateString()}
                            </Text>
                          </View>
                        ))
                    ) : (
                      <Text style={styles.noDataText}>No workouts recorded</Text>
                    )}
                  </Card>

                  {/* Recent Diet Logs */}
                  <Card style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Recent Meals</Text>
                    {selectedMember.diet_logs &&
                      selectedMember.diet_logs.length > 0 ? (
                      selectedMember.diet_logs.slice(0, 5).map((meal, index) => (
                        <View key={index} style={styles.mealItem}>
                          <View style={styles.mealInfo}>
                            <Text style={styles.mealName}>{meal.meal_name}</Text>
                            <Text style={styles.mealDetails}>
                              {meal.meal_type} •{' '}
                              {Number(meal.calories).toFixed(0)} cal
                            </Text>
                          </View>
                          <Text style={styles.mealDate}>
                            {new Date(meal.logged_at).toLocaleDateString()}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noDataText}>No meals logged</Text>
                    )}
                  </Card>

                  {/* Danger Zone */}
                  <Card style={styles.dangerCard}>
                    <Text style={styles.dangerTitle}>Danger Zone</Text>
                    <Text style={styles.dangerSubtitle}>
                      Permanently delete this member and all their data
                    </Text>
                    <Button
                      title="Delete Member"
                      onPress={() =>
                        deleteMember(selectedMember.id, selectedMember.full_name)
                      }
                      variant="outline"
                      style={styles.deleteButton}
                      textStyle={styles.deleteButtonText}
                    />
                  </Card>
                </>
              )}
            </ScrollView>
          </View>
        </Modal>
      </Animated.View>
    </SafeAreaView>
  );
}