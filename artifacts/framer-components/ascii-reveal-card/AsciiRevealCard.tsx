import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"

type ResponsiveImage = {
    src?: string
    srcSet?: string
    alt?: string
}

type ImageValue = ResponsiveImage | string | undefined
type FitMode = "cover" | "contain"
type InteractionMode = "hover" | "tap"
type RevealMode = "crossfade" | "spotlight"

type AsciiRevealCardProps = {
    image?: ImageValue
    altText: string
    title: string
    showTitle: boolean
    titleColor: string
    titleSize: number
    uppercaseTitle: boolean
    titleGap: number
    fit: FitMode
    characters: string
    columns: number
    contrast: number
    brightness: number
    invert: boolean
    asciiColor: string
    backgroundColor: string
    interaction: InteractionMode
    reveal: RevealMode
    previewRevealed: boolean
    revealRadius: number
    duration: number
    radius: number
    link: string
    newTab: boolean
    style?: React.CSSProperties
}

type DrawRect = {
    x: number
    y: number
    width: number
    height: number
}

const DEFAULT_IMAGE =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
            <rect width="1600" height="900" fill="#111111"/>
            <circle cx="1160" cy="410" r="330" fill="#d2613d"/>
            <path d="M180 630h570v48H180zm0-120h760v48H180zm0-120h520v48H180z" fill="#f2f2ef"/>
        </svg>
    `)

const DEFAULT_CHARACTERS = ".:-=+*#%@"
const ASCII_LEVELS = 64
const SOURCE_COLUMN_RATIO = 37 / 120
const MONO_FONT =
    '"Geist Mono", ui-monospace, SFMono-Regular, "Roboto Mono", Menlo, Monaco, Consolas, monospace'
const REVEAL_EASING = "cubic-bezier(0, 0, 0.2, 1)"

function resolveImage(image: ImageValue) {
    if (typeof image === "string") {
        return { src: image, srcSet: undefined, alt: undefined }
    }

    return {
        src: image?.src || DEFAULT_IMAGE,
        srcSet: image?.srcSet,
        alt: image?.alt,
    }
}

function calculateImageRect(
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    fit: FitMode
): DrawRect {
    const sourceRatio = sourceWidth / sourceHeight
    const targetRatio = targetWidth / targetHeight
    const useWidth = fit === "cover" ? sourceRatio < targetRatio : sourceRatio > targetRatio

    if (useWidth) {
        const height = targetWidth / sourceRatio
        return { x: 0, y: (targetHeight - height) / 2, width: targetWidth, height }
    }

    const width = targetHeight * sourceRatio
    return { x: (targetWidth - width) / 2, y: 0, width, height: targetHeight }
}

function normalizeCharacters(characters: string) {
    const ramp = Array.from(characters.trim())
    return ramp.length > 1 ? ramp : Array.from(DEFAULT_CHARACTERS)
}

function adjustedLuminance(
    red: number,
    green: number,
    blue: number,
    contrast: number,
    brightness: number,
    invert: boolean
) {
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
    const contrasted = (luminance - 0.5) * contrast + 0.5 + brightness / 100
    const clamped = Math.max(0, Math.min(1, contrasted))
    return invert ? 1 - clamped : clamped
}

/**
 * A replaceable image-to-ASCII showcase card reconstructed from the original
 * Good Fella card interaction.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 482
 */
export default function AsciiRevealCard(props: AsciiRevealCardProps) {
    const {
        image,
        altText = "Website preview",
        title = "ASCII Reveal",
        showTitle = true,
        titleColor = "#FFFFFF",
        titleSize = 16,
        uppercaseTitle = true,
        titleGap = 12,
        fit = "cover",
        characters = DEFAULT_CHARACTERS,
        columns = 120,
        contrast = 1,
        brightness = 0,
        invert = false,
        asciiColor = "#FFFFFF",
        backgroundColor = "#232323",
        interaction = "hover",
        reveal = "crossfade",
        previewRevealed = false,
        revealRadius = 24,
        duration = 0.5,
        radius = 0,
        link = "",
        newTab = true,
        style,
    } = props

    const rootRef = React.useRef<HTMLElement>(null)
    const mediaRef = React.useRef<HTMLDivElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const [hoverActive, setHoverActive] = React.useState(false)
    const [tapActive, setTapActive] = React.useState(false)
    const [touchActive, setTouchActive] = React.useState(false)
    const [asciiReady, setAsciiReady] = React.useState(false)
    const [asciiUnavailable, setAsciiUnavailable] = React.useState(false)
    const [pointer, setPointer] = React.useState({ x: 50, y: 50 })
    const [titleEntered, setTitleEntered] = React.useState(false)
    const isStatic = useIsStaticRenderer()
    const resolvedImage = React.useMemo(() => resolveImage(image), [image])
    const fitMode: FitMode = String(fit).toLowerCase() === "contain" ? "contain" : "cover"
    const interactionMode: InteractionMode =
        String(interaction).toLowerCase() === "tap" ? "tap" : "hover"
    const revealMode: RevealMode =
        String(reveal).toLowerCase() === "spotlight" ? "spotlight" : "crossfade"
    const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const transitionDuration = prefersReducedMotion ? 0 : Math.max(0, duration)

    React.useEffect(() => {
        if (isStatic || prefersReducedMotion) {
            setTitleEntered(true)
            return
        }

        const frame = window.requestAnimationFrame(() => setTitleEntered(true))
        return () => window.cancelAnimationFrame(frame)
    }, [isStatic, prefersReducedMotion])

    React.useEffect(() => {
        const root = rootRef.current
        if (!root || isStatic || interactionMode !== "hover") return

        const touchDevice =
            window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0
        if (!touchDevice) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry?.rootBounds) return
                setTouchActive(entry.boundingClientRect.top <= entry.rootBounds.top)
            },
            { rootMargin: "-50% 0px -50% 0px" }
        )
        observer.observe(root)
        return () => observer.disconnect()
    }, [interactionMode, isStatic])

    React.useEffect(() => {
        const root = mediaRef.current
        const canvas = canvasRef.current
        if (!root || !canvas || !resolvedImage.src) return

        let disposed = false
        let frame = 0
        const source = new Image()

        if (!resolvedImage.src.startsWith("data:")) source.crossOrigin = "anonymous"
        source.decoding = "async"

        const draw = () => {
            if (disposed || !source.naturalWidth || !source.naturalHeight) return

            const rect = root.getBoundingClientRect()
            if (rect.width < 1 || rect.height < 1) return

            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            const pixelWidth = Math.max(1, Math.round(rect.width * dpr))
            const pixelHeight = Math.max(1, Math.round(rect.height * dpr))
            const columnCount = Math.max(24, Math.round(columns))
            const rowCount = Math.max(8, Math.round(columnCount * SOURCE_COLUMN_RATIO))

            canvas.width = pixelWidth
            canvas.height = pixelHeight

            const context = canvas.getContext("2d")
            const sampleCanvas = document.createElement("canvas")
            const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true })
            if (!context || !sampleContext) return

            sampleCanvas.width = columnCount
            sampleCanvas.height = rowCount
            sampleContext.clearRect(0, 0, columnCount, rowCount)
            sampleContext.fillStyle = backgroundColor
            sampleContext.fillRect(0, 0, columnCount, rowCount)

            const imageRect = calculateImageRect(
                source.naturalWidth,
                source.naturalHeight,
                columnCount,
                rowCount,
                fitMode
            )
            sampleContext.imageSmoothingEnabled = true
            sampleContext.drawImage(
                source,
                imageRect.x,
                imageRect.y,
                imageRect.width,
                imageRect.height
            )

            try {
                const pixels = sampleContext.getImageData(0, 0, columnCount, rowCount).data
                const ramp = normalizeCharacters(characters)
                const highestLevel = ASCII_LEVELS - 1
                const cellWidth = pixelWidth / columnCount
                const cellHeight = pixelHeight / rowCount

                context.clearRect(0, 0, pixelWidth, pixelHeight)
                context.fillStyle = asciiColor
                context.textAlign = "center"
                context.textBaseline = "middle"
                context.font = `${Math.floor(cellHeight)}px ${MONO_FONT}`
                const measuredM = context.measureText("M").width || 0.6 * cellHeight
                context.font = `${(cellWidth / measuredM) * cellHeight}px ${MONO_FONT}`

                for (let row = 0; row < rowCount; row += 1) {
                    for (let column = 0; column < columnCount; column += 1) {
                        const pixelIndex = (row * columnCount + column) * 4
                        const alpha = pixels[pixelIndex + 3] / 255
                        if (alpha <= 0.01) continue

                        const luminance = adjustedLuminance(
                            pixels[pixelIndex],
                            pixels[pixelIndex + 1],
                            pixels[pixelIndex + 2],
                            contrast,
                            brightness,
                            invert
                        )
                        const level = Math.round(luminance * highestLevel)
                        const value = level / highestLevel
                        const character =
                            ramp[Math.min(ramp.length - 1, Math.round(value * (ramp.length - 1)))]

                        context.globalAlpha = alpha * (0.12 + 0.88 * value ** 0.85)
                        context.fillText(
                            character,
                            (column + 0.5) * cellWidth,
                            (row + 0.5) * cellHeight
                        )
                    }
                }

                context.globalAlpha = 1
                setAsciiUnavailable(false)
                setAsciiReady(true)
            } catch {
                context.clearRect(0, 0, pixelWidth, pixelHeight)
                setAsciiUnavailable(true)
                setAsciiReady(false)
            }
        }

        const scheduleDraw = () => {
            window.cancelAnimationFrame(frame)
            frame = window.requestAnimationFrame(draw)
        }

        source.onload = scheduleDraw
        source.onerror = () => {
            if (!disposed) {
                setAsciiUnavailable(true)
                setAsciiReady(false)
            }
        }
        source.src = resolvedImage.src

        const observer = new ResizeObserver(scheduleDraw)
        observer.observe(root)
        document.fonts?.ready.then(scheduleDraw)

        return () => {
            disposed = true
            window.cancelAnimationFrame(frame)
            observer.disconnect()
            source.onload = null
            source.onerror = null
        }
    }, [
        asciiColor,
        backgroundColor,
        brightness,
        characters,
        columns,
        contrast,
        fitMode,
        invert,
        resolvedImage.src,
    ])

    const showImage =
        asciiUnavailable ||
        previewRevealed ||
        (interactionMode === "hover" ? hoverActive || touchActive : tapActive)

    const updatePointer = (event: React.PointerEvent<HTMLElement>) => {
        const rect = mediaRef.current?.getBoundingClientRect()
        if (!rect?.width || !rect.height) return
        setPointer({
            x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
            y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
        })
    }

    const onPointerEnter = (event: React.PointerEvent<HTMLElement>) => {
        updatePointer(event)
        if (!isStatic && interactionMode === "hover" && event.pointerType !== "touch") {
            setHoverActive(true)
        }
    }

    const onPointerLeave = () => {
        if (interactionMode === "hover") setHoverActive(false)
    }

    const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
        updatePointer(event)
        if (!isStatic && interactionMode === "tap") setTapActive((current) => !current)
    }

    const imageClip =
        revealMode === "spotlight" && !asciiUnavailable
            ? `circle(${showImage ? revealRadius : 0}% at ${pointer.x}% ${pointer.y}%)`
            : undefined

    const content = (
        <>
            <div
                ref={mediaRef}
                role="group"
                aria-label={altText || resolvedImage.alt || "ASCII image reveal"}
                style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    minHeight: 1,
                    overflow: "hidden",
                    borderRadius: radius,
                    background: "transparent",
                    isolation: "isolate",
                }}
            >
                <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label={title || altText || "ASCII image"}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        opacity:
                            asciiReady && !(revealMode === "crossfade" && showImage) ? 1 : 0,
                        transition: `opacity ${transitionDuration}s ${REVEAL_EASING}`,
                        pointerEvents: "none",
                    }}
                />
                <img
                    src={resolvedImage.src}
                    srcSet={resolvedImage.srcSet}
                    alt={altText || resolvedImage.alt || ""}
                    draggable={false}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        display: "block",
                        objectFit: fitMode,
                        opacity: revealMode === "crossfade" ? (showImage ? 1 : 0) : 1,
                        clipPath: imageClip,
                        transition:
                            revealMode === "crossfade"
                                ? `opacity ${transitionDuration}s ${REVEAL_EASING}`
                                : `clip-path ${transitionDuration}s ${REVEAL_EASING}`,
                        pointerEvents: "none",
                        userSelect: "none",
                    }}
                />
            </div>
            {showTitle && (
                <div
                    style={{
                        width: "100%",
                        height: "1.25em",
                        color: titleColor,
                        fontFamily: MONO_FONT,
                        fontSize: `clamp(14px, ${titleSize}px, 16px)`,
                        fontWeight: 400,
                        lineHeight: 1.25,
                        letterSpacing: "normal",
                        textTransform: uppercaseTitle ? "uppercase" : "none",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                    }}
                >
                    <span
                        style={{
                            display: "block",
                            opacity: titleEntered ? 1 : 0,
                            transform: titleEntered ? "translateY(0)" : "translateY(100%)",
                            transition: prefersReducedMotion
                                ? "none"
                                : "opacity 700ms cubic-bezier(0.23, 1, 0.32, 1), transform 700ms cubic-bezier(0.23, 1, 0.32, 1)",
                        }}
                    >
                        {title}
                    </span>
                </div>
            )}
        </>
    )

    const rootStyle: React.CSSProperties = {
        ...style,
        position: "relative",
        width: "100%",
        height: "auto",
        minWidth: 1,
        minHeight: 1,
        overflow: "visible",
        display: "flex",
        flexDirection: "column",
        gap: showTitle ? titleGap : 0,
        color: titleColor,
        background: backgroundColor,
        textDecoration: "none",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
    }

    return React.createElement(
        link ? "a" : "div",
        {
            ref: rootRef,
            ...(link
                ? {
                      href: link,
                      target: newTab ? "_blank" : undefined,
                      rel: newTab ? "noopener noreferrer" : undefined,
                  }
                : {}),
            onPointerEnter,
            onPointerMove: updatePointer,
            onPointerLeave,
            onPointerDown,
            style: rootStyle,
        },
        content
    )
}

addPropertyControls(AsciiRevealCard, {
    image: {
        type: ControlType.ResponsiveImage,
        title: "Image",
    },
    altText: {
        type: ControlType.String,
        title: "Alt Text",
        defaultValue: "Website preview",
    },
    title: {
        type: ControlType.String,
        title: "Title",
        defaultValue: "ASCII Reveal",
    },
    showTitle: {
        type: ControlType.Boolean,
        title: "Show Title",
        defaultValue: true,
    },
    titleColor: {
        type: ControlType.Color,
        title: "Title Color",
        defaultValue: "#FFFFFF",
        hidden: (values) => !values.showTitle,
    },
    titleSize: {
        type: ControlType.Number,
        title: "Title Size",
        min: 14,
        max: 16,
        step: 1,
        defaultValue: 16,
        unit: "px",
        hidden: (values) => !values.showTitle,
    },
    uppercaseTitle: {
        type: ControlType.Boolean,
        title: "Uppercase",
        defaultValue: true,
        hidden: (values) => !values.showTitle,
    },
    titleGap: {
        type: ControlType.Number,
        title: "Title Gap",
        min: 0,
        max: 48,
        step: 1,
        defaultValue: 12,
        unit: "px",
        hidden: (values) => !values.showTitle,
    },
    fit: {
        type: ControlType.Enum,
        title: "Fit",
        options: ["cover", "contain"],
        optionTitles: ["Cover", "Contain"],
        defaultValue: "cover",
        displaySegmentedControl: true,
    },
    characters: {
        type: ControlType.String,
        title: "Characters",
        defaultValue: DEFAULT_CHARACTERS,
    },
    columns: {
        type: ControlType.Number,
        title: "ASCII Detail",
        min: 24,
        max: 200,
        step: 1,
        defaultValue: 120,
    },
    contrast: {
        type: ControlType.Number,
        title: "Contrast",
        min: 0.25,
        max: 3,
        step: 0.05,
        defaultValue: 1,
    },
    brightness: {
        type: ControlType.Number,
        title: "Brightness",
        min: -50,
        max: 50,
        step: 1,
        defaultValue: 0,
        unit: "%",
    },
    invert: {
        type: ControlType.Boolean,
        title: "Invert",
        defaultValue: false,
    },
    asciiColor: {
        type: ControlType.Color,
        title: "ASCII",
        defaultValue: "#FFFFFF",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#232323",
    },
    interaction: {
        type: ControlType.Enum,
        title: "Interaction",
        options: ["hover", "tap"],
        optionTitles: ["Source Hover", "Tap"],
        defaultValue: "hover",
        displaySegmentedControl: true,
    },
    reveal: {
        type: ControlType.Enum,
        title: "Reveal",
        options: ["crossfade", "spotlight"],
        optionTitles: ["Source Fade", "Spotlight"],
        defaultValue: "crossfade",
        displaySegmentedControl: true,
    },
    previewRevealed: {
        type: ControlType.Boolean,
        title: "Preview Image",
        defaultValue: false,
    },
    revealRadius: {
        type: ControlType.Number,
        title: "Reveal Size",
        min: 5,
        max: 75,
        step: 1,
        defaultValue: 24,
        unit: "%",
        hidden: (values) => values.reveal !== "spotlight",
    },
    duration: {
        type: ControlType.Number,
        title: "Duration",
        min: 0,
        max: 2,
        step: 0.05,
        defaultValue: 0.5,
        unit: "s",
    },
    radius: {
        type: ControlType.Number,
        title: "Radius",
        min: 0,
        max: 80,
        step: 1,
        defaultValue: 0,
        unit: "px",
    },
    link: {
        type: ControlType.Link,
        title: "Link",
        defaultValue: "",
    },
    newTab: {
        type: ControlType.Boolean,
        title: "New Tab",
        defaultValue: true,
        hidden: (values) => !values.link,
    },
})
