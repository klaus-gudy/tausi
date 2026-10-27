-- Zones get a permission of their own, and seeing every super dealer becomes
-- one too: with dealers.read alone, a salesperson sees only the dealers in the
-- zone, region or district they cover. Every role that could see dealers
-- keeps seeing the zones, and keeps seeing every dealer unless it's the
-- Salesperson role.
INSERT INTO "permissions" ("key", "description") VALUES
    ('zones.read',       'See zones and the salespeople and dealers in each'),
    ('dealers.read_all', 'See super dealers in every zone, not just the places you cover');

UPDATE "permissions"
SET "description" = 'See super dealers in the zone, region or district you cover'
WHERE "key" = 'dealers.read';

INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", p."key"
FROM "roles" r
JOIN "permissions" p ON p."key" IN ('zones.read', 'dealers.read_all')
WHERE r."organization_id" IS NULL AND r."key" = 'owner'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT rp."role_id", 'zones.read'
FROM "role_permissions" rp
WHERE rp."permission_key" = 'dealers.read'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT rp."role_id", 'dealers.read_all'
FROM "role_permissions" rp
JOIN "roles" r ON r."id" = rp."role_id"
WHERE rp."permission_key" = 'dealers.read' AND r."key" <> 'salesperson'
ON CONFLICT DO NOTHING;
