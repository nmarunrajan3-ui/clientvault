import { z } from 'zod';

export const activationInputSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer'),
  productName: z.string().trim().min(2, 'Product name must be at least 2 characters'),
  activationKey: z
    .string()
    .trim()
    .min(4, 'Please paste a valid activation key from your external software'),
  issueDate: z.string().min(1, 'Issue date is required'),
  expirationDate: z.string().min(1, 'Expiration date is required'),
  duration: z.number().optional(),
  notes: z.string().optional(),
});

export type ActivationInput = z.infer<typeof activationInputSchema>;

export const renewalInputSchema = z.object({
  licenseId: z.string().min(1, 'License ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  renewalKey: z
    .string()
    .trim()
    .min(4, 'Please paste a valid renewal key from your external software'),
  renewalDate: z.string().min(1, 'Renewal date is required'),
  previousExpirationDate: z.string().min(1, 'Previous expiration date is required'),
  newExpirationDate: z.string().min(1, 'New expiration date is required'),
  duration: z.number().optional(),
  notes: z.string().optional(),
});

export type RenewalInput = z.infer<typeof renewalInputSchema>;
