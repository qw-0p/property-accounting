CREATE TABLE units_of_measure (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO units_of_measure (name) VALUES ('шт'), ('к-т'), ('пара'), ('уп'), ('л'), ('кг'), ('м'), ('од');