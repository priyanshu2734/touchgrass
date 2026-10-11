import { useEffect, useState, type FormEvent } from 'react';
import type { ProgressEntry } from '../../types';
import { formatDate, formatDuration } from '../../utils/format';
import { Button } from '../Button';
import { ErrorMessage } from '../ErrorMessage';
import { FormField } from '../FormField';
import { Modal } from '../Modal';

const NOTE_MAX = 500;

interface Props {
  entry: ProgressEntry | null;
  onSaveNote: (entry: ProgressEntry, note: string) => Promise<void>;
  onRemove: (entry: ProgressEntry) => Promise<void>;
  onClose: () => void;
}

export function EntryModal({ entry, onSaveNote, onRemove, onClose }: Props) {
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<ProgressEntry | null>(null);
  if (entry && entry !== last) setLast(entry);
  const shown = entry ?? last;

  useEffect(() => {
    if (entry) {
      setNote(entry.note ?? '');
      setConfirming(false);
      setError(null);
    }
  }, [entry]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not save this. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (shown) void run(() => onSaveNote(shown, note.trim()));
  }

  return (
    <Modal
      open={entry !== null}
      onClose={onClose}
      busy={busy}
      title={shown?.title ?? 'Entry'}
      description={shown ? `${formatDate(shown.completedAt)} · ${formatDuration(shown.minutes)}` : undefined}
    >
      {shown && (
        <div className="space-y-6">
          <form onSubmit={save} className="space-y-4">
            <FormField id="entry-note" label="Your note" optional hint="Only you can see this.">
              <textarea
                id="entry-note"
                data-autofocus
                className="input min-h-24 resize-y"
                rows={3}
                maxLength={NOTE_MAX}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <p className="mt-1 text-right text-xs text-forest-600">
                {note.length}/{NOTE_MAX}
              </p>
            </FormField>
            <div className="flex justify-end">
              <Button type="submit" loading={busy && !confirming}>
                Save note
              </Button>
            </div>
          </form>

          {error && <ErrorMessage title="Could not save" message={error} />}

          <div className="border-t border-forest-800/10 pt-5">
            {!confirming ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-forest-700">Logged by mistake? You can remove this entry and your totals will update.</p>
                <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
                  Remove entry
                </Button>
              </div>
            ) : (
              <div role="alertdialog" aria-label="Confirm removal" className="rounded-2xl bg-ember-100/60 p-4">
                <p className="font-semibold text-forest-900">Remove this entry? It cannot be undone.</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button variant="accent" size="sm" loading={busy} onClick={() => void run(() => onRemove(shown))}>
                    Yes, remove it
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
                    Keep it
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
