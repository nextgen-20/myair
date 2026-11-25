# Qubo cloud provider — what MyAir actually does (updated 2026-11-25)

## A vs B — read this first

- **(A) Control an already-configured Qubo R250 (or other HPH purifier) that is already
  paired to your Qubo account via the official app:** implemented from source-verified
  protocol details, but **hardware-unverified** — no physical device has run this code.
- **(B) First-time setup of a brand-new/factory-unconfigured Qubo R250 (BLE pairing +
  pushing your Wi-Fi SSID/password + enrolling it to your account) from MyAir:**
  **NOT implemented.** See "Why (B) isn't implemented" below — this is a missing protocol
  step, not a stub or a disabled feature.


MyAir's Qubo provider authenticates as **your own Qubo account** against Qubo's real
cloud REST API (`srvcapp.platform.quboworld.com`) — the same service and account the
official Qubo app uses. There is no DNS redirection, no TLS interception, no credential
extraction from anyone else's device, and no modification to Qubo's servers. You sign in
with your email/password; Qubo issues the session, exactly as it would to its own app.

## Where the protocol details came from

Endpoint paths, header names, the login/refresh flow, and the air-purifier shadow field
names are all reimplemented in Kotlin (`android/.../provider/qubo/`) from reading the
source of **selvakk2k/qubopy** (MIT license) — specifically `qubopy/const.py`,
`qubopy/auth.py`, `qubopy/client.py`, `qubopy/devices/base.py` and
`qubopy/devices/purifier.py`. No code was copied verbatim; MyAir's Kotlin implementation
is independent, using the same documented endpoints/fields. `qubopy` itself says these
were found by inspecting Qubo's own published Android app (`com.hero.iot`), not by
intercepting anyone's live traffic.

`dtechterminal/qubo-local-control` was also reviewed again for this implementation; it
documents the same MQTT topic names used here for context, but MyAir does not use its
DNS-redirection / local-broker-impersonation approach (see `docs/QUBO_INVESTIGATION.md`
for why).

## What's confirmed vs. not, per qubopy's own README

qubopy's README marks air-purifier (`HPH`) login, discovery and shadow **read** as tested
against real hardware, crediting a named contributor's test on a real **Q400** for "REST
shadow controls & state telemetry," and a separate contributor's real **Q200** test of an
MQTT `aqiRefresh` telemetry command. It does **not** claim any model was tested by its own
maintainer, and one internal code comment separately flags the shadow-attribute **write**
HTTP route as inferred rather than confirmed from the Android app's own network layer.

**MyAir has not been run against any physical Qubo device, R250/HPH06 or otherwise.**
Everything below is "implemented from a verified protocol description," not "verified on
your hardware."

## What MyAir's QuboProvider implements

- Sign-in: `POST /sms/api/v1/sp/{sp}/user/login?system=CS` with email+password, storing the
  returned access/refresh token in Android's Keystore-backed `EncryptedSharedPreferences`
  (never the password, never sent to the web/JS layer).
- Token refresh: `POST .../auth/refresh` when the access token is close to expiring.
- Discovery: `GET .../units` then `GET .../units/{unit}/devices`, keeping only devices
  whose model starts with `HPH` (Qubo's air-purifier family, which includes the R250 as
  `HPH06` — MyAir does not hard-code that one model; any `HPH`-prefixed device discovered
  is treated as a purifier and shown with its real reported model string).
- State read: `GET .../devices/{device}/deviceshadow` (v2 shadow), flattened into
  `serviceName_attributeName` keys exactly as qubopy's shadow parser does, then mapped to
  power / fan mode (`auto`/`manual`/`sleep`/`qsense`) / fan speed level (1–3) / PM2.5 /
  filter life % / child lock — **only the fields the device's own shadow response actually
  contains are shown**; everything else stays `null`.
- Commands: `PUT .../shadow/attribute` with `{instanceId, serviceName, attributeName,
  attributeValue}`, then re-reads the shadow (up to 6 times, 700ms apart) before the UI is
  allowed to say "Confirmed" — otherwise it shows "accepted, not confirmed" or the error.
- MQTT: **not implemented in this pass.** The REST shadow read above already gives real,
  live-enough state for a dashboard; real-time push telemetry over Qubo's MQTT broker
  (`mqtt.platform.quboworld.com:8883`, plain TLS with the same account token — no DNS
  tricks) is a documented extension point, not yet built. The one case qubopy flags where
  REST alone is insufficient is PM2.5 going stale until an `aqiRefresh` MQTT command (or the
  mobile app) prompts a fresh sample — until MQTT is added, MyAir's PM2.5 reading may be
  stale for the same reason the official app's would be if left untouched.

