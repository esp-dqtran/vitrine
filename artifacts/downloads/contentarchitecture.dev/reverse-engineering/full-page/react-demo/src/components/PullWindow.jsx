import { createContext, useContext, useState } from "react";
import { motion, useDragControls } from "motion/react";

const PullWindowContext = createContext(null);

export function PullWindow({ children, className = "", dragElastic = 0.2 }) {
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);

  return (
    <div className={`pull-window ${className}`.trim()}>
      <motion.div
        aria-hidden="true"
        className="pull-window__boundary"
        initial={{ opacity: 0 }}
        animate={{ opacity: dragging ? 1 : 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      />
      <motion.div
        className="pull-window__content"
        drag
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
        dragElastic={dragElastic}
        dragMomentum={false}
        dragSnapToOrigin
        dragTransition={{ bounceStiffness: 320, bounceDamping: 24 }}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => setDragging(false)}
      >
        <PullWindowContext.Provider value={controls}>
          {children}
        </PullWindowContext.Provider>
      </motion.div>
    </div>
  );
}

export function PullWindowHandle({ children, className = "" }) {
  const controls = useContext(PullWindowContext);
  return (
    <div
      className={`pull-window__handle ${className}`.trim()}
      onPointerDown={controls ? (event) => controls.start(event) : undefined}
    >
      {children}
    </div>
  );
}
