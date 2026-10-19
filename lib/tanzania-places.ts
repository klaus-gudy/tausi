// Tanzania's 8 sales zones, 31 regions (26 mainland, 5 Zanzibar) and their
// 150 districts as of the 2022 census, in list order: what a new
// organization's places can start from. Region and district keys are slugs
// of their names; see placeKey in lib/places.ts.
export const TANZANIA_PLACES: {
  key: string
  name: string
  regions: { name: string; districts: string[] }[]
}[] = [
  {
    key: "coastal",
    name: "Coastal Zone",
    regions: [
      { name: "Dar es Salaam", districts: ["Ilala", "Kigamboni", "Kinondoni", "Temeke", "Ubungo"] },
      { name: "Pwani", districts: ["Bagamoyo", "Kibaha", "Kibiti", "Kisarawe", "Mafia", "Mkuranga", "Rufiji"] },
      { name: "Tanga", districts: ["Handeni", "Kilindi", "Korogwe", "Lushoto", "Mkinga", "Muheza", "Pangani", "Tanga"] },
      { name: "Morogoro", districts: ["Gairo", "Kilombero", "Kilosa", "Malinyi", "Morogoro", "Mvomero", "Ulanga"] },
    ],
  },
  {
    key: "northern",
    name: "Northern Zone",
    regions: [
      { name: "Arusha", districts: ["Arumeru", "Arusha", "Karatu", "Longido", "Monduli", "Ngorongoro"] },
      { name: "Kilimanjaro", districts: ["Hai", "Moshi", "Mwanga", "Rombo", "Same", "Siha"] },
      { name: "Manyara", districts: ["Babati", "Hanang", "Kiteto", "Mbulu", "Simanjiro"] },
    ],
  },
  {
    key: "lake",
    name: "Lake Zone",
    regions: [
      { name: "Mwanza", districts: ["Ilemela", "Kwimba", "Magu", "Misungwi", "Nyamagana", "Sengerema", "Ukerewe"] },
      { name: "Mara", districts: ["Bunda", "Butiama", "Musoma", "Rorya", "Serengeti", "Tarime"] },
      { name: "Kagera", districts: ["Biharamulo", "Bukoba", "Karagwe", "Kyerwa", "Missenyi", "Muleba", "Ngara"] },
      { name: "Geita", districts: ["Bukombe", "Chato", "Geita", "Mbogwe", "Nyang'hwale"] },
      { name: "Shinyanga", districts: ["Kahama", "Kishapu", "Shinyanga"] },
      { name: "Simiyu", districts: ["Bariadi", "Busega", "Itilima", "Maswa", "Meatu"] },
    ],
  },
  {
    key: "central",
    name: "Central Zone",
    regions: [
      { name: "Dodoma", districts: ["Bahi", "Chamwino", "Chemba", "Dodoma", "Kondoa", "Kongwa", "Mpwapwa"] },
      { name: "Singida", districts: ["Ikungi", "Iramba", "Manyoni", "Mkalama", "Singida"] },
    ],
  },
  {
    key: "western",
    name: "Western Zone",
    regions: [
      { name: "Tabora", districts: ["Igunga", "Kaliua", "Nzega", "Sikonge", "Tabora", "Urambo", "Uyui"] },
      { name: "Kigoma", districts: ["Buhigwe", "Kakonko", "Kasulu", "Kibondo", "Kigoma", "Uvinza"] },
      { name: "Katavi", districts: ["Mlele", "Mpanda", "Tanganyika"] },
    ],
  },
  {
    key: "southern-highlands",
    name: "Southern Highlands Zone",
    regions: [
      { name: "Mbeya", districts: ["Chunya", "Kyela", "Mbarali", "Mbeya", "Rungwe"] },
      { name: "Songwe", districts: ["Ileje", "Mbozi", "Momba", "Songwe"] },
      { name: "Iringa", districts: ["Iringa", "Kilolo", "Mufindi"] },
      { name: "Njombe", districts: ["Ludewa", "Makete", "Njombe", "Wanging'ombe"] },
      { name: "Rukwa", districts: ["Kalambo", "Nkasi", "Sumbawanga"] },
    ],
  },
  {
    key: "southern",
    name: "Southern Zone",
    regions: [
      { name: "Lindi", districts: ["Kilwa", "Lindi", "Liwale", "Nachingwea", "Ruangwa"] },
      { name: "Mtwara", districts: ["Masasi", "Mtwara", "Nanyumbu", "Newala", "Tandahimba"] },
      { name: "Ruvuma", districts: ["Mbinga", "Namtumbo", "Nyasa", "Songea", "Tunduru"] },
    ],
  },
  {
    key: "zanzibar",
    name: "Zanzibar",
    regions: [
      { name: "Mjini Magharibi", districts: ["Magharibi A", "Magharibi B", "Mjini"] },
      { name: "Kaskazini Unguja", districts: ["Kaskazini A", "Kaskazini B"] },
      { name: "Kusini Unguja", districts: ["Kati", "Kusini"] },
      { name: "Kaskazini Pemba", districts: ["Micheweni", "Wete"] },
      { name: "Kusini Pemba", districts: ["Chake Chake", "Mkoani"] },
    ],
  },
]
