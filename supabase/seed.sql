-- ============================================================
-- Maestro de Personal — normative seeds (Appendix B) + extended demo catalog.
-- Idempotent rerunnability via ON CONFLICT ("Cod") DO NOTHING.
-- ============================================================

-- Lab-mandated dependencias (exact spellings 1..3), plus extended operational units.
INSERT INTO dependencia ("DepCod","DepNom","DepEstReg") VALUES
  (1,'Sistemas',1),
  (2,'Contabilidad',1),
  (3,'Almacen',1),
  (4,'Recursos Humanos',1),
  (5,'Logística',1),
  (6,'Comercial',1),
  (7,'Operaciones',1),
  (8,'Auditoría Interna',2)
ON CONFLICT ("DepCod") DO NOTHING;

-- Normative countries (1..5), plus extended LATAM/Iberoamérica catalog.
INSERT INTO pais ("PaiCod","PaiNom","PaiEstReg") VALUES
  (1,'Perú',1),
  (2,'Chile',1),
  (3,'Colombia',1),
  (4,'Ecuador',1),
  (5,'Bolivia',1),
  (6,'Argentina',1),
  (7,'Brasil',1),
  (8,'México',1),
  (9,'Uruguay',1),
  (10,'España',1),
  (11,'Costa Rica',2)
ON CONFLICT ("PaiCod") DO NOTHING;

-- Normative cargos (1..5), plus extended roles across Soluciones Móviles S.A.C.
INSERT INTO cargo ("CarCod","CarNom","CarEstReg") VALUES
  (1,'Analista de Sistemas',1),
  (2,'Programador',1),
  (3,'Contador',1),
  (4,'Almacenero',1),
  (5,'Gerente',1),
  (6,'Arquitecto de Software',1),
  (7,'Especialista QA',1),
  (8,'Analista de Recursos Humanos',1),
  (9,'Coordinador Logístico',1),
  (10,'Ejecutivo Comercial',1),
  (11,'Administrador de Base de Datos',1),
  (12,'Digitador Temporal',2)
ON CONFLICT ("CarCod") DO NOTHING;

-- Normative employees (1..4) + extended team roster (5..14).
INSERT INTO personal
  ("PerCod","PerNom","PerDNI","PerFecNac","PerPaiCod","PerDepCod","PerCarCod","PerEstReg")
VALUES
  (1,'Juan Pérez','70000001','1990-03-15',1,1,2,1),
  (2,'María López','70000002','1988-07-22',1,2,3,1),
  (3,'Carlos García','70000003','1995-11-02',2,3,4,1),
  (4,'Ana Rodríguez','70000004','1985-01-30',1,1,1,1),
  (5,'Luis Quispe Mamani','70000005','1992-05-14',1,1,6,1),
  (6,'Valeria Mendoza Rojas','70000006','1996-09-18',1,1,7,1),
  (7,'Diego Paredes Vargas','70000007','1989-12-04',3,4,8,1),
  (8,'Camila Flores Huamán','70000008','1994-02-25',1,5,9,1),
  (9,'Andrés Salazar Castro','70000009','1987-06-11',4,6,10,1),
  (10,'Lucía Chávez Aguilar','70000010','1993-08-09',1,1,11,1),
  (11,'Jorge Villanueva Soto','70000011','1983-04-20',5,7,5,1),
  (12,'Sofía Gutiérrez Ramos','70000012','1998-10-12',6,2,3,1),
  (13,'Ricardo Medina Ponce','70000013','1991-01-07',1,3,4,2),
  (14,'Elena Cáceres Delgado','70000014','1997-07-29',2,6,10,1)
ON CONFLICT ("PerCod") DO NOTHING;
