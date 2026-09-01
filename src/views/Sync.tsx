import { useState, useEffect, useCallback } from 'react';
import { Scan, Wifi, WifiOff, ArrowLeftRight, Users, Shield } from 'lucide-react';
import { useApp } from '../store';
import { p2pSync, parseQrPayload, encryptSyncData, decryptSyncData, type QrPayload } from '../utils/p2p-sync';
import { Btn, Modal } from '../components/ui';

export function SyncView() {
  const app = useApp();
  const { state, set, toast } = app;
  
  const [mode, setMode] = useState<'idle' | 'host' | 'join'>('idle');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<QrPayload | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [peers, setPeers] = useState(p2pSync.getPeers());
  const [sessionStatus, setSessionStatus] = useState(p2pSync.getCurrentSession());
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedState, setImportedState] = useState<any>(null);

  // Listen for status changes
  useEffect(() => {
    p2pSync.setStatusHandler((session) => {
      setSessionStatus({ ...session });
      if (session.status === 'connected') {
        toast('Peer connected successfully', 'ok');
      } else if (session.status === 'error') {
        toast(session.error ?? 'Connection error', 'err');
      }
    });
    
    // Poll for peer updates
    const interval = setInterval(() => {
      setPeers([...p2pSync.getPeers()]);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [toast]);

  const startHost = async () => {
    try {
      setMode('host');
      const profileName = state.settings.profileName || 'Anonymous';
      const { qrDataUrl, payload } = await p2pSync.createOffer(profileName);
      setQrDataUrl(qrDataUrl);
      setQrPayload(payload);
      toast('QR code generated — show this to the device joining you', 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create offer', 'err');
      setMode('idle');
    }
  };

  const startJoin = () => {
    setMode('join');
    setQrDataUrl(null);
    setQrPayload(null);
    setScanInput('');
  };

  const handleScanOffer = async () => {
    try {
      const payload = parseQrPayload(scanInput.trim());
      if (!payload || payload.type !== 'offer') {
        throw new Error('Invalid offer QR code');
      }
      
      const profileName = state.settings.profileName || 'Anonymous';
      const { qrDataUrl: answerQr, payload: answerPayload } = await p2pSync.createAnswer(profileName, payload);
      setQrDataUrl(answerQr);
      setQrPayload(answerPayload);
      toast('Answer QR generated — show this back to the host device', 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to process offer', 'err');
    }
  };

  const completeHostConnection = async () => {
    try {
      const payload = parseQrPayload(scanInput.trim());
      if (!payload || payload.type !== 'answer') {
        throw new Error('Invalid answer QR code');
      }
      
      await p2pSync.completeHostConnection(payload);
      toast('Connection established!', 'ok');
      setScanInput('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to complete connection', 'err');
    }
  };

  const completeJoinConnection = async () => {
    try {
      const payload = parseQrPayload(scanInput.trim());
      if (!payload || payload.type !== 'offer') {
        throw new Error('Invalid offer QR code');
      }
      
      await p2pSync.completeClientConnection(payload);
      toast('Connected to host!', 'ok');
      setScanInput('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to complete connection', 'err');
    }
  };

  const performSync = async () => {
    try {
      await p2pSync.syncState(state);
      toast('Sync initiated — waiting for peer response', 'ok');
      
      // In a full implementation, we'd receive and merge the remote state here
      // For now, we just send our state
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Sync failed', 'err');
    }
  };

  const disconnect = () => {
    p2pSync.disconnect();
    setMode('idle');
    setQrDataUrl(null);
    setQrPayload(null);
    setSessionStatus(null);
    toast('Disconnected from peer', 'warn');
  };

  const cancelSetup = () => {
    p2pSync.disconnect();
    setMode('idle');
    setQrDataUrl(null);
    setQrPayload(null);
  };

  const copyQrData = () => {
    if (qrPayload) {
      navigator.clipboard.writeText(JSON.stringify(qrPayload));
      toast('QR data copied to clipboard', 'ok');
    }
  };

  const pasteQrData = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setScanInput(text);
      toast('Pasted from clipboard', 'ok');
    } catch {
      toast('Failed to read clipboard', 'err');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[24px] font-bold tracking-tight">P2P Sync</h1>
        <p className="text-[13px] font-semibold" style={{ color: 'var(--mut)' }}>
          Sync your LifeLog data directly with other devices using QR codes. No servers, no cloud — fully encrypted peer-to-peer.
        </p>
      </div>

      {/* Status Card */}
      <div className="card card-hover p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {sessionStatus?.status === 'connected' ? (
              <Wifi size={20} style={{ color: 'var(--ok)' }} />
            ) : (
              <WifiOff size={20} style={{ color: 'var(--mut)' }} />
            )}
            <span className="font-display text-[15px] font-bold">
              {sessionStatus?.status === 'connected' ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          {sessionStatus && (
            <span className="chip text-[10px]" style={{ 
              background: sessionStatus.status === 'connected' ? 'var(--ok-soft)' : 
                         sessionStatus.status === 'connecting' ? 'var(--warn-soft)' : 'var(--panel2)'
            }}>
              {sessionStatus.status}
            </span>
          )}
        </div>
        
        {sessionStatus && (
          <div className="mt-3 space-y-1 text-[12px] font-semibold" style={{ color: 'var(--mut)' }}>
            <div>Peer: {sessionStatus.peerName}</div>
            {sessionStatus.status === 'connected' && peers.length > 0 && (
              <div>Last sync: {peers[0].lastSyncAt ? new Date(peers[0].lastSyncAt).toLocaleTimeString() : 'Never'}</div>
            )}
          </div>
        )}
      </div>

      {/* Main Action Buttons */}
      {mode === 'idle' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={startHost}
            className="card card-hover p-4 text-left transition-all hover:-translate-y-0.5"
            style={{ borderColor: 'var(--line)', cursor: 'pointer' }}
          >
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-2" style={{ background: 'var(--accent-soft)' }}>
                <Wifi size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div className="font-display text-[15px] font-bold">Host Sync Session</div>
                <div className="text-[11px] font-semibold" style={{ color: 'var(--mut)' }}>
                  Generate QR for others to join
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={startJoin}
            className="card card-hover p-4 text-left transition-all hover:-translate-y-0.5"
            style={{ borderColor: 'var(--line)', cursor: 'pointer' }}
          >
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-2" style={{ background: 'var(--accent-soft)' }}>
                <Scan size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div className="font-display text-[15px] font-bold">Join Sync Session</div>
                <div className="text-[11px] font-semibold" style={{ color: 'var(--mut)' }}>
                  Scan host's QR code
                </div>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Host Mode */}
      {mode === 'host' && !qrDataUrl && (
        <div className="card card-hover p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-[15px] font-bold">Generating QR...</div>
            <Btn size="sm" variant="ghost" onClick={cancelSetup}>
              <ArrowLeftRight size={14} /> Cancel
            </Btn>
          </div>
        </div>
      )}

      {mode === 'host' && qrDataUrl && sessionStatus?.status !== 'connected' && (
        <div className="card card-hover p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-[15px] font-bold">Show this QR to joining device</div>
            <Btn size="sm" variant="ghost" onClick={copyQrData}>
              Copy Data
            </Btn>
          </div>
          
          <div className="flex flex-col items-center gap-3">
            <img src={qrDataUrl} alt="Connection QR" className="rounded-lg border" style={{ borderColor: 'var(--line)' }} />
            <div className="text-center text-[12px] font-semibold" style={{ color: 'var(--mut)' }}>
              The other device should scan this QR or paste the data
            </div>
          </div>

          <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
            <div className="mb-2 text-[13px] font-bold">Or paste their answer QR:</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder='Paste answer QR JSON here...'
                className="flex-1 rounded-xl border px-3 py-2 text-[13px] font-semibold outline-none focus:ring-2"
                style={{ 
                  borderColor: 'var(--line)', 
                  background: 'var(--bg)'
                }}
              />
              <Btn size="sm" variant="ghost" onClick={pasteQrData}>Paste</Btn>
              <Btn size="sm" onClick={completeHostConnection}>Connect</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Join Mode */}
      {mode === 'join' && !qrDataUrl && (
        <div className="card card-hover p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-[15px] font-bold">Scan Host's QR Code</div>
            <Btn size="sm" variant="ghost" onClick={cancelSetup}>
              <ArrowLeftRight size={14} /> Back
            </Btn>
          </div>

          <div className="space-y-3">
            <div>
              <label className="lbl mb-1 block">Paste QR data from host:</label>
              <textarea
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder='Paste the offer QR JSON here...'
                rows={4}
                className="w-full rounded-xl border px-3 py-2 text-[13px] font-semibold outline-none focus:ring-2"
                style={{ 
                  borderColor: 'var(--line)', 
                  background: 'var(--bg)'
                }}
              />
            </div>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={pasteQrData} className="flex-1">
                Paste from Clipboard
              </Btn>
              <Btn onClick={handleScanOffer} className="flex-1">
                <Scan size={14} /> Generate Answer
              </Btn>
            </div>
          </div>
        </div>
      )}

      {mode === 'join' && qrDataUrl && sessionStatus?.status !== 'connected' && (
        <div className="card card-hover p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-[15px] font-bold">Show this back to host</div>
            <Btn size="sm" variant="ghost" onClick={copyQrData}>
              Copy Data
            </Btn>
          </div>
          
          <div className="flex flex-col items-center gap-3">
            <img src={qrDataUrl} alt="Answer QR" className="rounded-lg border" style={{ borderColor: 'var(--line)' }} />
            <div className="text-center text-[12px] font-semibold" style={{ color: 'var(--mut)' }}>
              Host must scan this QR to complete connection
            </div>
          </div>

          <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
            <div className="mb-2 text-[13px] font-bold">Or paste host's confirmation:</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder='Paste confirmation JSON...'
                className="flex-1 rounded-xl border px-3 py-2 text-[13px] font-semibold outline-none focus:ring-2"
                style={{ 
                  borderColor: 'var(--line)', 
                  background: 'var(--bg)'
                }}
              />
              <Btn size="sm" variant="ghost" onClick={pasteQrData}>Paste</Btn>
              <Btn size="sm" onClick={completeJoinConnection}>Connect</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Connected State */}
      {sessionStatus?.status === 'connected' && (
        <div className="card card-hover p-4" style={{ borderColor: 'var(--ok)' }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={18} style={{ color: 'var(--ok)' }} />
              <span className="font-display text-[15px] font-bold">Connected to {sessionStatus.peerName}</span>
            </div>
            <Btn size="sm" variant="ghost" onClick={disconnect}>
              Disconnect
            </Btn>
          </div>

          <div className="flex items-center gap-3">
            <Btn onClick={performSync} className="flex-1">
              <ArrowLeftRight size={16} /> Sync Now
            </Btn>
          </div>

          <div className="mt-3 rounded-lg p-3 text-[11.5px] font-semibold" style={{ background: 'var(--accent-soft)', color: 'var(--text)' }}>
            <Shield size={12} className="inline mr-1" />
            All sync data is encrypted with AES-256-GCM. Your data never leaves your devices.
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="card card-hover p-4">
        <div className="font-display text-[15px] font-bold mb-2">How it works</div>
        <ol className="list-decimal pl-5 text-[12.5px] font-semibold space-y-1" style={{ color: 'var(--mut)' }}>
          <li><strong>Host:</strong> Click "Host Sync Session" to generate a QR code</li>
          <li><strong>Join:</strong> On another device, click "Join Sync Session" and paste/scan the host's QR</li>
          <li><strong>Confirm:</strong> The joining device shows its own QR, which the host scans/pastes</li>
          <li><strong>Sync:</strong> Once connected, click "Sync Now" to exchange encrypted data</li>
        </ol>
        <div className="mt-3 text-[11.5px] font-semibold" style={{ color: 'var(--mut)' }}>
          💡 Tip: If cameras aren't available, you can copy/paste the QR JSON data between devices manually.
        </div>
      </div>
    </div>
  );
}
