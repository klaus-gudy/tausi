-- Someone invited is a member from the start, waiting to accept. On its own
-- migration: a new enum value can't be used in the transaction that adds it.
ALTER TYPE "membership_status" ADD VALUE 'invited' BEFORE 'active';
