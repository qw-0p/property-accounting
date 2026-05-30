ALTER TABLE units
  ADD COLUMN status_id INTEGER REFERENCES statuses(id) ON DELETE SET NULL,
  ADD COLUMN location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  ADD COLUMN counted BOOLEAN DEFAULT true,
  ADD COLUMN available BOOLEAN DEFAULT true,
  ADD COLUMN report TEXT,
  ADD COLUMN journal_entry TEXT,
  ADD COLUMN note TEXT;

ALTER TABLE items
  DROP COLUMN counted,
  DROP COLUMN available,
  DROP COLUMN total_quantity,
  DROP COLUMN status_id,
  DROP COLUMN location_id,
  DROP COLUMN report,
  DROP COLUMN journal_entry,
  DROP COLUMN note;