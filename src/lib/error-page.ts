// src/lib/error-page.ts
export function getErrorPageHTML(error: Error): string {
  return `
    <div style="font-family:monospace;padding:2rem;color:#000">
      <h1>Something went wrong</h1>
      <p>${error.message}</p>
      <button onclick="window.location.reload()">Reload</button>
    </div>
  `;
}
