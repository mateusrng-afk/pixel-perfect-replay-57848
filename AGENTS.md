<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- All booking data access goes through `src/lib/booking/repo.ts` (browser Supabase client, RLS applies) and query options in `src/lib/booking/queries.ts`; row-to-type conversion lives in `mappers.ts`. UI never queries the database directly.
- Each barber's lunch lives in `barber_breaks` (one daily interval per barber, admin-only RLS); `assert_barber_slot` enforces hours + lunch for both `book_appointment` and `admin_update_appointment`, and `get_busy_times` returns lunch as busy so the public page needs no extra read.
- Staff edit appointments only via `staff_update_appointment` (security definer; admin any, barber only own and cannot reassign; recomputes price/duration, overlap still blocked by the exclusion constraint); status changes stay a direct RLS-guarded update, and the `guard_appointment_update` trigger lets non-admins change only `status` directly.
- Staff identity: `barber_accounts` links an auth user to one barber; `current_barber_id()` (active link + `barber` role) and `is_staff()` drive every per-barber RLS policy, so privacy is enforced in the database, not the UI.
- Clients book only via the `book_appointment` DB function (computes price/duration, validates hours) and read availability via `get_busy_times`; double booking is blocked by the `appointments_no_overlap` exclusion constraint, so never add a direct client insert path.
- Appointment times are stored as timestamptz and shown in America/Maceio (fixed -03:00, no DST).
- A service with no `barber_services` rows is offered by every barber (same rule in SQL and `schedule.ts`).
- Admin pages live under `src/routes/_authenticated/admin*` (URL `/admin/*`, shared `admin.tsx` layout); admin rights come from `user_roles` + `has_role`, never from client state; roles are granted only through database migrations (no self-claim path), so no account can promote itself.
- Slot availability and price math live as pure functions in `src/lib/booking/schedule.ts`, covered by `schedule.test.ts`; change rules there, not in components.
- Failed page-file downloads ("Importing a module script failed") recover via `src/lib/chunk-reload.ts`: inline head script + root error boundary do one full reload per 10s, because browsers cache failed imports and the app otherwise never starts.
