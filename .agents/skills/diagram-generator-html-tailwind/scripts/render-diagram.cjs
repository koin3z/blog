#!/usr/bin/env node

const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { pathToFileURL } = require("node:url")
const zlib = require("node:zlib")

const TAILWIND_VERSION = "4.3.3"
const TAILWIND_URL = `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@${TAILWIND_VERSION}`
const TAILWIND_ASSET = path.resolve(
  __dirname,
  "..",
  "assets",
  "vendor",
  `tailwind-browser-${TAILWIND_VERSION}.js`,
)
const MAX_OUTPUT_PIXELS = 40_000_000
const MIN_OUTER_TRANSPARENT_RATIO = 0.9
const MIN_TOTAL_TRANSPARENT_RATIO = 0.05
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  `script-src 'unsafe-eval' 'wasm-unsafe-eval' ${new URL(TAILWIND_URL).origin}`,
  "style-src 'unsafe-inline'",
  "img-src 'none'",
  "font-src 'none'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ")

const HELP = `
Render a fixed-size HTML/Tailwind diagram to a transparent PNG.

Usage:
  node render-diagram.cjs --input diagram.html --output diagram.png [options]

Required:
  --input <path>           HTML source with #diagram, data-width, and data-height
  --output <path>          PNG output path

Options:
  --selector <selector>    Diagram root selector (default: #diagram)
  --scale <number>         PNG device scale, 1 or 2 (default: 1)
  --min-font-size <px>     Minimum visible text size (default: 16)
  --timeout <ms>           Rendering timeout (default: 15000)
  --allow-overflow         Record overflow findings without failing
  --force                  Overwrite an existing PNG and report
  --help                   Show this help
`.trim()

function parseArguments(argv) {
  const options = {
    selector: "#diagram",
    scale: 1,
    minFontSize: 16,
    timeout: 15000,
    allowOverflow: false,
    force: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === "--help" || argument === "-h") {
      options.help = true
      continue
    }

    if (argument === "--allow-overflow") {
      options.allowOverflow = true
      continue
    }

    if (argument === "--force") {
      options.force = true
      continue
    }

    const next = argv[index + 1]
    if (!next) {
      throw new Error(`Missing value for ${argument}`)
    }

    if (argument === "--input" || argument === "-i") {
      options.input = next
    } else if (argument === "--output" || argument === "-o") {
      options.output = next
    } else if (argument === "--selector") {
      options.selector = next
    } else if (argument === "--scale") {
      options.scale = Number(next)
    } else if (argument === "--min-font-size") {
      options.minFontSize = Number(next)
    } else if (argument === "--timeout") {
      options.timeout = Number(next)
    } else {
      throw new Error(`Unknown option: ${argument}`)
    }

    index += 1
  }

  return options
}

function validateArguments(options) {
  if (!options.input || !options.output) {
    throw new Error("--input and --output are required")
  }

  if (![1, 2].includes(options.scale)) {
    throw new Error("--scale must be 1 or 2")
  }

  if (!Number.isFinite(options.minFontSize) || options.minFontSize < 1) {
    throw new Error("--min-font-size must be a positive number")
  }

  if (!Number.isFinite(options.timeout) || options.timeout < 1000) {
    throw new Error("--timeout must be at least 1000ms")
  }
}

function validateCanvasContract(rawContract, scale) {
  const width = Number(rawContract?.width)
  const height = Number(rawContract?.height)

  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error("Diagram root must declare integer data-width and data-height attributes")
  }

  if (width < 64 || height < 64 || width > 8192 || height > 8192) {
    throw new Error(`Unsupported canvas size: ${width}x${height}`)
  }

  const outputPixels = width * scale * height * scale
  if (outputPixels > MAX_OUTPUT_PIXELS) {
    throw new Error(
      `Output exceeds ${MAX_OUTPUT_PIXELS.toLocaleString("en-US")} pixels: ` +
        `${width * scale}x${height * scale}`,
    )
  }

  return { width, height }
}

function safeRequestLabel(value) {
  try {
    const parsed = new URL(value)

    if (parsed.protocol === "file:") {
      return `file:${path.basename(decodeURIComponent(parsed.pathname))}`
    }

    if (parsed.protocol === "data:") {
      return "data:"
    }

    parsed.username = ""
    parsed.password = ""
    parsed.search = ""
    parsed.hash = ""
    return `${parsed.protocol}//${parsed.host}/`
  } catch {
    return "(unparseable resource)"
  }
}

