-- Owner is now the only system role. Every other role is the organization's
-- own, made on the roles page. Organizations already using the old admin,
-- storekeeper, salesperson, member and viewer roles get their own copy of
-- each, with the same permissions, so nobody's access changes.
INSERT INTO "roles" ("organization_id", "key", "name", "description")
SELECT DISTINCT used."organization_id", r."key", r."name", r."description"
FROM "roles" r
JOIN (
    SELECT "organization_id", "role_id" FROM "memberships"
    UNION
    SELECT "organization_id", "role_id" FROM "invitations"
) used ON used."role_id" = r."id"
WHERE r."organization_id" IS NULL AND r."key" IN ('admin', 'storekeeper', 'salesperson', 'member', 'viewer');

INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT copy."id", rp."permission_key"
FROM "roles" copy
JOIN "roles" sys ON sys."key" = copy."key" AND sys."organization_id" IS NULL
JOIN "role_permissions" rp ON rp."role_id" = sys."id"
WHERE copy."organization_id" IS NOT NULL AND copy."key" IN ('admin', 'storekeeper', 'salesperson', 'member', 'viewer');

UPDATE "memberships" m
SET "role_id" = copy."id"
FROM "roles" sys, "roles" copy
WHERE m."role_id" = sys."id"
    AND sys."organization_id" IS NULL AND sys."key" IN ('admin', 'storekeeper', 'salesperson', 'member', 'viewer')
    AND copy."organization_id" = m."organization_id" AND copy."key" = sys."key";

UPDATE "invitations" i
SET "role_id" = copy."id"
FROM "roles" sys, "roles" copy
WHERE i."role_id" = sys."id"
    AND sys."organization_id" IS NULL AND sys."key" IN ('admin', 'storekeeper', 'salesperson', 'member', 'viewer')
    AND copy."organization_id" = i."organization_id" AND copy."key" = sys."key";

-- Their permission grants go with them (ON DELETE CASCADE).
DELETE FROM "roles" WHERE "organization_id" IS NULL AND "key" IN ('admin', 'storekeeper', 'salesperson', 'member', 'viewer');
