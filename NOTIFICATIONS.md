# Calendar notifications

The bell opens notification preferences. Birthday and daily rain forecast sources feed the existing Akatsuki broadcast table and push sender. No preferences are enabled automatically. Enable a device, send a test, then save the desired sources. A push subscription to Calendar receives the account's Akatsuki broadcasts, not only Calendar sources. Installing both apps and enabling both can produce two notifications on one phone; disable one installation if desired.

All scheduling currently uses Asia/Tokyo. Birthdays repeat annually; February 29 uses February 28 in non-leap years. A preference selects the day itself or 1–7 days before. Rain uses the existing selected Akatsuki weather cache, daily precipitation in mm, a four-hour freshness limit, and its expiry. It is a daily forecast reminder, not rain-onset prediction. Missing/stale forecasts are skipped. Late evaluation retries for two hours. Occurrence keys prevent repeat generation. Source reminders expire at the next Japan midnight, and deleted birthdays/disabled sources are cancelled at the next scheduler run. The existing push sender's delivery/TTL behavior remains unchanged.

The Calendar service worker receives pushes, and tapping opens Akatsuki's shared Done/Snooze record. It only removes its own old caches. No notes, entries, birthdays, or downloaded content are migrated or cleared.

## Backend

`sql/calendar_alerts.sql` was applied to General_apps. It adds an ownership-protected preferences table, a private occurrence ledger and private invoker function, and the `calendar-alert-sources` minute job. The existing Akatsuki push job handles delivery. This is a one-time migration, not a script to rerun blindly.

No secrets are stored in the client. The existing Akatsuki public-key and subscribe RPCs handle device registration. The private scheduler is not executable by anon/authenticated.

## Remaining work before release

- Run `tests/alerts.sql` with a trusted SQL connection. It uses a transaction with rollback and asserts birthday timing/leap years, deduplication, deletion, rain threshold/freshness and scheduler privilege restrictions. Two connector attempts stalled; no successful result was received.
- Verify preferences isolation with two signed-in accounts and inspect security advisors.
- Verify mobile/desktop layout. The environment blocked the Chromium process; visual checks were not completed.
- Verify actual Android/iPad delivery while closed, tap navigation and offline reopening. `npm test` passes 46 tests, including service-worker push/expiry/cache tests; these do not establish real-device delivery.
- Train-delay automation is not implemented. The UI explicitly says not connected and links to JR East official live status. Choose a licensed/supported feed with verified line coverage before adding alerts. No train delay API credentials or verified integration were found.

Settings stay off by default. The frontend remains on a review branch until these release checks pass.
