# Wedding Website

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run [`supabase-schema.sql`](supabase-schema.sql).
3. Copy the project URL and anon/public key from Project Settings → API into [`supabase-config.js`](supabase-config.js).
4. Deploy the site as usual. The wishes board and RSVP form will then use Supabase; if the config is empty, they fall back to browser-only storage.

Never put a Supabase service-role key in the browser. Only use the anon/public key in `supabase-config.js`.

## Python RSVP viewer

Double-click `start_rsvp_viewer.bat`, or run `python rsvp_viewer.py` from this folder.
Requires Python 3 with Tkinter (included in the standard Windows Python installer).
No third-party packages are needed.

1. The viewer reads your project URL from `supabase-config.js`.
2. Enter your Supabase **secret key** (or legacy **service-role key**) from your project's API key settings, then click **Connect / Refresh**. The website's publishable key cannot read private RSVPs under the existing database policies.
3. View total replies, accepted replies, declined replies, and attending guests. Guest totals sum `guests` for accepted replies only; replies are counted as submissions, without deduplicating people.
4. Search names, contact information, or messages; filter attendance; double-click a row to read all its details.
5. Choose all or filtered responses, choose a format, and click **Save report**.

Exports: CSV (opens in Excel), TSV, JSON, HTML, XML, and TXT. For PDF, export HTML, open it in a browser, and click **Print / Save as PDF**. Arbitrary file formats are not supported; renaming a file does not convert its contents. CSV/TSV prefix formula-like text with an apostrophe for safe spreadsheet opening; JSON preserves the original data.

The viewer keeps the entered key in memory only and performs read-only requests. Keep it on your own computer; do not put an admin key into website files or commit it. You can alternatively set `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) and optionally `SUPABASE_URL` in the process environment. See [Supabase API key documentation](https://supabase.com/docs/guides/getting-started/api-keys).

Click Refresh to retrieve the latest submissions. All response pages are fetched. Data is loaded into memory, so this dashboard is intended for wedding-sized guest lists. Browser-only fallback replies in localStorage are not available through Supabase and will not appear here. An internet connection and a valid admin key are required for live loading; a failed refresh retains the previous results.

Run checks with `python -m unittest test_rsvp_viewer.py`.
