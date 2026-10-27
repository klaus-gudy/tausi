-- A member is a salesperson exactly when their role is Salesperson (the
-- role keyed 'salesperson'). Bring existing members in line with that.

-- Members given the role from Members never got a salesperson record.
INSERT INTO "salespeople" ("organization_id", "membership_id")
SELECT m."organization_id", m."id"
FROM "memberships" m
JOIN "roles" r ON r."id" = m."role_id"
WHERE r."key" = 'salesperson'
  AND NOT EXISTS (SELECT 1 FROM "salespeople" s WHERE s."membership_id" = m."id");

-- Salespeople whose member has another role: dropped when they have no
-- history, deactivated (kept on record) when they do.
DELETE FROM "salespeople" s
USING "memberships" m, "roles" r
WHERE m."id" = s."membership_id"
  AND r."id" = m."role_id"
  AND r."key" <> 'salesperson'
  AND NOT EXISTS (SELECT 1 FROM "stock_transfers" t WHERE t."salesperson_id" = s."id")
  AND NOT EXISTS (SELECT 1 FROM "deliveries" d WHERE d."salesperson_id" = s."id");

UPDATE "salespeople" s
SET "deactivated_at" = now()
FROM "memberships" m
JOIN "roles" r ON r."id" = m."role_id"
WHERE m."id" = s."membership_id"
  AND r."key" <> 'salesperson'
  AND s."deactivated_at" IS NULL;
