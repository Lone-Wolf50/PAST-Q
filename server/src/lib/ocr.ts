import fs from 'fs';
import path from 'path';
import vision from '@google-cloud/vision';
import Tesseract from 'tesseract.js';

/**
 * Converts PDF pages to images and runs Google Cloud Vision API OCR or Tesseract.js local OCR.
 * Supports up to 12 pages dynamically to capture all exam questions.
 */
export async function performOcrPipeline(pdfBuffer: Buffer, numPages: number): Promise<string> {
  const images: Buffer[] = [];
  try {
    const targetPages = Math.min(numPages || 1, 12);
    console.log(`[OCR Pipeline] Converting PDF to images for OCR. Target pages: ${targetPages}`);

    const { definePDFJSModule, getDocumentProxy, renderPageAsImage } = await import('unpdf');
    await definePDFJSModule(() => import('pdfjs-dist/legacy/build/pdf.mjs'));

    // Load the PDF document ONCE into the pdfjs worker via a document proxy.
    // Previously we passed a raw Uint8Array to renderPageAsImage on every page,
    // which internally calls getDocument() and transfers the underlying ArrayBuffer
    // to the worker thread each time. pdfjs-dist v5.x rejects that repeated transfer
    // on pages 2+ with "Cannot transfer object of unsupported type".
    // Using getDocumentProxy once avoids any further ArrayBuffer transfers per page.
    const uint8Array = new Uint8Array(pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength
    ));
    const docProxy = await getDocumentProxy(uint8Array);

    for (let pageNum = 1; pageNum <= targetPages; pageNum++) {
      try {
        console.log(`[OCR Pipeline] Rendering page ${pageNum}/${targetPages} to image...`);
        // Pass the document proxy (not raw bytes) so pdfjs doesn't attempt
        // another ArrayBuffer transfer for each page.
        const arrayBuffer = await renderPageAsImage(docProxy, pageNum, {
          canvasImport: () => import('@napi-rs/canvas'),
          scale: 1.5,
        });
        images.push(Buffer.from(arrayBuffer));
      } catch (pageErr: any) {
        console.error(`[OCR Pipeline] Failed to render page ${pageNum}:`, pageErr.message);
      }
    }
    console.log(`[OCR Pipeline] Successfully converted PDF to ${images.length} page images.`);
  } catch (err: any) {
    console.error('[OCR Pipeline] PDF to image conversion failed:', err.message);
    throw new Error('Failed to convert PDF pages to images for OCR: ' + err.message);
  }

  if (images.length === 0) {
    throw new Error('No images generated from PDF');
  }

  // Step 1: Google Cloud Vision API OCR
  const keyPath = path.join(__dirname, '../../past-q-vision-4522486be562.json');
  if (fs.existsSync(keyPath)) {
    try {
      console.log('[OCR Pipeline] Attempting Google Cloud Vision OCR...');
      const client = new vision.ImageAnnotatorClient({
        keyFilename: keyPath
      });

      const requests: any = images.map(imgBuffer => ({
        image: { content: imgBuffer.toString('base64') },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
      }));

      const batchResult: any = await client.batchAnnotateImages({ requests });
      const result = batchResult[0];

      let ocrText = '';
      if (result.responses) {
        for (let i = 0; i < result.responses.length; i++) {
          const res = result.responses[i];
          if (res.fullTextAnnotation?.text) {
            ocrText += `--- PAGE ${i + 1} ---\n${res.fullTextAnnotation.text}\n\n`;
          }
        }
      }

      const trimmedText = ocrText.trim();
      if (trimmedText.length > 50) {
        console.log(`[OCR Pipeline] Google Cloud Vision OCR succeeded! Character length: ${trimmedText.length}`);
        return trimmedText;
      } else {
        console.warn('[OCR Pipeline] Google Cloud Vision OCR returned insufficient text, falling back to Tesseract...');
      }
    } catch (visionErr: any) {
      console.error('[OCR Pipeline] Google Cloud Vision OCR failed:', visionErr.message);
    }
  } else {
    console.warn('[OCR Pipeline] Google Cloud Vision credentials file not found. Skipping to Tesseract.js...');
  }

  // Step 2: Tesseract.js OCR
  if (process.env.NODE_ENV === 'production' || process.env.DISABLE_LOCAL_OCR === 'true') {
    console.warn('[OCR Pipeline] Tesseract.js local OCR is disabled in production to protect the Node event loop and prevent memory depletion.');
    throw new Error('Local Tesseract OCR fallback is disabled in production to guarantee server performance. Please configure a valid Google Cloud Vision key.');
  }

  try {
    console.log('[OCR Pipeline] Attempting Tesseract.js OCR...');
    let ocrText = '';
    for (let i = 0; i < images.length; i++) {
      console.log(`[OCR Pipeline] Tesseract.js processing page ${i + 1}/${images.length}...`);
      const { data: { text } } = await Tesseract.recognize(images[i], 'eng');
      if (text && text.trim().length > 0) {
        ocrText += `--- PAGE ${i + 1} ---\n${text}\n\n`;
      }
    }

    const trimmedText = ocrText.trim();
    if (trimmedText.length > 50) {
      console.log(`[OCR Pipeline] Tesseract.js OCR succeeded! Character length: ${trimmedText.length}`);
      return trimmedText;
    }
    throw new Error('Tesseract.js OCR returned insufficient text');
  } catch (tessErr: any) {
    console.error('[OCR Pipeline] Tesseract.js OCR failed:', tessErr.message);
    throw tessErr;
  }
}
