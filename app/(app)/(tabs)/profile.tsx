import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Modal,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Alert,
  TextInput,
  Image
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { getUserInvoices } from "@/lib/invoice";
import { Card } from "@/components/ui/Card";
import { useRouter, useFocusEffect } from "expo-router";
import SafeAreaWrapper from "@/components/SafeAreaWrapper";
import { useTheme } from '@/contexts/ThemeContext';
import ThemePicker from '@/components/ThemePicker';
import { formatRupees } from '@/lib/currency';
import {
  User,
  Bell,
  Moon,
  QrCode,
  CircleHelp,
  Shield,
  FileText,
  Download,
  LogOut,
  Crown,
  Trophy,
  Star,
  Flame,
  CreditCard,
  Sparkles,
  Lock,
  ArrowRight,
  CheckCircle,
  Building2,
} from "lucide-react-native";
import InvoicesList from "@/components/InvoicesList";
import MemberSubscriptionModal from "@/components/MemberSubscriptionModal";
import { useSubscription } from "@/contexts/SubscriptionContext";
import * as Notifications from 'expo-notifications';
import { X, Calendar } from "lucide-react-native";
import { supabase } from "@/lib/supabase";

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function ProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { profile, signOut, gym } = useAuth();
  const { subscriptionInfo, hasActiveSubscription, loading: subLoading, refreshSubscription, isTrial } = useSubscription();

  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showMemberSubscriptionModal, setShowMemberSubscriptionModal] = useState(false);
  const [payments, setPayments] = useState<Array<{ id: string; plan: { name: string }; payment_date: string; amount: number; status: string }>>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalContent, setLegalModalContent] = useState({ title: '', content: '' });
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
const [feedbackData, setFeedbackData] = useState({
  type: 'other' as 'bug' | 'feature' | 'improvement' | 'other',
  rating: 5,
  message: '',
});
const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Show loading indicator when payments are being loaded (rendered inside return)

  const safe = profile || {
    full_name: "User",
    email: "user@example.com",
    level: 1,
    total_points: 0,
    current_streak: 0,
    max_streak: 0,
    role: "member",
  };

  useEffect(() => {
    if (profile?.id) {
      loadInvoices();
      loadNotificationPreference();
    }
  }, [profile]);

  // Auto-refresh when tab is focused (as per requirement)
  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        refreshSubscription();
        loadInvoices();
      }
    }, [profile?.id, refreshSubscription])
  );

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
  const submitFeedback = async () => {
    if (!feedbackData.message.trim()) {
      Alert.alert('Error', 'Please enter your feedback');
      return;
    }
  
    setSubmittingFeedback(true);
  
    try {
      const { error } = await supabase.from('feedback').insert([{
        user_id: profile?.id,
        user_name: profile?.full_name || 'Anonymous',
        user_email: profile?.email,
        feedback_type: feedbackData.type,
        rating: feedbackData.rating,
        message: feedbackData.message.trim(),
        device_info: `${Platform.OS} ${Platform.Version}`,
      }]);
  
      if (error) throw error;
  
      Alert.alert(
        'Thank You! 🎉',
        'Your feedback has been submitted successfully. We appreciate your input!'
      );
  
      // Reset form
      setFeedbackData({
        type: 'other',
        rating: 5,
        message: '',
      });
      setShowFeedbackModal(false);
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const loadNotificationPreference = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('notifications_enabled')
        .eq('id', profile?.id)
        .single();

      if (data) {
        setNotifications(data.notifications_enabled ?? true);
      }
    } catch (error) {
      console.error('Error loading notification preference:', error);
    }
  };

  const toggleNotifications = async (value: boolean) => {
    setNotifications(value);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notifications_enabled: value })
        .eq('id', profile?.id);

      if (error) throw error;

      if (value) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings.'
          );
          setNotifications(false);
          await supabase
            .from('profiles')
            .update({ notifications_enabled: false })
            .eq('id', profile?.id);
        } else {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Notifications Enabled ✅",
              body: "You'll receive updates about workouts and subscriptions!",
            },
            trigger: null,
          });
        }
      } else {
        Alert.alert('Notifications Disabled', 'You can re-enable them anytime.');
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      setNotifications(!value);
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  const showLegalContent = (type: 'privacy' | 'terms' | 'support') => {
    const contents = {
      privacy: {
        title: 'Privacy Policy',
        content: `Last Updated: January 2026
  
  1. Information We Collect
  - Account information (name, email, phone)
  - Workout and attendance data
  - Payment information (securely processed)
  
  2. How We Use Your Information
  - Provide and improve services
  - Process payments
  - Send notifications
  - Track fitness progress
  
  3. Data Security
  We use industry-standard security measures to protect your data.
  
  4. Data Sharing
  We do not sell your information. Shared only with:
  - Your gym (workout data)
  - Payment processors
  - Service providers
  
  5. Your Rights
  - Access your data
  - Request corrections/deletion
  - Opt-out of marketing
  
  Contact: privacy@gymcore.com`
      },
      terms: {
        title: 'Terms of Service',
        content: `Last Updated: January 2026
  
  1. Acceptance of Terms
  By using GymCore, you agree to these terms.
  
  2. User Accounts
  - Provide accurate information
  - Keep account secure
  - One account per person
  - Must be 13+ years old
  
  3. Subscriptions
  - Auto-renew unless cancelled
  - Refunds per refund policy
  - Prices subject to change
  
  4. User Conduct
  - No harassment or abuse
  - No unauthorized access
  - Follow gym rules
  - Respect other members
  
  5. Liability
  - Use at your own risk
  - Consult doctor before workouts
  - GymCore not liable for injuries
  
  Contact: support@gymcore.com`
      },
      support: {
        title: 'Help & Support',
        content: `GymCore Support Center
  
  📧 Email Support
  support@gymcore.com
  Response time: 24-48 hours
  
  📱 Phone Support
  +91 1800-GYMCORE
  Mon-Fri: 9 AM - 6 PM IST
  
  💬 Live Chat
  Available in app
  Mon-Fri: 10 AM - 5 PM IST
  
  🌐 Help Center
  Visit: help.gymcore.com
  
  Common Issues:
  - Login problems: Reset password
  - Payment issues: Check card details
  - Subscription: Manage in Profile
  - Technical bugs: Contact support
  
  Gym Owner Support:
  - Member management help
  - Payment setup assistance
  - Technical integration
  
  We're here to help! 💪`
      }
    };

    setLegalModalContent(contents[type]);
    setShowLegalModal(true);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const POINTS_PER_LEVEL = 1000;
  const progressPercent =
    ((safe.total_points % POINTS_PER_LEVEL) / POINTS_PER_LEVEL) * 100;
  const xpToNextLevel =
    POINTS_PER_LEVEL - (safe.total_points % POINTS_PER_LEVEL);

  const styles = StyleSheet.create({
    feedbackTypeButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    feedbackTypeButtonActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '15',
    },
    feedbackTypeText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    feedbackTypeTextActive: {
      color: theme.colors.primary,
    },
    ratingContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginVertical: 16,
    },
    ratingStar: {
      padding: 4,
    },
    feedbackInput: {
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 15,
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    submitButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 16,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { padding: 24, paddingTop: Platform.OS === 'ios' ? 16 : 24 },
    title: { fontSize: 28, fontWeight: "bold", color: theme.colors.text },
    subtitle: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
    profileCard: { margin: 24, marginTop: 12, padding: 20 },
    profileHeader: { flexDirection: "row", alignItems: "center" },
    avatar: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 16,
    },
    profileText: { flex: 1 },
    userName: { fontSize: 20, fontWeight: "bold", color: theme.colors.text },
    userEmail: { color: theme.colors.textSecondary, marginTop: 4, fontSize: 14 },
    levelInfo: { marginTop: 6, color: theme.colors.primary, fontWeight: "600", fontSize: 13 },
    progressTitle: { color: theme.colors.textSecondary, marginTop: 16, fontSize: 13 },
    progressBar: {
      height: 8,
      backgroundColor: theme.colors.border,
      borderRadius: 4,
      marginTop: 8,
    },
    progressFill: {
      height: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 4,
    },
    gymCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 20
    },
    gymHeader: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'center',
    },
    gymIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    gymInfo: {
      flex: 1,
    },
    gymLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 4,
      fontWeight: '500',
    },
    gymName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 4,
    },
    gymLocation: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    subscriptionCard: { marginHorizontal: 24, marginBottom: 16, padding: 20 },
    activeSubscription: {
      backgroundColor: theme.colors.success + '20',
      borderColor: theme.colors.success,
      borderWidth: 2,
    },
    noSubscription: {
      backgroundColor: theme.colors.card,
      borderWidth: 0,
    },
    gymIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    subscriptionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16
    },
    subscriptionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.success + '30',
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    premiumIcon: {
      backgroundColor: theme.colors.success + '20',
      borderWidth: 2,
      borderColor: theme.colors.success + '40',
    },
    subscriptionInfo: { flex: 1 },
    premiumBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.success + '30',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: "flex-start",
      gap: 4,
    },
    premiumBadgeText: {
      fontSize: 11,
      fontWeight: "bold",
      color: theme.colors.success,
    },
    subscriptionPlan: { fontSize: 18, fontWeight: "bold", color: theme.colors.success, marginTop: 6 },
    activeSubscriptionCard: {
      borderWidth: 2,
      borderColor: theme.colors.success + '40',
      backgroundColor: theme.colors.success + '05',
    },
    subscriptionDetails: {
      flexDirection: "row",
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      marginBottom: 12,
    },
    subscriptionStat: { flex: 1, alignItems: "center" },
    subscriptionDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 16,
    },
    subscriptionDividerVertical: {
      width: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: 8,
    },
    premiumFeatures: {
      gap: 8,
    },
    featureItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    featureText: {
      fontSize: 14,
      color: theme.colors.success,
    },
    noSubHeader: {
      alignItems: "center",
      marginBottom: 20,
    },
    sparkleContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.primaryLight + '30',
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    noSubTitle: {
      fontSize: 22,
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: "center",
    },
    noSubSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: "center",
      paddingHorizontal: 20,
    },
    planDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginTop: 8,
    },
    featuresGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    featureBox: {
      width: "48%",
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    featureIconBox: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.card,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    featureBoxText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
      textAlign: "center",
    },
    subscribeButtonContainer: {
      marginTop: 8,
    },
    gymLogo: {
      width: 64,
      height: 64,
      borderRadius: 50,
    },

    fallbackText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
    },
    subscribeButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    subscribeButtonText: {
      color: theme.colors.card,
      fontWeight: "bold",
      fontSize: 16,
    },
    section: { paddingHorizontal: 24, marginTop: 8, marginBottom: 16 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 20, fontWeight: "bold", color: theme.colors.text },
    sectionCount: {
      backgroundColor: theme.colors.primary,
      color: theme.colors.card,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      fontSize: 12,
      fontWeight: "bold",
    },
    paymentCard: { marginBottom: 8, padding: 16 },
    paymentHeader: { flexDirection: "row", alignItems: "center" },
    paymentIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primaryLight + '30',
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    paymentInfo: { flex: 1 },
    paymentPlan: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
    paymentDate: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
    paymentRight: { alignItems: "flex-end" },
    paymentPrice: { fontSize: 16, fontWeight: "bold", color: theme.colors.text },
    paymentStatus: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: theme.colors.warning + '30',
      marginTop: 4,
    },
    statusSuccess: { backgroundColor: theme.colors.success + '30' },
    statusText: { fontSize: 11, fontWeight: "600", color: theme.colors.success },
    invoiceCard: {
      marginBottom: 8,
      padding: 16,
    },
    invoiceHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    invoiceIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primaryLight + '30',
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    invoiceInfo: {
      flex: 1,
    },
    invoiceNumber: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    invoiceDate: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    invoiceRight: {
      alignItems: "flex-end",
    },
    invoiceAmount: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: 4,
    },
    downloadButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: theme.colors.primaryLight + '30',
    },
    downloadText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 12,
    },
    statItem: {
      width: "48%",
      padding: 16,
      borderRadius: 16,
      alignItems: "center",
    },
    statIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.card,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    statValue: {
      fontSize: 24,
      fontWeight: "bold",
      marginTop: 4,
      color: theme.colors.text,
    },
    statLabel: {
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontSize: 13,
      fontWeight: "500",
    },
    menuCard: { marginHorizontal: 24, marginBottom: 12, paddingVertical: 4 },
    menuItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
    },
    menuLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    menuText: { fontSize: 15, color: theme.colors.text, fontWeight: "500" },
    logoutContainer: {
      marginHorizontal: 24,
      marginBottom: 8,
      marginTop: 8,
    },
    logoutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.error + '30',
      gap: 8,
    },
    logoutText: {
      color: theme.colors.error,
      fontWeight: "600",
      fontSize: 15,
    },
    footer: { height: 24 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalBox: {
      width: "85%",
      backgroundColor: theme.colors.card,
      padding: 24,
      borderRadius: 20,
      alignItems: "center",
    },
    modalIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.error + '30',
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "bold",
      marginBottom: 8,
      color: theme.colors.text,
    },
    modalMessage: {
      fontSize: 15,
      textAlign: "center",
      color: theme.colors.textSecondary,
      marginBottom: 24,
      lineHeight: 22,
    },
    modalActions: {
      flexDirection: "row",
      width: "100%",
      gap: 12,
    },
    modalCancel: {
      flex: 1,
      paddingVertical: 14,
      backgroundColor: theme.colors.border + '40',
      borderRadius: 12,
      alignItems: "center",
    },
    modalCancelText: {
      fontSize: 15,
      color: theme.colors.text,
      fontWeight: "600",
    },
    modalLogout: {
      flex: 1,
      paddingVertical: 14,
      backgroundColor: theme.colors.error,
      borderRadius: 12,
      alignItems: "center",
    },
    modalLogoutText: {
      fontSize: 15,
      color: theme.colors.card,
      fontWeight: "600",
    },

    legalModalBox: {
      width: '90%',
      maxHeight: '80%',
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      overflow: 'hidden',
    },
    legalModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    legalModalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      flex: 1,
    },
    closeButton: {
      padding: 4,
    },
    legalModalContent: {
      padding: 20,
    },
    legalModalText: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 22,
    },
  });

  return (
    <SafeAreaWrapper>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your account and preferences</Text>
        </View>

        {/* Loading Indicator for Payments */}
        {loadingPayments && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading payments...</Text>
          </View>
        )}

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <User size={32} color={theme.colors.card} />
            </View>

            <View style={styles.profileText}>
              <Text style={styles.userName}>{safe.full_name}</Text>
              <Text style={styles.userEmail}>{safe.email}</Text>
              <Text style={styles.levelInfo}>
                Level {safe.level} • {safe.total_points} XP
              </Text>
            </View>
          </View>

          <Text style={styles.progressTitle}>
            {xpToNextLevel} XP to next level
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressPercent}%` }]}
            />
          </View>
        </Card>

        {/* Gym Information - Only for members */}
        {safe.role === 'member' && gym && (
          <Card style={styles.gymCard}>
            <View style={styles.gymHeader}>
              <View style={styles.gymIcon}>
                {gym?.logo_url ? (
                  <Image
                    source={{ uri: gym.logo_url }}
                    style={styles.gymLogo}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.fallbackText}>
                    {gym?.name?.charAt(0).toUpperCase() || 'G'}
                  </Text>
                )}
              </View>
              <View style={styles.gymInfo}>
                <Text style={styles.gymLabel}>Your Gym</Text>
                <Text style={styles.gymName}>{gym.name}</Text>
                {gym.location && (
                  <Text style={styles.gymLocation}>{gym.location}</Text>
                )}
              </View>
            </View>
          </Card>
        )}

        {/* Subscription Status - Only for members */}
        {safe.role === 'member' && (
          <>
            {subLoading ? (
              <Card style={styles.subscriptionCard}>
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.loadingText}>Checking subscription...</Text>
                </View>
              </Card>
            ) : hasActiveSubscription && subscriptionInfo && !isTrial ? (
              // Active Paid Subscription Card
              <Card style={StyleSheet.flatten([styles.subscriptionCard, styles.activeSubscriptionCard])}>
                <View style={styles.subscriptionHeader}>
                  <View style={[styles.subscriptionIcon, styles.premiumIcon]}>
                    <Crown size={28} color={theme.colors.success} />
                  </View>
                  <View style={styles.subscriptionInfo}>
                    <View style={styles.premiumBadge}>
                      <Sparkles size={14} color={theme.colors.success} />
                      <Text style={styles.premiumBadgeText}>PREMIUM ACTIVE</Text>
                    </View>
                    <Text style={styles.subscriptionPlan}>{subscriptionInfo.plan_name || 'Premium Plan'}</Text>
                  </View>
                </View>
                <View style={styles.subscriptionDivider} />
                <View style={styles.subscriptionDetails}>
                  <View style={styles.subscriptionStat}>
                    <Text style={[styles.statValue, { color: theme.colors.text }]}>{subscriptionInfo.days_remaining || 0}</Text>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Days Remaining</Text>
                  </View>
                  <View style={styles.subscriptionDividerVertical} />
                  <View style={styles.subscriptionStat}>
                    <Text style={[styles.statValue, { color: theme.colors.text, fontSize: 14 }]}>
                      {subscriptionInfo.end_date ? new Date(subscriptionInfo.end_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'N/A'}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Expires On</Text>
                  </View>
                </View>
                <View style={styles.premiumFeatures}>
                  <View style={styles.featureItem}>
                    <CheckCircle size={18} color={theme.colors.success} />
                    <Text style={styles.featureText}>All workouts unlocked</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <CheckCircle size={18} color={theme.colors.success} />
                    <Text style={styles.featureText}>Personalized diet plans</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <CheckCircle size={18} color={theme.colors.success} />
                    <Text style={styles.featureText}>Progress tracking</Text>
                  </View>
                </View>
              </Card>
            ) : hasActiveSubscription && isTrial ? (
              // Trial Active - Show upgrade option
              <Card style={StyleSheet.flatten([styles.subscriptionCard, { borderWidth: 2, borderColor: theme.colors.warning }])}>
                <View style={styles.subscriptionHeader}>
                  <View style={styles.subscriptionIcon}>
                    <Sparkles size={24} color={theme.colors.warning} />
                  </View>
                  <View style={styles.subscriptionInfo}>
                    <View style={[styles.premiumBadge, { backgroundColor: theme.colors.warning + '30' }]}>
                      <Sparkles size={14} color={theme.colors.warning} />
                      <Text style={[styles.premiumBadgeText, { color: theme.colors.warning }]}>FREE TRIAL ACTIVE</Text>
                    </View>
                    <Text style={[styles.subscriptionPlan, { color: theme.colors.warning }]}>
                      {subscriptionInfo?.days_remaining || 0} Days Remaining
                    </Text>
                  </View>
                </View>
                <View style={[styles.subscriptionDivider, { marginVertical: 12 }]} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Calendar size={16} color={theme.colors.textSecondary} />
                  <Text style={[styles.planDescription, { marginTop: 0 }]}>
                    Expires on {subscriptionInfo?.end_date ? new Date(subscriptionInfo.end_date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    }) : 'N/A'}
                  </Text>
                </View>
                <Text style={styles.planDescription}>
                  Upgrade now to continue enjoying premium features after your trial expires.
                </Text>
                <TouchableOpacity
                  style={[styles.subscribeButton, { marginTop: 16 }]}
                  onPress={() => setShowMemberSubscriptionModal(true)}
                >
                  <Crown size={18} color={theme.colors.card} />
                  <Text style={styles.subscribeButtonText}>Upgrade to Pro</Text>
                  <ArrowRight size={18} color={theme.colors.card} />
                </TouchableOpacity>
              </Card>
            ) : (
              // No Subscription or Trial Expired
              <Pressable
                style={[styles.subscriptionCard, styles.noSubscription]}
                onPress={() => setShowMemberSubscriptionModal(true)}
              >
                <View style={styles.noSubHeader}>
                  <View style={styles.sparkleContainer}>
                    <Sparkles size={32} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.noSubTitle}>Unlock Premium Features!</Text>
                  <Text style={styles.noSubSubtitle}>
                    Get access to exclusive workouts, diet plans, and more
                  </Text>
                </View>

                <View style={styles.featuresGrid}>
                  <View style={styles.featureBox}>
                    <View style={styles.featureIconBox}>
                      <Lock size={18} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.featureBoxText}>Custom Workouts</Text>
                  </View>
                  <View style={styles.featureBox}>
                    <View style={styles.featureIconBox}>
                      <Lock size={18} color={theme.colors.accent} />
                    </View>
                    <Text style={styles.featureBoxText}>Diet Plans</Text>
                  </View>
                  <View style={styles.featureBox}>
                    <View style={styles.featureIconBox}>
                      <Lock size={18} color={theme.colors.warning} />
                    </View>
                    <Text style={styles.featureBoxText}>Progress Tracking</Text>
                  </View>
                  <View style={styles.featureBox}>
                    <View style={styles.featureIconBox}>
                      <Lock size={18} color={theme.colors.success} />
                    </View>
                    <Text style={styles.featureBoxText}>Priority Support</Text>
                  </View>
                </View>

                <View style={styles.subscribeButtonContainer}>
                  <View style={styles.subscribeButton}>
                    <Sparkles size={18} color={theme.colors.card} />
                    <Text style={styles.subscribeButtonText}>Upgrade to Pro</Text>
                    <ArrowRight size={18} color={theme.colors.card} />
                  </View>
                </View>
              </Pressable>
            )}
          </>
        )}

        <InvoicesList userId={profile!.id} onRefresh={loadInvoices} />

        {/* Achievements */}
        {/* <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <View style={styles.statsGrid}>
            <StatItem
              label="Best Streak"
              value={safe.max_streak}
              icon={<Trophy size={22} color={theme.colors.error} />}
              color={theme.colors.error + '20'}
            />
            <StatItem
              label="Current Streak"
              value={safe.current_streak}
              icon={<Flame size={22} color={theme.colors.warning} />}
              color={theme.colors.warning + '20'}
            />
            <StatItem
              label="Total XP"
              value={safe.total_points}
              icon={<Star size={22} color={theme.colors.warning} />}
              color={theme.colors.warning + '20'}
            />
            <StatItem
              label="Level"
              value={safe.level}
              icon={<Crown size={22} color={theme.colors.accent} />}
              color={theme.colors.accent + '20'}
            />
          </View>
        </View> */}

        {/* Preferences */}
        <Card style={styles.menuCard}>
          <MenuItem
            title="Notifications"
            icon={<Bell size={20} color={theme.colors.textSecondary} />}
            right={
              <Switch
                value={notifications}
                onValueChange={toggleNotifications}
                trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
                thumbColor={notifications ? theme.colors.primary : theme.colors.border}
              />
            }
          />
          <MenuItem
            title="Theme"
            icon={<Moon size={20} color={theme.colors.textSecondary} />}
            right={<ThemePicker />}
          />
        </Card>

        {/* Account */}
        <Card style={styles.menuCard}>
          {safe.role === 'member' && (
            <MenuItem
              title="Manage Subscription"
              icon={<CreditCard size={20} color={theme.colors.textSecondary} />}
              onPress={() => setShowMemberSubscriptionModal(true)}
              showChevron
            />
          )}

          <MenuItem
            title="Help & Support"
            icon={<CircleHelp size={20} color={theme.colors.textSecondary} />}
            onPress={() => showLegalContent('support')}
            showChevron
          />
        </Card>

        {/* Legal */}
        <Card style={styles.menuCard}>
          <MenuItem
            title="Privacy Policy"
            icon={<Shield size={20} color={theme.colors.textSecondary} />}
            onPress={() => showLegalContent('privacy')}
            showChevron
          />
          <MenuItem
            title="Terms of Service"
            icon={<FileText size={20} color={theme.colors.textSecondary} />}
            onPress={() => showLegalContent('terms')}
            showChevron
          />
          <MenuItem
    title="Send Feedback"
    icon={<Star size={20} color={theme.colors.textSecondary} />}
    onPress={() => setShowFeedbackModal(true)}
    showChevron
  />
        </Card>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <LogOut size={20} color={theme.colors.error} />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.footer} />
      </ScrollView>

      {/* Member Subscription Modal */}
      {safe.role === 'member' && (
        <MemberSubscriptionModal
          visible={showMemberSubscriptionModal}
          onClose={() => setShowMemberSubscriptionModal(false)}
          onSuccess={async () => {
            await refreshSubscription();
          }}
        />
      )}

      {/* Logout Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalIcon}>
              <LogOut size={32} color={theme.colors.error} />
            </View>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to logout? You will need to sign in again to access your account.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowLogoutModal(false)}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowLogoutModal(false);
                  signOut();
                }}
                style={styles.modalLogout}
              >
                <Text style={styles.modalLogoutText}>Logout</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Legal Content Modal */}
      <Modal
        visible={showLegalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLegalModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.legalModalBox, { backgroundColor: theme.colors.card }]}>
            <View style={styles.legalModalHeader}>
              <Text style={styles.legalModalTitle}>{legalModalContent.title}</Text>
              <TouchableOpacity
                onPress={() => setShowLegalModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.legalModalContent}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.legalModalText}>{legalModalContent.content}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
<Modal
  visible={showFeedbackModal}
  transparent
  animationType="slide"
  onRequestClose={() => setShowFeedbackModal(false)}
>
  <View style={styles.modalBackdrop}>
    <View style={[styles.legalModalBox, { backgroundColor: theme.colors.card }]}>
      <View style={styles.legalModalHeader}>
        <Text style={styles.legalModalTitle}>Send Feedback</Text>
        <TouchableOpacity
          onPress={() => setShowFeedbackModal(false)}
          style={styles.closeButton}
        >
          <X size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.legalModalContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.legalModalText, { marginBottom: 16 }]}>
          We'd love to hear from you! Your feedback helps us improve.
        </Text>

        {/* Feedback Type */}
        <Text style={[styles.legalModalText, { fontWeight: '600', marginBottom: 12 }]}>
          Feedback Type
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {[
            { value: 'bug', label: '🐛 Bug' },
            { value: 'feature', label: '✨ Feature' },
            { value: 'improvement', label: '📈 Improve' },
            { value: 'other', label: '💬 Other' },
          ].map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.feedbackTypeButton,
                feedbackData.type === type.value && styles.feedbackTypeButtonActive,
              ]}
              onPress={() => setFeedbackData({ ...feedbackData, type: type.value as any })}
            >
              <Text
                style={[
                  styles.feedbackTypeText,
                  feedbackData.type === type.value && styles.feedbackTypeTextActive,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Rating */}
        <Text style={[styles.legalModalText, { fontWeight: '600', marginBottom: 8 }]}>
          Rate Your Experience
        </Text>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              style={styles.ratingStar}
              onPress={() => setFeedbackData({ ...feedbackData, rating: star })}
            >
              <Star
                size={32}
                color={star <= feedbackData.rating ? theme.colors.warning : theme.colors.border}
                fill={star <= feedbackData.rating ? theme.colors.warning : 'none'}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Message */}
        <Text style={[styles.legalModalText, { fontWeight: '600', marginBottom: 12 }]}>
          Your Feedback *
        </Text>
        <TextInput
          style={styles.feedbackInput}
          placeholder="Tell us what you think..."
          placeholderTextColor={theme.colors.textSecondary}
          value={feedbackData.message}
          onChangeText={(text) => setFeedbackData({ ...feedbackData, message: text })}
          multiline
          numberOfLines={6}
        />

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submittingFeedback && { opacity: 0.6 }]}
          onPress={submitFeedback}
          disabled={submittingFeedback}
        >
          {submittingFeedback ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Feedback</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  </View>
</Modal>
    </SafeAreaWrapper>
  );
}

interface MenuItemProps {
  title: string;
  icon: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
}

function MenuItem({ title, icon, right, onPress, showChevron }: MenuItemProps) {
  const { theme } = useTheme();

  const menuStyles = StyleSheet.create({
    menuItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
    },
    menuLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    menuText: { fontSize: 15, color: theme.colors.text, fontWeight: "500" },
  });

  return (
    <Pressable
      style={menuStyles.menuItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={menuStyles.menuLeft}>
        {icon}
        <Text style={menuStyles.menuText}>{title}</Text>
      </View>
      {right || (showChevron && (
        <ArrowRight size={18} color={theme.colors.textSecondary} />
      ))}
    </Pressable>
  );
}

interface StatItemProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatItem({ label, value, icon, color }: StatItemProps) {
  const { theme } = useTheme();

  const statStyles = StyleSheet.create({
    statItem: {
      width: "48%",
      padding: 16,
      borderRadius: 16,
      alignItems: "center",
    },
    statIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.card,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    statValue: {
      fontSize: 24,
      fontWeight: "bold",
      marginTop: 4,
      color: theme.colors.text,
    },
    statLabel: {
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontSize: 13,
      fontWeight: "500",
    },
  });

  return (
    <View style={[statStyles.statItem, { backgroundColor: color }]}>
      <View style={statStyles.statIcon}>{icon}</View>
      <Text style={statStyles.statValue}>{value}</Text>
      <Text style={statStyles.statLabel}>{label}</Text>
    </View>
  );
}