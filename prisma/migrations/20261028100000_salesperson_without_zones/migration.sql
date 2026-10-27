-- Salespeople work from their own coverage, so the Salesperson role no longer
-- opens the Zones page. Other roles keep zones.read.
DELETE FROM "role_permissions" rp
USING "roles" r
WHERE rp."role_id" = r."id" AND r."key" = 'salesperson' AND rp."permission_key" = 'zones.read';
