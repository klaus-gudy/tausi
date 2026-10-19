-- Places: Tanzania's zones, regions and districts, picked from lists instead
-- of typed. Shared by every organization, like permissions. Keys are slugs
-- of the names ("dar-es-salaam", "kinondoni") so they read well in SQL.
CREATE TABLE "zones" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "regions" (
    "key" TEXT NOT NULL,
    "zone_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "districts" (
    "region_key" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("region_key", "key")
);

-- CreateIndex
CREATE INDEX "regions_zone_key_idx" ON "regions"("zone_key");

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_zone_key_fkey" FOREIGN KEY ("zone_key") REFERENCES "zones"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_region_key_fkey" FOREIGN KEY ("region_key") REFERENCES "regions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: the 8 sales zones, 31 regions (26 mainland, 5 Zanzibar) and their
-- 150 districts as of the 2022 census.
INSERT INTO "zones" ("key", "name", "position") VALUES
    ('coastal', 'Coastal Zone', 1),
    ('northern', 'Northern Zone', 2),
    ('lake', 'Lake Zone', 3),
    ('central', 'Central Zone', 4),
    ('western', 'Western Zone', 5),
    ('southern-highlands', 'Southern Highlands Zone', 6),
    ('southern', 'Southern Zone', 7),
    ('zanzibar', 'Zanzibar', 8);

INSERT INTO "regions" ("key", "zone_key", "name") VALUES
    ('dar-es-salaam', 'coastal', 'Dar es Salaam'),
    ('pwani', 'coastal', 'Pwani'),
    ('tanga', 'coastal', 'Tanga'),
    ('morogoro', 'coastal', 'Morogoro'),
    ('arusha', 'northern', 'Arusha'),
    ('kilimanjaro', 'northern', 'Kilimanjaro'),
    ('manyara', 'northern', 'Manyara'),
    ('mwanza', 'lake', 'Mwanza'),
    ('mara', 'lake', 'Mara'),
    ('kagera', 'lake', 'Kagera'),
    ('geita', 'lake', 'Geita'),
    ('shinyanga', 'lake', 'Shinyanga'),
    ('simiyu', 'lake', 'Simiyu'),
    ('dodoma', 'central', 'Dodoma'),
    ('singida', 'central', 'Singida'),
    ('tabora', 'western', 'Tabora'),
    ('kigoma', 'western', 'Kigoma'),
    ('katavi', 'western', 'Katavi'),
    ('mbeya', 'southern-highlands', 'Mbeya'),
    ('songwe', 'southern-highlands', 'Songwe'),
    ('iringa', 'southern-highlands', 'Iringa'),
    ('njombe', 'southern-highlands', 'Njombe'),
    ('rukwa', 'southern-highlands', 'Rukwa'),
    ('lindi', 'southern', 'Lindi'),
    ('mtwara', 'southern', 'Mtwara'),
    ('ruvuma', 'southern', 'Ruvuma'),
    ('mjini-magharibi', 'zanzibar', 'Mjini Magharibi'),
    ('kaskazini-unguja', 'zanzibar', 'Kaskazini Unguja'),
    ('kusini-unguja', 'zanzibar', 'Kusini Unguja'),
    ('kaskazini-pemba', 'zanzibar', 'Kaskazini Pemba'),
    ('kusini-pemba', 'zanzibar', 'Kusini Pemba');

