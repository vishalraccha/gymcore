import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Moon, Check, ChevronDown } from 'lucide-react-native';

export default function ThemePicker() {
  const { theme, setTheme, availableThemes } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const currentTheme = availableThemes.find(t => t.id === theme.id) || availableThemes[0];

  return (
    <>
      {/* Dropdown Button */}
      <TouchableOpacity
        style={[styles.dropdownButton, { 
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <View style={styles.leftSection}>
          <Moon size={20} color={theme.colors.textSecondary} />
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Theme
          </Text>
        </View>

        <View style={styles.rightSection}>
          <View style={styles.indicators}>
            {currentTheme.indicators.map((color, index) => (
              <View
                key={index}
                style={[styles.indicator, { backgroundColor: color }]}
              />
            ))}
          </View>
          <ChevronDown size={20} color={theme.colors.textSecondary} />
        </View>
      </TouchableOpacity>

      {/* Modal Popup */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={styles.modalBackdrop}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                    Choose Theme
                  </Text>
                </View>

                {/* Scrollable Theme List */}
                <ScrollView 
                  style={styles.scrollView}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {availableThemes.map((t) => {
                    const isSelected = theme.id === t.id;
                    
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.themeItem,
                          { 
                            backgroundColor: isSelected 
                              ? theme.colors.primary + '10' 
                              : 'transparent',
                            borderColor: isSelected 
                              ? theme.colors.primary 
                              : theme.colors.border,
                          }
                        ]}
                        onPress={() => {
                          setTheme(t.id);
                          setTimeout(() => setModalVisible(false), 300);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.themeInfo}>
                          <Text style={[
                            styles.themeName, 
                            { 
                              color: isSelected 
                                ? theme.colors.primary 
                                : theme.colors.text,
                              fontWeight: isSelected ? '700' : '600',
                            }
                          ]}>
                            {t.name}
                          </Text>
                          
                          <View style={styles.themeIndicators}>
                            {t.indicators.map((color, index) => (
                              <View
                                key={index}
                                style={[
                                  styles.themeIndicator, 
                                  { backgroundColor: color }
                                ]}
                              />
                            ))}
                          </View>
                        </View>

                        {isSelected && (
                          <Check 
                            size={20} 
                            color={theme.colors.primary} 
                            strokeWidth={3}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Close Button */}
                <TouchableOpacity
                  style={[styles.closeButton, { backgroundColor: theme.colors.border }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Dropdown Button Styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  indicators: {
    flexDirection: 'row',
    gap: 6,
  },
  indicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    maxHeight: '80%',
  },
  modalHeader: {
    marginBottom: 16,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 400,
  },

  // Theme Item Styles
  themeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
  },
  themeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  themeName: {
    fontSize: 16,
    minWidth: 100,
  },
  themeIndicators: {
    flexDirection: 'row',
    gap: 6,
  },
  themeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },

  // Close Button
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});