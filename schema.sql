-- ==========================================================================
-- Suivi des Ventes — schéma de base de données (Supabase / Postgres)
-- À exécuter une seule fois dans : Tableau de bord Supabase > SQL Editor
-- ==========================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------------
-- Table des ventes
-- ------------------------------------------------------------------------
create table if not exists ventes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_name  text not null,
  montant      numeric(12,2) not null check (montant > 0),
  description  text not null default 'Fournitures scolaires',
  type         text not null check (type in ('cash','credit')),
  date         date not null default current_date,
  created_at   timestamptz not null default now()
);

create index if not exists idx_ventes_user_date on ventes(user_id, date desc);

-- ------------------------------------------------------------------------
-- Table des paiements / encaissements
-- Une vente "cash" reçoit automatiquement un paiement égal au montant total
-- au moment de sa création (géré côté application). Une vente "credit"
-- peut recevoir 0, 1 ou plusieurs paiements partiels jusqu'à extinction
-- de la dette.
-- ------------------------------------------------------------------------
create table if not exists paiements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vente_id     uuid not null references ventes(id) on delete cascade,
  montant      numeric(12,2) not null check (montant > 0),
  date         date not null default current_date,
  created_at   timestamptz not null default now()
);

create index if not exists idx_paiements_vente on paiements(vente_id);
create index if not exists idx_paiements_user_date on paiements(user_id, date);

-- ------------------------------------------------------------------------
-- Row Level Security : chaque utilisateur ne voit / modifie que ses
-- propres données. Comme ce site n'a qu'un seul compte, cela n'a l'air
-- utile qu'en apparence — mais c'est ce qui rend la clé "anon" totalement
-- sûre à exposer publiquement, et permet d'ajouter un jour d'autres
-- comptes sans rien changer au code.
-- ------------------------------------------------------------------------
alter table ventes enable row level security;
alter table paiements enable row level security;

drop policy if exists "ventes_owner_all" on ventes;
create policy "ventes_owner_all" on ventes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "paiements_owner_all" on paiements;
create policy "paiements_owner_all" on paiements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------------
-- Temps réel : permet au site de recevoir automatiquement les changements
-- (nouvelle vente, encaissement...) faits depuis un autre appareil connecté
-- au même compte, sans avoir à recharger la page. Le bloc do $$ ... end $$
-- évite une erreur si le script est ré-exécuté et que les tables sont déjà
-- dans la publication.
-- ------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ventes'
  ) then
    alter publication supabase_realtime add table ventes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'paiements'
  ) then
    alter publication supabase_realtime add table paiements;
  end if;
end $$;

-- ==========================================================================
-- Après avoir exécuté ce script :
-- 1. Va dans Authentication > Users > "Add user" et crée TON compte
--    (email + mot de passe). C'est ce compte qui te servira à te
--    connecter sur le site.
-- 2. Récupère l'URL du projet et la clé "anon public" dans
--    Project Settings > API, et colle-les dans config.js.
-- ==========================================================================