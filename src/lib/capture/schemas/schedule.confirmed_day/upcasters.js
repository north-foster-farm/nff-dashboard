// Upcaster chain for schedule.confirmed_day.
// Key n is a pure function lifting a vN doc to v(N+1). v1 is current, so
// there are none yet; when v2 ships (likely in S5 once the confirmed-day
// shape firms up), add `1: (v1) => ({ ...mapped to v2 }),` here.
export default {};
