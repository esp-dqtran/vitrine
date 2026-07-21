# Mobbin-Style Site Video Card Design

## Goal

Make Site section videos as quick to scan as Mobbin's cards while keeping Astryx's existing section inspector as the destination. This change applies only to video cards in the Sites experience. App cards and Site image cards keep their current behavior.

## Reference Behavior

The implementation will reproduce the selected Mobbin behavior captured from the signed-in reference page:

- A 16:10 media frame with an 8 px radius and restrained neutral background.
- Poster-backed video rendered with `object-fit: contain`.
- Muted, looping, inline playback with no native controls.
- Playback starts when enough of the card is visible and pauses after it leaves the viewport.
- Hover and keyboard focus add a subtle 10% black veil without lifting or scaling the card.
- A white, 44 px-high `View section` pill appears 16 px from the media edges using a 300 ms opacity and upward-slide transition.
- Clicking either the card or pill opens the existing `SiteSectionInspector`.

The Mobbin selection circle, overflow menu, Save action, and site-identity footer are deliberately excluded. They would imply collection behavior that Astryx does not need for this interaction.

## Architecture

Add a Site-specific section-card boundary rather than changing the shared App card presentation. `SiteVersionPage` will use the Site-specific component for section videos and continue using the current `MediaGridCard` path for images.

The video card owns only presentation and viewport playback. It receives the existing section label, media URL, poster URL, badges, and `onOpen` callback. It does not fetch data or own inspector state.

An `IntersectionObserver` watches the video card at a visibility threshold of 35%. Entering the threshold calls `video.play()`; leaving it calls `video.pause()`. Rejected autoplay promises are safely ignored because the media is muted and the card remains usable as a poster-backed preview. The observer disconnects when the component unmounts.

## Interaction and Accessibility

The whole card remains a keyboard-accessible action. Hover and `focus-within` expose the same veil and call-to-action so the interaction is not pointer-only. The pill is the visible action label, but card and pill activate the same `onOpen` callback without double invocation.

Existing pattern and media-type badges remain available without competing with the hover action. They sit outside the action tray rather than covering the `View section` pill.

## Error Handling

- Missing or failed video media falls back to the supplied poster and existing neutral frame.
- If `IntersectionObserver` is unavailable, the card remains paused and fully usable through the poster and inspector action.
- A rejected `play()` promise does not surface an error or block opening the inspector.

## Verification

Focused component tests will cover:

- Video attributes: muted, looped, inline, poster-backed, and no native controls.
- Visibility-driven `play()` and `pause()` behavior with a mocked `IntersectionObserver`.
- The `View section` action and inspector callback.
- Preservation of the existing image-card path and shared App-card behavior.

After tests and the production build pass, Chrome visual QA will compare Astryx against the saved Mobbin default and hover screenshots at the same viewport and state. The comparison must confirm frame ratio, radius, video fit, veil strength, pill dimensions and inset, transition end state, and absence of hover lift. Results will be recorded in `design-qa.md`.

## Out of Scope

- Save or collection workflows.
- Multi-select controls and overflow actions.
- New API, database, queue, or object-storage behavior.
- Changes to App cards or Site image cards.
