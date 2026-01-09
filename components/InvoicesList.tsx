// InvoicesList.tsx - CORRECTED with proper amount calculations
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
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
  Building2,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Mail,
  MessageCircle,
  DollarSign,
  Tag,
  Percent
} from 'lucide-react-native';
import { formatRupees } from '@/lib/currency';
import { generateInvoiceHTML } from '@/lib/invoicePDF';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import { Linking } from 'react-native';

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
  total_amount: number;
  currency: string;
  payment_status: string;
  invoice_date: string;
  due_date?: string;
  items: any;
  payment_id?: string;
  subscription_id?: string;
  is_installment?: boolean;
  installment_number?: number;
  total_installments?: number;
  original_total_amount?: number;
  remaining_amount?: number;
  admission_fee?: number;
  discount_amount?: number;
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
  subscription?: {
    name?: string;
    price?: number;
  };
  userSubscription?: {
    admission_fee?: number;
    discount_amount?: number;
    total_amount?: number;
    paid_amount?: number;
    pending_amount?: number;
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
  const [processingInvoiceId, setProcessingInvoiceId] = useState<string | null>(null);

  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    fetchInvoices();
  }, [userId]);

  const parseInvoiceItems = (items: any): any[] => {
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        return [];
      }
    }
    if (items && typeof items === 'object') return [items];
    return [];
  };

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          user:profiles!invoices_user_id_fkey(full_name, email, phone),
          gym:gyms(name, location, phone, email),
          subscription:user_subscriptions!invoices_subscription_id_fkey(
            subscription:subscription_id(name, price),
            admission_fee,
            discount_amount,
            total_amount,
            paid_amount,
            pending_amount
          )
        `)
        .eq('user_id', userId)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      const parsedInvoices = (data || []).map(invoice => {
        // Extract data from nested subscription object
        const userSubscriptionData = invoice.subscription;
        const subscriptionPlan = userSubscriptionData?.subscription;

        // Get admission_fee and discount_amount from user_subscriptions table
        const admissionFee = invoice.admission_fee || 
          userSubscriptionData?.admission_fee || 0;
        const discountAmount = invoice.discount_amount || 
          userSubscriptionData?.discount_amount || 0;

        return {
          ...invoice,
          items: parseInvoiceItems(invoice.items),
          subscription: subscriptionPlan || null,
          // Store user_subscriptions data separately
          userSubscription: userSubscriptionData,
          // Ensure these fields are at the top level
          admission_fee: admissionFee,
          discount_amount: discountAmount,
        };
      });

      setInvoices(parsedInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      Alert.alert('Error', 'Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAmounts = (invoice: Invoice) => {
    // Get subscription price from subscription plan
    const subscriptionPrice = invoice.subscription?.price || 0;

    // Get admission fee and discount from invoice OR userSubscription
    const admissionFee = invoice.admission_fee || 
      invoice.userSubscription?.admission_fee || 0;
    
    const discountAmount = invoice.discount_amount || 
      invoice.userSubscription?.discount_amount || 0;

    // Calculate subtotal and final total
    const subtotal = subscriptionPrice + admissionFee;
    const finalTotal = Math.max(0, subtotal - discountAmount);

    // Get paid amount - use userSubscription data if available
    const paidAmount = invoice.userSubscription?.paid_amount || 
      invoice.amount || 0;

    // Calculate remaining amount
    const remainingAmount = invoice.userSubscription?.pending_amount !== undefined
      ? invoice.userSubscription.pending_amount
      : (invoice.remaining_amount !== undefined
        ? invoice.remaining_amount
        : Math.max(0, finalTotal - paidAmount));

    return {
      subscriptionPrice,
      admissionFee,
      discountAmount,
      subtotal,
      finalTotal,
      paidAmount,
      remainingAmount,
    };
  };

  const generatePDFForSharing = async (invoice: Invoice): Promise<string | null> => {
    try {
      const invoiceWithParsedItems = {
        ...invoice,
        items: parseInvoiceItems(invoice.items)
      };

      const html = generateInvoiceHTML(invoiceWithParsedItems);

      if (!html) {
        throw new Error('Failed to generate invoice HTML');
      }

      if (Platform.OS === 'web') {
        const { uri } = await Print.printToFileAsync({ html });
        return uri;
      }

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      return uri;
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      Alert.alert('PDF Generation Error', error?.message || 'Failed to generate PDF');
      return null;
    }
  };

  const handleSendWhatsApp = async (invoice: Invoice) => {
    try {
      setProcessingInvoiceId(invoice.id);

      if (Platform.OS === 'web') {
        Alert.alert('Not Supported on Web', 'WhatsApp sharing is only available on mobile devices.');
        setProcessingInvoiceId(null);
        return;
      }

      // Fetch phone number
      let phoneNumber = null;
      try {
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', userId)
          .single();

        if (userError) throw userError;
        phoneNumber = userData?.phone?.replace(/[^0-9]/g, '');
      } catch (error) {
        console.error('Error fetching user phone:', error);
      }

      if (!phoneNumber) {
        Alert.alert('Error', 'Member phone number not found. Please add a phone number for this member.');
        setProcessingInvoiceId(null);
        return;
      }

      if (phoneNumber.length < 10) {
        Alert.alert('Error', 'Invalid phone number. Please check the member\'s phone number.');
        setProcessingInvoiceId(null);
        return;
      }

      if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
        phoneNumber = '91' + phoneNumber;
      }

      // Generate PDF first
      const pdfUri = await generatePDFForSharing(invoice);
      if (!pdfUri) {
        setProcessingInvoiceId(null);
        return;
      }

      const { paidAmount, remainingAmount, finalTotal, admissionFee, discountAmount } = calculateAmounts(invoice);

      const message = `Hello ${invoice.user?.full_name || 'Member'} 👋

