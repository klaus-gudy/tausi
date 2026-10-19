-- NOT VALID only skips existing rows when the check is added; Postgres still
-- checks every later UPDATE, so a dealer saved without a phone or email could
-- no longer be deactivated or reactivated. Exempt the dealers that existed
-- when this runs instead; the form still asks them for one when edited.
ALTER TABLE "super_dealers" DROP CONSTRAINT "super_dealers_contact_check";

DO $$
BEGIN
    EXECUTE format(
        'ALTER TABLE "super_dealers" ADD CONSTRAINT "super_dealers_contact_check" CHECK (
            "phone" IS NOT NULL OR "email" IS NOT NULL OR "created_at" < %L::timestamptz
        )',
        now()
    );
END
$$;
