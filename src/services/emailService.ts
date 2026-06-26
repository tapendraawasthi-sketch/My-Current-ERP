export async function sendDocumentEmail(opts: {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  attachmentBlob: Blob;
  attachmentName: string;
}): Promise<void> {
  const formData = new FormData();
  formData.append('to', opts.to);
  if (opts.cc) formData.append('cc', opts.cc);
  formData.append('subject', opts.subject);
  formData.append('body', opts.body);
  formData.append('file', opts.attachmentBlob, opts.attachmentName);

  const res = await fetch('/api/share/email', {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': 'Bearer ' + sessionStorage.getItem('sutra_token'),
    },
  });

  if (!res.ok) {
    throw new Error('Failed to send email');
  }
}