Your invoice ${invoice.invoice_number} is ready!

*Invoice Details:*
${invoice.subscription?.name || 'Subscription'} Plan
${admissionFee > 0 ? `Admission Fee: ${formatRupees(admissionFee)}\n` : ''}${discountAmount > 0 ? `Discount: -${formatRupees(discountAmount)}\n` : ''}
━━━━━━━━━━━━━━━━━━━━
Total Amount: ${formatRupees(finalTotal)}
Paid: ${formatRupees(paidAmount)} ✅
${remainingAmount > 0 ? `Remaining: ${formatRupees(remainingAmount)} ⚠️\n` : ''}
Status: ${invoice.payment_status.toUpperCase()}
Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-IN')}

📄 Invoice PDF is attached below.

Thank you for your business!
${invoice.gym?.name || 'Gym Team'}`;

      // Try WhatsApp URLs
      const whatsappUrls = [
        `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`,
        `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`,
        `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`
      ];

      let whatsappOpened = false;
      for (const url of whatsappUrls) {
        try {
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
            whatsappOpened = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!whatsappOpened) {
        Alert.alert(
          'WhatsApp Not Available',
          'WhatsApp is not installed. Would you like to share the invoice another way?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setProcessingInvoiceId(null) },
            { text: 'Share PDF', onPress: () => handleDownloadInvoice(invoice) }
          ]
        );
        return;
      }

      // Wait a moment for WhatsApp to open, then share PDF
      setTimeout(async () => {
        try {
          const shareAvailable = await Sharing.isAvailableAsync();
          if (shareAvailable) {
            await Sharing.shareAsync(pdfUri, {
              mimeType: 'application/pdf',
              dialogTitle: `Invoice ${invoice.invoice_number}`,
              UTI: 'com.adobe.pdf',
            });
          }
        } catch (shareError) {
          console.error('Share error:', shareError);
        } finally {
          setProcessingInvoiceId(null);
        }
      }, 1500);

    } catch (error: any) {
      console.error('Error sending WhatsApp:', error);
      Alert.alert('Error', 'Failed to send via WhatsApp: ' + (error?.message || 'Unknown error'));
      setProcessingInvoiceId(null);
    }
  };

  const handleSendEmail = async (invoice: Invoice) => {
    try {
      setProcessingInvoiceId(invoice.id);

      const userEmail = invoice.user?.email;
      if (!userEmail) {
        Alert.alert('Error', 'Member email not found');
        setProcessingInvoiceId(null);
        return;
      }

      if (Platform.OS === 'web') {
        Alert.alert('Not Supported on Web', 'Please use the mobile app to send emails with attachments.');
        setProcessingInvoiceId(null);
        return;
      }

      const isAvailable = await MailComposer.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Email is not configured on this device.');
        setProcessingInvoiceId(null);
        return;
      }

      const pdfUri = await generatePDFForSharing(invoice);
      if (!pdfUri) {
        setProcessingInvoiceId(null);
        return;
      }

      const { paidAmount, remainingAmount, finalTotal, admissionFee, discountAmount, subscriptionPrice } = calculateAmounts(invoice);

      const emailSubject = `Invoice ${invoice.invoice_number} - ${invoice.gym?.name || 'Gym'}`;
      const emailBody = `Dear ${invoice.user?.full_name || 'Member'},

