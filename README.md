# Wedding Website

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run [`supabase-schema.sql`](supabase-schema.sql).
3. Copy the project URL and anon/public key from Project Settings → API into [`supabase-config.js`](supabase-config.js).
4. Deploy the site as usual. The wishes board and RSVP form will then use Supabase; if the config is empty, they fall back to browser-only storage.

Never put a Supabase service-role key in the browser. Only use the anon/public key in `supabase-config.js`.
