import type { Customer, License } from '../types/models';

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportCustomersToCsv(customers: Customer[], filename = 'clientvault-customers.csv'): void {
  const headers = [
    'Customer ID',
    'Customer Name',
    'Business Name',
    'Business Type',
    'Phone',
    'Email',
    'GSTIN',
    'Address',
    'Status',
    'Notes',
    'Registration Date',
  ];

  const rows = customers.map((c) => [
    escapeCsvCell(c.customerId),
    escapeCsvCell(c.name),
    escapeCsvCell(c.businessName),
    escapeCsvCell(c.businessType),
    escapeCsvCell(c.phone),
    escapeCsvCell(c.email || ''),
    escapeCsvCell(c.gstin || ''),
    escapeCsvCell(c.address),
    escapeCsvCell(c.status),
    escapeCsvCell(c.notes || ''),
    escapeCsvCell(new Date(c.createdAt).toLocaleDateString()),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportLicensesToCsv(
  licenses: License[],
  customersMap: Record<string, Customer>,
  filename = 'clientvault-licenses.csv'
): void {
  const headers = [
    'License ID',
    'Customer ID',
    'Customer Name',
    'Product Name',
    'Current Key',
    'Issue Date',
    'Expiration Date',
    'Status',
    'Notes',
  ];

  const rows = licenses.map((lic) => {
    const cust = customersMap[lic.customerId];
    return [
      escapeCsvCell(lic.licenseId),
      escapeCsvCell(lic.customerId),
      escapeCsvCell(cust?.name || ''),
      escapeCsvCell(lic.productName),
      escapeCsvCell(lic.currentRenewalKey || lic.activationKey),
      escapeCsvCell(new Date(lic.issueDate).toLocaleDateString()),
      escapeCsvCell(new Date(lic.expirationDate).toLocaleDateString()),
      escapeCsvCell(lic.status),
      escapeCsvCell(lic.notes || ''),
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