## Why (B) — first-time commissioning — isn't implemented

Both reference repositories were re-checked specifically for this (grepped for
provisioning/BLE/Wi-Fi-credential/SoftAP/onboarding terms):

- **selvakk2k/qubopy** has Bluetooth-LE code, but it is only for *extracting offline
  unlock keys from already-paired Qubo smart locks* (`qubopy/devices/lock.py`,
  `QuboKeyExtractionError`, GATT UUIDs in `const.py`) — unrelated to purifiers and
  unrelated to onboarding new hardware. It has no air-purifier provisioning code at all.
- **dtechterminal/qubo-local-control** assumes the purifier is already on your Wi-Fi and
  already talking to Qubo's cloud MQTT broker; its entire mechanism is redirecting that
  *already-working* connection to a local broker via DNS + TLS interception (which MyAir
  does not use — see `docs/QUBO_INVESTIGATION.md`). It documents nothing about how the
  device joins Wi-Fi or an account in the first place.

Neither MIT-licensed source this project is built from documents the actual first-time
commissioning protocol (almost certainly BLE + a SoftAP or BLE-WiFi-credential exchange
with Hero Electronix's cloud, the same category of protocol as Google/Matter commissioning
for a different ecosystem). Implementing it would mean reverse-engineering the official
Qubo Android app's BLE/pairing traffic from scratch — exactly the kind of undocumented,
unverified reverse-engineering this project's constraints rule out. So: **(B) is reported
as a missing protocol step**, not quietly left out. If you have a new/unconfigured R250,
it must be onboarded with the official Qubo app first; once it shows up in your Qubo
account, MyAir's existing discovery (capability A) can see and control it.

## Fix made in this verification pass

`QuboApiClient.getUnits()`/`getDevicesForUnit()` originally assumed the `/units` and
`/units/{unit}/devices` endpoints return a **bare JSON array**. Re-reading qubopy's own
`get_units`/`get_devices_for_unit` (`qubopy/client.py`) shows its author does **not** know
this for certain either — that code defensively accepts a bare array *or* an object with
the list under `"data"`/`"units"`/`"devices"`, because the real shape wasn't confirmed.
MyAir's parser only handled the bare-array case, which would have silently reported "no
devices" if the server actually replies with the object-wrapped shape. Fixed to accept
both, matching qubopy's own defensiveness, so a real account's devices aren't silently
dropped by a parsing assumption.

## What you need to do on a real Android phone to test this

**Prerequisite for both:** build the APK somewhere with real network access (this
sandbox cannot resolve `dl.google.com`/`plugins.gradle.org`, so Gradle here fails at
plugin resolution — see the final report), install it on a phone, and have a Qubo
account with at least one purifier already added via the official Qubo app.

**To test (A) — controlling an already-configured R250:**
1. Open MyAir → Integrations → Qubo → Sign in, enter your real Qubo account email/password.
2. Confirm sign-in succeeds (or fails with a real, specific error if credentials are wrong —
   watch for this, since a silent "stuck on loading" would indicate a real bug).
3. Confirm your R250 (or whichever HPH-series purifier) appears in the discovered list with
   its real reported model string.
4. Select it, confirm the dashboard shows real PM2.5/filter-life/fan-mode/fan-speed/child-lock
   values matching what the official Qubo app shows for the same device at the same time.
5. Send a command (e.g. toggle power or change fan speed) and confirm MyAir's UI only ever
   says "Confirmed" after it has re-read the shadow and seen the new value — and separately
   confirm in the official Qubo app (or physically, by listening/watching the purifier) that
   the real device actually changed state, not just MyAir's own cached copy.
6. Turn off Wi-Fi on the purifier (or otherwise take it offline) and confirm MyAir reports it
   offline rather than showing stale state as if it were live.

**To test (B) — there is nothing to test.** No first-time-setup UI exists in MyAir for an
unconfigured purifier; a new R250 must be commissioned with the official Qubo app, after
which it becomes testable under (A) above.

## Account/ToS note

Qubo has not published this API for third-party use. Using your own credentials against it
is not a security bypass, but it is still an unofficial client; Qubo's login response shows
sessions like this one in the app under **Account → Logged In Devices**, and revoking it
there (or changing your password) will sign MyAir out.
