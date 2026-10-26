-- Only salespeople supply super dealers now (transfers, then deliveries), so
-- stock isn't issued straight from a warehouse any more. Roles lose the key
-- through role_permissions' cascade; past issued movements stay as history.
DELETE FROM "permissions" WHERE "key" = 'stock.issue';
