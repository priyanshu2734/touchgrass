import { useState, type FormEvent } from 'react';
import type { SessionInput } from '../../types';
import { Button } from '../Button';
import { ErrorMessage } from '../ErrorMessage';
import { FormField, errorId, hintId } from '../FormField';
import { Modal } from '../Modal';

const NOTE_MAX = 500;

interface Props {
  open: boolean;
  onSubmit: (input: SessionInput) => Promise<void>;
  onClose: () => void;
}

/** Log time outside that was not a quest: a walk to the shop, lunch on a bench. */
export function LogSessionModal({ open, onSubmit, onClose }: Props) {
  const [minutes, setMinutes] = useState('15');
  const [note, setNote] = useState('');
  const [minutesError, setMinutesError] = useState<string>();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(minutes);
    if (!Number.isInteger(value) || value < 1 || value > 600) {
      setMinutesError('Enter a whole number of minutes between 1 and 600.');
      return;
    }
    setMinutesError(undefined);
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit({ minutes: value, note: note.trim() || undefined });
      setNote('');
      setMinutes('15');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'We could not save this. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} busy={saving} title="Log time outside" description="Any time outdoors counts, with or without a quest.">
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-6">
        <FormField id="session-minutes" label="Minutes outside" error={minutesError} hint="Your best guess is fine.">
          <input
            id="session-minutes"
            data-autofocus
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            className="input max-w-[10rem]"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            aria-invalid={Boolean(minutesError)}
            aria-describedby={[hintId('session-minutes'), minutesError ? errorId('session-minutes') : ''].filter(Boolean).join(' ')}
          />
        </FormField>
        <FormField id="session-note" label="What did you do?" optional>
          <textarea
            id="session-note"
            className="input min-h-24 resize-y"
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Walked home the long way"
          />
          <p className="mt-1 text-right text-xs text-forest-600">
            {note.length}/{NOTE_MAX}
          </p>
        </FormField>
        {saveError && <ErrorMessage title="Could not save" message={saveError} />}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" loading={saving}>
            {saving ? 'Saving' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
