-- ============================================================
-- Maestro de Personal — normative seeds (Appendix B).
-- Idempotent rerunnability via ON CONFLICT ("Cod") DO NOTHING.
-- ============================================================

-- Lab-mandated dependencias (exact spellings), all Activo.
INSERT INTO dependencia ("DepCod","DepNom","DepEstReg") VALUES
  (1,'Sistemas',1),
  (2,'Contabilidad',1),
  (3,'Almacen',1)
ON CONFLICT ("DepCod") DO NOTHING;

INSERT INTO pais ("PaiCod","PaiNom","PaiEstReg") VALUES
  (1,'Perú',1),
  (2,'Chile',1),
  (3,'Colombia',1),
  (4,'Ecuador',1),
  (5,'Bolivia',1)
ON CONFLICT ("PaiCod") DO NOTHING;

INSERT INTO cargo ("CarCod","CarNom","CarEstReg") VALUES
  (1,'Analista de Sistemas',1),
  (2,'Programador',1),
  (3,'Contador',1),
  (4,'Almacenero',1),
  (5,'Gerente',1)
ON CONFLICT ("CarCod") DO NOTHING;

INSERT INTO personal
  ("PerCod","PerNom","PerDNI","PerFecNac","PerPaiCod","PerDepCod","PerCarCod","PerEstReg")
VALUES
  (1,'Juan Pérez','70000001','1990-03-15',1,1,2,1),
  (2,'María López','70000002','1988-07-22',1,2,3,1),
  (3,'Carlos García','70000003','1995-11-02',2,3,4,1),
  (4,'Ana Rodríguez','70000004','1985-01-30',1,1,1,1)
ON CONFLICT ("PerCod") DO NOTHING;
