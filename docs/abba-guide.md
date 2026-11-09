# Abba Guide tour structure

The public route `/<lang>/guide` presents the on-site companion UI in English and Arabic. Its first sample route covers four waypoints for the Hanging Church: the raised church/nave, wooden ceiling, marble pulpit, and icon collection. Content is stored in `lib/content/abba-guide.ts`; each waypoint has a stable ID, arrival anchor, long story, quick highlight, architectural note, discovery prompt, navigation bridge, and estimated dwell time.

## Journey state

`components/site/abba-guide.tsx` keeps `currentIndex`, `completedWaypoints`, `skippedWaypoints`, `elapsedSeconds`, allotted tour duration, focus mode, running state, and rest mode. It calculates remaining time and pacing from elapsed time and completed progress. If estimated remaining dwell time exceeds the user’s time budget, it offers a short route and records skipped stops separately from completed ones. State is stored in browser local storage so a visitor can continue on the same device.

Focus modes are `STORYTELLING_DEEP_DIVE`, `QUICK_HIGHLIGHTS`, and `ARCHITECTURAL_FOCUS`. The rest control pauses the timer. Context questions are answered from a small, explicit set of sourced notes; unknown questions receive a transparent fallback rather than an invented answer.

## Data and integration boundaries

The sample stories use the same Ministry of Tourism and Antiquities references linked on the existing Hanging Church profile. The UI requires visitors to confirm each arrival manually. It does not infer physical location, provide turn-by-turn maps, or send data to a live language model. Directions defer to visitor signage and church staff because access and visitor flow can change. The route is a prototype guide and does not promise that every area is open or accessible.

For a production guide, add reviewed waypoint records per church with verified coordinates or indoor positioning, step-free/accessibility details, route geometry, opening/access states, media rights, multilingual story versions, and source links. A live assistant should retrieve only from those reviewed records and preserve the same unknown-answer behavior.
