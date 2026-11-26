-- Fase 5: comentarios traídos de afuera cuyo autor no tiene cuenta acá. Se guarda su nombre para mostrarlo.
ALTER TABLE comentarios ADD COLUMN autor_externo TEXT;
