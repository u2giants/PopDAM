import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { config } from "./config";

const execFileAsync = promisify(execFile);

/**
 * Generate an ExtendScript (.jsx) file that opens an AI file in Illustrator
 * and exports it as a JPEG.
 */
function buildExportScript(aiFilePath: string, outputJpegPath: string): string {
  // ExtendScript uses forward slashes or escaped backslashes
  const inputEscaped = aiFilePath.replace(/\\/g, "/");
  const outputEscaped = outputJpegPath.replace(/\\/g, "/");

  return `
// ExtendScript for Adobe Illustrator — Export AI as JPEG
var inputFile = new File("${inputEscaped}");
var outputFile = new File("${outputEscaped}");

if (inputFile.exists) {
  var doc = app.open(inputFile);

  var exportOptions = new ExportOptionsJPEG();
  exportOptions.qualitySetting = ${config.thumbnailQuality};
  exportOptions.antiAliasing = true;
  exportOptions.artBoardClipping = true;

  // Calculate scale to fit within max size
  var maxDim = ${config.thumbnailMaxSize};
  var w = doc.width;
  var h = doc.height;
  if (w > maxDim || h > maxDim) {
    var scale = Math.min(maxDim / w, maxDim / h) * 100;
    exportOptions.horizontalScale = scale;
    exportOptions.verticalScale = scale;
  }

  doc.exportFile(outputFile, ExportType.JPEG, exportOptions);
  doc.close(SaveOptions.DONOTSAVECHANGES);
} else {
  // Signal error by not creating output
}
`;
}

/**
 * Use Adobe Illustrator to render an AI file to JPEG.
 * Returns the path to the output JPEG.
 */
export async function renderWithIllustrator(
  aiFilePath: string,
  assetId: string
): Promise<{ jpegPath: string; width: number; height: number }> {
  const outputDir = path.join(config.dataDir, "renders");
  await fs.mkdir(outputDir, { recursive: true });

  const jpegPath = path.join(outputDir, `${assetId}.jpg`);
  const scriptPath = path.join(outputDir, `${assetId}.jsx`);

  // Write ExtendScript
  const script = buildExportScript(aiFilePath, jpegPath);
  await fs.writeFile(scriptPath, script, "utf-8");

  try {
    // Run Illustrator with the script
    // -run flag executes an ExtendScript file
    await execFileAsync(config.illustratorPath, [scriptPath], {
      timeout: 120000, // 2 minute timeout per file
    });

    // Verify output exists
    try {
      await fs.access(jpegPath);
    } catch {
      throw new Error("Illustrator did not produce output JPEG");
    }

    // Get dimensions using sharp
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(jpegPath).metadata();

    return {
      jpegPath,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } finally {
    // Clean up script file
    await fs.unlink(scriptPath).catch(() => {});
  }
}
