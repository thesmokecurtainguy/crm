-- Normalize phones imported as Excel floats or bare digits to (NNN) NNN-NNNN
UPDATE "company"
SET "phone" = '(' || substr(d, 1, 3) || ') ' || substr(d, 4, 3) || '-' || substr(d, 7, 4)
FROM (
  SELECT id, regexp_replace(regexp_replace("phone", '\.0+$', ''), '\D', '', 'g') AS d
  FROM "company"
  WHERE "phone" IS NOT NULL
) AS src
WHERE "company".id = src.id
  AND length(src.d) = 10;

UPDATE "company"
SET "phone" = '(' || substr(d, 2, 3) || ') ' || substr(d, 5, 3) || '-' || substr(d, 8, 4)
FROM (
  SELECT id, regexp_replace(regexp_replace("phone", '\.0+$', ''), '\D', '', 'g') AS d
  FROM "company"
  WHERE "phone" IS NOT NULL
) AS src
WHERE "company".id = src.id
  AND length(src.d) = 11 AND src.d LIKE '1%';

UPDATE "contact"
SET "phone" = '(' || substr(d, 1, 3) || ') ' || substr(d, 4, 3) || '-' || substr(d, 7, 4)
FROM (
  SELECT id, regexp_replace(regexp_replace("phone", '\.0+$', ''), '\D', '', 'g') AS d
  FROM "contact"
  WHERE "phone" IS NOT NULL
) AS src
WHERE "contact".id = src.id
  AND length(src.d) = 10;
