import { useState } from 'react';
import { ModalWrapper, Field, HelpBox, ErrorBanner } from './shared';

interface Props {
  mode: 'encrypt' | 'decrypt';
  onExecute: (password: string) => Promise<void>;
  onClose: () => void;
}

export function CryptoModal({ mode, onExecute, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEncrypt = mode === 'encrypt';

  const handleSubmit = async () => {
    if (!password) return;
    if (isEncrypt && password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError(null);
    try {
      await onExecute(password);
      onClose();
    } catch (e: any) { setError(e.message || 'Operation failed.'); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper title={isEncrypt ? 'Encrypt PDF' : 'Decrypt PDF'} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <HelpBox>
          {isEncrypt
            ? 'Encrypt the PDF with AES-256-GCM. The file will be saved as <code className="text-zinc-400">.pdf.enc</code> and can only be opened with the password you choose.'
            : 'Decrypt a <code className="text-zinc-400">.pdf.enc</code> file. Enter the password that was used to encrypt it.'}
        </HelpBox>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <p className="text-zinc-400 text-xs">
          {isEncrypt
            ? 'The PDF will be encrypted with AES-256-GCM and saved as .pdf.enc'
            : 'Enter the password used to encrypt this file.'}
        </p>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-emerald-500"
            placeholder={isEncrypt ? 'Choose a strong password' : 'Enter password'}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
        </Field>
        {isEncrypt && (
          <Field label="Confirm Password">
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-emerald-500"
              placeholder="Re-enter password"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
          </Field>
        )}
        <button onClick={handleSubmit} disabled={loading || !password || (isEncrypt && password !== confirm)}
          className="w-full py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors mt-2">
          {loading ? 'Processing...' : isEncrypt ? 'Encrypt & Download' : 'Decrypt & Load'}
        </button>
      </div>
    </ModalWrapper>
  );
}

