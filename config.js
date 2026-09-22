// ==========================================================================
// Configuration Supabase
// ==========================================================================
// Renseigne ces deux valeurs avec celles de TON projet Supabase :
// Tableau de bord Supabase > Project Settings > API Keys
//   - "Project URL"                                   -> SUPABASE_URL
//   - "Publishable key" (commence par sb_publishable_) -> SUPABASE_ANON_KEY
//     (sur un projet plus ancien, elle peut encore s'appeler "anon public")
//
// Ces valeurs ne sont PAS secrètes : cette clé est faite pour être visible
// côté navigateur. La sécurité réelle est assurée par les règles RLS (Row
// Level Security) définies dans schema.sql, qui limitent l'accès aux
// données à ton propre compte connecté.
//
// ON ne mets JAMAIS la "Secret key" (sb_secret_...) ici : celle-là doit rester
// uniquement côté serveur, jamais dans un fichier chargé par le navigateur.
// ==========================================================================

window.SUPABASE_URL = "https://wlrqxmpbmavhdrqdjdzt.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_7QcSL9-AymiYbjmtRFR5lw_5tLU6rMh";






