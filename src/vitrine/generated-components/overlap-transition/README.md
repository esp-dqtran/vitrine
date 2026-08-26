# Overlap Transition Stage

Keeps the surrounding application shell mounted while the keyed content layer enters above the outgoing layer. The motion is component-scoped, direction-aware, and reduced-motion safe.

```tsx
<OverlapTransitionStage direction="forward" transitionKey={routeId}>
  <Results routeId={routeId} />
</OverlapTransitionStage>
```

The stage owns clipping and stacking. Its parent should provide the intended height or allow the child content to establish it. Import `overlapTransition.css` once in the application stylesheet.
