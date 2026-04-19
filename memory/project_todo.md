---
name: Project TODOs
description: Deferred requirements and schema changes to implement later
type: project
---

## Tour timeline / duration (deferred)

- Tour model needs start time and end time fields (or duration)
- `meetingTime` on Tour is assembly time, ~30–40 min before tour start — it is NOT the start time
- Tour timeline will have a relation with the Tour model (exact shape TBD by user)
- Impacts: tour display on dashboard, buddy scheduling, notifications

## Tour booking open/closed status (deferred)

- Need to distinguish `published + open` (buddies can book) vs `published + closed` (visible, cannot book)
- Currently `TourStatus` = `draft | published | cancelled | completed` — no open/closed distinction
- Options: add new status values, or add a separate `bookingOpen: Boolean` field on Tour
- Must decide data model before implementing booking flow