INSERT INTO "districts" ("region_key", "key", "name") VALUES
    ('dar-es-salaam', 'ilala', 'Ilala'),
    ('dar-es-salaam', 'kigamboni', 'Kigamboni'),
    ('dar-es-salaam', 'kinondoni', 'Kinondoni'),
    ('dar-es-salaam', 'temeke', 'Temeke'),
    ('dar-es-salaam', 'ubungo', 'Ubungo'),
    ('pwani', 'bagamoyo', 'Bagamoyo'),
    ('pwani', 'kibaha', 'Kibaha'),
    ('pwani', 'kibiti', 'Kibiti'),
    ('pwani', 'kisarawe', 'Kisarawe'),
    ('pwani', 'mafia', 'Mafia'),
    ('pwani', 'mkuranga', 'Mkuranga'),
    ('pwani', 'rufiji', 'Rufiji'),
    ('tanga', 'handeni', 'Handeni'),
    ('tanga', 'kilindi', 'Kilindi'),
    ('tanga', 'korogwe', 'Korogwe'),
    ('tanga', 'lushoto', 'Lushoto'),
    ('tanga', 'mkinga', 'Mkinga'),
    ('tanga', 'muheza', 'Muheza'),
    ('tanga', 'pangani', 'Pangani'),
    ('tanga', 'tanga', 'Tanga'),
    ('morogoro', 'gairo', 'Gairo'),
    ('morogoro', 'kilombero', 'Kilombero'),
    ('morogoro', 'kilosa', 'Kilosa'),
    ('morogoro', 'malinyi', 'Malinyi'),
    ('morogoro', 'morogoro', 'Morogoro'),
    ('morogoro', 'mvomero', 'Mvomero'),
    ('morogoro', 'ulanga', 'Ulanga'),
    ('arusha', 'arumeru', 'Arumeru'),
    ('arusha', 'arusha', 'Arusha'),
    ('arusha', 'karatu', 'Karatu'),
    ('arusha', 'longido', 'Longido'),
    ('arusha', 'monduli', 'Monduli'),
    ('arusha', 'ngorongoro', 'Ngorongoro'),
    ('kilimanjaro', 'hai', 'Hai'),
    ('kilimanjaro', 'moshi', 'Moshi'),
    ('kilimanjaro', 'mwanga', 'Mwanga'),
    ('kilimanjaro', 'rombo', 'Rombo'),
    ('kilimanjaro', 'same', 'Same'),
    ('kilimanjaro', 'siha', 'Siha'),
    ('manyara', 'babati', 'Babati'),
    ('manyara', 'hanang', 'Hanang'),
    ('manyara', 'kiteto', 'Kiteto'),
    ('manyara', 'mbulu', 'Mbulu'),
    ('manyara', 'simanjiro', 'Simanjiro'),
    ('mwanza', 'ilemela', 'Ilemela'),
    ('mwanza', 'kwimba', 'Kwimba'),
    ('mwanza', 'magu', 'Magu'),
    ('mwanza', 'misungwi', 'Misungwi'),
    ('mwanza', 'nyamagana', 'Nyamagana'),
    ('mwanza', 'sengerema', 'Sengerema'),
    ('mwanza', 'ukerewe', 'Ukerewe'),
    ('mara', 'bunda', 'Bunda'),
    ('mara', 'butiama', 'Butiama'),
    ('mara', 'musoma', 'Musoma'),
    ('mara', 'rorya', 'Rorya'),
    ('mara', 'serengeti', 'Serengeti'),
    ('mara', 'tarime', 'Tarime'),
    ('kagera', 'biharamulo', 'Biharamulo'),
    ('kagera', 'bukoba', 'Bukoba'),
    ('kagera', 'karagwe', 'Karagwe'),
    ('kagera', 'kyerwa', 'Kyerwa'),
    ('kagera', 'missenyi', 'Missenyi'),
    ('kagera', 'muleba', 'Muleba'),
    ('kagera', 'ngara', 'Ngara'),
    ('geita', 'bukombe', 'Bukombe'),
    ('geita', 'chato', 'Chato'),
    ('geita', 'geita', 'Geita'),
    ('geita', 'mbogwe', 'Mbogwe'),
    ('geita', 'nyang-hwale', 'Nyang''hwale'),
    ('shinyanga', 'kahama', 'Kahama'),
    ('shinyanga', 'kishapu', 'Kishapu'),
    ('shinyanga', 'shinyanga', 'Shinyanga'),
    ('simiyu', 'bariadi', 'Bariadi'),
    ('simiyu', 'busega', 'Busega'),
    ('simiyu', 'itilima', 'Itilima'),
    ('simiyu', 'maswa', 'Maswa'),
    ('simiyu', 'meatu', 'Meatu'),
    ('dodoma', 'bahi', 'Bahi'),
    ('dodoma', 'chamwino', 'Chamwino'),
    ('dodoma', 'chemba', 'Chemba'),
    ('dodoma', 'dodoma', 'Dodoma'),
    ('dodoma', 'kondoa', 'Kondoa'),
    ('dodoma', 'kongwa', 'Kongwa'),
    ('dodoma', 'mpwapwa', 'Mpwapwa'),
    ('singida', 'ikungi', 'Ikungi'),
    ('singida', 'iramba', 'Iramba'),
    ('singida', 'manyoni', 'Manyoni'),
    ('singida', 'mkalama', 'Mkalama'),
    ('singida', 'singida', 'Singida'),
    ('tabora', 'igunga', 'Igunga'),
    ('tabora', 'kaliua', 'Kaliua'),
    ('tabora', 'nzega', 'Nzega'),
    ('tabora', 'sikonge', 'Sikonge'),
    ('tabora', 'tabora', 'Tabora'),
    ('tabora', 'urambo', 'Urambo'),
    ('tabora', 'uyui', 'Uyui'),
    ('kigoma', 'buhigwe', 'Buhigwe'),
    ('kigoma', 'kakonko', 'Kakonko'),
    ('kigoma', 'kasulu', 'Kasulu'),
    ('kigoma', 'kibondo', 'Kibondo'),
    ('kigoma', 'kigoma', 'Kigoma'),
    ('kigoma', 'uvinza', 'Uvinza'),
    ('katavi', 'mlele', 'Mlele'),
    ('katavi', 'mpanda', 'Mpanda'),
    ('katavi', 'tanganyika', 'Tanganyika'),
    ('mbeya', 'chunya', 'Chunya'),
    ('mbeya', 'kyela', 'Kyela'),
    ('mbeya', 'mbarali', 'Mbarali'),
    ('mbeya', 'mbeya', 'Mbeya'),
    ('mbeya', 'rungwe', 'Rungwe'),
    ('songwe', 'ileje', 'Ileje'),
    ('songwe', 'mbozi', 'Mbozi'),
    ('songwe', 'momba', 'Momba'),
    ('songwe', 'songwe', 'Songwe'),
    ('iringa', 'iringa', 'Iringa'),
    ('iringa', 'kilolo', 'Kilolo'),
    ('iringa', 'mufindi', 'Mufindi'),
    ('njombe', 'ludewa', 'Ludewa'),
    ('njombe', 'makete', 'Makete'),
    ('njombe', 'njombe', 'Njombe'),
    ('njombe', 'wanging-ombe', 'Wanging''ombe'),
    ('rukwa', 'kalambo', 'Kalambo'),
    ('rukwa', 'nkasi', 'Nkasi'),
    ('rukwa', 'sumbawanga', 'Sumbawanga'),
    ('lindi', 'kilwa', 'Kilwa'),
    ('lindi', 'lindi', 'Lindi'),
    ('lindi', 'liwale', 'Liwale'),
    ('lindi', 'nachingwea', 'Nachingwea'),
    ('lindi', 'ruangwa', 'Ruangwa'),
    ('mtwara', 'masasi', 'Masasi'),
    ('mtwara', 'mtwara', 'Mtwara'),
    ('mtwara', 'nanyumbu', 'Nanyumbu'),
    ('mtwara', 'newala', 'Newala'),
    ('mtwara', 'tandahimba', 'Tandahimba'),
    ('ruvuma', 'mbinga', 'Mbinga'),
    ('ruvuma', 'namtumbo', 'Namtumbo'),
    ('ruvuma', 'nyasa', 'Nyasa'),
    ('ruvuma', 'songea', 'Songea'),
    ('ruvuma', 'tunduru', 'Tunduru'),
    ('mjini-magharibi', 'magharibi-a', 'Magharibi A'),
    ('mjini-magharibi', 'magharibi-b', 'Magharibi B'),
    ('mjini-magharibi', 'mjini', 'Mjini'),
    ('kaskazini-unguja', 'kaskazini-a', 'Kaskazini A'),
    ('kaskazini-unguja', 'kaskazini-b', 'Kaskazini B'),
    ('kusini-unguja', 'kati', 'Kati'),
    ('kusini-unguja', 'kusini', 'Kusini'),
    ('kaskazini-pemba', 'micheweni', 'Micheweni'),
    ('kaskazini-pemba', 'wete', 'Wete'),
    ('kusini-pemba', 'chake-chake', 'Chake Chake'),
    ('kusini-pemba', 'mkoani', 'Mkoani');

