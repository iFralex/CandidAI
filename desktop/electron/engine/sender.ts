import { BrowserWindow } from 'electron';
import { SERVER_URL } from '../config';

export interface EmailItem {
  id: string;
  to: string;
  subject: string;
  body: string;
  cvUrl: string;
  companyName: string;
  recruiterName: string;
  recruiterTitle: string;
}

export async function startRemoteCampaign(
  userId: string,
  idToken: string,
  emails: EmailItem[],
  provider: string,
  mainWindow: BrowserWindow,
): Promise<void> {
  try {
    const res = await fetch(`${SERVER_URL}/send_emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ user_id: userId, provider, emails }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Errore sconosciuto' }));
      const msg = body.error ?? `Errore server: ${res.status}`;
      console.error('[campaign] Server error:', msg);
      mainWindow.webContents.send('campaign-error', msg);
      return;
    }

    const data = await res.json();
    console.log('[campaign] Campagna accodata sul server:', data.message);
    mainWindow.webContents.send('campaign-queued', emails.length);
  } catch (err) {
    console.error('[campaign] Impossibile contattare il server:', err);
    mainWindow.webContents.send(
      'campaign-error',
      'Impossibile contattare il server. Verifica la connessione.',
    );
  }
}

export async function stopRemoteCampaign(
  userId: string,
  idToken: string,
  mainWindow: BrowserWindow,
): Promise<void> {
  try {
    await fetch(`${SERVER_URL}/stop_campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ user_id: userId }),
    });
    console.log('[campaign] Richiesta di stop inviata al server.');
  } catch (err) {
    console.error('[campaign] Impossibile inviare stop al server:', err);
  }
  mainWindow.webContents.send('campaign-stopped');
}
