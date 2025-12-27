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
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Profile, WorkoutLog, DietLog, Attendance } from '@/types/database';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
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
} from 'lucide-react-native';

interface MemberDetails extends Profile {
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
}

export default function MembersScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [members, setMembers] = useState<MemberDetails[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberDetails | null>(
    null
  );
  const [newMember, setNewMember] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile?.role === 'admin' || profile?.role === 'gym_owner') {
      fetchMembers();
    }
  }, [profile]);

  // Filter members when search query or members change
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMembers(members);
    } else {
      const filtered = members.filter(
        (member) =>
          member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (member.phone && member.phone.includes(searchQuery))
      );
      setFilteredMembers(filtered);
    }
  }, [searchQuery, members]);

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

      const { data, error } = await query.order('created_at', {
        ascending: false,
      });

      if (error) throw error;

      const membersWithStats = await Promise.all(
        (data || []).map(async (member) => {
          const stats = await fetchMemberStats(member.id);
          return { ...member, stats };
        })
      );

      setMembers(membersWithStats);
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
      const totalCaloriesBurned =
        workoutLogs?.reduce(
          (sum, log) => sum + Number(log.calories_burned),
          0
        ) || 0;
      const totalMinutes =
        workoutLogs?.reduce((sum, log) => sum + log.duration_minutes, 0) || 0;
      const totalMeals = dietLogs?.length || 0;
      const avgSessionDuration =
        totalWorkouts > 0 ? Math.round(totalMinutes / totalWorkouts) : 0;
      const lastWorkout = workoutLogs?.[0]?.completed_at || '';

      return {
        totalWorkouts,
        totalCaloriesBurned: Math.round(totalCaloriesBurned),
        totalMinutes,
        totalMeals,
        avgSessionDuration,
        lastWorkout,
      };
    } catch (error) {
      console.error('Error fetching member stats:', error);
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

      const { data: workoutLogs } = await supabase
        .from('workout_logs')
        .select('*, workouts(name, category, muscle_group)')
        .eq('user_id', memberId)
        .order('completed_at', { ascending: false })
        .limit(10);

      const { data: dietLogs } = await supabase
        .from('diet_logs')
        .select('*')
        .eq('user_id', memberId)
        .order('logged_at', { ascending: false })
        .limit(10);

      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', memberId)
        .order('check_in_time', { ascending: false })
        .limit(10);

      const stats = await fetchMemberStats(memberId);

      setSelectedMember({
        ...memberData,
        workout_logs: workoutLogs || [],
        diet_logs: dietLogs || [],
        attendance: attendance || [],
        stats,
      });
      setShowMemberDetails(true);
    } catch (error) {
      console.error('Error fetching member details:', error);
      Alert.alert('Error', 'Failed to fetch member details');
    } finally {
      setIsLoading(false);
    }
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

    setIsLoading(true);

    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newMember.email,
        password: newMember.password,
        options: {
          data: {
            full_name: newMember.full_name,
            phone: newMember.phone || null,
            role: 'member',
            gym_id: profile?.gym_id ? String(profile.gym_id) : null, // FIXED
          },
        },
      });


      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Failed to create user');
      }

      // Wait a moment for the trigger to create the profile
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setNewMember({
        full_name: '',
        email: '',
        phone: '',
        password: '',
      });
      setShowAddMember(false);
      await fetchMembers();
      Alert.alert(
        'Success',
        `Member ${newMember.full_name} added successfully! They can now login with their email and password.`
      );
    } catch (error) {
      console.error('Error adding member:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to add member';
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
      `Are you sure you want to delete ${memberName}? This action cannot be undone and will delete all their data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from auth.users (this will cascade delete profile due to FK)
              const { error } = await supabase.rpc('delete_user', {
                user_id: memberId,
              });

              if (error) {
                // Fallback: delete profile directly
                const { error: profileError } = await supabase
                  .from('profiles')
                  .delete()
                  .eq('id', memberId);

                if (profileError) throw profileError;
              }

              setShowMemberDetails(false);
              await fetchMembers();
              Alert.alert('Success', 'Member deleted successfully');
            } catch (error) {
              console.error('Delete error:', error);
              const errorMessage = error instanceof Error ? error.message : 'Failed to delete member';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: 24,
      paddingTop: Platform.OS === 'ios' ? 16 : 24,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    searchContainer: {
      paddingHorizontal: 24,
      marginBottom: 24,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    noMembersCard: {
      marginHorizontal: 24,
      alignItems: 'center',
      paddingVertical: 48,
    },
    noMembersText: {
      fontSize: 18,
      fontWeight: '600',
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
      marginHorizontal: 24,
      marginBottom: 12,
      padding: 16,
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
    memberAvatarLarge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberDetails: {
      flex: 1,
    },
    memberName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    memberContact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
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
    memberStats: {
      alignItems: 'flex-end',
    },
    memberLevel: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    memberStreak: {
      fontSize: 12,
      color: theme.colors.warning,
      marginTop: 2,
    },
    viewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primaryLight + '30',
      paddingHorizontal: 12,
      paddingVertical: 6,
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
      bottom: (Platform.OS === 'ios' ? 0 : 0) + 24 + 57,
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
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.card,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 24,
      paddingTop: Platform.OS === 'ios' ? 16 : 24,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    modalContent: {
      flex: 1,
      padding: 24,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      marginBottom: 20,
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
    },
    helperText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 20,
      lineHeight: 20,
    },
    addButton: {
      marginTop: 8,
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
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 16,
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
  });

  return (
    <SafeAreaWrapper>
    <View style={styles.container}>
      <ScrollView
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
        <View style={styles.header}>
          <Text style={styles.title}>Members</Text>
          <Text style={styles.subtitle}>
            Manage your gym members ({members.length} total)
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={20} color={theme.colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.colors.textSecondary}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Members List */}
        {filteredMembers.length === 0 ? (
          <Card style={styles.noMembersCard}>
            <User size={48} color={theme.colors.textSecondary} />
            <Text style={styles.noMembersText}>
              {searchQuery ? 'No members found' : 'No members yet'}
            </Text>
            <Text style={styles.noMembersSubtext}>
              {searchQuery
                ? 'Try adjusting your search'
                : 'Add your first member to get started'}
            </Text>
          </Card>
        ) : (
          filteredMembers.map((member) => (
            <Card key={member.id} style={styles.memberCard}>
              <View style={styles.memberInfo}>
                <View style={styles.memberAvatar}>
                  <User size={24} color={theme.colors.card} />
                </View>
                <View style={styles.memberDetails}>
                  <Text style={styles.memberName}>{member.full_name}</Text>
                  <View style={styles.memberContact}>
                    <Mail size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.memberEmail}>{member.email}</Text>
                  </View>
                  {member.phone && (
                    <View style={styles.memberContact}>
                      <Phone size={14} color={theme.colors.textSecondary} />
                      <Text style={styles.memberPhone}>{member.phone}</Text>
                    </View>
                  )}

                  {/* Member Stats */}
                  <View style={styles.memberStatsRow}>
                    <View style={styles.statItem}>
                      <Activity size={12} color={theme.colors.primary} />
                      <Text style={styles.statText}>
                        {member.stats?.totalWorkouts || 0} workouts
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Flame size={12} color={theme.colors.error} />
                      <Text style={styles.statText}>
                        {member.stats?.totalCaloriesBurned || 0} cal
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.memberActions}>
                  <View style={styles.memberStats}>
                    <Text style={styles.memberLevel}>Lv. {member.level}</Text>
                    <Text style={styles.memberStreak}>
                      {member.current_streak}🔥
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => fetchMemberDetails(member.id as string)}
                  >
                    <Eye size={16} color={theme.colors.primary} />
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Add Member FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddMember(true)}
      >
        <Plus size={24} color={theme.colors.card} />
      </TouchableOpacity>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMember}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddMember(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add New Member</Text>
            <TouchableOpacity onPress={() => setShowAddMember(false)}>
              <X size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter full name"
              value={newMember.full_name}
              onChangeText={(text) =>
                setNewMember({ ...newMember, full_name: text })
              }
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.inputLabel}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email address"
              value={newMember.email}
              onChangeText={(text) =>
                setNewMember({ ...newMember, email: text })
              }
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.inputLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter phone number (optional)"
              value={newMember.phone}
              onChangeText={(text) =>
                setNewMember({ ...newMember, phone: text })
              }
              keyboardType="phone-pad"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.inputLabel}>Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password (min 6 characters)"
              value={newMember.password}
              onChangeText={(text) =>
                setNewMember({ ...newMember, password: text })
              }
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.helperText}>
              The member will use this email and password to login to the app.
            </Text>

            <Button
              title="Add Member"
              onPress={addMember}
              isLoading={isLoading}
              style={styles.addButton}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Member Details Modal */}
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
    </View>
    </SafeAreaWrapper>
  );
}