-- Super dealers: a shop name and a contact name, either of which may be
-- missing; a region and district from the lists above instead of free text.
ALTER TABLE "super_dealers" RENAME COLUMN "name" TO "shop_name";
ALTER TABLE "super_dealers" RENAME COLUMN "contact_person" TO "contact_name";
ALTER TABLE "super_dealers" ALTER COLUMN "shop_name" DROP NOT NULL;
ALTER INDEX "super_dealers_organization_id_name_key" RENAME TO "super_dealers_organization_id_shop_name_key";

ALTER TABLE "super_dealers"
    ADD COLUMN "region_key" TEXT,
    ADD COLUMN "district_key" TEXT;

-- Typed regions that name one of the list's move over; anything else is kept
-- at the end of the address so nothing is lost.
UPDATE "super_dealers" d
SET "region_key" = r."key"
FROM "regions" r
WHERE lower(btrim(d."region")) IN (lower(r."name"), r."key")
   OR (r."key" = 'pwani' AND lower(btrim(d."region")) = 'coast')
   OR (r."key" = 'dar-es-salaam' AND lower(btrim(d."region")) IN ('dar', 'dsm'));

UPDATE "super_dealers"
SET "address" = concat_ws(', ', "address", btrim("region"))
WHERE "region_key" IS NULL AND btrim(coalesce("region", '')) <> '';

ALTER TABLE "super_dealers" DROP COLUMN "region";

-- CreateIndex
CREATE INDEX "super_dealers_region_key_idx" ON "super_dealers"("region_key");

-- AddForeignKey
ALTER TABLE "super_dealers" ADD CONSTRAINT "super_dealers_region_key_fkey" FOREIGN KEY ("region_key") REFERENCES "regions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: the district must be in the dealer's region. With MATCH
-- SIMPLE a dealer without a district isn't checked.
ALTER TABLE "super_dealers" ADD CONSTRAINT "super_dealers_region_key_district_key_fkey" FOREIGN KEY ("region_key", "district_key") REFERENCES "districts"("region_key", "key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A dealer is known by a shop name or a contact name, and reached by phone or
-- email. Dealers saved before this rule may lack both, so it is checked for
-- new and edited rows only (NOT VALID); editing such a dealer asks for one.
ALTER TABLE "super_dealers" ADD CONSTRAINT "super_dealers_name_check" CHECK (
    "shop_name" IS NOT NULL OR "contact_name" IS NOT NULL
);
ALTER TABLE "super_dealers" ADD CONSTRAINT "super_dealers_contact_check" CHECK (
    "phone" IS NOT NULL OR "email" IS NOT NULL
) NOT VALID;