function staticAudit(html, selector) {
  const issues = []
  const externalResources = []

  if (selector === "#diagram" && !/\bid\s*=\s*["']diagram["']/i.test(html)) {
    issues.push("Missing #diagram root")
  }

  if (!/\brole\s*=\s*["']img["']/i.test(html)) {
    issues.push('Missing role="img"')
  }

  const ariaMatch = html.match(/\baria-label\s*=\s*["']([^"']+)["']/i)
  if (!ariaMatch || ariaMatch[1].trim().length === 0) {
    issues.push("Missing non-empty aria-label")
  }

  const probeTag = html.match(/<[^>]*\bid\s*=\s*["']tailwind-probe["'][^>]*>/i)?.[0]
  const probeClass = probeTag?.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] || ""
  if (!probeTag || !probeClass.split(/\s+/).includes("hidden")) {
    issues.push("Missing #tailwind-probe.hidden")
  }

  let tailwindRuntimeDeclared = false
  let tailwindRuntimeDeclarations = 0
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
  let scriptMatch
  while ((scriptMatch = scriptPattern.exec(html)) !== null) {
    const attributes = scriptMatch[1]
    const body = scriptMatch[2].trim()
    const source = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]
    const allowedTailwindScript = source?.startsWith(TAILWIND_URL) && body.length === 0

    if (allowedTailwindScript) {
      tailwindRuntimeDeclared = true
      tailwindRuntimeDeclarations += 1
    } else {
      issues.push("Executable inline or non-Tailwind script is not allowed")
    }
  }

  if (!tailwindRuntimeDeclared) {
    issues.push(`Missing pinned Tailwind browser runtime declaration: ${TAILWIND_URL}`)
  } else if (tailwindRuntimeDeclarations !== 1) {
    issues.push("Declare the pinned Tailwind browser runtime exactly once")
  }

  if (/\son[a-z][a-z0-9_-]*\s*=/i.test(html)) {
    issues.push("Inline event handlers are not allowed")
  }

  if (/\bjavascript\s*:/i.test(html)) {
    issues.push("javascript: URLs are not allowed")
  }

  const forbiddenElements = [
    "audio",
    "animate",
    "animateMotion",
    "animateTransform",
    "canvas",
    "discard",
    "embed",
    "form",
    "iframe",
    "img",
    "input",
    "marquee",
    "object",
    "picture",
    "select",
    "set",
    "source",
    "template",
    "textarea",
    "video",
  ]
  const presentForbiddenElements = forbiddenElements.filter((tag) =>
    new RegExp(`<${tag}\\b`, "i").test(html),
  )
  if (presentForbiddenElements.length > 0) {
    issues.push(
      `Unsupported active or unverifiable elements: ${presentForbiddenElements.join(", ")}`,
    )
  }

  if (/<meta\b[^>]*\bhttp-equiv\s*=\s*["']?refresh\b/i.test(html)) {
    issues.push("Meta refresh is not allowed")
  }

  const recordResource = (resource) => {
    const trimmed = resource.trim()
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(TAILWIND_URL)) {
      return
    }

    externalResources.push(safeRequestLabel(trimmed.split(/\s+/)[0]))
  }

  const attributePattern = /\b(?:src|srcset|href|data)\s*=\s*["']([^"']+)["']/gi
  let match
  while ((match = attributePattern.exec(html)) !== null) {
    recordResource(match[1])
  }

  const cssUrlPattern = /\burl\(\s*["']?([^"')]+)["']?\s*\)/gi
  while ((match = cssUrlPattern.exec(html)) !== null) {
    recordResource(match[1])
  }

  const cssImportPattern = /@import\s+(?:url\(\s*)?["']([^"']+)["']/gi
  while ((match = cssImportPattern.exec(html)) !== null) {
    recordResource(match[1])
  }

  const uniqueResources = [...new Set(externalResources)]
  if (uniqueResources.length > 0) {
    issues.push(`External or local resources are not allowed: ${uniqueResources.join(", ")}`)
  }

  return {
    issues: [...new Set(issues)],
    externalResources: uniqueResources,
    tailwindRuntimeDeclared,
    tailwindRuntimeDeclarations,
  }
}

function loadPlaywright() {
  const candidates = [
    {
      label: "environment",
      request: process.env.PLAYWRIGHT_MODULE_PATH,
    },
    {
      label: "skill-local",
      request: path.resolve(__dirname, "..", "node_modules", "playwright"),
    },
    {
      label: "project-local",
      request: path.resolve(process.cwd(), "node_modules", "playwright"),
    },
    {
      label: "codex-runtime",
      request: path.join(
        os.homedir(),
        ".cache",
        "codex-runtimes",
        "codex-primary-runtime",
        "dependencies",
        "node",
        "node_modules",
        "playwright",
      ),
    },
    {
      label: "node-resolution",
      request: "playwright",
    },
  ].filter((candidate) => candidate.request)

  const failures = []

  for (const candidate of candidates) {
    try {
      return {
        playwright: require(candidate.request),
        source: candidate.label,
        failures,
      }
    } catch (error) {
      failures.push(`${candidate.label}: ${error.code || "load failed"}`)
    }
  }

  return { playwright: null, source: null, failures }
}

function findChromeExecutable() {
  const pathCandidates = (process.env.PATH || "")
    .split(path.delimiter)
    .flatMap((directory) =>
      ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].map((name) =>
        path.join(directory, name),
      ),
    )
  const candidates = [
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
    ...pathCandidates,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    process.env.PROGRAMFILES &&
      path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean)

  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

async function launchPlaywrightBrowser(playwright, chromeExecutable) {
  const attempts = []

  if (chromeExecutable) {
    try {
      return {
        browser: await playwright.chromium.launch({
          headless: true,
          executablePath: chromeExecutable,
          args: ["--font-render-hinting=none"],
        }),
        launchMode: "system-chrome",
        attempts,
      }
    } catch (error) {
      attempts.push(`system Chrome: ${error.message}`)
    }
  }

  try {
    return {
      browser: await playwright.chromium.launch({ headless: true }),
      launchMode: "playwright-chromium",
      attempts,
    }
  } catch (error) {
    attempts.push(`Playwright Chromium: ${error.message}`)
  }

  return { browser: null, launchMode: null, attempts }
}

async function renderWithPlaywright({
  browser,
  launchMode,
  playwrightSource,
  options,
  inputPath,
  html,
  outputPath,
}) {
  const consoleErrors = []
  const pageErrors = []
  const blockedRemoteRequests = []
  const requestFailures = []
  const unexpectedPages = []
  const mainDocumentUrl = pathToFileURL(inputPath).href
  let tailwindFulfilled = 0
  let context

  try {
    context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: options.scale,
      serviceWorkers: "block",
    })

    await context.route("**/*", async (route) => {
      const request = route.request()
      const url = request.url()

      if (url === mainDocumentUrl && request.resourceType() === "document") {
        await route.fulfill({
          body: html,
          contentType: "text/html; charset=utf-8",
          headers: {
            "Content-Security-Policy": CONTENT_SECURITY_POLICY,
          },
        })
        return
      }

      if (url.startsWith(TAILWIND_URL)) {
        tailwindFulfilled += 1
        await route.fulfill({
          path: TAILWIND_ASSET,
          contentType: "application/javascript; charset=utf-8",
        })
        return
      }

      blockedRemoteRequests.push(safeRequestLabel(url))
      await route.abort("blockedbyclient")
    })

    if (typeof context.routeWebSocket === "function") {
      await context.routeWebSocket(/.*/, async (webSocket) => {
        blockedRemoteRequests.push(safeRequestLabel(webSocket.url()))
        await webSocket.close({
          code: 1008,
          reason: "External connections are blocked during diagram rendering",
        })
      })
    }

    const page = await context.newPage()
    context.on("page", (candidate) => {
      if (candidate !== page) {
        unexpectedPages.push("Unexpected page or popup")
        candidate.close().catch(() => undefined)
      }
    })

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push("Browser console error")
      }
    })

    page.on("pageerror", () => {
      pageErrors.push("Page script error")
    })

    page.on("requestfailed", (request) => {
      requestFailures.push({
        url: safeRequestLabel(request.url()),
        reason: request.failure()?.errorText || "unknown",
      })
    })

    await page.goto(mainDocumentUrl, {
      waitUntil: "domcontentloaded",
      timeout: options.timeout,
    })

    await page.waitForFunction(
      ({ selector }) => {
        const root = document.querySelector(selector)
        const probe = document.querySelector("#tailwind-probe")
        return Boolean(root && probe && getComputedStyle(probe).display === "none")
      },
      { selector: options.selector },
      { timeout: options.timeout },
    )

    const rawContract = await page.evaluate(
      ({ selector }) => {
        const root = document.querySelector(selector)
        return root
          ? {
              width: root.getAttribute("data-width"),
              height: root.getAttribute("data-height"),
            }
          : null
      },
      { selector: options.selector },
    )
    const contract = validateCanvasContract(rawContract, options.scale)

    await page.setViewportSize({
      width: contract.width,
      height: contract.height,
    })

    const rootLocator = page.locator(options.selector)
    await rootLocator.scrollIntoViewIfNeeded({ timeout: options.timeout })
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        }),
    )

    const motionAudit = await page.evaluate(() => {
      const findings = []
      const elements = [
        document.documentElement,
        ...Array.from(document.documentElement.querySelectorAll("*")),
      ]
      const pseudoElements = [null, "::before", "::after", "::marker", "::backdrop"]
      const hasNonZeroTime = (value) =>
        value.split(",").some((part) => {
          const amount = Number.parseFloat(part.trim().toLowerCase())
          return Number.isFinite(amount) && amount !== 0
        })

      for (const element of elements) {
        for (const pseudoElement of pseudoElements) {
          const style = getComputedStyle(element, pseudoElement)
          const hasAnimation = style.animationName
            .split(",")
            .some((name) => name.trim().toLowerCase() !== "none")
          const hasTransition =
            style.transitionProperty
              .split(",")
              .some((property) => property.trim().toLowerCase() !== "none") &&
            (hasNonZeroTime(style.transitionDuration) || hasNonZeroTime(style.transitionDelay))

          if (hasAnimation || hasTransition) {
            findings.push({
              tag: element.tagName.toLowerCase(),
              id: element.id || null,
              pseudoElement,
              animation: hasAnimation,
              transition: hasTransition,
            })
          }
        }
      }

      return {
        findings: findings.slice(0, 50),
        activeAnimationCount: document.getAnimations().length,
      }
    })

    await page.addStyleTag({
      content:
        "*,*::before,*::after{" +
        "animation:none!important;transition:none!important;" +
        "caret-color:transparent!important}",
    })

    await page.evaluate(async () => {
      for (const svg of document.querySelectorAll("svg")) {
        if (typeof svg.pauseAnimations === "function") {
          svg.pauseAnimations()
        }
      }

      if (document.fonts?.ready) {
        await document.fonts.ready
      }

      const images = Array.from(document.images)
      await Promise.all(
        images.map(async (image) => {
          if (!image.complete && typeof image.decode === "function") {
            await image.decode().catch(() => undefined)
          }
        }),
      )

      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      })
    })

    const domAudit = await page.evaluate(
      ({ selector, minFontSize, contract }) => {
        const root = document.querySelector(selector)
        if (!root) {
          return {
            status: "failed",
            issues: [`Missing diagram root: ${selector}`],
            issueCodes: ["missing-root"],
            canvas: null,
            backgrounds: null,
            role: null,
            ariaLabel: null,
            directTextElements: [],
            overflowElements: [],
            clippedElements: [],
            clippedText: [],
            coveringBackgrounds: [],
            ancestorBackgrounds: [],
            unsupportedVisualEffects: [],
            externalOverlays: [],
            imageIssues: [],
          }
        }

        const tolerance = 2
        const issues = []
        const issueCodes = []
        const issueKeys = new Set()
        const addIssue = (key, message) => {
          if (!issueKeys.has(key)) {
            issueKeys.add(key)
            issueCodes.push(key)
            issues.push(message)
          }
        }
        const rootRect = root.getBoundingClientRect()
        const rootStyle = getComputedStyle(root)
        const bodyStyle = getComputedStyle(document.body)
        const htmlStyle = getComputedStyle(document.documentElement)
        const directTextElements = []
        const overflowElements = []
        const clippedElements = []
        const clippedText = []
        const coveringBackgrounds = []
        const ancestorBackgrounds = []
        const unsupportedVisualEffects = []
        const externalOverlays = []
        const rootAncestors = []
        let rootAncestor = root.parentElement
        while (rootAncestor) {
          rootAncestors.push(rootAncestor)
          rootAncestor = rootAncestor.parentElement
        }

        const isDisplayOpacityChainRendered = (element) => {
          let cursor = element
          while (cursor) {
            const style = getComputedStyle(cursor)
            if (style.display === "none" || Number(style.opacity) === 0) {
              return false
            }

            if (cursor === document.documentElement) {
              break
            }
            cursor = cursor.parentElement
          }

          return true
        }

        const isStyleChainRendered = (element) => {
          const elementStyle = getComputedStyle(element)
          return (
            isDisplayOpacityChainRendered(element) &&
            elementStyle.visibility !== "hidden" &&
            elementStyle.visibility !== "collapse"
          )
        }

        const isVisible = (element) => {
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && isStyleChainRendered(element)
        }

        const hasTransparentBackground = (value) =>
          value === "transparent" ||
          /^rgba\([^,]+,[^,]+,[^,]+,\s*0(?:\.0+)?\s*\)$/i.test(value.replace(/\s+/g, " "))

        const summarizeElement = (element) => ({
          tag: element.tagName.toLowerCase(),
          id: element.id || null,
          classes: String(element.className?.baseVal || element.className || "").slice(0, 180),
        })

        const pseudoGeneratesPaint = (element, pseudoElement) => {
          const style = getComputedStyle(element, pseudoElement)
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.visibility !== "collapse" &&
            Number(style.opacity) !== 0 &&
            !["none", "normal"].includes(style.content)
          )
        }

        const splitCssList = (value) => {
          const parts = []
          let depth = 0
          let start = 0
          for (let index = 0; index < value.length; index += 1) {
            if (value[index] === "(") {
              depth += 1
            } else if (value[index] === ")") {
              depth = Math.max(0, depth - 1)
            } else if (value[index] === "," && depth === 0) {
              parts.push(value.slice(start, index).trim())
              start = index + 1
            }
          }
          parts.push(value.slice(start).trim())
          return parts.filter(Boolean)
        }

        const parseShadowExtents = (value) => {
          const extents = { left: 0, top: 0, right: 0, bottom: 0 }
          if (!value || value === "none") {
            return { valid: true, extents }
          }

          for (const shadow of splitCssList(value)) {
            if (/\binset\b/i.test(shadow)) {
              continue
            }

            const withoutColors = shadow
              .replace(/(?:rgb|hsl|lab|lch|oklab|oklch|color)\([^)]*\)/gi, " ")
              .replace(/#[\da-f]{3,8}\b/gi, " ")
              .replace(/\b(?:transparent|currentcolor|[a-z]+)\b/gi, " ")
            const lengths = Array.from(
              withoutColors.matchAll(/(-?(?:\d+|\d*\.\d+))px/gi),
              (match) => Number(match[1]),
            )

            if (lengths.length < 2 || lengths.some((length) => !Number.isFinite(length))) {
              return { valid: false, extents }
            }

            const [offsetX, offsetY, blur = 0, spread = 0] = lengths
            if (blur < 0) {
              return { valid: false, extents }
            }

            // Chromium's Gaussian blur can paint beyond the declared blur radius.
            // Use a conservative 1.5x envelope so locator screenshots cannot crop
            // a visually meaningful shadow while the DOM audit still passes.
            const radius = Math.max(0, blur * 1.5 + spread)
            extents.left = Math.max(extents.left, Math.max(0, -offsetX) + radius)
            extents.right = Math.max(extents.right, Math.max(0, offsetX) + radius)
            extents.top = Math.max(extents.top, Math.max(0, -offsetY) + radius)
            extents.bottom = Math.max(extents.bottom, Math.max(0, offsetY) + radius)
          }

          return { valid: true, extents }
        }

        const hasTransformInChain = (element) => {
          let cursor = element
          while (cursor) {
            const style = getComputedStyle(cursor)
            const zoom = Number.parseFloat(style.zoom)
            if (
              style.transform !== "none" ||
              (style.scale && style.scale !== "none") ||
              (style.rotate && style.rotate !== "none") ||
              (style.translate && style.translate !== "none") ||
              (Number.isFinite(zoom) && Math.abs(zoom - 1) > 0.0001)
            ) {
              return true
            }

            if (cursor === document.documentElement) {
              break
            }
            cursor = cursor.parentElement
          }

          return false
        }

        const svgStrokeTags = new Set([
          "circle",
          "ellipse",
          "line",
          "path",
          "polygon",
          "polyline",
          "rect",
          "text",
          "textpath",
          "tspan",
          "use",
        ])

        const hasUnsupportedClippingStyle = (style) => {
          const containment = String(style.contain || "none")
            .toLowerCase()
            .split(/\s+/)
          return (
            containment.some((value) => ["paint", "content", "strict"].includes(value)) ||
            (style.clip && style.clip !== "auto") ||
            (style.contentVisibility && style.contentVisibility !== "visible") ||
            (style.maskBorderSource && style.maskBorderSource !== "none") ||
            (style.webkitMaskBoxImage && style.webkitMaskBoxImage !== "none")
          )
        }

        const hasUnsupportedPaintOutset = (style) =>
          (style.borderImageSource && style.borderImageSource !== "none") ||
          (style.textDecorationLine && style.textDecorationLine !== "none") ||
          (style.textEmphasisStyle && style.textEmphasisStyle !== "none") ||
          (style.webkitBoxReflect && style.webkitBoxReflect !== "none")

        if (Math.abs(rootRect.width - contract.width) > tolerance) {
          addIssue(
            "canvas-width",
            `Canvas CSS width does not match data-width: ${rootRect.width}px != ${contract.width}px`,
          )
        }

        if (Math.abs(rootRect.height - contract.height) > tolerance) {
          addIssue(
            "canvas-height",
            `Canvas CSS height does not match data-height: ${rootRect.height}px != ${contract.height}px`,
          )
        }

        if (root.scrollWidth > root.clientWidth + tolerance) {
          addIssue(
            "root-horizontal-overflow",
            `Root horizontal overflow: ${root.scrollWidth}px > ${root.clientWidth}px`,
          )
        }

        if (root.scrollHeight > root.clientHeight + tolerance) {
          addIssue(
            "root-vertical-overflow",
            `Root vertical overflow: ${root.scrollHeight}px > ${root.clientHeight}px`,
          )
        }

        for (const ancestor of rootAncestors) {
          const ancestorStyle = getComputedStyle(ancestor)
          const ancestorRect = ancestor.getBoundingClientRect()
          const clipRect = {
            left: ancestorRect.left + ancestor.clientLeft,
            top: ancestorRect.top + ancestor.clientTop,
            right: ancestorRect.left + ancestor.clientLeft + ancestor.clientWidth,
            bottom: ancestorRect.top + ancestor.clientTop + ancestor.clientHeight,
          }
          const clipsX = /^(hidden|clip|auto|scroll)$/.test(ancestorStyle.overflowX)
          const clipsY = /^(hidden|clip|auto|scroll)$/.test(ancestorStyle.overflowY)
          const clippedX =
            clipsX &&
            (rootRect.left < clipRect.left - tolerance ||
              rootRect.right > clipRect.right + tolerance)
          const clippedY =
            clipsY &&
            (rootRect.top < clipRect.top - tolerance ||
              rootRect.bottom > clipRect.bottom + tolerance)

          if (clippedX || clippedY) {
            clippedElements.push({
              ...summarizeElement(root),
              clippedBy: summarizeElement(ancestor),
              ancestorOfDiagram: true,
            })
            break
          }
        }

        const elements = [root, ...Array.from(root.querySelectorAll("*"))]
        for (const element of elements) {
          if (!isDisplayOpacityChainRendered(element)) {
            continue
          }

          const elementBoxVisible = isStyleChainRendered(element)
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          const hasPseudoContent =
            pseudoGeneratesPaint(element, "::before") ||
            pseudoGeneratesPaint(element, "::after") ||
            pseudoGeneratesPaint(element, "::marker")
          const hasListMarker =
            style.display === "list-item" &&
            (style.listStyleType !== "none" || style.listStyleImage !== "none")
          const hasUnverifiableEffect =
            style.clipPath !== "none" ||
            style.filter !== "none" ||
            (style.backdropFilter && style.backdropFilter !== "none") ||
            (style.webkitBackdropFilter && style.webkitBackdropFilter !== "none") ||
            (style.maskImage && style.maskImage !== "none") ||
            (style.webkitMaskImage && style.webkitMaskImage !== "none") ||
            (style.markerStart && style.markerStart !== "none") ||
            (style.markerMid && style.markerMid !== "none") ||
            (style.markerEnd && style.markerEnd !== "none") ||
            hasListMarker ||
            hasUnsupportedClippingStyle(style) ||
            hasUnsupportedPaintOutset(style) ||
            hasPseudoContent
          const boxShadow = parseShadowExtents(style.boxShadow)
          const hasBoxShadow = style.boxShadow !== "none"
          const transformedBoxShadow = hasBoxShadow && hasTransformInChain(element)
          const hasTextShadow = style.textShadow !== "none"
          const hasTextStroke = Number.parseFloat(style.webkitTextStrokeWidth) > 0
          const hasOutline =
            style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0
          const hasStroke =
            svgStrokeTags.has(element.tagName.toLowerCase()) &&
            style.stroke !== "none" &&
            !hasTransparentBackground(String(style.stroke)) &&
            Number.parseFloat(style.strokeOpacity) !== 0
          const strokeWidthValue = String(style.strokeWidth || "").trim()
          const supportedStrokeWidth = /^(?:0(?:\.0+)?|(?:\d+|\d*\.\d+)px)$/i.test(strokeWidthValue)
          const unsupportedStrokeWidth = hasStroke && !supportedStrokeWidth
          const strokeWidth =
            hasStroke && supportedStrokeWidth ? Number.parseFloat(strokeWidthValue) || 0 : 0
          let strokeScale = 1
          let strokeJoinMultiplier = 1
          let unsupportedStrokeGeometry = false

          if (hasStroke && supportedStrokeWidth) {
            const vectorEffect = String(style.vectorEffect || "none")
            if (!["none", "non-scaling-stroke"].includes(vectorEffect)) {
              unsupportedStrokeGeometry = true
            } else if (vectorEffect !== "non-scaling-stroke") {
              const matrix =
                typeof element.getScreenCTM === "function" ? element.getScreenCTM() : null
              if (!matrix) {
                unsupportedStrokeGeometry = true
              } else {
                const sum = matrix.a ** 2 + matrix.b ** 2 + matrix.c ** 2 + matrix.d ** 2
                const determinant = matrix.a * matrix.d - matrix.b * matrix.c
                const discriminant = Math.max(0, sum ** 2 - 4 * determinant ** 2)
                strokeScale = Math.sqrt((sum + Math.sqrt(discriminant)) / 2)
                if (!Number.isFinite(strokeScale) || strokeScale <= 0) {
                  unsupportedStrokeGeometry = true
                }
              }
            }

            if (/^miter(?:-clip)?$/i.test(String(style.strokeLinejoin))) {
              const miterLimit = Number.parseFloat(style.strokeMiterlimit)
              if (!Number.isFinite(miterLimit) || miterLimit < 1) {
                unsupportedStrokeGeometry = true
              } else {
                strokeJoinMultiplier = miterLimit
              }
            }
          }

          const strokeExtent =
            unsupportedStrokeWidth || unsupportedStrokeGeometry
              ? 0
              : (strokeWidth * strokeScale * strokeJoinMultiplier) / 2

          if (hasUnverifiableEffect) {
            unsupportedVisualEffects.push({
              ...summarizeElement(element),
              clipPath: style.clipPath !== "none",
              filter:
                style.filter !== "none" ||
                (style.backdropFilter && style.backdropFilter !== "none") ||
                (style.webkitBackdropFilter && style.webkitBackdropFilter !== "none"),
              mask:
                (style.maskImage && style.maskImage !== "none") ||
                (style.webkitMaskImage && style.webkitMaskImage !== "none"),
              marker:
                (style.markerStart && style.markerStart !== "none") ||
                (style.markerMid && style.markerMid !== "none") ||
                (style.markerEnd && style.markerEnd !== "none"),
              listMarker: hasListMarker,
              unsupportedClipping: hasUnsupportedClippingStyle(style),
              unsupportedPaintOutset: hasUnsupportedPaintOutset(style),
              pseudoContent: hasPseudoContent,
            })
          }

          if (!elementBoxVisible) {
            continue
          }

          const outside =
            rect.left < rootRect.left - tolerance ||
            rect.top < rootRect.top - tolerance ||
            rect.right > rootRect.right + tolerance ||
            rect.bottom > rootRect.bottom + tolerance

          if (outside) {
            overflowElements.push({
              ...summarizeElement(element),
              rect: {
                left: Math.round(rect.left - rootRect.left),
                top: Math.round(rect.top - rootRect.top),
                right: Math.round(rect.right - rootRect.left),
                bottom: Math.round(rect.bottom - rootRect.top),
              },
            })
          }

          let clippingAncestor = element.parentElement
          while (clippingAncestor && root.contains(clippingAncestor)) {
            const ancestorStyle = getComputedStyle(clippingAncestor)
            const ancestorRect = clippingAncestor.getBoundingClientRect()
            const clipRect = {
              left: ancestorRect.left + clippingAncestor.clientLeft,
              top: ancestorRect.top + clippingAncestor.clientTop,
              right: ancestorRect.left + clippingAncestor.clientLeft + clippingAncestor.clientWidth,
              bottom: ancestorRect.top + clippingAncestor.clientTop + clippingAncestor.clientHeight,
            }
            const clipsX = /^(hidden|clip|auto|scroll)$/.test(ancestorStyle.overflowX)
            const clipsY = /^(hidden|clip|auto|scroll)$/.test(ancestorStyle.overflowY)
            const clippedX =
              clipsX &&
              (rect.left < clipRect.left - tolerance || rect.right > clipRect.right + tolerance)
            const clippedY =
              clipsY &&
              (rect.top < clipRect.top - tolerance || rect.bottom > clipRect.bottom + tolerance)

            if (clippedX || clippedY) {
              clippedElements.push({
                ...summarizeElement(element),
                clippedBy: summarizeElement(clippingAncestor),
              })
              break
            }

            if (clippingAncestor === root) {
              break
            }
            clippingAncestor = clippingAncestor.parentElement
          }

          const shadowOutsideCanvas =
            hasBoxShadow &&
            (!boxShadow.valid ||
              rect.left - rootRect.left < boxShadow.extents.left + tolerance ||
              rect.top - rootRect.top < boxShadow.extents.top + tolerance ||
              rootRect.right - rect.right < boxShadow.extents.right + tolerance ||
              rootRect.bottom - rect.bottom < boxShadow.extents.bottom + tolerance)
          const strokeOutsideCanvas =
            strokeExtent > 0 &&
            (rect.left - rootRect.left < strokeExtent + tolerance ||
              rect.top - rootRect.top < strokeExtent + tolerance ||
              rootRect.right - rect.right < strokeExtent + tolerance ||
              rootRect.bottom - rect.bottom < strokeExtent + tolerance)

          if (
            shadowOutsideCanvas ||
            transformedBoxShadow ||
            hasTextShadow ||
            hasTextStroke ||
            hasOutline ||
            strokeOutsideCanvas ||
            unsupportedStrokeWidth ||
            unsupportedStrokeGeometry
          ) {
            unsupportedVisualEffects.push({
              ...summarizeElement(element),
              shadowOutsideCanvas,
              transformedBoxShadow,
              textShadow: hasTextShadow,
              textStroke: hasTextStroke,
              outline: hasOutline,
              strokeOutsideCanvas,
              unsupportedStrokeWidth,
              unsupportedStrokeGeometry,
              strokeScale: Number(strokeScale.toFixed(4)),
              strokeJoinMultiplier,
              strokeExtent: Number(strokeExtent.toFixed(4)),
            })
          }

          const areaRatio =
            (rect.width * rect.height) / Math.max(1, rootRect.width * rootRect.height)
          const coversCanvas = areaRatio >= 0.9

          if (
            coversCanvas &&
            (!hasTransparentBackground(style.backgroundColor) || style.backgroundImage !== "none")
          ) {
            coveringBackgrounds.push({
              ...summarizeElement(element),
              areaRatio: Number(areaRatio.toFixed(4)),
              backgroundColor: style.backgroundColor,
              hasBackgroundImage: style.backgroundImage !== "none",
            })
          }
        }

        if (overflowElements.length > 0) {
          addIssue(
            "outside-canvas",
            `${overflowElements.length} visible element(s) extend outside the canvas`,
          )
        }

        if (clippedElements.length > 0) {
          addIssue(
            "clipped-elements",
            `${clippedElements.length} visible element(s) are clipped by an ancestor`,
          )
        }

        for (const surface of rootAncestors) {
          const style = getComputedStyle(surface)
          const hasPseudoContent =
            pseudoGeneratesPaint(surface, "::before") ||
            pseudoGeneratesPaint(surface, "::after") ||
            pseudoGeneratesPaint(surface, "::marker")
          const hasListMarker =
            style.display === "list-item" &&
            (style.listStyleType !== "none" || style.listStyleImage !== "none")
          const hasSurfaceEffect =
            style.clipPath !== "none" ||
            style.filter !== "none" ||
            (style.backdropFilter && style.backdropFilter !== "none") ||
            (style.webkitBackdropFilter && style.webkitBackdropFilter !== "none") ||
            (style.maskImage && style.maskImage !== "none") ||
            (style.webkitMaskImage && style.webkitMaskImage !== "none") ||
            (style.markerStart && style.markerStart !== "none") ||
            (style.markerMid && style.markerMid !== "none") ||
            (style.markerEnd && style.markerEnd !== "none") ||
            hasListMarker ||
            hasUnsupportedClippingStyle(style) ||
            hasUnsupportedPaintOutset(style) ||
            style.boxShadow !== "none" ||
            style.textShadow !== "none" ||
            Number.parseFloat(style.webkitTextStrokeWidth) > 0 ||
            (style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0) ||
            hasPseudoContent

          if (hasSurfaceEffect) {
            unsupportedVisualEffects.push({
              ...summarizeElement(surface),
              documentSurface: true,
            })
          }
        }

        for (const element of Array.from(document.body.querySelectorAll("*"))) {
          if (
            element === root ||
            root.contains(element) ||
            element.contains(root) ||
            element.id === "tailwind-probe"
          ) {
            continue
          }

          if (!isDisplayOpacityChainRendered(element)) {
            continue
          }

          const elementBoxVisible = isStyleChainRendered(element)
          const style = getComputedStyle(element)
          const hasPseudoContent =
            pseudoGeneratesPaint(element, "::before") ||
            pseudoGeneratesPaint(element, "::after") ||
            pseudoGeneratesPaint(element, "::marker")
          const hasListMarker =
            style.display === "list-item" &&
            (style.listStyleType !== "none" || style.listStyleImage !== "none")
          const hasExternalEffect =
            style.clipPath !== "none" ||
            style.filter !== "none" ||
            (style.backdropFilter && style.backdropFilter !== "none") ||
            (style.webkitBackdropFilter && style.webkitBackdropFilter !== "none") ||
            (style.maskImage && style.maskImage !== "none") ||
            (style.webkitMaskImage && style.webkitMaskImage !== "none") ||
            (style.markerStart && style.markerStart !== "none") ||
            (style.markerMid && style.markerMid !== "none") ||
            (style.markerEnd && style.markerEnd !== "none") ||
            hasListMarker ||
            hasUnsupportedClippingStyle(style) ||
            hasUnsupportedPaintOutset(style) ||
            style.boxShadow !== "none" ||
            style.textShadow !== "none" ||
            Number.parseFloat(style.webkitTextStrokeWidth) > 0 ||
            (style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0) ||
            (style.stroke !== "none" && !hasTransparentBackground(String(style.stroke))) ||
            hasPseudoContent

          if (hasExternalEffect) {
            unsupportedVisualEffects.push({
              ...summarizeElement(element),
              outsideDiagram: true,
            })
          }

          if (!elementBoxVisible) {
            continue
          }

          const rect = element.getBoundingClientRect()
          if (rect.width <= 0 || rect.height <= 0) {
            continue
          }

          const overlapsRoot =
            rect.right > rootRect.left &&
            rect.left < rootRect.right &&
            rect.bottom > rootRect.top &&
            rect.top < rootRect.bottom

          if (overlapsRoot) {
            externalOverlays.push(summarizeElement(element))
          }
        }

        if (externalOverlays.length > 0) {
          addIssue(
            "external-overlays",
            `${externalOverlays.length} visible element(s) outside the diagram overlap the canvas`,
          )
        }

        if (unsupportedVisualEffects.length > 0) {
          addIssue(
            "unsupported-visual-effects",
            `${unsupportedVisualEffects.length} element(s) use unverifiable clipping, masks, ` +
              "filters, pseudo-content, or paint effects outside the canvas",
          )
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        let textNode = walker.nextNode()
        while (textNode) {
          const text = textNode.textContent.trim().replace(/\s+/g, " ")
          const parent = textNode.parentElement

          if (text && parent && isVisible(parent)) {
            const range = document.createRange()
            range.selectNodeContents(textNode)
            const rectangles = Array.from(range.getClientRects()).filter(
              (rect) => rect.width > 0 && rect.height > 0,
            )

            if (rectangles.length > 0) {
              const textRect = {
                left: Math.min(...rectangles.map((rect) => rect.left)),
                top: Math.min(...rectangles.map((rect) => rect.top)),
                right: Math.max(...rectangles.map((rect) => rect.right)),
                bottom: Math.max(...rectangles.map((rect) => rect.bottom)),
              }
              const fontSize = Number.parseFloat(getComputedStyle(parent).fontSize)
              let transformScale = 1
              let transformAncestor = parent
              while (transformAncestor && root.contains(transformAncestor)) {
                const transformStyle = getComputedStyle(transformAncestor)
                if (transformStyle.transform !== "none") {
                  const matrix = new DOMMatrixReadOnly(transformStyle.transform)
                  const scaleX = Math.hypot(matrix.a, matrix.b)
                  const scaleY = Math.hypot(matrix.c, matrix.d)
                  transformScale *= Math.min(scaleX, scaleY)
                }

                const zoom = Number.parseFloat(transformStyle.zoom)
                if (Number.isFinite(zoom) && zoom > 0) {
                  transformScale *= zoom
                }

                if (transformAncestor === root) {
                  break
                }
                transformAncestor = transformAncestor.parentElement
              }
              const smallestRenderedLineHeight = Math.min(...rectangles.map((rect) => rect.height))
              const effectiveFontSize = Math.min(
                fontSize * transformScale,
                smallestRenderedLineHeight,
              )
              const entry = {
                tag: parent.tagName.toLowerCase(),
                text: text.slice(0, 100),
                fontSize,
                effectiveFontSize: Number(effectiveFontSize.toFixed(2)),
              }
              directTextElements.push(entry)

              if (effectiveFontSize + 0.01 < minFontSize) {
                addIssue(
                  `font:${directTextElements.length}`,
                  `Text below minimum size: ${entry.effectiveFontSize}px < ` +
                    `${minFontSize}px (${entry.text})`,
                )
              }

              const outsideRoot =
                textRect.left < rootRect.left - tolerance ||
                textRect.top < rootRect.top - tolerance ||
                textRect.right > rootRect.right + tolerance ||
                textRect.bottom > rootRect.bottom + tolerance

              if (outsideRoot) {
                clippedText.push({
                  ...entry,
                  reason: "outside diagram canvas",
                })
              }

              let ancestor = parent
              while (ancestor && root.contains(ancestor)) {
                const ancestorStyle = getComputedStyle(ancestor)
                const ancestorRect = ancestor.getBoundingClientRect()
                const clipRect = {
                  left: ancestorRect.left + ancestor.clientLeft,
                  top: ancestorRect.top + ancestor.clientTop,
                  right: ancestorRect.left + ancestor.clientLeft + ancestor.clientWidth,
                  bottom: ancestorRect.top + ancestor.clientTop + ancestor.clientHeight,
                }
                const clipsX = /^(hidden|clip|auto|scroll)$/.test(ancestorStyle.overflowX)
                const clipsY = /^(hidden|clip|auto|scroll)$/.test(ancestorStyle.overflowY)
                const clippedX =
                  clipsX &&
                  (textRect.left < clipRect.left - tolerance ||
                    textRect.right > clipRect.right + tolerance)
                const clippedY =
                  clipsY &&
                  (textRect.top < clipRect.top - tolerance ||
                    textRect.bottom > clipRect.bottom + tolerance)

                if (clippedX || clippedY) {
                  clippedText.push({
                    ...entry,
                    reason: `clipped by ${ancestor.tagName.toLowerCase()}`,
                  })
                  break
                }

                if (ancestor === root) {
                  break
                }
                ancestor = ancestor.parentElement
              }
            }
          }

          textNode = walker.nextNode()
        }

        if (clippedText.length > 0) {
          addIssue("clipped-text", `${clippedText.length} text node(s) are clipped or outside`)
        }

        const backgrounds = {
          html: {
            color: htmlStyle.backgroundColor,
            hasImage: htmlStyle.backgroundImage !== "none",
          },
          body: {
            color: bodyStyle.backgroundColor,
            hasImage: bodyStyle.backgroundImage !== "none",
          },
          root: {
            color: rootStyle.backgroundColor,
            hasImage: rootStyle.backgroundImage !== "none",
          },
        }

        for (const ancestor of rootAncestors) {
          if (ancestor === document.documentElement || ancestor === document.body) {
            continue
          }

          const style = getComputedStyle(ancestor)
          ancestorBackgrounds.push({
            ...summarizeElement(ancestor),
            color: style.backgroundColor,
            hasImage: style.backgroundImage !== "none",
          })
        }

        for (const [name, background] of Object.entries(backgrounds)) {
          if (!hasTransparentBackground(background.color)) {
            addIssue(
              `${name}-background-color`,
              `${name} background is not transparent: ${background.color}`,
            )
          }
          if (background.hasImage) {
            addIssue(`${name}-background-image`, `${name} background image is not allowed`)
          }
        }

        for (const [index, background] of ancestorBackgrounds.entries()) {
          if (!hasTransparentBackground(background.color)) {
            addIssue(
              `ancestor-${index}-background-color`,
              `Diagram ancestor background is not transparent: ${background.color}`,
            )
          }
          if (background.hasImage) {
            addIssue(
              `ancestor-${index}-background-image`,
              "Diagram ancestor background image is not allowed",
            )
          }
        }

        if (coveringBackgrounds.length > 0) {
          addIssue(
            "covering-background",
            `${coveringBackgrounds.length} descendant background(s) cover the canvas`,
          )
        }

        const imageIssues = Array.from(document.images)
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map(() => "Image failed to load")

        if (imageIssues.length > 0) {
          addIssue("failed-images", `${imageIssues.length} image(s) failed to load`)
        }

        const role = root.getAttribute("role")
        const ariaLabel = root.getAttribute("aria-label")

        if (role !== "img") {
          addIssue("role", 'Diagram root must have role="img"')
        }

        if (!ariaLabel?.trim()) {
          addIssue("aria-label", "Diagram root must have a non-empty aria-label")
        }

        return {
          status: issues.length === 0 ? "passed" : "failed",
          issues,
          issueCodes,
          canvas: {
            width: rootRect.width,
            height: rootRect.height,
            scrollWidth: root.scrollWidth,
            scrollHeight: root.scrollHeight,
          },
          backgrounds,
          role,
          ariaLabel,
          directTextElements: directTextElements.slice(0, 250),
          overflowElements: overflowElements.slice(0, 20),
          clippedElements: clippedElements.slice(0, 20),
          clippedText: clippedText.slice(0, 20),
          coveringBackgrounds: coveringBackgrounds.slice(0, 20),
          ancestorBackgrounds: ancestorBackgrounds.slice(0, 20),
          unsupportedVisualEffects: unsupportedVisualEffects.slice(0, 20),
          externalOverlays: externalOverlays.slice(0, 20),
          imageIssues,
        }
      },
      {
        selector: options.selector,
        minFontSize: options.minFontSize,
        contract,
      },
    )

    domAudit.motionEffects = motionAudit
    if (motionAudit.findings.length > 0 || motionAudit.activeAnimationCount > 0) {
      domAudit.issues.push(
        `${motionAudit.findings.length} element or pseudo-element motion effect(s) are not allowed`,
      )
      domAudit.issueCodes.push("motion-effects")
      domAudit.status = "failed"
    }

    const preCapture = await page.evaluate(
      ({ selector }) => {
        const root = document.querySelector(selector)
        if (!root) {
          return null
        }

        const rect = root.getBoundingClientRect()
        return {
          dataWidth: root.getAttribute("data-width"),
          dataHeight: root.getAttribute("data-height"),
          width: rect.width,
          height: rect.height,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          scrollWidth: root.scrollWidth,
          scrollHeight: root.scrollHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          pageScrollX: window.scrollX,
          pageScrollY: window.scrollY,
          activeAnimationCount: document.getAnimations().length,
        }
      },
      { selector: options.selector },
    )
    const preCaptureIssues = []
    const addPreCaptureIssue = (code, message) => {
      preCaptureIssues.push({ code, message })
    }
    if (!preCapture) {
      addPreCaptureIssue("pre-capture-missing-root", "Diagram root disappeared before capture")
    } else {
      if (
        Number(preCapture.dataWidth) !== contract.width ||
        Number(preCapture.dataHeight) !== contract.height
      ) {
        addPreCaptureIssue(
          "pre-capture-contract",
          "Diagram data-width or data-height changed before capture",
        )
      }
      if (
        Math.abs(preCapture.width - contract.width) > 2 ||
        Math.abs(preCapture.height - contract.height) > 2
      ) {
        addPreCaptureIssue(
          "pre-capture-dimensions",
          "Diagram CSS dimensions changed before capture",
        )
      }
      if (
        preCapture.left < -2 ||
        preCapture.top < -2 ||
        preCapture.right > preCapture.viewportWidth + 2 ||
        preCapture.bottom > preCapture.viewportHeight + 2
      ) {
        addPreCaptureIssue(
          "pre-capture-viewport",
          "Diagram is not fully inside the viewport after final scrolling",
        )
      }
      if (
        preCapture.scrollWidth > preCapture.width + 2 ||
        preCapture.scrollHeight > preCapture.height + 2
      ) {
        addPreCaptureIssue("pre-capture-overflow", "Diagram overflow changed before capture")
      }
      if (preCapture.activeAnimationCount > 0) {
        addPreCaptureIssue(
          "pre-capture-motion",
          "CSS or Web Animations are still active before capture",
        )
      }
    }

    if (tailwindFulfilled !== 1) {
      addPreCaptureIssue(
        "tailwind-runtime-count",
        `Pinned Tailwind runtime was fulfilled ${tailwindFulfilled} time(s), expected once`,
      )
    }

    if (unexpectedPages.length > 0) {
      addPreCaptureIssue("unexpected-page", "An unexpected page or popup was created")
    }

    if (preCaptureIssues.length > 0) {
      domAudit.issues.push(...preCaptureIssues.map((issue) => issue.message))
      domAudit.issueCodes.push(...preCaptureIssues.map((issue) => issue.code))
      domAudit.status = "failed"
    }
    domAudit.preCapture = preCapture

    await rootLocator.screenshot({
      path: outputPath,
      type: "png",
      omitBackground: true,
      animations: "disabled",
      caret: "hide",
      scale: options.scale === 1 ? "css" : "device",
    })

    const postCapture = await page.evaluate(
      ({ selector }) => {
        const root = document.querySelector(selector)
        if (!root) {
          return null
        }

        const rect = root.getBoundingClientRect()
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          pageScrollX: window.scrollX,
          pageScrollY: window.scrollY,
        }
      },
      { selector: options.selector },
    )
    domAudit.postCapture = postCapture

    if (
      !postCapture ||
      !preCapture ||
      Math.abs(postCapture.left - preCapture.left) > 0.5 ||
      Math.abs(postCapture.top - preCapture.top) > 0.5 ||
      Math.abs(postCapture.right - preCapture.right) > 0.5 ||
      Math.abs(postCapture.bottom - preCapture.bottom) > 0.5 ||
      Math.abs(postCapture.pageScrollX - preCapture.pageScrollX) > 0.5 ||
      Math.abs(postCapture.pageScrollY - preCapture.pageScrollY) > 0.5
    ) {
      domAudit.issues.push("Diagram position or page scroll changed during capture")
      domAudit.issueCodes.push("capture-position-changed")
      domAudit.status = "failed"
    }

    return {
      renderer: "playwright",
      launchMode,
      playwrightSource,
      contract,
      domAudit,
      consoleErrors,
      pageErrors,
      blockedRemoteRequests: [...new Set(blockedRemoteRequests)],
      requestFailures,
      unexpectedPages,
      tailwindFulfilled,
      warnings: [],
    }
  } finally {
    if (context) {
      await context.close().catch(() => undefined)
    }
    await browser.close().catch(() => undefined)
  }
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const upperLeftDistance = Math.abs(estimate - upperLeft)

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) {
    return left
  }

  if (upDistance <= upperLeftDistance) {
    return up
  }

  return upperLeft
}

