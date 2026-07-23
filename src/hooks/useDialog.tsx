import { useState, useCallback, useMemo } from 'react';
import { DialogSheet, type DialogState } from '../components/DialogSheet';

export function useDialog() {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const alert_ = useCallback((title: string, message: string): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({
        type: 'alert',
        title,
        message,
        resolve: () => { setDialog(null); resolve(); },
      });
    });
  }, []);

  const confirm = useCallback((title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        type: 'confirm',
        title,
        message,
        resolve: (value) => { setDialog(null); resolve(value as boolean); },
      });
    });
  }, []);

  const prompt_ = useCallback((title: string, message: string, defaultValue?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      setDialog({
        type: 'prompt',
        title,
        message,
        defaultValue: defaultValue ?? '',
        resolve: (value) => { setDialog(null); resolve(value as string | null); },
      });
    });
  }, []);

  const DialogComponent = <DialogSheet dialog={dialog} />;

  return useMemo(() => ({
    alert: alert_,
    confirm,
    prompt: prompt_,
    Dialog: DialogComponent,
    isOpen: dialog !== null,
  }), [alert_, confirm, prompt_, DialogComponent, dialog]);
}
