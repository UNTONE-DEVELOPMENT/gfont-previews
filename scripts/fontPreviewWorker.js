import workerpool from 'workerpool';
import puppeteer from "puppeteer";
import sharp from "sharp";

async function createBrowser() {
  return await puppeteer.launch({
    headless: "shell",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
    ]
  });
}

const generateHTMLPreview = (family, size, style) => {
  const fontCssHref = `https://fonts.googleapis.com/css?family=${family.replace(/\s+/g, "+")}:${style}&text=${encodeURIComponent(family)}`;

  return `<html>
    <head>
        <link rel="stylesheet" href="${fontCssHref}">
        <style>
            body {
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
            }
            .preview {
                display: inline-block;
                font-family: "${family}";
                font-size: ${size}px;
                white-space: nowrap;
            }
        </style>
    </head>
    <body>
        <div class="preview">${family}</div>
    </body>
    </html>`;
};

const browser = await createBrowser();

const generatePreview = async (family, style, height, output) => {
  const page = await browser.newPage();
  await page.setViewport({ width: height * 10, height: height * 2, deviceScaleFactor: 1 });

  await page.goto(`data:text/html,${generateHTMLPreview(family, height, style)}`, { waitUntil: "load" });

  await page.evaluateHandle('document.fonts.ready');

  // Get the bounding box of the text
  const boundingBox = await page.evaluate(() => {
    const textElement = document.querySelector('.preview');
    const rect = textElement.getBoundingClientRect();
    return {
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height)
    };
  });

  console.log(`Bounding Box for ${family}:`, boundingBox);

  // Resize viewport based on actual text dimensions
  await page.setViewport({ width: boundingBox.width + 20, height: boundingBox.height + 20, deviceScaleFactor: 1 });

  const previewItemScreenshot = await page.screenshot({ type: "png", omitBackground: true });

  await page.close();

  const previewOutputPath = `${output}/${family}-${style}.png`;

  await sharp(previewItemScreenshot)
    .resize({ height: boundingBox.height, fit: "contain" }) // Ensures it doesn't upscale beyond measured height
    .toFile(previewOutputPath);

  console.log(`Generated preview: ${previewOutputPath}`);

  return previewOutputPath;
};

workerpool.worker({ generatePreview });
