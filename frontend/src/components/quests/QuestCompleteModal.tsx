import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CompleteQuestInput, Quest } from '../../types';
import { Button } from '../Button';
import { ErrorMessage } from '../ErrorMessage';
import { FormField, errorId, hintId } from '../FormField';
import { Modal } from '../Modal';

const NOTE_MAX = 500;

interface Props {
  quest: Quest | null;
  /** Minutes to pre-fill. The person can change it. */
  suggestedMinutes: number;
  fromStart: boolean;
  repeat: boolean;
  onSubmit: (input: CompleteQuestInput) => Promise<void>;
  onClose: () => void;
}

export function QuestCompleteModal({ quest, suggestedMinutes, fromStart, repeat, onSubmit, onClose }: Props) {
  const [minutes, setMinutes] = useState(String(suggestedMinutes));
  const [note, setNote] = useState('');
  const [minutesError, setMinutesError] = useState<string>();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastQuest, setLastQuest] = useState<Quest | null>(null);
  const openId = useRef<string | null>(null);

  if (quest && quest !== lastQuest) setLastQuest(quest);
  const shown = quest ?? lastQuest;

  useEffect(() => {
    if (quest && openId.current !== quest.id) {
      openId.current = quest.id;
      setMinutes(String(suggestedMinutes));
      setNote('');
      setMinutesError(undefined);
      setSaveError(null);
    }
    if (!quest) openId.current = null;
  }, [quest, suggestedMinutes]);

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
      await onSubmit({ minutesSpent: value, reflection: note.trim() || undefined, repeat });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'We could not save this. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={quest !== null}
      onClose={onClose}
      busy={saving}
      title={repeat ? 'Log another time' : 'Log this quest'}
      description={shown ? `${shown.title}. Only log it if you did it.` : undefined}
    >
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-6">
        <FormField
          id="minutes"
          label="Minutes outside"
          hint={fromStart ? 'Pre-filled from when you pressed Start. Change it if that is not right.' : 'Your best guess is fine.'}
          error={minutesError}
        >
          <input
            id="minutes"
            data-autofocus
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            className="input max-w-[10rem]"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            aria-invalid={Boolean(minutesError)}
            aria-describedby={[hintId('minutes'), minutesError ? errorId('minutes') : ''].filter(Boolean).join(' ')}
          />
        </FormField>

        <FormField id="reflection" label="How did it go?" optional hint="A line or two for future you. It stays private to you.">
          <textarea
            id="reflection"
            className="input min-h-24 resize-y"
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-describedby={hintId('reflection')}
            placeholder="What did you notice?"
          />
          <p className="mt-1 text-right text-xs text-forest-600">
            {note.length}/{NOTE_MAX}
          </p>
        </FormField>

        {saveError && <ErrorMessage title="Could not save" message={saveError} />}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Not yet
          </Button>
          <Button type="submit" variant="accent" loading={saving}>
            {saving ? 'Saving' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
