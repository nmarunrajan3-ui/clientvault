import { z } from 'zod';

export const BUSINESS_TYPES = [
  'Retail & Supermarket',
  'Restaurant & Hospitality',
  'Pharmacy & Healthcare',
  'Wholesale & Distribution',
  'Manufacturing & Industrial',
  'Professional Services',
  'Education & Training',
  'IT & Software Solutions',
  'Automotive & Spares',
  'Logistics & Transport',
  'Textiles & Garments',
  'Other / Custom',
] as const;

// GSTIN format regex (15 chars: 2 state digits + 10 PAN chars + 1 entity num + 1 Z + 1 check digit)
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const customerInputSchema = z.object({
  name: z.string().trim().min(2, 'Customer name must be at least 2 characters'),
  phone: z
    .string()
    .trim()
    .min(5, 'Phone number must be at least 5 digits')
    .max(20, 'Phone number is too long'),
  businessName: z.string().trim().min(2, 'Business name must be at least 2 characters'),
  businessType: z.string().trim().min(1, 'Please select or enter a business type'),
  address: z.string().trim().min(3, 'Address must be at least 3 characters'),
  gstin: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .refine((val) => val === '' || GSTIN_REGEX.test(val), {
      message: 'GSTIN should match format: 29ABCDE1234F1Z5 (15 characters)',
    })
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .trim()
    .refine((val) => val === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Please enter a valid email address',
    })
    .optional()
    .or(z.literal('')),
  notes: z.string().optional(),
  status: z.enum(['active', 'archived']).default('active'),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;
