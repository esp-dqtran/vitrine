import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { PullWindow, PullWindowHandle } from "../../components/PullWindow.jsx";

const INITIAL_POSITION = { row: 0, chars: 0 };

function buildRows({ command, footer, lines, numbered }) {
  const rows = [];

  if (command) rows.push({ left: `> ${command}` });
  if (command && lines.length > 0) rows.push({ left: " " });

  lines.forEach((line, index) => {
    rows.push({
      num: numbered ? String(index + 1).padStart(3, "0") : undefined,
      left: typeof line === "string" ? line : line.label,
      right: typeof line === "string" ? undefined : line.tag,
    });
  });

  if (footer) {
    if (rows.length > 0) rows.push({ left: " " });
    rows.push({ left: footer });
  }

  return rows;
}

function rowCharacterCount(row) {
  return (row.num?.length || 0) + row.left.length;
}

function Cursor() {
  return <span className="terminal-cursor" aria-hidden="true" />;
}

function AnimatedTerminalRow({ complete, current, cursor, position, row }) {
  const numberLength = row.num?.length || 0;
  const visibleCharacters = complete ? rowCharacterCount(row) : current ? position.chars : 0;
  const visibleNumber = row.num?.slice(0, Math.min(visibleCharacters, numberLength)) || "";
  const visibleText = row.left.slice(0, Math.max(0, visibleCharacters - numberLength));

  return (
    <div className="terminal-row">
      <span className={`terminal-row__left${row.num ? " terminal-row__left--numbered" : ""}`}>
        {row.num ? (
          <span className="terminal-number">
            <span className="terminal-measure">{row.num}</span>
            <span className="terminal-visible">{visibleNumber}</span>
          </span>
        ) : null}
        <span className="terminal-text">
          <span className="terminal-measure">{row.left || " "}</span>
          <span className="terminal-visible">{visibleText}{cursor ? <Cursor /> : null}</span>
        </span>
      </span>
      {row.right !== undefined ? (
        <span className={`terminal-tag${complete ? " is-visible" : ""}`}>{row.right}</span>
      ) : null}
    </div>
  );
}

function EditableTerminalRows({ cursor, rows }) {
  return (
    <div
      className="terminal-rows terminal-rows--editable"
      contentEditable
      data-editable-initialized="true"
      suppressContentEditableWarning
      spellCheck="false"
    >
      {rows.map((row, index) => (
        <div className="terminal-row" key={`${row.num || "row"}-${index}`}>
          <span className={`terminal-row__left${row.num ? " terminal-row__left--numbered" : ""}`}>
            {row.num ? <span className="terminal-number terminal-number--plain" contentEditable="false">{row.num}</span> : null}
            <span>{row.left || " "}{cursor && index === rows.length - 1 ? <Cursor /> : null}</span>
          </span>
          {row.right !== undefined ? <span className="terminal-tag is-visible" contentEditable="false">{row.right}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function Terminal({
  title = "Terminal",
  command,
  lines = [],
  footer,
  numbered = true,
  charDelay = 16,
  lineDelay = 200,
  startDelay = 120,
  cursor = true,
  editable = true,
}) {
  const prefersReducedMotion = useReducedMotion();
  const windowRef = useRef(null);
  const [entered, setEntered] = useState(false);
  const [position, setPosition] = useState(INITIAL_POSITION);
  const [finished, setFinished] = useState(false);
  const rows = useMemo(
    () => buildRows({ command, footer, lines, numbered }),
    [command, footer, lines, numbered],
  );
  const accessibleText = useMemo(
    () => rows
      .map((row) => [row.num, row.left, row.right].filter(Boolean).join(" "))
      .filter((row) => row.trim().length > 0)
      .join(". "),
    [rows],
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setFinished(true);
      return undefined;
    }

    const element = windowRef.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setEntered(true);
        observer.disconnect();
      }
    }, { rootMargin: "0px 0px -10% 0px" });

    observer.observe(element);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || !entered) return undefined;

    let cancelled = false;
    let timer = 0;
    setPosition(INITIAL_POSITION);
    setFinished(false);

    const schedule = (delay, callback) => {
      timer = window.setTimeout(() => {
        if (!cancelled) callback();
      }, delay);
    };

    const type = (nextPosition) => {
      const row = rows[nextPosition.row];
      if (!row) {
        setFinished(true);
        return;
      }

      setPosition(nextPosition);
      if (nextPosition.chars < rowCharacterCount(row)) {
        schedule(charDelay, () => type({ ...nextPosition, chars: nextPosition.chars + 1 }));
      } else {
        schedule(lineDelay, () => type({ row: nextPosition.row + 1, chars: 0 }));
      }
    };

    schedule(startDelay, () => type(INITIAL_POSITION));

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [charDelay, entered, lineDelay, prefersReducedMotion, rows, startDelay]);

  return (
    <PullWindow className="problem-terminal">
      <div className="problem-terminal__dither">
        <div ref={windowRef} className="problem-terminal__window">
          <PullWindowHandle className="problem-terminal__header">
            <span>{title}</span>
          </PullWindowHandle>
          <div className="problem-terminal__body">
            <span className="sr-only">{accessibleText}</span>
            {finished && editable ? (
              <EditableTerminalRows cursor={cursor && !prefersReducedMotion} rows={rows} />
            ) : (
              <div className="terminal-rows" aria-hidden="true">
                {rows.map((row, index) => (
                  <AnimatedTerminalRow
                    complete={finished || index < position.row}
                    current={!finished && index === position.row}
                    cursor={cursor && !prefersReducedMotion && entered && index === position.row}
                    key={`${row.num || "row"}-${index}`}
                    position={position}
                    row={row}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PullWindow>
  );
}
