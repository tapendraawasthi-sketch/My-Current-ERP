export function generateShareEmailSubject(documentType: string, documentRef: string, companyName: string): string {
  return `${companyName} - ${documentType} ${documentRef}`;
}

export function generateShareEmailBody(documentType: string, documentRef: string, companyName: string): string {
  return `Dear Sir/Madam,

Please find attached the ${documentType} (${documentRef}) from ${companyName}.

If you have any questions, please contact us.

Regards,
${companyName}`;
}
