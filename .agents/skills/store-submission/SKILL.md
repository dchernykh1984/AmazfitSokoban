---
name: store-submission
description: Prepare the Zepp App Store listing - the exact image requirements, the field limits in the console form, and what reviewers reject for. Use when asked to publish, submit or resubmit the app, or to prepare store screenshots, an icon or listing text.
---

# Submitting to the Zepp App Store

Requirements below are from the Zepp OS submission guidelines
(<https://docs.zepp.com/docs/v2/distribute/>) and from a real review round.

## Images

**App Introduction Screenshot (round screen)** - 360x360 px, PNG, 1 to 10 of
them, three or more recommended. The background **must be transparent, not
filled**, and the app interface has to fill the area: for a round device, the
screenshot sits centred in the transparent 360x360 square with no margin.

**App Icon** - 240x240 px, PNG, a circular image on a transparent background,
with no padding around it. The icon shipped inside the app is not suitable as
is: it is square with a dark plate, so it needs redrawing as a circle that
touches the edges.

Do not paint a bezel ring or a plate behind the screen: that is a filled
background by another name, and it does not exist in the app. Verify
transparency by reading pixels, not by looking - a corner pixel must come back
with alpha 0, and the edge midpoint must be the app's own content.

## Field limits in the console form

| Field                 | Limit                            |
| --------------------- | -------------------------------- |
| App Introduction      | 40 characters                    |
| App Details           | 600 characters                   |
| Privacy Statement     | free text                        |
| Features Descriptions | free text, aimed at the reviewer |

Count the characters before handing the text over; both limits are easy to blow
past with a feature list.

## What a reviewer asked for

- Preview images that "accurately represent the app experience" and meet the
  format above.
- A contact email **in the app description** (the App Details field), in a
  "Feedback & Support:" line. The written guidelines do not require an email at
  all, and the reviewer's wording is a recommendation - but it was raised as a
  condition of publishing, and review attempts are rationed (6 per week), so
  satisfying it literally is cheaper than arguing. A repository link can go
  alongside it, not instead of it.

Rejections of this kind need no new build: the `.zab` is unchanged, only the
listing is edited before resubmitting.

## Other fields, for reference

Call Permission is `None` - the app declares only `data:os.device.info` and
`device:os.local_storage`, and none of the permissions the form lists (heart
rate, network, positioning, background) are used. The installation package
includes no SDK, and there is no music playback. Supported Devices should be the
round models only: `app.json` declares round targets exclusively.
