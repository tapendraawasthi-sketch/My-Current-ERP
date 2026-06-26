export async function generateShareLink(documentRef: string, opts: {
  expiryHours: number;
  password?: string;
  allowDownload: boolean;
}): Promise<string> {
  const res = await fetch('/api/share/link', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + sessionStorage.getItem('sutra_token'),
    },
    body: JSON.stringify({ documentRef, ...opts }),
  });
  
  if (!res.ok) {
    throw new Error('Failed to generate share link');
  }
  
  const data = await res.json();
  return data.linkToken;
}

export async function revokeShareLink(linkToken: string): Promise<void> {
  const res = await fetch(`/api/share/link/${linkToken}`, {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer ' + sessionStorage.getItem('sutra_token'),
    },
  });

  if (!res.ok) {
    throw new Error('Failed to revoke share link');
  }
}
