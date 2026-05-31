ALTER TABLE items DROP COLUMN unit;
ALTER TABLE items ADD COLUMN unit_of_measure_id INTEGER REFERENCES units_of_measure(id) ON DELETE SET NULL;