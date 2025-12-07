import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Modal,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/Card";

import {
  User,
  Bell,
  Moon,
  QrCode,
  CircleHelp,
  Shield,
  FileText,
  LogOut,
  Crown,
  Trophy,
  Star,
  Flame,
} from "lucide-react-native";

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();

  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Fallback profile
  const safe = profile || {
    full_name: "User",
    email: "user@example.com",
    level: 1,
    total_points: 0,
    current_streak: 0,
    max_streak: 0,
    role: "member",
  };

  const handleLogout = () => {
    console.log("⚠️ Logout button pressed");
    setShowLogoutModal(true); // Now modal shows on ALL platforms
  };

  // Level progress calculation
  const POINTS_PER_LEVEL = 1000;
  const progressPercent =
    ((safe.total_points % POINTS_PER_LEVEL) / POINTS_PER_LEVEL) * 100;
  const xpToNextLevel =
    POINTS_PER_LEVEL - (safe.total_points % POINTS_PER_LEVEL);

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your account and preferences</Text>
        </View>

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <User size={32} color="#fff" />
            </View>

            <View style={styles.profileText}>
              <Text style={styles.userName}>{safe.full_name}</Text>
              <Text style={styles.userEmail}>{safe.email}</Text>
              <Text style={styles.levelInfo}>
                Level {safe.level} • {safe.total_points} XP
              </Text>
            </View>
          </View>

          {/* Progress */}
          <Text style={styles.progressTitle}>
            {xpToNextLevel} XP to next level
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressPercent}%` }]}
            />
          </View>
        </Card>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <View style={styles.statsGrid}>
            <StatItem
              label="Best Streak"
              value={safe.max_streak}
              icon={<Trophy size={22} color="#EF4444" />}
            />
            <StatItem
              label="Current Streak"
              value={safe.current_streak}
              icon={<Flame size={22} color="#F97316" />}
            />
            <StatItem
              label="Total XP"
              value={safe.total_points}
              icon={<Star size={22} color="#F59E0B" />}
            />
            <StatItem
              label="Level"
              value={safe.level}
              icon={<Crown size={22} color="#8B5CF6" />}
            />
          </View>
        </View>

        {/* Preferences */}
        <Card style={styles.menuCard}>
          <MenuItem
            title="Notifications"
            icon={<Bell size={20} color="#64748B" />}
            right={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
              />
            }
          />

          <MenuItem
            title="Dark Mode"
            icon={<Moon size={20} color="#64748B" />}
            right={<Switch value={darkMode} onValueChange={setDarkMode} />}
          />
        </Card>

        {/* Account */}
        <Card style={styles.menuCard}>
          <MenuItem
            title="QR Code"
            icon={<QrCode size={20} color="#64748B" />}
          />
          <MenuItem
            title="Help & Support"
            icon={<CircleHelp size={20} color="#64748B" />}
          />
        </Card>

        {/* Legal */}
        <Card style={styles.menuCard}>
          <MenuItem
            title="Privacy Policy"
            icon={<Shield size={20} color="#64748B" />}
          />
          <MenuItem
            title="Terms of Service"
            icon={<FileText size={20} color="#64748B" />}
          />
        </Card>

        {/* Logout Button */}
        <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
          <Pressable
            onPress={handleLogout}
            style={styles.logoutButton}
          >
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Universal Logout Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalMessage}>
              Do you really want to logout?
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
                  console.log("⚠️ Logout confirmed → Calling signOut()");
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
    </>
  );
}

/* Menu item component */
function MenuItem({ title, icon, right }: any) {
  return (
    <View style={styles.menuItem}>
      <View style={styles.menuLeft}>
        {icon}
        <Text style={styles.menuText}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

/* Stat card */
function StatItem({ label, value, icon }: any) {
  return (
    <View style={styles.statItem}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  header: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: "bold", color: "#0F172A" },
  subtitle: { fontSize: 14, color: "#64748B", marginTop: 4 },

  profileCard: { margin: 24, padding: 20 },
  profileHeader: { flexDirection: "row", alignItems: "center" },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },

  profileText: { flex: 1 },
  userName: { fontSize: 20, fontWeight: "bold", color: "#0F172A" },
  userEmail: { color: "#64748B", marginTop: 4 },
  levelInfo: { marginTop: 4, color: "#3B82F6", fontWeight: "600" },

  progressTitle: { color: "#3B82F6", marginTop: 12 },
  progressBar: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    marginTop: 6,
  },
  progressFill: {
    height: 8,
    backgroundColor: "#3B82F6",
    borderRadius: 4,
  },

  section: { paddingHorizontal: 24, marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 12 },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  statItem: {
    width: "47%",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    marginBottom: 14,
  },

  statValue: { fontSize: 20, fontWeight: "bold", marginTop: 6 },
  statLabel: { color: "#64748B", marginTop: 2 },

  menuCard: { marginHorizontal: 24, marginBottom: 12, paddingVertical: 6 },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
  },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuText: { fontSize: 16, color: "#374151" },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  logoutText: {
    marginLeft: 8,
    color: "#EF4444",
    fontWeight: "600",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    width: "80%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: "center",
    color: "#555",
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 10,
    marginRight: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 16,
    color: "#374151",
  },
  modalLogout: {
    flex: 1,
    paddingVertical: 10,
    marginLeft: 8,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    alignItems: "center",
  },
  modalLogoutText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});