function analyzePng(pngPath) {
  const bytes = fs.readFileSync(pngPath)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  if (!bytes.subarray(0, 8).equals(signature)) {
    throw new Error("Output is not a PNG file")
  }

  let offset = 8
  let ihdr
  const idatChunks = []

  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString("ascii", offset + 4, offset + 8)
    const data = bytes.subarray(offset + 8, offset + 8 + length)

    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      }
    } else if (type === "IDAT") {
      idatChunks.push(data)
    } else if (type === "IEND") {
      break
    }

    offset += 12 + length
  }

  if (!ihdr) {
    throw new Error("PNG is missing IHDR")
  }

  const result = {
    ...ihdr,
    hasAlpha: [4, 6].includes(ihdr.colorType),
    alphaMin: null,
    alphaMax: null,
    transparentPixels: null,
    translucentPixels: null,
    opaquePixels: null,
    transparentRatio: null,
    cornerAlpha: null,
    outerBandSize: null,
    outerBandPixels: null,
    outerTransparentPixels: null,
    outerTransparentRatio: null,
  }

  if (!result.hasAlpha || ihdr.bitDepth !== 8 || ihdr.interlace !== 0) {
    return result
  }

  const channels = ihdr.colorType === 6 ? 4 : 2
  const alphaIndex = channels - 1
  const rowLength = ihdr.width * channels
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks))
  const outerBandSize = Math.max(
    1,
    Math.min(16, Math.ceil(Math.min(ihdr.width, ihdr.height) * 0.01)),
  )
  let dataOffset = 0
  let previousRow = Buffer.alloc(rowLength)
  let alphaMin = 255
  let alphaMax = 0
  let transparentPixels = 0
  let translucentPixels = 0
  let opaquePixels = 0
  let outerBandPixels = 0
  let outerTransparentPixels = 0
  let firstRowCorners
  let lastRowCorners

  for (let rowIndex = 0; rowIndex < ihdr.height; rowIndex += 1) {
    const filter = inflated[dataOffset]
    dataOffset += 1
    const encodedRow = inflated.subarray(dataOffset, dataOffset + rowLength)
    dataOffset += rowLength
    const row = Buffer.allocUnsafe(rowLength)

    for (let byteIndex = 0; byteIndex < rowLength; byteIndex += 1) {
      const encoded = encodedRow[byteIndex]
      const left = byteIndex >= channels ? row[byteIndex - channels] : 0
      const up = previousRow[byteIndex]
      const upperLeft = byteIndex >= channels ? previousRow[byteIndex - channels] : 0
      let value

      if (filter === 0) {
        value = encoded
      } else if (filter === 1) {
        value = encoded + left
      } else if (filter === 2) {
        value = encoded + up
      } else if (filter === 3) {
        value = encoded + Math.floor((left + up) / 2)
      } else if (filter === 4) {
        value = encoded + paethPredictor(left, up, upperLeft)
      } else {
        throw new Error(`Unsupported PNG filter: ${filter}`)
      }

      row[byteIndex] = value & 0xff
    }

    for (let pixelOffset = alphaIndex; pixelOffset < rowLength; pixelOffset += channels) {
      const pixelIndex = Math.floor(pixelOffset / channels)
      const alpha = row[pixelOffset]
      alphaMin = Math.min(alphaMin, alpha)
      alphaMax = Math.max(alphaMax, alpha)

      if (alpha === 0) {
        transparentPixels += 1
      } else if (alpha === 255) {
        opaquePixels += 1
      } else {
        translucentPixels += 1
      }

      const isOuterBand =
        rowIndex < outerBandSize ||
        rowIndex >= ihdr.height - outerBandSize ||
        pixelIndex < outerBandSize ||
        pixelIndex >= ihdr.width - outerBandSize

      if (isOuterBand) {
        outerBandPixels += 1
        if (alpha === 0) {
          outerTransparentPixels += 1
        }
      }
    }

    const corners = [row[alphaIndex], row[rowLength - channels + alphaIndex]]
    if (rowIndex === 0) {
      firstRowCorners = corners
    }
    if (rowIndex === ihdr.height - 1) {
      lastRowCorners = corners
    }

    previousRow = row
  }

  result.alphaMin = alphaMin
  result.alphaMax = alphaMax
  result.transparentPixels = transparentPixels
  result.translucentPixels = translucentPixels
  result.opaquePixels = opaquePixels
  result.transparentRatio = Number(
    (transparentPixels / Math.max(1, ihdr.width * ihdr.height)).toFixed(6),
  )
  result.cornerAlpha = [...firstRowCorners, ...lastRowCorners]
  result.outerBandSize = outerBandSize
  result.outerBandPixels = outerBandPixels
  result.outerTransparentPixels = outerTransparentPixels
  result.outerTransparentRatio =
    outerBandPixels === 0 ? 0 : Number((outerTransparentPixels / outerBandPixels).toFixed(6))

  return result
}

