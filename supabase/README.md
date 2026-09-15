# Supabase

Local Supabase project for recon.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for `supabase start`)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

## Commands

```bash
# Start local stack (Postgres, Auth, Storage, etc.)
supabase start

# Stop local stack
supabase stop

# Create a new migration
supabase migration new <name>

# Apply migrations locally
supabase db reset

# Link to a remote project (one-time)
supabase link --project-ref <project-ref>
```

## Layout

```text
supabase/
├── config.toml      # Local project configuration
├── migrations/      # SQL migrations (versioned)
└── seed.sql         # Seed data for local resets
```
