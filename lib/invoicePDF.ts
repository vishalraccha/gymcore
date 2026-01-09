/**
 * Invoice PDF/HTML generation utilities - WITH ADMISSION & DISCOUNT
 */

import { formatRupees, formatCurrencyNumber } from './currency';

export interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  gym_id?: string;
  amount: number;
  total_amount: number;
  currency: string;
  payment_type: string;
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
  admission_fee?: number;
  discount_amount?: number;
  gym?: {
    name: string;
    location?: string;
    phone?: string;
    email?: string;
  };
  user?: {
    full_name: string;
    email: string;
    phone?: string;
  };
  subscription?: {
    name?: string;
    price?: number;
  };
}

/**
 * Calculate all amounts correctly
 */
function calculateAmounts(invoice: Invoice) {
  // Get base subscription price from items or subscription relation
  const subscriptionPrice = invoice.subscription?.price || 
    (invoice.items && invoice.items[0]?.amount) || 
    invoice.total_amount || 0;

  // Get admission fee and discount
  const admissionFee = invoice.admission_fee || 0;
  const discountAmount = invoice.discount_amount || 0;

  // Calculate subtotal: subscription + admission
  const subtotal = subscriptionPrice + admissionFee;

  // Calculate final total after discount
  const finalTotal = Math.max(0, subtotal - discountAmount);

  // Amount paid
  const paidAmount = invoice.amount || 0;

  // Remaining amount
  const remainingAmount = invoice.remaining_amount !== undefined
    ? invoice.remaining_amount
    : Math.max(0, finalTotal - paidAmount);

  return {
    subscriptionPrice,
    admissionFee,
    discountAmount,
    subtotal,
    finalTotal,
    paidAmount,
    remainingAmount,
  };
}

/**
 * Generate HTML for invoice (optimized for single page)
 */
