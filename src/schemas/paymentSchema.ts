import { z } from 'zod';

export const PAYMENT_METHODS = [
  'UPI',
  'Bank Transfer / NEFT / IMPS',
  'Cash',
  'Cheque',
  'Credit / Debit Card',
  'Other',
] as const;

export const paymentInputSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer'),
  licenseId: z.string().optional().or(z.literal('')),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMethod: z.enum(PAYMENT_METHODS).default('UPI'),
  status: z.enum(['paid', 'partially_paid', 'unpaid']).default('paid'),
  transactionRef: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;
