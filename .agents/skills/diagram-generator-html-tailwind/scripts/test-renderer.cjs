#!/usr/bin/env node

const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const skillDirectory = path.resolve(__dirname, "..")
const renderer = path.join(__dirname, "render-diagram.cjs")
const baseTemplate = path.join(skillDirectory, "assets", "base.html")
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "diagram-renderer-test-"))

function reportPathFor(outputPath) {
  return outputPath.replace(/\.png$/i, "") + ".report.json"
}

function runRenderer(inputPath, outputPath, extraArguments = []) {
  return spawnSync(
    process.execPath,
    [renderer, "--input", inputPath, "--output", outputPath, "--force", ...extraArguments],
    {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  )
}

function readReport(outputPath) {
  return JSON.parse(fs.readFileSync(reportPathFor(outputPath), "utf8"))
}

try {
  const baseOutput = path.join(temporaryDirectory, "base.png")
  const baseResult = runRenderer(baseTemplate, baseOutput)
  assert.equal(baseResult.status, 0, baseResult.stderr || baseResult.stdout)
  const baseReport = readReport(baseOutput)
  assert.equal(baseReport.success, true)
  assert.deepEqual([baseReport.png.width, baseReport.png.height], [760, 150])
  assert.equal(baseReport.png.outerTransparentRatio, 1)
  assert.deepEqual(baseReport.domAudit.clippedText, [])

  const scaleOutput = path.join(temporaryDirectory, "base-2x.png")
  const scaleResult = runRenderer(baseTemplate, scaleOutput, ["--scale", "2"])
  assert.equal(scaleResult.status, 0, scaleResult.stderr || scaleResult.stdout)
  const scaleReport = readReport(scaleOutput)
  assert.equal(scaleReport.success, true)
  assert.deepEqual([scaleReport.png.width, scaleReport.png.height], [1520, 300])

  const maliciousHtml = path.join(temporaryDirectory, "blocked-resource.html")
  fs.writeFileSync(
    maliciousHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace("</body>", '<img src="file:///etc/passwd" alt="">\n</body>'),
  )
  const maliciousOutput = path.join(temporaryDirectory, "blocked-resource.png")
  const maliciousResult = runRenderer(maliciousHtml, maliciousOutput)
  assert.equal(maliciousResult.status, 2, maliciousResult.stderr || maliciousResult.stdout)
  const maliciousReport = readReport(maliciousOutput)
  assert.equal(maliciousReport.success, false)
  assert.ok(maliciousReport.staticAudit.externalResources.includes("file:passwd"))
  assert.ok(
    maliciousReport.diagnostics.blockedRequests.includes("file:passwd") ||
      maliciousReport.diagnostics.consoleErrors.length > 0 ||
      maliciousReport.diagnostics.requestFailures.length > 0,
  )

  const opaqueHtml = path.join(temporaryDirectory, "opaque-canvas.html")
  fs.writeFileSync(
    opaqueHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        'class="relative h-[150px] w-[760px] overflow-hidden bg-transparent"',
        'class="relative h-[150px] w-[760px] overflow-hidden bg-white"',
      ),
  )
  const opaqueOutput = path.join(temporaryDirectory, "opaque-canvas.png")
  const opaqueResult = runRenderer(opaqueHtml, opaqueOutput)
  assert.equal(opaqueResult.status, 2, opaqueResult.stderr || opaqueResult.stdout)
  const opaqueReport = readReport(opaqueOutput)
  assert.equal(opaqueReport.success, false)
  assert.ok(opaqueReport.png.outerTransparentRatio < 0.9)
  assert.ok(opaqueReport.domAudit.issues.some((issue) => issue.includes("root background")))

  const insetHtml = path.join(temporaryDirectory, "inset-background.html")
  fs.writeFileSync(
    insetHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "<!-- diagram-content -->",
        '<div class="absolute inset-[2px] bg-white"></div>\n' + "<!-- diagram-content -->",
      ),
  )
  const insetOutput = path.join(temporaryDirectory, "inset-background.png")
  const insetResult = runRenderer(insetHtml, insetOutput)
  assert.equal(insetResult.status, 2, insetResult.stderr || insetResult.stdout)
  const insetReport = readReport(insetOutput)
  assert.equal(insetReport.success, false)
  assert.ok(
    insetReport.png.transparentRatio < 0.05 || insetReport.domAudit.coveringBackgrounds.length > 0,
  )

  const allowedOverflowHtml = path.join(temporaryDirectory, "allowed-overflow-background.html")
  fs.writeFileSync(
    allowedOverflowHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "<!-- diagram-content -->",
        '<div data-allow-overflow class="absolute -left-[30px] top-20 h-40 w-40 bg-white"></div>\n' +
          "<!-- diagram-content -->",
      ),
  )
  const allowedOverflowOutput = path.join(temporaryDirectory, "allowed-overflow-background.png")
  const allowedOverflowResult = runRenderer(allowedOverflowHtml, allowedOverflowOutput)
  assert.equal(
    allowedOverflowResult.status,
    2,
    allowedOverflowResult.stderr || allowedOverflowResult.stdout,
  )
  assert.ok(readReport(allowedOverflowOutput).domAudit.overflowElements.length > 0)

  const paintBoundaryHtml = path.join(temporaryDirectory, "paint-boundary.html")
  fs.writeFileSync(
    paintBoundaryHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "<!-- diagram-content -->",
        '<section id="paint-containment" style="contain:paint">' +
          '<div id="paint-outset" style="border:8px solid transparent;' +
          "border-image:linear-gradient(#fff,#fff) 1 / 8px / 40px;" +
          '-webkit-box-reflect:right 40px">paint</div></section>' +
          "<!-- diagram-content -->",
      )
      .replace(
        "</main>",
        '<div id="legacy-clip" style="position:absolute;clip:rect(0,10px,10px,0)">clip</div>' +
          "</main>",
      ),
  )
  const paintBoundaryOutput = path.join(temporaryDirectory, "paint-boundary.png")
  const paintBoundaryResult = runRenderer(paintBoundaryHtml, paintBoundaryOutput)
  assert.equal(
    paintBoundaryResult.status,
    2,
    paintBoundaryResult.stderr || paintBoundaryResult.stdout,
  )
  const paintBoundaryEffects = readReport(paintBoundaryOutput).domAudit.unsupportedVisualEffects
  assert.ok(
    paintBoundaryEffects.some(
      (entry) => entry.id === "paint-containment" && entry.unsupportedClipping,
    ),
  )
  assert.ok(
    paintBoundaryEffects.some(
      (entry) => entry.id === "paint-outset" && entry.unsupportedPaintOutset,
    ),
  )
  assert.ok(
    paintBoundaryEffects.some((entry) => entry.id === "legacy-clip" && entry.unsupportedClipping),
  )

  const smallTextHtml = path.join(temporaryDirectory, "small-text.html")
  fs.writeFileSync(
    smallTextHtml,
    fs.readFileSync(baseTemplate, "utf8").replace("text-[20px]", "text-[14px]"),
  )
  const smallTextOutput = path.join(temporaryDirectory, "small-text.png")
  const smallTextResult = runRenderer(smallTextHtml, smallTextOutput)
  assert.equal(smallTextResult.status, 2, smallTextResult.stderr || smallTextResult.stdout)
  const smallTextReport = readReport(smallTextOutput)
  assert.ok(
    smallTextReport.domAudit.directTextElements.some((entry) => entry.effectiveFontSize < 16),
  )

  const restoredVisibilityHtml = path.join(temporaryDirectory, "restored-visibility.html")
  fs.writeFileSync(
    restoredVisibilityHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace("</style>", "body{visibility:hidden}#diagram{visibility:visible}</style>")
      .replace("text-[20px]", "text-[14px]"),
  )
  const restoredVisibilityOutput = path.join(temporaryDirectory, "restored-visibility.png")
  const restoredVisibilityResult = runRenderer(restoredVisibilityHtml, restoredVisibilityOutput)
  assert.equal(
    restoredVisibilityResult.status,
    2,
    restoredVisibilityResult.stderr || restoredVisibilityResult.stdout,
  )
  assert.ok(
    readReport(restoredVisibilityOutput).domAudit.directTextElements.some(
      (entry) => entry.effectiveFontSize < 16,
    ),
  )

  const restoredPseudoHtml = path.join(temporaryDirectory, "restored-pseudo.html")
  fs.writeFileSync(
    restoredPseudoHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "</style>",
        "#pseudo-host{visibility:hidden}#pseudo-host::before{" +
          'content:"";visibility:visible;position:fixed;inset:0;background:#fff}' +
          "</style>",
      )
      .replace(
        "</main>",
        '<div id="hidden-clip" class="absolute left-20 top-20 h-20 w-20" ' +
          'style="visibility:hidden;contain:paint">' +
          '<span style="visibility:visible">visible child</span></div>' +
          '<div id="pseudo-host"></div></main>',
      ),
  )
  const restoredPseudoOutput = path.join(temporaryDirectory, "restored-pseudo.png")
  const restoredPseudoResult = runRenderer(restoredPseudoHtml, restoredPseudoOutput)
  assert.equal(
    restoredPseudoResult.status,
    2,
    restoredPseudoResult.stderr || restoredPseudoResult.stdout,
  )
  const restoredPseudoEffects = readReport(restoredPseudoOutput).domAudit.unsupportedVisualEffects
  assert.ok(
    restoredPseudoEffects.some((entry) => entry.id === "pseudo-host" && entry.pseudoContent),
  )
  assert.ok(
    restoredPseudoEffects.some((entry) => entry.id === "hidden-clip" && entry.unsupportedClipping),
  )

  const transformedTextHtml = path.join(temporaryDirectory, "transformed-text.html")
  fs.writeFileSync(
    transformedTextHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        'class="absolute top-[76px] left-[40px] w-[180px] text-center"',
        'style="transform:scale(0.5);box-shadow:0 4px 8px rgba(15,23,42,0.12)" ' +
          'class="absolute top-[76px] left-[40px] w-[180px] text-center"',
      ),
  )
  const transformedTextOutput = path.join(temporaryDirectory, "transformed-text.png")
  const transformedTextResult = runRenderer(transformedTextHtml, transformedTextOutput)
  assert.equal(
    transformedTextResult.status,
    2,
    transformedTextResult.stderr || transformedTextResult.stdout,
  )
  const transformedTextReport = readReport(transformedTextOutput)
  assert.ok(
    transformedTextReport.domAudit.directTextElements.some((entry) => entry.effectiveFontSize < 16),
  )
  assert.ok(
    transformedTextReport.domAudit.unsupportedVisualEffects.some(
      (entry) => entry.transformedBoxShadow,
    ),
  )

  const rootEffectHtml = path.join(temporaryDirectory, "root-effect.html")
  fs.writeFileSync(
    rootEffectHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "</style>",
        '#diagram::before{content:"tiny";font-size:8px;position:absolute}</style>',
      ),
  )
  const rootEffectOutput = path.join(temporaryDirectory, "root-effect.png")
  const rootEffectResult = runRenderer(rootEffectHtml, rootEffectOutput)
  assert.equal(rootEffectResult.status, 2, rootEffectResult.stderr || rootEffectResult.stdout)
  assert.ok(
    readReport(rootEffectOutput).domAudit.unsupportedVisualEffects.some(
      (entry) => entry.id === "diagram",
    ),
  )
  const allowedRootEffectOutput = path.join(temporaryDirectory, "allowed-root-effect.png")
  const allowedRootEffectResult = runRenderer(rootEffectHtml, allowedRootEffectOutput, [
    "--allow-overflow",
  ])
  assert.equal(
    allowedRootEffectResult.status,
    2,
    allowedRootEffectResult.stderr || allowedRootEffectResult.stdout,
  )

  const importantAnimationHtml = path.join(temporaryDirectory, "important-animation.html")
  fs.writeFileSync(
    importantAnimationHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "</style>",
        "@keyframes shift{from{transform:translateX(0)}to{transform:translateX(-120px)}}" +
          "#diagram section>article{animation:shift 1s infinite alternate!important}</style>",
      ),
  )
  const importantAnimationOutput = path.join(temporaryDirectory, "important-animation.png")
  const importantAnimationResult = runRenderer(importantAnimationHtml, importantAnimationOutput)
  assert.equal(
    importantAnimationResult.status,
    2,
    importantAnimationResult.stderr || importantAnimationResult.stdout,
  )
  assert.ok(readReport(importantAnimationOutput).domAudit.issueCodes.includes("motion-effects"))

  const zeroAreaEffectHtml = path.join(temporaryDirectory, "zero-area-effect.html")
  fs.writeFileSync(
    zeroAreaEffectHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "</style>",
        "#paint-only{width:0;height:0}#paint-only::before{" +
          'content:"tiny";position:fixed;font-size:8px}</style>',
      )
      .replace("</main>", '<div id="paint-only"></div></main>'),
  )
  const zeroAreaEffectOutput = path.join(temporaryDirectory, "zero-area-effect.png")
  const zeroAreaEffectResult = runRenderer(zeroAreaEffectHtml, zeroAreaEffectOutput)
  assert.equal(
    zeroAreaEffectResult.status,
    2,
    zeroAreaEffectResult.stderr || zeroAreaEffectResult.stdout,
  )
  assert.ok(
    readReport(zeroAreaEffectOutput).domAudit.unsupportedVisualEffects.some(
      (entry) => entry.id === "paint-only" && entry.pseudoContent,
    ),
  )

  const shadowTemplateHtml = path.join(temporaryDirectory, "shadow-template.html")
  fs.writeFileSync(
    shadowTemplateHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "</main>",
        '<template shadowrootmode="open"><div class="fixed inset-0 bg-white"></div></template>' +
          "</main>",
      ),
  )
  const shadowTemplateOutput = path.join(temporaryDirectory, "shadow-template.png")
  const shadowTemplateResult = runRenderer(shadowTemplateHtml, shadowTemplateOutput)
  assert.equal(
    shadowTemplateResult.status,
    2,
    shadowTemplateResult.stderr || shadowTemplateResult.stdout,
  )
  assert.ok(
    readReport(shadowTemplateOutput).staticAudit.issues.some((issue) =>
      issue.includes("Unsupported active"),
    ),
  )

  const percentageStrokeHtml = path.join(temporaryDirectory, "percentage-stroke.html")
  fs.writeFileSync(
    percentageStrokeHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "</main>",
        '<svg class="absolute left-20 top-20 h-20 w-20" viewBox="0 0 100 100">' +
          '<circle cx="50" cy="50" r="30" fill="none" stroke="#000" stroke-width="10%" />' +
          "</svg></main>",
      ),
  )
  const percentageStrokeOutput = path.join(temporaryDirectory, "percentage-stroke.png")
  const percentageStrokeResult = runRenderer(percentageStrokeHtml, percentageStrokeOutput)
  assert.equal(
    percentageStrokeResult.status,
    2,
    percentageStrokeResult.stderr || percentageStrokeResult.stdout,
  )
  assert.ok(
    readReport(percentageStrokeOutput).domAudit.unsupportedVisualEffects.some(
      (entry) => entry.unsupportedStrokeWidth,
    ),
  )

  const scaledStrokeHtml = path.join(temporaryDirectory, "scaled-stroke.html")
  fs.writeFileSync(
    scaledStrokeHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "</main>",
        '<svg class="absolute left-0 top-0 h-[100px] w-[100px]" viewBox="0 0 10 10">' +
          '<path d="M.4 5H9" fill="none" stroke="#000" stroke-width="1" ' +
          'stroke-linejoin="round" /></svg></main>',
      ),
  )
  const scaledStrokeOutput = path.join(temporaryDirectory, "scaled-stroke.png")
  const scaledStrokeResult = runRenderer(scaledStrokeHtml, scaledStrokeOutput)
  assert.equal(scaledStrokeResult.status, 2, scaledStrokeResult.stderr || scaledStrokeResult.stdout)
  assert.ok(
    readReport(scaledStrokeOutput).domAudit.unsupportedVisualEffects.some(
      (entry) => entry.strokeOutsideCanvas && entry.strokeScale >= 9,
    ),
  )

  const miterStrokeHtml = path.join(temporaryDirectory, "miter-stroke.html")
  fs.writeFileSync(
    miterStrokeHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "</main>",
        '<svg class="absolute left-0 top-0 h-[100px] w-[100px]" viewBox="0 0 100 100">' +
          '<path d="M6 90 6 10 7 90" fill="none" stroke="#000" stroke-width="4" ' +
          'stroke-linejoin="miter" stroke-miterlimit="4" /></svg></main>',
      ),
  )
  const miterStrokeOutput = path.join(temporaryDirectory, "miter-stroke.png")
  const miterStrokeResult = runRenderer(miterStrokeHtml, miterStrokeOutput)
  assert.equal(miterStrokeResult.status, 2, miterStrokeResult.stderr || miterStrokeResult.stdout)
  assert.ok(
    readReport(miterStrokeOutput).domAudit.unsupportedVisualEffects.some(
      (entry) => entry.strokeOutsideCanvas && entry.strokeJoinMultiplier === 4,
    ),
  )

  const listMarkerHtml = path.join(temporaryDirectory, "list-marker.html")
  fs.writeFileSync(
    listMarkerHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "</style>",
        '#custom-marker{list-style:none}#custom-marker::marker{content:"X";' +
          "visibility:visible;font-size:8px}</style>",
      )
      .replace(
        "</main>",
        '<ul class="absolute left-0 top-20"><li id="custom-marker">outside marker</li></ul>' +
          "</main>",
      ),
  )
  const listMarkerOutput = path.join(temporaryDirectory, "list-marker.png")
  const listMarkerResult = runRenderer(listMarkerHtml, listMarkerOutput)
  assert.equal(listMarkerResult.status, 2, listMarkerResult.stderr || listMarkerResult.stdout)
  assert.ok(
    readReport(listMarkerOutput).domAudit.unsupportedVisualEffects.some(
      (entry) => entry.id === "custom-marker" && entry.pseudoContent,
    ),
  )

  const wrapperHtml = path.join(temporaryDirectory, "transparent-wrapper.html")
  fs.writeFileSync(
    wrapperHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace("<main", '<div class="bg-transparent"><main')
      .replace("</main>", "</main></div>"),
  )
  const wrapperOutput = path.join(temporaryDirectory, "transparent-wrapper.png")
  const wrapperResult = runRenderer(wrapperHtml, wrapperOutput)
  assert.equal(wrapperResult.status, 0, wrapperResult.stderr || wrapperResult.stdout)
  assert.equal(readReport(wrapperOutput).success, true)

  const wrapperBackgroundHtml = path.join(temporaryDirectory, "wrapper-background.html")
  fs.writeFileSync(
    wrapperBackgroundHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace("<main", '<div class="bg-white"><main')
      .replace("</main>", "</main></div>"),
  )
  const wrapperBackgroundOutput = path.join(temporaryDirectory, "wrapper-background.png")
  const wrapperBackgroundResult = runRenderer(wrapperBackgroundHtml, wrapperBackgroundOutput)
  assert.equal(
    wrapperBackgroundResult.status,
    2,
    wrapperBackgroundResult.stderr || wrapperBackgroundResult.stdout,
  )
  assert.ok(readReport(wrapperBackgroundOutput).domAudit.ancestorBackgrounds.length > 0)

  const externalOverlayHtml = path.join(temporaryDirectory, "external-overlay.html")
  fs.writeFileSync(
    externalOverlayHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace("</main>", '</main><div class="fixed inset-0 bg-white" aria-hidden="true"></div>'),
  )
  const externalOverlayOutput = path.join(temporaryDirectory, "external-overlay.png")
  const externalOverlayResult = runRenderer(externalOverlayHtml, externalOverlayOutput)
  assert.equal(
    externalOverlayResult.status,
    2,
    externalOverlayResult.stderr || externalOverlayResult.stdout,
  )
  assert.ok(readReport(externalOverlayOutput).domAudit.externalOverlays.length > 0)

  const scrolledOverlayHtml = path.join(temporaryDirectory, "scrolled-overlay.html")
  fs.writeFileSync(
    scrolledOverlayHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace("overflow-hidden", "overflow-visible")
      .replace(
        "<main",
        '<div class="h-[900px]"></div>' +
          '<div id="fixed-overlay" class="fixed inset-x-0 top-0 h-20 bg-white"></div>' +
          "<main",
      ),
  )
  const scrolledOverlayOutput = path.join(temporaryDirectory, "scrolled-overlay.png")
  const scrolledOverlayResult = runRenderer(scrolledOverlayHtml, scrolledOverlayOutput)
  assert.equal(
    scrolledOverlayResult.status,
    2,
    scrolledOverlayResult.stderr || scrolledOverlayResult.stdout,
  )
  assert.ok(
    readReport(scrolledOverlayOutput).domAudit.externalOverlays.some(
      (entry) => entry.id === "fixed-overlay",
    ),
  )

  const extremeShadowHtml = path.join(temporaryDirectory, "extreme-shadow.html")
  fs.writeFileSync(
    extremeShadowHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        'class="absolute top-[76px] left-[40px] w-[180px] text-center"',
        'style="box-shadow:-100px 0 20px #000" ' +
          'class="absolute top-[76px] left-[40px] w-[180px] text-center"',
      ),
  )
  const extremeShadowOutput = path.join(temporaryDirectory, "extreme-shadow.png")
  const extremeShadowResult = runRenderer(extremeShadowHtml, extremeShadowOutput)
  assert.equal(
    extremeShadowResult.status,
    2,
    extremeShadowResult.stderr || extremeShadowResult.stdout,
  )
  assert.ok(
    readReport(extremeShadowOutput).domAudit.unsupportedVisualEffects.some(
      (entry) => entry.shadowOutsideCanvas,
    ),
  )

  const smilHtml = path.join(temporaryDirectory, "smil.html")
  fs.writeFileSync(
    smilHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "</main>",
        '<svg><circle cx="10" cy="10" r="5"><animate attributeName="cx" ' +
          'from="10" to="100" dur="1s" /></circle></svg></main>',
      ),
  )
  const smilOutput = path.join(temporaryDirectory, "smil.png")
  const smilResult = runRenderer(smilHtml, smilOutput)
  assert.equal(smilResult.status, 2, smilResult.stderr || smilResult.stdout)
  assert.ok(
    readReport(smilOutput).staticAudit.issues.some((issue) => issue.includes("Unsupported active")),
  )

  const activeHtml = path.join(temporaryDirectory, "active-content.html")
  fs.writeFileSync(
    activeHtml,
    fs
      .readFileSync(baseTemplate, "utf8")
      .replace(
        "</body>",
        '<script>window.open("https://example.invalid");' +
          'new WebSocket("wss://example.invalid")</script>\n</body>',
      ),
  )
  const activeOutput = path.join(temporaryDirectory, "active-content.png")
  const activeResult = runRenderer(activeHtml, activeOutput)
  assert.equal(activeResult.status, 2, activeResult.stderr || activeResult.stdout)
  const activeReport = readReport(activeOutput)
  assert.ok(activeReport.staticAudit.issues.some((issue) => issue.includes("Executable inline")))
  assert.equal(activeReport.diagnostics.unexpectedPages.length, 0)

  const staleOutput = path.join(temporaryDirectory, "stale.png")
  const staleInitialResult = runRenderer(baseTemplate, staleOutput)
  assert.equal(staleInitialResult.status, 0, staleInitialResult.stderr || staleInitialResult.stdout)
  const missingProbeHtml = path.join(temporaryDirectory, "missing-probe.html")
  fs.writeFileSync(
    missingProbeHtml,
    fs.readFileSync(baseTemplate, "utf8").replace('id="tailwind-probe"', 'id="removed-probe"'),
  )
  const staleFailureResult = runRenderer(missingProbeHtml, staleOutput, ["--timeout", "1000"])
  assert.equal(staleFailureResult.status, 1)
  assert.equal(fs.existsSync(staleOutput), false)
  assert.equal(fs.existsSync(reportPathFor(staleOutput)), false)

  console.log(
    "PASS renderer self-test: base, scale, resource isolation, text size, " +
      "transparency, visual effects, shadow DOM, wrappers, animation, active content, " +
      "stale-output cleanup",
  )
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
}
