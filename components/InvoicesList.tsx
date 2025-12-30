// InvoicesList.tsx - Add this component to your Members Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  FileText,
  Download,
  X,
  Calendar,
  DollarSign,
  Building2,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Eye,
} from 'lucide-react-native';
import { formatRupees } from '@/lib/currency';
import { generateInvoiceHTML } from '@/lib/invoicePDF';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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

interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  gym_id?: string;
  payment_type: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  payment_status: string;
  invoice_date: string;
  due_date?: string;
  items: any[];
  payment_id?: string;
  subscription_id?: string;
  is_installment?: boolean;
  installment_number?: number;
  total_installments?: number;
  original_total_amount?: number;
  remaining_amount?: number;
  // Relations
  user?: {
    full_name: string;
    email: string;
    phone?: string;
  };
  gym?: {
    name: string;
    location?: string;
    phone?: string;
    email?: string;
  };
}

interface InvoicesListProps {
  userId: string;
  onRefresh?: () => void;
}

export default function InvoicesList({ userId, onRefresh }: InvoicesListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchInvoices();
    console.log('Fetching invoices for userId:', userId);

  }, [userId]);

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
  .from('invoices')
  .select(`
    *,
    gym:gyms(name, location, phone, email)
  `)
  .eq('user_id', userId)
  .order('invoice_date', { ascending: false });

        console.log('Invoices raw:', data, error);

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      Alert.alert('Error', 'Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      setIsDownloading(true);

      // Generate HTML
      const html = generateInvoiceHTML(invoice);

      // Create PDF
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      // Share or save PDF
      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice ${invoice.invoice_number}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Android
        await Sharing.shareAsync(uri);
      }

      Alert.alert('Success', 'Invoice downloaded successfully!');
    } catch (error) {
      console.error('Error downloading invoice:', error);
      Alert.alert('Error', 'Failed to download invoice');
    } finally {
      setIsDownloading(false);
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return {
          bg: COLORS.successLight,
          color: COLORS.success,
          icon: CheckCircle,
          text: 'Paid',
        };
      case 'partial':
        return {
          bg: COLORS.warningLight,
          color: COLORS.warning,
          icon: AlertCircle,
          text: 'Partial',
        };
      case 'pending':
        return {
          bg: COLORS.errorLight,
          color: COLORS.error,
          icon: AlertCircle,
          text: 'Pending',
        };
      default:
        return {
          bg: COLORS.border,
          color: COLORS.textSecondary,
          icon: AlertCircle,
          text: status,
        };
    }
  };

  const calculatePaidAmount = (invoice: Invoice) => {
    if (invoice.payment_status === 'completed' || invoice.payment_status === 'paid') {
      return invoice.total_amount;
    }
    if (invoice.original_total_amount && invoice.remaining_amount !== undefined) {
      return invoice.original_total_amount - invoice.remaining_amount;
    }
    return invoice.amount;
  };

  const calculateRemainingAmount = (invoice: Invoice) => {
    if (invoice.payment_status === 'completed' || invoice.payment_status === 'paid') {
      return 0;
    }
    if (invoice.remaining_amount !== undefined) {
      return invoice.remaining_amount;
    }
    if (invoice.original_total_amount) {
      return invoice.original_total_amount - invoice.amount;
    }
    return 0;
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Invoices</Text>
        <View style={styles.headerRight}>
          <Text style={styles.sectionCount}>{invoices.length}</Text>
        </View>
      </View>

      {invoices.length === 0 ? (
        <Card style={styles.emptyCard}>
          <FileText size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>No invoices yet</Text>
          <Text style={styles.emptySubtext}>Invoices will appear here</Text>
        </Card>
      ) : (
        invoices.map((invoice) => {
          const statusBadge = getPaymentStatusBadge(invoice.payment_status);
          const StatusIcon = statusBadge.icon;

          return (
            <Card key={invoice.id} style={styles.invoiceCard}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedInvoice(invoice);
                  setShowDetailModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.invoiceHeader}>
                  <View style={styles.invoiceIconContainer}>
                    <FileText size={20} color={COLORS.primary} />
                  </View>
                  <View style={styles.invoiceInfo}>
                    <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                    <Text style={styles.invoiceDate}>
                      {new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
                      <StatusIcon size={12} color={statusBadge.color} />
                      <Text style={[styles.statusText, { color: statusBadge.color }]}>
                        {statusBadge.text}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.invoiceRight}>
                    <Text style={styles.invoiceAmount}>
                      {formatRupees(invoice.total_amount)}
                    </Text>
                    <TouchableOpacity
                      style={styles.downloadButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDownloadInvoice(invoice);
                      }}
                      disabled={isDownloading}
                    >
                      <Download size={14} color={COLORS.primary} />
                      <Text style={styles.downloadText}>Download</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Card>
          );
        })
      )}

      {/* Invoice Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Invoice Details</Text>
                <Text style={styles.modalSubtitle}>{selectedInvoice?.invoice_number}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDetailModal(false)}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedInvoice && (
                <>
                  {/* Status Card */}
                  <Card style={styles.statusCard}>
                    <View style={styles.statusCardHeader}>
                      {(() => {
                        const badge = getPaymentStatusBadge(selectedInvoice.payment_status);
                        const StatusIcon = badge.icon;
                        return (
                          <View
                            style={[
                              styles.statusBadgeLarge,
                              { backgroundColor: badge.bg },
                            ]}
                          >
                            <StatusIcon size={20} color={badge.color} />
                            <Text
                              style={[styles.statusTextLarge, { color: badge.color }]}
                            >
                              Payment {badge.text}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  </Card>

                  {/* Invoice Info */}
                  <Card style={styles.detailCard}>
                    <Text style={styles.detailCardTitle}>Invoice Information</Text>
                    
                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <FileText size={16} color={COLORS.textSecondary} />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Invoice Number</Text>
                        <Text style={styles.detailValue}>{selectedInvoice.invoice_number}</Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Calendar size={16} color={COLORS.textSecondary} />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Invoice Date</Text>
                        <Text style={styles.detailValue}>
                          {new Date(selectedInvoice.invoice_date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                    </View>

                    {selectedInvoice.due_date && (
                      <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                          <Calendar size={16} color={COLORS.textSecondary} />
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Due Date</Text>
                          <Text style={styles.detailValue}>
                            {new Date(selectedInvoice.due_date).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <CreditCard size={16} color={COLORS.textSecondary} />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Payment Method</Text>
                        <Text style={styles.detailValue}>
                          {selectedInvoice.payment_type.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {selectedInvoice.gym && (
                      <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                          <Building2 size={16} color={COLORS.textSecondary} />
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Gym Name</Text>
                          <Text style={styles.detailValue}>{selectedInvoice.gym.name}</Text>
                        </View>
                      </View>
                    )}
                  </Card>

                  {/* Amount Breakdown */}
                  <Card style={styles.detailCard}>
                    <Text style={styles.detailCardTitle}>Amount Details</Text>

                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Subtotal</Text>
                      <Text style={styles.amountValue}>
                        {formatRupees(selectedInvoice.amount)}
                      </Text>
                    </View>

                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>GST (18%)</Text>
                      <Text style={styles.amountValue}>
                        {formatRupees(selectedInvoice.tax_amount || 0)}
                      </Text>
                    </View>

                    <View style={[styles.amountRow, styles.amountRowDivider]}>
                      <Text style={styles.amountLabelTotal}>Total Amount</Text>
                      <Text style={styles.amountValueTotal}>
                        {formatRupees(selectedInvoice.total_amount)}
                      </Text>
                    </View>

                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Paid Amount</Text>
                      <Text style={[styles.amountValue, { color: COLORS.success }]}>
                        {formatRupees(calculatePaidAmount(selectedInvoice))}
                      </Text>
                    </View>

                    {calculateRemainingAmount(selectedInvoice) > 0 && (
                      <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>Remaining Amount</Text>
                        <Text style={[styles.amountValue, { color: COLORS.error }]}>
                          {formatRupees(calculateRemainingAmount(selectedInvoice))}
                        </Text>
                      </View>
                    )}
                  </Card>

                  {/* Installment Info */}
                  {selectedInvoice.is_installment && (
                    <Card style={styles.detailCard}>
                      <Text style={styles.detailCardTitle}>Installment Information</Text>
                      <View style={styles.installmentInfo}>
                        <Text style={styles.installmentText}>
                          Installment {selectedInvoice.installment_number} of{' '}
                          {selectedInvoice.total_installments}
                        </Text>
                      </View>
                    </Card>
                  )}

                  {/* Actions */}
                  <View style={styles.actionButtons}>
                    <Button
                      title="Download Invoice"
                      onPress={() => handleDownloadInvoice(selectedInvoice)}
                      isLoading={isDownloading}
                      style={styles.downloadButtonLarge}
                    />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  invoiceCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  invoiceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  invoiceDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  invoiceRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  invoiceAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
  },
  downloadText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  modalScrollView: {
    flex: 1,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 40,
  },
  statusCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statusCardHeader: {
    width: '100%',
    alignItems: 'center',
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  statusTextLarge: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
  },
  detailCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  amountRowDivider: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    marginTop: 8,
    paddingTop: 16,
  },
  amountLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  amountLabelTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  amountValueTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  installmentInfo: {
    backgroundColor: COLORS.primaryLight,
    padding: 16,
    borderRadius: 12,
  },
  installmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
  actionButtons: {
    marginTop: 8,
  },
  downloadButtonLarge: {
    minHeight: 52,
  },
});