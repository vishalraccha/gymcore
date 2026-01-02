import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Image,
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import SafeAreaWrapper from "@/components/SafeAreaWrapper";
import ThemePicker from "@/components/ThemePicker";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  LogOut,
  Moon,
  Upload,
  User,
  Calendar,
  Plus,
  X,
  Edit,
  Crown,
  TrendingUp,
  CheckCircle,
  AlertCircle,
} from "lucide-react-native";
import { uploadGymLogo } from '@/lib/storage';

interface GymData {
  id?: string;
  name: string;
  location: string;
  phone: string;
  email: string;
  description: string;
  logo_url: string;
  created_at?: string;
}

interface SubscriptionData {
  plan_name: string;
  amount_paid: number;
  total_amount: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'expired';
  days_remaining: number;
}

export default function GymProfileScreen() {
  const { theme } = useTheme();
  const { profile, refreshProfile, refreshGym, signOut } = useAuth();
  const [gymData, setGymData] = useState<GymData>({
    name: "",
    location: "",
    phone: "",
    email: "",
    description: "",
    logo_url: "",
  });
  const [ownerName, setOwnerName] = useState("");
  const [isEditingOwner, setIsEditingOwner] = useState(false);

  // Dummy subscription data - replace with actual data from your database
  const [subscription, setSubscription] = useState<SubscriptionData>({
    plan_name: "Premium Plan",
    amount_paid: 15000,
    total_amount: 15000,
    start_date: "2024-01-01",
    end_date: "2024-12-31",
    status: 'active',
    days_remaining: 180,
  });

  const [hasGym, setHasGym] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadGymData();
    if (profile) {
      setOwnerName(profile.full_name || "");
    }
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGymData();
    setRefreshing(false);
  };

  // ⭐ FIXED: Load gym data - gym already exists from registration
  const loadGymData = async () => {
    if (!profile) {
      setIsLoading(false);
      return;
    }

    try {
      // ⭐ FIX 1: For gym owners, find gym by owner_id (not gym_id)
      if (profile.role === 'gym_owner') {
        const { data, error } = await supabase
          .from("gyms")
          .select("*")
          .eq("owner_id", profile.id) // ⭐ Find by owner_id
          .single();

        if (error) {
          console.error("Error loading gym:", error);
          setHasGym(false);
          setIsLoading(false);
          return;
        }

        if (data) {
          setGymData({
            id: data.id,
            name: data.name,
            location: data.location ?? "",
            phone: data.phone ?? "",
            email: data.email ?? "",
            description: data.description ?? "",
            logo_url: data.logo_url ?? "",
            created_at: data.created_at,
          });
          setHasGym(true);

          // ⭐ FIX 2: If profile.gym_id is missing, update it
          if (!profile.gym_id) {
            await supabase
              .from('profiles')
              .update({ gym_id: data.id })
              .eq('id', profile.id);
            await refreshProfile();
          }
        } else {
          setHasGym(false);
        }
      } else {
        // For non-owners, check gym_id
        if (!profile.gym_id) {
          setHasGym(false);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("gyms")
          .select("*")
          .eq("id", profile.gym_id)
          .single();

        if (error) throw error;

        setGymData({
          id: data.id,
          name: data.name,
          location: data.location ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          description: data.description ?? "",
          logo_url: data.logo_url ?? "",
          created_at: data.created_at,
        });
        setHasGym(true);
      }
    } catch (err) {
      console.error("Error loading gym:", err);
      setHasGym(false);
    }

    setIsLoading(false);
  };

  // ⭐ REMOVE this entire function - not needed anymore
  // Delete the createGym function completely

  // ⭐ FIXED: handleSave only updates, never creates
  

  const pickImage = async () => {
    if (!hasGym || !gymData.id) {
      Alert.alert('Error', 'Please create gym profile first');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      setUploadingLogo(true);

      const imageUri = result.assets[0].uri;

      // Convert URI to Blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const logoUrl = await uploadGymLogo(blob, gymData.id);

      // Update database
      const { error } = await supabase
        .from('gyms')
        .update({ logo_url: logoUrl })
        .eq('id', gymData.id);

      if (error) throw error;

      // Update local state
      setGymData(prev => ({ ...prev, logo_url: logoUrl }));
      await refreshGym();

      Alert.alert('Success', 'Gym logo updated successfully!');
    } catch (error) {
      console.error('Error uploading logo:', error);
      Alert.alert('Error', 'Failed to update gym logo. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  };


  const updateOwnerName = async () => {
    if (!ownerName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: ownerName.trim() })
        .eq('id', profile?.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditingOwner(false);
      Alert.alert('Success', 'Name updated successfully');
    } catch (error) {
      console.error('Error updating name:', error);
      Alert.alert('Error', 'Failed to update name');
    }
  };

  // const createGym = async () => {
  //   if (!gymData.name.trim()) {
  //     Alert.alert("Missing Field", "Gym name is required.");
  //     return;
  //   }

  //   if (!profile?.id) {
  //     Alert.alert("Error", "Profile not loaded.");
  //     return;
  //   }

  //   setIsSaving(true);

  //   try {
  //     const { data: newGym, error: gymError } = await supabase
  //       .from("gyms")
  //       .insert([
  //         {
  //           name: gymData.name,
  //           location: gymData.location || null,
  //           phone: gymData.phone || null,
  //           email: gymData.email || null,
  //           description: gymData.description || null,
  //           logo_url: gymData.logo_url || null,
  //           owner_id: profile.id,
  //         },
  //       ])
  //       .select()
  //       .single();

  //     if (gymError) throw gymError;

  //     const { error: profileError } = await supabase
  //       .from("profiles")
  //       .update({
  //         gym_id: newGym.id,
  //         role: "gym_owner",
  //       })
  //       .eq("id", profile.id);

  //     if (profileError) throw profileError;

  //     await refreshProfile();
  //     await refreshGym();

  //     setHasGym(true);
  //     setIsEditing(false);
  //     Alert.alert("Success", "Gym created successfully! 🎉");
  //   } catch (err) {
  //     console.error("Error creating gym:", err);
  //     Alert.alert("Error", "Failed to create gym");
  //   }

  //   setIsSaving(false);
  // };

  const updateGym = async () => {
    if (!gymData.name.trim()) {
      Alert.alert("Missing Field", "Gym name is required.");
      return;
    }

    if (!profile?.gym_id) {
      Alert.alert("Error", "No gym found to update.");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("gyms")
        .update({
          name: gymData.name,
          location: gymData.location || null,
          phone: gymData.phone || null,
          email: gymData.email || null,
          description: gymData.description || null,
          logo_url: gymData.logo_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.gym_id);

      if (error) throw error;

      await refreshGym();
      setIsEditing(false);
      Alert.alert("Success", "Gym updated successfully! ✅");
    } catch (err) {
      console.error("Error updating gym:", err);
      Alert.alert("Error", "Failed to update gym");
    }

    setIsSaving(false);
  };

  const handleSave = () => {
    if (hasGym) updateGym();
    // else createGym();
  };

  const handleCancel = () => {
    loadGymData();
    setIsEditing(false);
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        signOut();
      }
    } else {
      Alert.alert(
        "Logout",
        "Are you sure you want to logout?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Logout", style: "destructive", onPress: () => signOut() }
        ]
      );
    }
  };

  const calculateProgress = () => {
    const totalDays = Math.ceil(
      (new Date(subscription.end_date).getTime() - new Date(subscription.start_date).getTime()) /
      (1000 * 60 * 60 * 24)
    );
    const elapsed = totalDays - subscription.days_remaining;
    return (elapsed / totalDays) * 100;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Regular',
    },
    header: {
      padding: 24,
      paddingTop: Platform.OS === 'ios' ? 16 : 24,
      backgroundColor: theme.colors.card,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
    },
    logoutButton: {
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.error + '15',
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontFamily: 'Inter-Regular',
    },

    // Profile Header Card
    profileCard: {
      marginHorizontal: 24,
      marginTop: 16,
      marginBottom: 16,
      padding: 24,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    logoContainer: {
      position: 'relative',
      marginRight: 20,
    },
    gymLogo: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: theme.colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: theme.colors.primary + '30',
    },
    logoImage: {
      width: 96,
      height: 96,
      borderRadius: 48,
    },
    uploadButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: theme.colors.primary,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: theme.colors.card,
    },
    profileInfo: {
      flex: 1,
    },
    ownerSection: {
      marginBottom: 8,
    },
    ownerLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Medium',
      marginBottom: 4,
    },
    ownerNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    ownerName: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
      flex: 1,
    },
    ownerInput: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.primary,
      paddingVertical: 4,
    },
    editIconButton: {
      padding: 4,
    },
    gymNameLarge: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
      marginBottom: 4,
    },
    gymLocation: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontFamily: 'Inter-Regular',
    },



    // Subscription Card
    subscriptionCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 24,
      backgroundColor: theme.colors.primary,
      borderRadius: 20,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    subscriptionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    crownIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    subscriptionInfo: {
      flex: 1,
    },
    subscriptionPlan: {
      fontSize: 22,
      fontWeight: '800',
      color: '#FFFFFF',
      fontFamily: 'Inter-Bold',
      marginBottom: 4,
    },
    subscriptionStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
      fontFamily: 'Inter-SemiBold',
    },
    subscriptionGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    subStatItem: {
      flex: 1,
    },
    subStatLabel: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
      fontFamily: 'Inter-Medium',
      marginBottom: 6,
    },
    subStatValue: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: 'Inter-Bold',
    },
    progressSection: {
      marginTop: 8,
    },
    progressBar: {
      height: 8,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#FFFFFF',
      borderRadius: 4,
    },
    progressText: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.9)',
      fontFamily: 'Inter-Medium',
    },

    // Form Card
    formCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 24,
    },
    formTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 20,
      fontFamily: 'Inter-Bold',
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    inputLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      fontFamily: 'Inter-SemiBold',
    },
    input: {
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      fontFamily: 'Inter-Regular',
    },
    inputDisabled: {
      backgroundColor: theme.colors.background,
      color: theme.colors.textSecondary,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    inputRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    inputHalf: {
      flex: 1,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
    },
    cancelButton: {
      flex: 1,
    },
    saveButton: {
      flex: 1,
    },

    // Stats Card
    statsCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 24,
    },
    statsTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 20,
      fontFamily: 'Inter-Bold',
    },
    statsGrid: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statIconBox: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 6,
      fontFamily: 'Inter-Bold',
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      fontFamily: 'Inter-Medium',
    },
    statDivider: {
      width: 1,
      height: 60,
      backgroundColor: theme.colors.border,
      marginHorizontal: 16,
    },

    // Theme Card
    themeCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 20,
    },
    themeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    themeTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
    },

    // No Gym Card
    noGymCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 48,
      alignItems: 'center',
    },
    noGymTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
      marginTop: 20,
      marginBottom: 10,
      fontFamily: 'Inter-Bold',
    },
    noGymText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
    },
    createButton: {
      minWidth: 200,
    },
  });

  if (isLoading && !refreshing) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading gym profile...</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Building2 size={32} color={theme.colors.primary} />
              <Text style={styles.title}>Gym Profile</Text>
            </View>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <LogOut size={24} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            {hasGym ? 'Manage your gym information' : 'Create your gym profile'}
          </Text>
        </View>

        {/* PROFILE HEADER CARD */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.logoContainer}>
              <View style={styles.gymLogo}>
                {gymData.logo_url ? (
                  <Image
                    source={{ uri: gymData.logo_url }}
                    style={styles.logoImage}
                    onError={(error) => {
                      console.log('Image load error:', error);
                      setGymData(prev => ({ ...prev, logo_url: '' }));
                    }}
                  />
                ) : (
                  <Building2 size={48} color={theme.colors.primary} />
                )}
              </View>
              {hasGym && (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={pickImage}
                  disabled={uploadingLogo}
                  activeOpacity={0.7}
                >
                  {uploadingLogo ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Upload size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.ownerSection}>
                <Text style={styles.ownerLabel}>Owner</Text>
                {isEditingOwner ? (
                  <View style={styles.ownerNameRow}>
                    <TextInput
                      style={styles.ownerInput}
                      value={ownerName}
                      onChangeText={setOwnerName}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={styles.editIconButton}
                      onPress={updateOwnerName}
                    >
                      <CheckCircle size={24} color={theme.colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editIconButton}
                      onPress={() => {
                        setOwnerName(profile?.full_name || "");
                        setIsEditingOwner(false);
                      }}
                    >
                      <AlertCircle size={24} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.ownerNameRow}>
                    <Text style={styles.ownerName}>{profile?.full_name || "Owner"}</Text>
                    <TouchableOpacity
                      style={styles.editIconButton}
                      onPress={() => setIsEditingOwner(true)}
                    >
                      <User size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <Text style={styles.gymNameLarge}>{gymData.name || 'Your Gym Name'}</Text>
              <Text style={styles.gymLocation}>
                {gymData.location || 'Location not set'}
              </Text>
            </View>
          </View>
        </Card>

        {/* APP SUBSCRIPTION CARD */}
        {hasGym && (
          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.crownIcon}>
                <Crown size={28} color="#FFFFFF" />
              </View>
              <View style={styles.subscriptionInfo}>
                <Text style={styles.subscriptionPlan}>{subscription.plan_name}</Text>
                <View style={styles.subscriptionStatus}>
                  <View style={styles.statusBadge}>
                    <CheckCircle size={14} color="#FFFFFF" />
                    <Text style={styles.statusText}>
                      {subscription.status === 'active' ? 'Active' : 'Expired'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.subscriptionGrid}>
              <View style={styles.subStatItem}>
                <Text style={styles.subStatLabel}>Amount Paid</Text>
                <Text style={styles.subStatValue}>₹{subscription.amount_paid.toLocaleString()}</Text>
              </View>
              <View style={styles.subStatItem}>
                <Text style={styles.subStatLabel}>Days Remaining</Text>
                <Text style={styles.subStatValue}>{subscription.days_remaining} days</Text>
              </View>
            </View>

            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${calculateProgress()}%` }]} />
              </View>
              <Text style={styles.progressText}>
                Valid till {new Date(subscription.end_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </Text>
            </View>
          </View>
        )}

        {/* GYM DETAILS FORM */}
        <Card style={styles.formCard}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20
          }}>
            <Text style={styles.formTitle}>
              {hasGym ? 'Gym Information' : 'Setup Your Gym'}
            </Text>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: isEditing ? theme.colors.error + '15' : theme.colors.primary + '15',
              }}
              onPress={() => isEditing ? handleCancel() : setIsEditing(true)}
              activeOpacity={0.7}
            >
              {isEditing ? (
                <>
                  <X size={18} color={theme.colors.error} />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: theme.colors.error,
                    fontFamily: 'Inter-SemiBold'
                  }}>
                    Cancel
                  </Text>
                </>
              ) : hasGym ? (
                <>
                  <Edit size={18} color={theme.colors.primary} />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: theme.colors.primary,
                    fontFamily: 'Inter-SemiBold'
                  }}>
                    Edit
                  </Text>
                </>
              ) : (
                <>
                  {!hasGym && !isEditing && profile?.role === 'gym_owner' && (
                    <Card style={styles.noGymCard}>
                      <AlertCircle size={72} color={theme.colors.error} />
                      <Text style={styles.noGymTitle}>Gym Profile Not Found</Text>
                      <Text style={styles.noGymText}>
                        Your gym profile should have been created during registration.
                        Please contact support or try logging out and back in.
                      </Text>
                      <Button
                        title="Refresh"
                        onPress={onRefresh}
                        style={styles.createButton}
                      />
                    </Card>
                  )}
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Building2 size={20} color={theme.colors.textSecondary} />
              <Text style={styles.inputLabel}>Gym Name *</Text>
            </View>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              placeholder="Enter gym name"
              placeholderTextColor={theme.colors.textSecondary}
              value={gymData.name}
              onChangeText={(text) => setGymData({ ...gymData, name: text })}
              editable={isEditing}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <MapPin size={20} color={theme.colors.textSecondary} />
              <Text style={styles.inputLabel}>Location</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea, !isEditing && styles.inputDisabled]}
              placeholder="Enter gym address"
              placeholderTextColor={theme.colors.textSecondary}
              value={gymData.location}
              onChangeText={(text) => setGymData({ ...gymData, location: text })}
              multiline
              numberOfLines={3}
              editable={isEditing}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <View style={styles.inputHeader}>
                <Phone size={20} color={theme.colors.textSecondary} />
                <Text style={styles.inputLabel}>Phone</Text>
              </View>
              <TextInput
                style={[styles.input, !isEditing && styles.inputDisabled]}
                placeholder="Phone number"
                placeholderTextColor={theme.colors.textSecondary}
                value={gymData.phone}
                onChangeText={(text) => setGymData({ ...gymData, phone: text })}
                keyboardType="phone-pad"
                editable={isEditing}
              />
            </View>

            <View style={styles.inputHalf}>
              <View style={styles.inputHeader}>
                <Mail size={20} color={theme.colors.textSecondary} />
                <Text style={styles.inputLabel}>Email</Text>
              </View>
              <TextInput
                style={[styles.input, !isEditing && styles.inputDisabled]}
                placeholder="Contact email"
                placeholderTextColor={theme.colors.textSecondary}
                value={gymData.email}
                onChangeText={(text) => setGymData({ ...gymData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={isEditing}
              />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <FileText size={20} color={theme.colors.textSecondary} />
              <Text style={styles.inputLabel}>Description</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea, !isEditing && styles.inputDisabled]}
              placeholder="Describe your gym, facilities, and services"
              placeholderTextColor={theme.colors.textSecondary}
              value={gymData.description}
              onChangeText={(text) => setGymData({ ...gymData, description: text })}
              multiline
              numberOfLines={4}
              editable={isEditing}
            />


          </View>

          {isEditing && (
            <View style={styles.actionButtons}>
              <Button
                title="Cancel"
                onPress={handleCancel}
                variant="outline"
                style={styles.cancelButton}
              />
              <Button
                title={hasGym ? 'Save Changes' : 'Create Gym'}
                onPress={handleSave}
                isLoading={isSaving}
                style={styles.saveButton}
              />
            </View>
          )}
        </Card>

        {/* QUICK STATS */}
        {hasGym && gymData.created_at && (
          <Card style={styles.statsCard}>
            <Text style={styles.statsTitle}>Quick Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <View style={[styles.statIconBox, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Calendar size={24} color={theme.colors.primary} />
                </View>
                <Text style={styles.statValue}>
                  {new Date(gymData.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </Text>
                <Text style={styles.statLabel}>Established</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <View style={[styles.statIconBox, { backgroundColor: theme.colors.success + '20' }]}>
                  <CheckCircle size={24} color={theme.colors.success} />
                </View>
                <Text style={styles.statValue}>Active</Text>
                <Text style={styles.statLabel}>Status</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <View style={[styles.statIconBox, { backgroundColor: theme.colors.warning + '20' }]}>
                  <TrendingUp size={24} color={theme.colors.warning} />
                </View>
                <Text style={styles.statValue}>
                  {Math.floor(
                    (Date.now() - new Date(gymData.created_at).getTime()) /
                    (1000 * 60 * 60 * 24)
                  )}
                </Text>
                <Text style={styles.statLabel}>Days Running</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Theme Picker */}
        <Card style={styles.themeCard}>
          <View style={styles.themeHeader}>
            <Moon size={24} color={theme.colors.primary} />
            <Text style={styles.themeTitle}>App Theme</Text>
          </View>
          <ThemePicker />
        </Card>

        {/* NO GYM STATE */}
        {!hasGym && !isEditing && (
          <Card style={styles.noGymCard}>
            <Building2 size={72} color={theme.colors.textSecondary} />
            <Text style={styles.noGymTitle}>No Gym Profile Yet</Text>
            <Text style={styles.noGymText}>
              Create your gym profile to start managing members, subscriptions, and operations
            </Text>
            <Button
              title="Create Gym Profile"
              onPress={() => setIsEditing(true)}
              style={styles.createButton}
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaWrapper>
  );
}