Please find attached your invoice.

Invoice Details:
━━━━━━━━━━━━━━━━━━━━
Invoice Number: ${invoice.invoice_number}
Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}

Amount Details:
━━━━━━━━━━━━━━━━━━━━
Subscription: ${formatRupees(subscriptionPrice)}
${admissionFee > 0 ? `Admission Fee: ${formatRupees(admissionFee)}\n` : ''}${discountAmount > 0 ? `Discount: -${formatRupees(discountAmount)}\n` : ''}Total Amount: ${formatRupees(finalTotal)}
Paid Amount: ${formatRupees(paidAmount)}
${remainingAmount > 0 ? `Remaining: ${formatRupees(remainingAmount)}\n` : ''}Status: ${invoice.payment_status.toUpperCase()}

Thank you for your payment!

Best regards,
${invoice.gym?.name || 'Gym Team'}`;

      let finalAttachmentPath = pdfUri;

      if (Platform.OS === 'android') {
        const fileName = `Invoice_${invoice.invoice_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const newPath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({
          from: pdfUri,
          to: newPath,
        });
        finalAttachmentPath = newPath;
      }

      const result = await MailComposer.composeAsync({
        recipients: [userEmail],
        subject: emailSubject,
        body: emailBody,
        attachments: [finalAttachmentPath],
        isHtml: false,
      });

      if (result.status === 'sent') {
        Alert.alert('Success', 'Invoice email sent successfully!');
      } else if (result.status === 'saved') {
        Alert.alert('Saved', 'Email saved to drafts');
      }

      setProcessingInvoiceId(null);
    } catch (error: any) {
      console.error('Error sending email:', error);
      Alert.alert('Error', 'Failed to send email: ' + (error?.message || 'Unknown error'));
      setProcessingInvoiceId(null);
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      setProcessingInvoiceId(invoice.id);

      const pdfUri = await generatePDFForSharing(invoice);
      if (!pdfUri) {
        setProcessingInvoiceId(null);
        return;
      }

      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = pdfUri;
        link.download = `Invoice_${invoice.invoice_number}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Alert.alert('Success', 'Invoice downloaded successfully!');
        setProcessingInvoiceId(null);
        return;
      }

      const shareAvailable = await Sharing.isAvailableAsync();

      if (shareAvailable) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Save Invoice ${invoice.invoice_number}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }

      setProcessingInvoiceId(null);
    } catch (error: any) {
      console.error('Error downloading invoice:', error);
      Alert.alert('Error', 'Failed to download invoice: ' + (error?.message || 'Unknown error'));
      setProcessingInvoiceId(null);
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
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
          text: status || 'Unknown',
        };
    }
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
          const { finalTotal } = calculateAmounts(invoice);

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
                      {formatRupees(finalTotal)}
                    </Text>
                    <View style={styles.invoiceActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleSendWhatsApp(invoice);
                        }}
                        disabled={processingInvoiceId === invoice.id}
                      >
                        <MessageCircle size={14} color="#25D366" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleSendEmail(invoice);
                        }}
                        disabled={processingInvoiceId === invoice.id}
                      >
                        <Mail size={14} color={COLORS.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDownloadInvoice(invoice);
                        }}
                        disabled={processingInvoiceId === invoice.id}
                      >
                        <Download size={14} color={COLORS.text} />
                      </TouchableOpacity>
                    </View>
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
              {selectedInvoice && (() => {
                const amounts = calculateAmounts(selectedInvoice);
                return (
                  <>
                    {/* Status Card */}
                    <Card style={styles.statusCard}>
                      <View style={styles.statusCardHeader}>
                        {(() => {
                          const badge = getPaymentStatusBadge(selectedInvoice.payment_status);
                          const StatusIcon = badge.icon;
                          return (
                            <View style={[styles.statusBadgeLarge, { backgroundColor: badge.bg }]}>
                              <StatusIcon size={20} color={badge.color} />
                              <Text style={[styles.statusTextLarge, { color: badge.color }]}>
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

                      <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                          <CreditCard size={16} color={COLORS.textSecondary} />
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Payment Method</Text>
                          <Text style={styles.detailValue}>
                            {selectedInvoice.payment_type?.toUpperCase() || 'N/A'}
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
                        <View style={styles.amountRowLeft}>
                          <DollarSign size={16} color={COLORS.primary} />
                          <Text style={styles.amountLabel}>Subscription Amount</Text>
                        </View>
                        <Text style={styles.amountValue}>
                          {formatRupees(amounts.subscriptionPrice)}
                        </Text>
                      </View>

                      {amounts.admissionFee > 0 && (
                        <View style={[styles.amountRow, styles.admissionRow]}>
                          <View style={styles.amountRowLeft}>
                            <Tag size={16} color={COLORS.warning} />
                            <Text style={styles.amountLabel}>Admission Fee</Text>
                          </View>
                          <Text style={[styles.amountValue, { color: COLORS.warning }]}>
                            + {formatRupees(amounts.admissionFee)}
                          </Text>
                        </View>
                      )}

                      {amounts.discountAmount > 0 && (
                        <View style={[styles.amountRow, styles.discountRow]}>
                          <View style={styles.amountRowLeft}>
                            <Percent size={16} color={COLORS.success} />
                            <Text style={styles.amountLabel}>Discount Applied</Text>
                          </View>
                          <Text style={[styles.amountValue, { color: COLORS.success }]}>
                            - {formatRupees(amounts.discountAmount)}
                          </Text>
                        </View>
                      )}

                      <View style={[styles.amountRow, styles.amountRowDivider]}>
                        <Text style={styles.amountLabelTotal}>Total Amount</Text>
                        <Text style={styles.amountValueTotal}>
                          {formatRupees(amounts.finalTotal)}
                        </Text>
                      </View>

                      <View style={styles.amountRow}>
                        <Text style={styles.amountLabel}>Paid Amount</Text>
                        <Text style={[styles.amountValue, { color: COLORS.success, fontWeight: '700' }]}>
                          {formatRupees(amounts.paidAmount)}
                        </Text>
                      </View>

                      {amounts.remainingAmount > 0 && (
                        <View style={styles.amountRow}>
                          <Text style={styles.amountLabel}>Remaining Amount</Text>
                          <Text style={[styles.amountValue, { color: COLORS.error, fontWeight: '700' }]}>
                            {formatRupees(amounts.remainingAmount)}
                          </Text>
                        </View>
                      )}
                    </Card>

                    {/* Actions */}
                    <View style={styles.actionButtons}>
                      <Button
                        title="📱 Send via WhatsApp"
                        onPress={() => handleSendWhatsApp(selectedInvoice)}
                        isLoading={processingInvoiceId === selectedInvoice.id}
                        disabled={Platform.OS === 'web'}
                        style={[
                          styles.actionButtonLarge,
                          { backgroundColor: Platform.OS === 'web' ? COLORS.textSecondary : '#25D366' }
                        ]}
                      />
                      <Button
                        title="✉️ Send via Email"
                        onPress={() => handleSendEmail(selectedInvoice)}
                        isLoading={processingInvoiceId === selectedInvoice.id}
                        disabled={Platform.OS === 'web'}
                        style={[
                          styles.actionButtonLarge,
                          Platform.OS === 'web' && { backgroundColor: COLORS.textSecondary }
                        ]}
                      />
                      <Button
                        title="⬇️ Download Invoice"
                        onPress={() => handleDownloadInvoice(selectedInvoice)}
                        isLoading={processingInvoiceId === selectedInvoice.id}
                        style={styles.downloadButtonLarge}
                      />
                    </View>
                  </>
                );
              })()}
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
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  invoiceCard: {
    marginBottom: 12,
    padding: 16,
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  invoiceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceInfo: {
    flex: 1,
    gap: 4,
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  invoiceDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  invoiceRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  invoiceAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  invoiceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
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
    paddingVertical: 16,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
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
    padding: 16,
    marginBottom: 16,
    backgroundColor: COLORS.cardBg,
  },
  statusCardHeader: {
    alignItems: 'center',
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  statusTextLarge: {
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailCard: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: COLORS.cardBg,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    flex: 1,
    gap: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
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
  amountRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  admissionRow: {
    backgroundColor: COLORS.warningLight,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderBottomWidth: 0,
  },
  discountRow: {
    backgroundColor: COLORS.successLight,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderBottomWidth: 0,
  },
  amountRowDivider: {
    borderTopWidth: 2,
    borderTopColor: COLORS.border,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
    paddingVertical: 16,
    marginVertical: 8,
    backgroundColor: COLORS.background,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  amountLabelTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  amountValueTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionButtons: {
    gap: 12,
    marginTop: 8,
  },
  actionButtonLarge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
  },
  downloadButtonLarge: {
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingVertical: 16,
  },
});