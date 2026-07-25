# Mobbin Sites Fidelity Rebuild Plan

1. Add failing component and boundary tests for the Mobbin Sites shell,
   taxonomy, semantic Site card, and detail hierarchy.
2. Add failing source/store tests for real Mobbin Site metadata.
3. Extend the validated Site import graph and add a forward-only metadata
   migration without applying it to the live application database.
4. Persist and expose Site description, logo, styles, categories, and
   popularity through the store and API contracts.
5. Replace the Sites catalog shell, card markup, taxonomy, and toolbar.
6. Rebuild the Site-version header, version/tabs row, and preview stage while
   preserving Sections functionality.
7. Remove the admin `AppShell` wrapper from both Sites routes.
8. Run focused tests, TypeScript/Vite build, and migration checks.
9. Capture the rebuilt catalog and V7 detail in Chrome at the reference
   viewport, compare each side-by-side with the saved Mobbin screenshots, fix
   visible mismatches, and update `design-qa.md`.
