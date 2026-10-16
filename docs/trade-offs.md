# Trade-offs and tripwires

Standing principle: every accepted risk ships with its tripwire.

| Trade-off and why accepted | Metric | Threshold | Alert/flag | Pre-written remediation | Source |
| --- | --- | --- | --- | --- | --- |
| Offline sign-ups: member pricing applies immediately, even while the household is pending. Accepted so a walk-up customer at the stall gets into the sphere right away, since the POS has no signal to run the self-serve QR flow. | Share of offline sign-ups that never confirm, or that collide with an existing household on sync. | To be set. | To be designed. | Hold member pricing until the account is confirmed. | [north-foster-farm#244 (comment)](https://github.com/north-foster-farm/north-foster-farm/issues/244#issuecomment-6219841875), [nff-dashboard#25 (comment)](https://github.com/north-foster-farm/nff-dashboard/issues/25#issuecomment-6219906661) |