export function generateInvoiceHTML(invoice: Invoice): string {
  const invoiceDate = new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const {
    subscriptionPrice,
    admissionFee,
    discountAmount,
    subtotal,
    finalTotal,
    paidAmount,
    remainingAmount,
  } = calculateAmounts(invoice);

  const paymentStatusText =
    invoice.payment_status === 'completed' || invoice.payment_status === 'paid'
      ? 'Paid'
      : invoice.payment_status === 'partial'
      ? 'Partially Paid'
      : 'Pending';

  const statusClass =
    invoice.payment_status === 'completed' || invoice.payment_status === 'paid'
      ? 'paid'
      : invoice.payment_status === 'partial'
      ? 'partial'
      : 'pending';

  const planName = invoice.subscription?.name || 
    (invoice.items && invoice.items[0]?.description) || 
    'Gym Subscription';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: A4;
      margin: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Arial', sans-serif;
      color: #1f2937;
      line-height: 1.4;
      background: white;
    }
    
    .invoice-container {
      width: 210mm;
      min-height: 297mm;
      padding: 12mm;
      margin: 0 auto;
      background: white;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 3px solid #3B82F6;
    }
    
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #3B82F6;
      letter-spacing: -0.5px;
    }
    
    .invoice-title {
      text-align: right;
    }
    
    .invoice-title h1 {
      font-size: 28px;
      color: #1f2937;
      font-weight: 700;
      margin-bottom: 4px;
    }
    
    .invoice-number {
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
    }
    
    .details {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      gap: 25px;
    }
    
    .bill-to, .invoice-info {
      flex: 1;
    }
    
    .section-title {
      font-size: 10px;
      color: #6b7280;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }
    
    .bill-to p, .invoice-info p {
      margin: 3px 0;
      font-size: 12px;
      color: #374151;
    }
    
    .bill-to strong, .invoice-info strong {
      color: #1f2937;
      font-weight: 600;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
      margin-top: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .status-paid {
      background: #D1FAE5;
      color: #065F46;
    }
    
    .status-partial {
      background: #FEF3C7;
      color: #92400E;
    }
    
    .status-pending {
      background: #FEE2E2;
      color: #991B1B;
    }
    
    .items-section {
      margin: 18px 0;
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .items-section h3 {
      font-size: 13px;
      color: #374151;
      margin-bottom: 10px;
      font-weight: 600;
    }
    
    .item {
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .item:last-child {
      border-bottom: none;
    }
    
    .item-description {
      font-size: 13px;
      color: #1f2937;
      font-weight: 500;
    }
    
    .item-amount {
      font-size: 13px;
      color: #374151;
      font-weight: 600;
    }
    
    .amount-breakdown {
      margin: 18px 0;
      padding: 15px;
      background: linear-gradient(to bottom, #ffffff, #f9fafb);
      border: 2px solid #e5e7eb;
      border-radius: 10px;
    }
    
    .amount-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 13px;
      border-bottom: 1px dashed #d1d5db;
    }
    
    .amount-row:last-child {
      border-bottom: none;
    }
    
    .amount-row.highlight {
      background: #f0f9ff;
      padding: 10px;
      margin: -8px -8px 6px -8px;
      border-radius: 6px;
      border: 1px solid #bfdbfe;
    }
    
    .amount-row.admission {
      background: #fef3c7;
      padding: 10px;
      margin: 6px -8px;
      border-radius: 6px;
      border: 1px solid #fde68a;
    }
    
    .amount-row.discount {
      background: #d1fae5;
      padding: 10px;
      margin: 6px -8px;
      border-radius: 6px;
      border: 1px solid #86efac;
    }
    
    .amount-row.paid {
      background: #d1fae5;
      padding: 10px;
      margin: 6px -8px;
      border-radius: 6px;
      border: 1px solid #86efac;
    }
    
    .amount-row.remaining {
      background: #fee2e2;
      padding: 10px;
      margin: 6px -8px;
      border-radius: 6px;
      border: 1px solid #fca5a5;
    }
    
    .amount-row.total {
      margin-top: 6px;
      padding-top: 12px;
      border-top: 3px solid #3B82F6;
      font-size: 15px;
      font-weight: 700;
    }
    
    .amount-row .label {
      color: #374151;
      font-weight: 500;
    }
    
    .amount-row .value {
      color: #1f2937;
      font-weight: 600;
    }
    
    .amount-row.highlight .label,
    .amount-row.admission .label,
    .amount-row.discount .label,
    .amount-row.paid .label,
    .amount-row.remaining .label {
      font-weight: 600;
    }
    
    .payment-info {
      background: #f0f9ff;
      padding: 12px;
      border-radius: 8px;
      margin: 15px 0;
      border: 1px solid #bfdbfe;
    }
    
    .payment-info-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      font-size: 12px;
    }
    
    .payment-info-row strong {
      color: #1e40af;
      font-weight: 600;
    }
    
    .payment-info-row span {
      color: #374151;
    }
    
    .gym-info {
      margin-top: 18px;
      padding: 12px;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    
    .gym-name {
      font-size: 14px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 6px;
    }
    
    .gym-info p {
      font-size: 11px;
      color: #6b7280;
      margin: 3px 0;
    }
    
    .footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
    }
    
    .footer-thank-you {
      font-size: 14px;
      font-weight: 600;
      color: #3B82F6;
      margin-bottom: 6px;
    }
    
    .footer-note {
      font-size: 10px;
      color: #9ca3af;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      
      .invoice-container {
        margin: 0;
        box-shadow: none;
        page-break-after: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        ${invoice.gym?.name || 'GymCore'}
      </div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <div class="invoice-number">${invoice.invoice_number}</div>
      </div>
    </div>

    <!-- Details Section -->
    <div class="details">
      <div class="bill-to">
        <div class="section-title">Bill To</div>
        <p><strong>${invoice.user?.full_name || 'Member'}</strong></p>
        <p>${invoice.user?.email || ''}</p>
        ${invoice.user?.phone ? `<p>Phone: ${invoice.user.phone}</p>` : ''}
        <div class="status-badge status-${statusClass}">
          ${paymentStatusText}
        </div>
      </div>
      <div class="invoice-info">
        <div class="section-title">Invoice Details</div>
        <p><strong>Date:</strong> ${invoiceDate}</p>
        ${dueDate ? `<p><strong>Due Date:</strong> ${dueDate}</p>` : ''}
        <p><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
        ${invoice.payment_id ? `<p><strong>Payment ID:</strong> ${invoice.payment_id}</p>` : ''}
      </div>
    </div>

    <!-- Items Section -->
    <div class="items-section">
      <h3>Subscription Details</h3>
      <div class="item">
        <div class="item-description">${planName}</div>
        <div class="item-amount">₹${formatCurrencyNumber(subscriptionPrice)}</div>
      </div>
    </div>

    <!-- Amount Breakdown -->
    <div class="amount-breakdown">
      <div class="amount-row highlight">
        <span class="label">Subscription Amount</span>
        <span class="value">₹${formatCurrencyNumber(subscriptionPrice)}</span>
      </div>
      
      ${admissionFee > 0 ? `
      <div class="amount-row admission">
        <span class="label">Admission Fee</span>
        <span class="value">+ ₹${formatCurrencyNumber(admissionFee)}</span>
      </div>
      ` : ''}
      
      ${discountAmount > 0 ? `
      <div class="amount-row discount">
        <span class="label">Discount Applied</span>
        <span class="value">- ₹${formatCurrencyNumber(discountAmount)}</span>
      </div>
      ` : ''}
      
      <div class="amount-row total">
        <span class="label">Total Amount</span>
        <span class="value">₹${formatCurrencyNumber(finalTotal)}</span>
      </div>
      
      ${paidAmount > 0 ? `
      <div class="amount-row paid">
        <span class="label">Paid Amount</span>
        <span class="value">₹${formatCurrencyNumber(paidAmount)}</span>
      </div>
      ` : ''}
      
      ${remainingAmount > 0 ? `
      <div class="amount-row remaining">
        <span class="label">Remaining Amount</span>
        <span class="value">₹${formatCurrencyNumber(remainingAmount)}</span>
      </div>
      ` : ''}
    </div>

    <!-- Payment Information -->
    <div class="payment-info">
      <div class="payment-info-row">
        <strong>Payment Method:</strong>
        <span>${
          invoice.payment_type === 'cash'
            ? 'Cash Payment'
            : invoice.payment_type === 'online'
            ? 'Online Payment'
            : 'Razorpay'
        }</span>
      </div>
      <div class="payment-info-row">
        <strong>Payment Status:</strong>
        <span>${paymentStatusText}</span>
      </div>
      ${
        invoice.payment_id
          ? `
      <div class="payment-info-row">
        <strong>Transaction ID:</strong>
        <span>${invoice.payment_id}</span>
      </div>
      `
          : ''
      }
    </div>

    ${
      invoice.gym
        ? `
    <div class="gym-info">
      <div class="gym-name">${invoice.gym.name}</div>
      ${invoice.gym.location ? `<p>📍 ${invoice.gym.location}</p>` : ''}
      ${invoice.gym.phone ? `<p>📞 ${invoice.gym.phone}</p>` : ''}
      ${invoice.gym.email ? `<p>✉️ ${invoice.gym.email}</p>` : ''}
    </div>
    `
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      <div class="footer-thank-you">Thank you for your business!</div>
      <div class="footer-note">This is a computer-generated invoice and does not require a signature.</div>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Format invoice for display in UI
 */
export function formatInvoiceForDisplay(invoice: any) {
  const amounts = calculateAmounts(invoice);

  return {
    ...invoice,
    formattedSubscriptionPrice: formatRupees(amounts.subscriptionPrice),
    formattedAdmissionFee: formatRupees(amounts.admissionFee),
    formattedDiscount: formatRupees(amounts.discountAmount),
    formattedSubtotal: formatRupees(amounts.subtotal),
    formattedTotal: formatRupees(amounts.finalTotal),
    formattedPaid: formatRupees(amounts.paidAmount),
    formattedRemaining: formatRupees(amounts.remainingAmount),
    formattedDate: new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    formattedDueDate: invoice.due_date
      ? new Date(invoice.due_date).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : null,
  };
}