import { useRef } from "react";
import { useTeaserPieces, useTetrisFooter } from "../hooks/useTetrisFooter.js";
import { PixelButton } from "./PixelButton.jsx";

function LeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function RightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function DropIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m7 6 5 5 5-5" />
      <path d="m7 13 5 5 5-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export function TetrisFooter({ footerRef }) {
  const cityCanvasRef = useRef(null);
  const teaserCanvasRef = useRef(null);
  const game = useTetrisFooter(cityCanvasRef);
  useTeaserPieces(teaserCanvasRef);

  const playing = game.phase === "expand" || game.phase === "play";

  return (
    <footer
      id="play-footer"
      className={playing ? "playing" : ""}
      onClick={game.start}
      ref={footerRef}
    >
      <canvas id="footcity" aria-hidden="true" ref={cityCanvasRef} />
      <PixelButton className="tt-teaser" type="button" aria-label="play tetris">
        play <span className="tt-blocks" aria-hidden="true"><canvas id="ttpieces" ref={teaserCanvasRef} /></span>
      </PixelButton>

      <div id="tetris" className={game.gameOver ? "tt-isover" : ""}>
        <div className="tt-score">{String(game.score).padStart(6, "0")}</div>
        <div className="tt-pad">
          <button type="button" aria-label="Move left" onClick={(event) => { event.stopPropagation(); game.moveLeft(); }}><LeftIcon /></button>
          <button type="button" aria-label="Move right" onClick={(event) => { event.stopPropagation(); game.moveRight(); }}><RightIcon /></button>
          <button type="button" aria-label="Rotate" onClick={(event) => { event.stopPropagation(); game.rotate(); }}><RotateIcon /></button>
          <button type="button" aria-label="Hard drop" onClick={(event) => { event.stopPropagation(); game.hardDrop(); }}><DropIcon /></button>
        </div>
        <button className="tt-close" type="button" aria-label="Close" onClick={(event) => { event.stopPropagation(); game.close(); }}><CloseIcon /></button>
        <div className="tt-over">
          <span className="ttl">Game over</span>
          <PixelButton className="tt-again" type="button" onClick={(event) => { event.stopPropagation(); game.replay(); }}>
            play again
          </PixelButton>
        </div>
      </div>
    </footer>
  );
}
