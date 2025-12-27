import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Crown, Zap, CheckCircle, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface PremiumLockModalProps {
  visible: boolean;
  onClose: () => void;
  feature?: string;
}

export default function PremiumLockModal({
  visible,
  onClose,
  feature = 'this feature',
}: PremiumLockModalProps) {
  const router = useRouter();
  const { theme } = useTheme();

  const handleViewPlans = () => {
    onClose();
    router.push('/plans');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.modalContainer}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
              {/* Close Button */}
              <TouchableOpacity 
                style={[styles.closeButton, { backgroundColor: theme.colors.border }]}
                onPress={onClose}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              {/* Icon */}
              <View style={styles.iconContainer}>
                <View style={[styles.iconBackground, { backgroundColor: theme.colors.primaryLight + '30' }]}>
                  <Lock size={32} color={theme.colors.primary} />
                </View>
              </View>

              {/* Title */}
              <View style={styles.titleContainer}>
                <Crown size={20} color={theme.colors.warning} />
                <Text style={[styles.title, { color: theme.colors.text }]}>Premium Feature</Text>
              </View>

              {/* Description */}
              <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                Subscribe to unlock {feature} and get access to all premium features
              </Text>

              {/* Features List */}
              <View style={styles.featuresList}>
                <FeatureItem text="Unlimited Workouts" />
                <FeatureItem text="Personalized Diet Plans" />
                <FeatureItem text="Progress Analytics" />
                <FeatureItem text="Premium Support" />
              </View>

              {/* CTA Button */}
              <TouchableOpacity
                style={[styles.premiumButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleViewPlans}
              >
                <Zap size={20} color={theme.colors.card} />
                <Text style={[styles.premiumButtonText, { color: theme.colors.card }]}>View Plans</Text>
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function FeatureItem({ text }: { text: string }) {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.featureItem, { backgroundColor: theme.colors.success + '20' }]}>
      <CheckCircle size={16} color={theme.colors.success} />
      <Text style={[styles.featureText, { color: theme.colors.success }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  featuresList: {
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
  },
  premiumButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  premiumButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  cancelButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});