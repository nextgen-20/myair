# Qubo Smart Air Purifier — integration investigation (2026-11-24)

**Conclusion: first-time setup and real-time control of a Qubo purifier from a
third-party app like MyAir is not currently possible using only legitimate,
publicly documented information.** This file records what was checked and why.
MyAir does not implement a fake Qubo path — see `QuboIntegrationStatus` in
`src/providers/qubo/status.ts`.

## What was checked (public sources only)

- Qubo's own quick-start guide for the R700 purifier
  ([QSG-R700.pdf](https://www.quboworld.com/product-information/QSG-R700.pdf))
  and the smart-air-purifier FAQ
  ([quboworld.com/pages/smart-air-purifier-faq](https://www.quboworld.com/pages/smart-air-purifier-faq)).
- Qubo's Play Store / App Store listings.
- Web searches for a Qubo developer API, Alexa skill, Google Assistant
  integration, "Works with Google Home" listing, or Matter certification.
- The Connectivity Standards Alliance product directory (csa-iot.org), to see
  if any Hero Electronix / Qubo product is Matter-certified. (A similarly
  named "Smart Air Purifier 2" found there is a **different company**,
  Guangdong Qianyan Technology — not Qubo/Hero Electronix. No Qubo product
  appears in the CSA directory.)
- FCC ID lookups for "air purifier" hits near "R700" — the closest result
  (`2AZ2R-AP`) is **Shenzhen USEER Robotics / Lefant**, an unrelated vendor,
  not Qubo. No FCC filing confirmed for the Qubo R700's radio module.

## What is documented (from Qubo's own quick-start guide)

1. Power on the purifier; the app looks for its status LED blinking white.
2. The Qubo app discovers the purifier over **Bluetooth** (the guide does not
   say "BLE" explicitly, and no GATT service/characteristic UUIDs are
   published anywhere we could find).
3. The user types their **2.4 GHz Wi-Fi SSID and password into the Qubo app**;
   the app hands these to the purifier over that Bluetooth link.
4. The purifier joins Wi-Fi and the app confirms a connection.
5. After setup, control goes through Qubo's own cloud (consistent with the
   community `qubo-ha-mqtt`/`qubo-local-control` projects, which independently
   documented a cloud MQTT broker at `mqtt.platform.quboworld.com`).

## Why MyAir cannot do this today

- **No public BLE protocol spec.** Qubo has not published the GATT
  service/characteristic layout, the Wi-Fi-credential payload format, or any
  pairing/auth handshake. Determining it would require decompiling Qubo's app
  or capturing its Bluetooth/network traffic — i.e. reverse-engineering a
  proprietary protocol, which this project was explicitly told not to do and
  which this assistant would not do unprompted either.
- **No developer API.** No public Qubo/Hero Electronix API docs, partner
  program, or SDK were found.
- **No Matter certification.** Qubo air purifiers do not appear in the CSA-IOT
  Matter product directory, so Google's Home APIs (which only see Matter
  devices in your Google Home structure) have no legitimate way to reach one.
- **No confirmed Google Assistant / Alexa smart-home integration.** No
  official page documents Qubo exposing air purifiers through Google's or
  Amazon's smart-home platforms. (Qubo's security-camera/video-doorbell line
  does; the air purifiers are not shown to.) Even if one existed, a voice
  "smart home action" integration would not by itself let a third-party
  Android app read device state — that needs its own cloud-to-cloud API,
  which MyAir was already told not to build.

## What would make this legitimately possible

Any one of:
1. Qubo publishes a developer API or SDK for the air purifier.
2. Qubo certifies the air purifier for Matter (then the existing Google Home
   provider in this app would see it with no Qubo-specific code at all).
3. Qubo documents a supported local protocol (not reverse-engineered).

Until then, the Qubo entry in MyAir's Integrations screen says exactly this,
rather than a fake "Connect" button.
