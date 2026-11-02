# Fieldwork accounts and operations

The fieldwork portal is separate from farmer/FPO authentication. It uses private PostgreSQL account, session, form, record and audit tables, accessed through restricted security-definer functions. The web handler sends a publishable Supabase key; all authorization is performed inside those functions. Never grant direct account or record table reads to browser roles.

Roster imports are private and excluded from Git. Match normalized 10-digit login IDs; preserve existing password hashes during subsequent roster updates. Link supervisors by account ID. Only the five names explicitly authorised by the project owner may receive leadership. Review actual account identity before making roster changes.

Initial passwords are hashed individually with bcrypt; first login forces replacement. Passwords must be 12–72 characters and at most 72 UTF-8 bytes, including upper/lower case, digit and symbol. Sessions expire after 12 hours; restricted initial sessions expire after 15 minutes. Five failed account attempts lock login for 15 minutes. Password resets are coordinator operations; no self-service recovery or outbound credential messages are implemented.

To disable an account, set active=false and revoke its sessions. Server access stops immediately. Cached offline identity expires at its last issued session expiry; offline copies cannot be remotely erased. Protect enrolled devices and use the scoped master export carefully.

Offline drafts use per-account IndexedDB and are not app-encrypted at rest. Leadership always requires online verification. Service workers cache only explicit public application assets, never API responses. Draft sync uses server version checks; a conflict retains the local copy. Review actions require online server acknowledgement.

Validation: focused identity/API tests, production build and rollback database authorization assertions. Pilot survey interpretation, translations, GPS/permission handling, device storage loss and interrupted sync on actual Android devices before field rollout. Native cell triangulation/background tracking is not part of the browser application.
