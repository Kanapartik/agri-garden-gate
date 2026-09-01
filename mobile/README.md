# AgriGhar farmer mobile

The native farmer pilots live in:

- [`android/`](./android/) — Android 12 and later
- [`ios/`](./ios/) — iOS 17 and later

Both implement the Siddipet/Raipole contract in
[`../docs/mobile/`](../docs/mobile/) without changing the frozen `/mobile/v1`
API or consent envelopes.

These slices are installable pilot shells. Real OTP delivery and authoritative
identity, land, and FPO checks remain behind the frozen API adapters and are not
simulated as verified results.
