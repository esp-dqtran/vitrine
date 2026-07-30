# Mobbin Save and Copy feature audit

Date: 2026-07-30

Surface: Amazon Shopping iOS Screens and single-screen viewer in the signed-in Mobbin Chrome session.

## Flow

1. Single-screen Copy
   - Copy is rendered directly below each screen card.
   - Clicking it starts an image-copy operation.
   - The button becomes temporarily unavailable while the operation runs.
   - Confirmation toast: `Copied as png`.

2. Single-screen Save
   - Save opens an anchored collection popover.
   - Destinations include `All saved`, existing collections when available, and `Create collection`.
   - Saving changes the card action from `Save` to `Saved`.
   - Confirmation toast: `Saved`, with an `Add comment` action.
   - Selecting `All saved` again opens a destructive confirmation because the screen will be removed from Saved and every collection.

3. Create collection
   - Opens a centered `New collection` modal.
   - Fields: Name and Description.
   - Includes a Private toggle with explanatory copy.
   - Actions: Cancel and Create.

4. Batch selection
   - The upper-left selection control gives selected cards a blue outline and check mark.
   - Selecting a screen synchronizes across duplicate appearances of that screen, but the batch count remains based on distinct screens.
   - A fixed toolbar shows the selected count, Clear, Download, Copy, and Save.

5. Batch Copy
   - Shows `Copying screens...` while preparing the images.
   - Confirmation toast reports the exact count, such as `2 screens copied`.
   - The toast includes `Download plugin`.
   - Selection is cleared automatically after completion.

6. Batch Save
   - Opens the same collection destination popover as single-screen Save.
   - The selection stays active while choosing a destination.

7. Viewer actions
   - Viewer footer repeats Save, Copy, and More actions.
   - Copy has the same PNG-copy behavior as the card action.
   - A separate top-right `Copy link` action copies a share URL with Mobbin tracking parameters.

## Evidence

- `01-initial-screens.png`: Amazon Screens starting surface.
- `04-after-copy.png`: single-screen PNG copy confirmation.
- `05-save-popover.png`: Save destination popover.
- `06-after-save.png`: Saved state and Add comment confirmation.
- `07-unsave-confirmation.png`: destructive unsave warning.
- `08-create-collection.png`: New collection modal.
- `09-two-selected.png`: two-screen batch toolbar.
- `11-batch-copy-done.png`: batch copy confirmation.
- `12-batch-save-menu.png`: batch Save destination popover.
- `13-screen-viewer-actions.png`: viewer Save, Copy, and Copy link actions.

## State cleanup

- The test screen was unsaved after verification.
- No collection was created.
- Batch selection was cleared.
- The Mobbin tab was returned to the Amazon Shopping Screens page.

## Evidence limits

- Chrome exposed the visible success states and Mobbin's copy labels, but binary clipboard inspection did not return the PNG payload through the browser-control API.
- The `Copied as png` and `2 screens copied` confirmations are therefore the authoritative observed signals for image-copy behavior.
- Keyboard and assistive-technology behavior were not exhaustively tested.
