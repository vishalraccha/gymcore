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
  Platform
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import SafeAreaWrapper from "@/components/SafeAreaWrapper";
import ThemePicker from "@/components/ThemePicker";
import { Building2, MapPin, Phone, Mail, FileText, LogOut, Moon } from "lucide-react-native";

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

  const [hasGym, setHasGym] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGymData();
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGymData();
    setRefreshing(false);
  };

  const loadGymData = async () => {
    console.log("📌 Loading gym data…");

    if (!profile) {
      console.log("⚠ No profile found");
      setIsLoading(false);
      return;
    }

    if (!profile.gym_id) {
      console.log("ℹ No gym assigned yet");
      setHasGym(false);
      setIsLoading(false);
      return;
    }

    try {
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

      console.log("✅ Gym loaded:", data);
      setHasGym(true);
    } catch (err) {
      console.error("❌ Error loading gym:", err);
      setHasGym(false);
    }

    setIsLoading(false);
  };

  const createGym = async () => {
    if (!gymData.name.trim()) {
      Alert.alert("Missing Field", "Gym name is required.");
      return;
    }

    if (!profile?.id) {
      Alert.alert("Error", "Profile not loaded.");
      return;
    }

    setIsSaving(true);

    try {
      console.log("📌 Creating gym…");

      const { data: newGym, error: gymError } = await supabase
        .from("gyms")
        .insert([
          {
            name: gymData.name,
            location: gymData.location || null,
            phone: gymData.phone || null,
            email: gymData.email || null,
            description: gymData.description || null,
            logo_url: gymData.logo_url || null,
            owner_id: profile.id,
          },
        ])
        .select()
        .single();

      if (gymError) throw gymError;

      console.log("✅ Gym created:", newGym);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          gym_id: newGym.id,
          role: "gym_owner",
        })
        .eq("id", profile.id);

      if (profileError) throw profileError;

      console.log("🔄 Profile updated with gym_id");

      await refreshProfile();
      await refreshGym();

      setHasGym(true);
      setIsEditing(false);
      Alert.alert("Success", "Gym created successfully! 🎉");
    } catch (err) {
      console.error("❌ Error creating gym:", err);
      Alert.alert("Error", (err instanceof Error ? err.message : "Failed to create gym") || "Failed to create gym");
    }

    setIsSaving(false);
  };

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
      console.log("📌 Updating gym…");

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
      console.error("❌ Error updating gym:", err);
      Alert.alert("Error", (err instanceof Error ? err.message : "Failed to update gym") || "Failed to update gym");
    }

    setIsSaving(false);
  };

  const handleSave = () => {
    if (hasGym) updateGym();
    else createGym();
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
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await signOut();
          }
        }
      ]
    );
  }
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
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    title: {
      flex: 1,
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      fontFamily: 'Inter-Bold',
    },
    logoutButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.error + '20',
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginTop: 4,
      fontFamily: 'Inter-Regular',
    },
    overviewCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 24,
    },
    gymHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    gymLogo: {
      width: 80,
      height: 80,
      borderRadius: 16,
      backgroundColor: theme.colors.primaryLight + '30',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    logoPlaceholder: {
      fontSize: 40,
    },
    gymInfo: {
      flex: 1,
    },
    gymName: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
      fontFamily: 'Inter-Bold',
    },
    gymLocation: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 2,
      fontFamily: 'Inter-Regular',
    },
    ownerName: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '600',
      fontFamily: 'Inter-SemiBold',
    },
    editButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    editButtonText: {
      color: theme.colors.card,
      fontWeight: '600',
      fontSize: 14,
      fontFamily: 'Inter-SemiBold',
    },
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
      marginBottom: 8,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      fontFamily: 'Inter-SemiBold',
    },
    input: {
      borderWidth: 1,
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
      minHeight: 80,
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
    statsCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 24,
    },
    statsTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 16,
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
    statDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.colors.border,
      marginHorizontal: 16,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.primary,
      marginBottom: 4,
      fontFamily: 'Inter-Bold',
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      fontFamily: 'Inter-Regular',
    },
    noGymCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 40,
      alignItems: 'center',
    },
    noGymTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8,
      fontFamily: 'Inter-Bold',
    },
    noGymText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
      fontFamily: 'Inter-Regular',
    },
    createButton: {
      minWidth: 200,
    },
    logoutCard: {
      marginHorizontal: 24,
      marginBottom: 16,
      padding: 16,
    },
    logoutButtonFull: {
      borderColor: theme.colors.error,
    },
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
          <Building2 size={32} color={theme.colors.primary} />
          <Text style={styles.title}>Gym Profile</Text>
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

      {/* GYM OVERVIEW CARD */}
      <Card style={styles.overviewCard}>
        <View style={styles.gymHeader}>
          <View style={styles.gymLogo}>
            {gymData.logo_url ? (
              <Text style={styles.logoPlaceholder}>🏋️</Text>
            ) : (
              <Building2 size={48} color={theme.colors.primary} />
            )}
          </View>
          <View style={styles.gymInfo}>
            <Text style={styles.gymName}>{gymData.name || 'Your Gym Name'}</Text>
            <Text style={styles.gymLocation}>
              {gymData.location || 'Location not set'}
            </Text>
            <Text style={styles.ownerName}>Owner: {profile?.full_name}</Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => isEditing ? handleCancel() : setIsEditing(true)}
          >
            <Text style={styles.editButtonText}>
              {isEditing ? 'Cancel' : hasGym ? 'Edit' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Theme Picker */}
      <Card style={styles.themeCard}>
        <View style={styles.themeHeader}>
          <Moon size={24} color={theme.colors.primary} />
          <Text style={styles.themeTitle}>App Theme</Text>
        </View>
        <ThemePicker />
      </Card>

      {/* GYM DETAILS FORM */}
      <Card style={styles.formCard}>
        <Text style={styles.formTitle}>
          {hasGym ? 'Gym Information' : 'Setup Your Gym'}
        </Text>
        
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
            textAlignVertical="top"
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
            textAlignVertical="top"
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
              <Text style={styles.statValue}>
                {new Date(gymData.created_at).toLocaleDateString()}
              </Text>
              <Text style={styles.statLabel}>Established</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Active</Text>
              <Text style={styles.statLabel}>Status</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
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

      {!hasGym && !isEditing && (
        <Card style={styles.noGymCard}>
          <Building2 size={64} color={theme.colors.textSecondary} />
          <Text style={styles.noGymTitle}>No Gym Profile Yet</Text>
          <Text style={styles.noGymText}>
            Create your gym profile to start managing members and operations
          </Text>
          <Button
            title="Create Gym Profile"
            onPress={() => setIsEditing(true)}
            style={styles.createButton}
          />
        </Card>
      )}

      {/* Logout Button at Bottom */}
      <Card style={styles.logoutCard}>
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutButtonFull}
        />
      </Card>
    </ScrollView>
    </SafeAreaWrapper>
  );
}