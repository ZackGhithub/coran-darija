import { memo, useEffect, useState } from 'react';
import type { Flag, VerseMark } from '../lib/marks';
import Icon from './Icon';

interface Props {
  vkey: string; // « sourate:verset »
  mark?: VerseMark;
  onFlag: (key: string, flag: Flag) => void;
  onNote: (key: string, text: string) => void;
}

/**
 * Marques personnelles d'un verset : mémorisé (pour savoir où on en est), favori (à garder sous la main)
 * et note. Les données restent sur l'appareil.
 */
export default memo(function VerseMarks({ vkey, mark, onFlag, onNote }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(mark?.n ?? '');
  useEffect(() => setDraft(mark?.n ?? ''), [mark?.n]);
  const save = () => {
    if (draft.trim() !== (mark?.n ?? '')) onNote(vkey, draft);
  };

  return (
    <div className="marks">
      <div className="marks-row">
        <button
          type="button"
          className={`mark-pill ${mark?.m ? 'on-m' : ''}`}
          aria-pressed={!!mark?.m}
          onClick={() => onFlag(vkey, 'm')}
          title="Cochez quand ce verset est mémorisé, pour savoir où vous en êtes"
        >
          <Icon name={mark?.m ? 'memorized' : 'unmemorized'} /> Mémorisé
        </button>
        <button
          type="button"
          className={`mark-pill ${mark?.f ? 'on-f' : ''}`}
          aria-pressed={!!mark?.f}
          onClick={() => onFlag(vkey, 'f')}
          title="Garder ce verset dans vos favoris"
        >
          <Icon name="favorite" filled={!!mark?.f} /> Favori
        </button>
        <button
          type="button"
          className={`mark-pill ${mark?.n ? 'on-n' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          title="Ajouter une note sur ce verset"
        >
          <Icon name="note" /> Note{mark?.n && <span className="note-dot" title="Une note est enregistrée" />}
        </button>
      </div>

      {open && (
        <div className="note-editor">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            rows={3}
            maxLength={1000}
            placeholder="Votre note sur ce verset : un rappel, le sens, une astuce pour le retenir…"
            aria-label={`Note du verset ${vkey}`}
          />
          <div className="note-actions">
            <button
              type="button"
              className="btn-action-compact"
              onClick={() => {
                save();
                setOpen(false);
              }}
            >
              Enregistrer
            </button>
            {mark?.n && (
              <button
                type="button"
                className="btn-action-compact"
                onClick={() => {
                  onNote(vkey, '');
                  setDraft('');
                  setOpen(false);
                }}
              >
                Supprimer la note
              </button>
            )}
          </div>
        </div>
      )}
      {!open && mark?.n && (
        <button type="button" className="note-preview" onClick={() => setOpen(true)} title="Modifier la note">
          <Icon name="note" /> {mark.n}
        </button>
      )}
    </div>
  );
});
