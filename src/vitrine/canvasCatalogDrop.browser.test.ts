import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";

/*
 * The drop path is browser behaviour, not logic: whether a drag starts on a
 * card, whether a document-capture listener sees it before the editor's own
 * bubble-phase handler, and whether the payload survives in dataTransfer. None
 * of that is observable from the source, and reasoning about it produced
 * several confident wrong fixes — so it is exercised in a real browser here.
 *
 * This mirrors the structure in ProjectPlaygroundPage: an inner container with
 * a bubble-phase drop handler (Excalidraw), inside a wrapper, with listeners
 * registered on document in the capture phase.
 */
const MIME = "application/x-astryx-catalog";

const harness = `<!doctype html><html><body style="margin:0">
<div id="panel" style="position:absolute;left:0;top:0;width:200px;height:400px;z-index:410">
  <div id="card" draggable="true" style="width:180px;height:120px">
    <img id="thumb" style="width:100px;height:60px;pointer-events:none"
         src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='60'%3E%3C/svg%3E">
    <span>Card</span>
  </div>
</div>
<div id="wrapper" style="position:absolute;left:220px;top:0;width:600px;height:400px">
  <div id="editor" style="width:100%;height:100%">
    <canvas id="cv" width="600" height="400" style="display:block"></canvas>
  </div>
</div>
<script>
window.__log = [];
const MIME = ${JSON.stringify(MIME)};
document.getElementById('card').addEventListener('dragstart', (e) => {
  window.__log.push('dragstart');
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', 'Card');
  e.dataTransfer.setData(MIME, JSON.stringify({ kind: 'app', id: 42 }));
});
document.getElementById('editor').addEventListener('drop', () => {
  window.__log.push('editor-drop');
});
const root = document.getElementById('wrapper');
const inRoot = (e) => root.contains(e.target);
const carries = (e) => Array.from((e.dataTransfer && e.dataTransfer.types) || []).includes(MIME);
const over = (e) => {
  if (!inRoot(e) || !carries(e)) return;
  e.preventDefault(); e.stopPropagation();
  e.dataTransfer.dropEffect = 'copy';
  if (!window.__log.includes('dragover')) window.__log.push('dragover');
};
document.addEventListener('dragenter', over, true);
document.addEventListener('dragover', over, true);
document.addEventListener('drop', (e) => {
  if (!inRoot(e) || !carries(e)) return;
  e.preventDefault(); e.stopPropagation();
  let raw = ''; try { raw = e.dataTransfer.getData(MIME); } catch {}
  window.__log.push('drop:' + raw);
}, true);
</script></body></html>`;

test("a catalog card drags onto the board and the payload survives", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(harness);

    const card = await page.locator("#card").boundingBox();
    const canvas = await page.locator("#cv").boundingBox();
    assert.ok(card && canvas, "harness did not lay out");

    await page.mouse.move(card.x + 20, card.y + 100);
    await page.mouse.down();
    for (let step = 1; step <= 8; step += 1) {
      await page.mouse.move(
        card.x + 20 + ((canvas.x + 200 - card.x - 20) * step) / 8,
        card.y + 100 + ((canvas.y + 200 - card.y - 100) * step) / 8,
      );
    }
    await page.mouse.up();

    const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);

    assert.ok(log.includes("dragstart"), `no drag started: ${log.join()}`);
    assert.ok(log.includes("dragover"), `dragover never claimed: ${log.join()}`);
    // The payload has to come back out of dataTransfer, not just a ref.
    assert.ok(
      log.includes(`drop:${JSON.stringify({ kind: "app", id: 42 })}`),
      `drop did not carry the record: ${log.join()}`,
    );
    // Capturing at document must keep the editor's own handler out of it.
    assert.ok(!log.includes("editor-drop"), `editor also handled the drop: ${log.join()}`);
  } finally {
    await browser.close();
  }
});