function buildValidation({ png, contract, scale, staticAuditResult, renderResult, allowOverflow }) {
  const checks = []
  const expectedWidth = contract.width * scale
  const expectedHeight = contract.height * scale

  checks.push({
    text: `PNG dimensions are ${expectedWidth}x${expectedHeight}`,
    passed: png.width === expectedWidth && png.height === expectedHeight,
    evidence: `actual=${png.width}x${png.height}`,
  })
  checks.push({
    text: "PNG has a decoded alpha channel",
    passed: png.hasAlpha && png.alphaMin !== null,
    evidence: `colorType=${png.colorType}, bitDepth=${png.bitDepth}, interlace=${png.interlace}`,
  })
  checks.push({
    text: "PNG contains both fully transparent and fully opaque pixels",
    passed: png.transparentPixels > 0 && png.opaquePixels > 0,
    evidence:
      `alphaMin=${png.alphaMin}, alphaMax=${png.alphaMax}, ` +
      `transparent=${png.transparentPixels}, opaque=${png.opaquePixels}`,
  })
  checks.push({
    text: "All four PNG corners are fully transparent",
    passed: Array.isArray(png.cornerAlpha) && png.cornerAlpha.every((alpha) => alpha === 0),
    evidence: `cornerAlpha=${JSON.stringify(png.cornerAlpha)}`,
  })
  checks.push({
    text: `At least ${MIN_OUTER_TRANSPARENT_RATIO * 100}% of the outer PNG band is transparent`,
    passed: png.outerTransparentRatio >= MIN_OUTER_TRANSPARENT_RATIO,
    evidence:
      `band=${png.outerBandSize}px, transparent=${png.outerTransparentPixels}/` +
      `${png.outerBandPixels}, ratio=${png.outerTransparentRatio}`,
  })
  checks.push({
    text: `At least ${MIN_TOTAL_TRANSPARENT_RATIO * 100}% of the full PNG is transparent`,
    passed: png.transparentRatio >= MIN_TOTAL_TRANSPARENT_RATIO,
    evidence:
      `transparent=${png.transparentPixels}/${png.width * png.height}, ` +
      `ratio=${png.transparentRatio}`,
  })
  checks.push({
    text: "Static HTML contract passes",
    passed: staticAuditResult.issues.length === 0,
    evidence:
      staticAuditResult.issues.length === 0
        ? "role, aria-label, probe, and resource rules passed"
        : staticAuditResult.issues.join("; "),
  })

  const allowedOverflowCodes = new Set([
    "root-horizontal-overflow",
    "root-vertical-overflow",
    "outside-canvas",
    "clipped-elements",
    "clipped-text",
    "pre-capture-overflow",
  ])
  const domIssues = renderResult.domAudit.issues.map((message, index) => ({
    code: renderResult.domAudit.issueCodes?.[index] || "uncategorized",
    message,
  }))
  const overflowIssues = domIssues.filter((issue) => allowedOverflowCodes.has(issue.code))
  const nonOverflowIssues = domIssues.filter((issue) => !allowedOverflowCodes.has(issue.code))
  const formatIssues = (issues) =>
    issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ")

  checks.push({
    text: "Computed DOM, accessibility, font-size, and transparency checks pass",
    passed: nonOverflowIssues.length === 0,
    evidence: nonOverflowIssues.length === 0 ? "passed" : formatIssues(nonOverflowIssues),
  })
  checks.push({
    text: "No text or element extends outside the diagram canvas",
    passed: allowOverflow || overflowIssues.length === 0,
    evidence:
      overflowIssues.length === 0
        ? "passed"
        : `${allowOverflow ? "allowed" : "failed"}: ${formatIssues(overflowIssues)}`,
  })
  checks.push({
    text: "No unexpected resource, console, or page errors occurred",
    passed:
      renderResult.blockedRemoteRequests.length === 0 &&
      renderResult.consoleErrors.length === 0 &&
      renderResult.pageErrors.length === 0 &&
      renderResult.requestFailures.length === 0 &&
      renderResult.unexpectedPages.length === 0 &&
      renderResult.tailwindFulfilled === 1,
    evidence: JSON.stringify({
      blockedRequests: renderResult.blockedRemoteRequests,
      consoleErrors: renderResult.consoleErrors,
      pageErrors: renderResult.pageErrors,
      requestFailures: renderResult.requestFailures,
      unexpectedPages: renderResult.unexpectedPages,
      tailwindFulfilled: renderResult.tailwindFulfilled,
    }),
  })

  return {
    success: checks.every((check) => check.passed),
    checks,
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))

  if (options.help) {
    console.log(HELP)
    return
  }

  validateArguments(options)

  const inputPath = path.resolve(options.input)
  const outputPath = path.resolve(options.output)
  const reportPath = outputPath.replace(/\.png$/i, "") + ".report.json"

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input HTML does not exist: ${path.basename(inputPath)}`)
  }

  if (path.extname(outputPath).toLowerCase() !== ".png") {
    throw new Error("--output must use the .png extension")
  }

  if (!options.force && (fs.existsSync(outputPath) || fs.existsSync(reportPath))) {
    throw new Error("Output already exists; pass --force to overwrite it")
  }

  if (!fs.existsSync(TAILWIND_ASSET)) {
    throw new Error("Bundled Tailwind runtime is missing")
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  const html = fs.readFileSync(inputPath, "utf8")
  const staticAuditResult = staticAudit(html, options.selector)
  if (options.force) {
    fs.rmSync(outputPath, { force: true })
    fs.rmSync(reportPath, { force: true })
  }

  const stagingDirectory = fs.mkdtempSync(path.join(path.dirname(outputPath), ".diagram-render-"))
  const stagedOutputPath = path.join(stagingDirectory, path.basename(outputPath))
  const stagedReportPath = path.join(stagingDirectory, path.basename(reportPath))

  try {
    const playwrightLoad = loadPlaywright()

    if (!playwrightLoad.playwright) {
      throw new Error(
        "Playwright is required for verified rendering and was not found. " +
          "Install Playwright locally or set PLAYWRIGHT_MODULE_PATH.",
      )
    }

    const chromeExecutable = findChromeExecutable()
    const playwrightLaunch = await launchPlaywrightBrowser(
      playwrightLoad.playwright,
      chromeExecutable,
    )

    if (!playwrightLaunch.browser) {
      throw new Error(
        `Playwright could not launch Chromium: ${playwrightLaunch.attempts.join("; ")}`,
      )
    }

    const renderResult = await renderWithPlaywright({
      browser: playwrightLaunch.browser,
      launchMode: playwrightLaunch.launchMode,
      playwrightSource: playwrightLoad.source,
      options,
      inputPath,
      html,
      outputPath: stagedOutputPath,
    })
    const contract = renderResult.contract
    const png = analyzePng(stagedOutputPath)
    const validation = buildValidation({
      png,
      contract,
      scale: options.scale,
      staticAuditResult,
      renderResult,
      allowOverflow: options.allowOverflow,
    })
    const report = {
      success: validation.success,
      input: path.basename(inputPath),
      output: path.basename(outputPath),
      generatedAt: new Date().toISOString(),
      renderer: {
        name: renderResult.renderer,
        launchMode: renderResult.launchMode,
        playwrightSource: renderResult.playwrightSource,
        tailwindVersion: TAILWIND_VERSION,
        scale: options.scale,
      },
      contract,
      png,
      staticAudit: staticAuditResult,
      domAudit: renderResult.domAudit,
      diagnostics: {
        consoleErrors: renderResult.consoleErrors,
        pageErrors: renderResult.pageErrors,
        blockedRequests: renderResult.blockedRemoteRequests,
        requestFailures: renderResult.requestFailures,
        unexpectedPages: renderResult.unexpectedPages,
        tailwindFulfilled: renderResult.tailwindFulfilled,
        warnings: renderResult.warnings,
      },
      checks: validation.checks,
    }

    fs.writeFileSync(stagedReportPath, `${JSON.stringify(report, null, 2)}\n`)
    fs.renameSync(stagedOutputPath, outputPath)
    fs.renameSync(stagedReportPath, reportPath)

    const outcome = validation.success ? "PASS" : "FAIL"
    console.log(
      `${outcome} ${path.basename(outputPath)} ${png.width}x${png.height} ` +
        `alpha=${png.alphaMin}-${png.alphaMax} renderer=${renderResult.renderer}`,
    )
    console.log(`Report: ${path.basename(reportPath)}`)

    if (!validation.success) {
      process.exitCode = 2
    }
  } finally {
    fs.rmSync(stagingDirectory, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(`ERROR ${error.message}`)
  process.exitCode = 1
})
