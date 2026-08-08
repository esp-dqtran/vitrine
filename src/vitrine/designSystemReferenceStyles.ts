export const DESIGN_SYSTEM_REFERENCE_STYLES = String.raw`
.ds-refero-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, .8fr);
  gap: 24px;
  align-items: start;
}

.ds-refero-reference {
  min-width: 0;
  display: grid;
  gap: 24px;
}

.ds-refero-hero {
  margin: 0 0 24px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: #0d0f12;
}

.ds-refero-hero :is(img, video) {
  display: block;
  width: 100%;
  max-height: 540px;
  object-fit: cover;
  object-position: top;
}

.ds-refero-source {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 12px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.ds-refero-source a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ds-reference-pane {
  position: sticky;
  top: calc(var(--reference-nav-height, 72px) + 88px);
  overflow: hidden;
  display: grid;
  grid-template-rows: auto auto auto minmax(360px, 1fr) auto;
  max-height: calc(100vh - var(--reference-nav-height, 72px) - 104px);
  min-height: 680px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: #1f1f22;
  color: #e7e9ee;
  box-shadow: 0 24px 64px rgb(0 0 0 / 18%);
}

.ds-reference-pane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgb(255 255 255 / 10%);
}

.ds-reference-pane__tabs {
  display: flex;
  overflow-x: auto;
}

.ds-reference-pane__tabs button {
  flex: 0 0 auto;
  padding: 18px 16px 15px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #9298a7;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color 180ms ease, border-color 180ms ease, background-color 180ms ease;
}

.ds-reference-pane__tabs button.is-active {
  border-bottom-color: #f2f3f5;
  color: #f2f3f5;
}

.ds-reference-pane__density {
  flex: 0 0 auto;
  margin-right: 14px;
}

.ds-reference-pane__toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  align-items: center;
  min-height: 58px;
  padding: 10px 14px;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
}

.ds-reference-pane__toolbar > div {
  display: flex;
  gap: 8px;
}

.ds-reference-pane__context {
  padding: 8px 16px;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
  color: #9298a7;
  font-size: 12px;
}

.ds-reference-pane__copy.astryx-button {
  border-color: #fff !important;
  background: #fff !important;
  color: #1f1f22 !important;
}

.ds-reference-pane__copy.astryx-button:hover {
  border-color: #f2f2f3 !important;
  background: #f2f2f3 !important;
}

.ds-reference-pane__code {
  overflow: auto;
  min-width: 0;
  margin: 0;
  padding: 20px;
  background: transparent;
  color: #d8dbe3;
  font: 12px/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  animation: ds-reference-content-enter 180ms ease-out both;
}

.ds-reference-pane__code [data-design-system-reference-section] {
  display: block;
  scroll-margin-top: 12px;
}

.ds-reference-pane__code [data-design-system-reference-section][data-active="true"] {
  background: rgb(255 255 255 / 5%);
}

.ds-reference-pane footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid rgb(255 255 255 / 8%);
  color: #9298a7;
  font-size: 11px;
}

.ds-reference-pane footer a {
  color: #e7e9ee;
}

@keyframes ds-reference-content-enter {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .ds-reference-pane__tabs button,
  .ds-reference-pane__code {
    animation: none;
    transition: none;
  }
}

@media (max-width: 760px) {
  .ds-refero-layout {
    grid-template-columns: 1fr;
  }

  .ds-reference-pane {
    position: relative;
    top: auto;
    max-height: none;
    min-height: 620px;
  }
}

@media (max-width: 640px) {
  .ds-reference-pane__header {
    align-items: stretch;
    flex-direction: column;
    gap: 0;
  }

  .ds-reference-pane__density {
    align-self: flex-end;
    margin: 0 12px 10px;
  }

  .ds-reference-pane {
    min-height: 560px;
    border-radius: 14px;
  }

  .ds-reference-pane__tabs button {
    padding-inline: 12px;
  }
}
`;
