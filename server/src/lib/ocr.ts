import fs from 'fs';
import path from 'path';
import vision from '@google-cloud/vision';
import Tesseract from 'tesseract.js';
import { logFallbackEvent, getErrorMeaning, FallbackAttempt } from './fallback-logger';

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

  const attempts: FallbackAttempt[] = [];

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

      const firstError = result.responses?.find((r: any) => r.error)?.error;
      if (firstError) {
        throw new Error(firstError.message || 'Vision API execution error');
      }

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
        attempts.push({
          model_or_service: 'Google Cloud Vision',
          status: 'success'
        });
        await logFallbackEvent({
          request_type: 'OCR Pipeline',
          title: `OCR Extraction (${images.length} pages)`,
          success: true,
          selected_model_or_service: 'Google Cloud Vision',
          attempts
        });
        return trimmedText;
      } else {
        throw new Error('OCR_INSUFFICIENT_TEXT: Google Cloud Vision returned insufficient text');
      }
    } catch (visionErr: any) {
      const errInfo = getErrorMeaning(visionErr.status || visionErr.code, visionErr.message);
      attempts.push({
        model_or_service: 'Google Cloud Vision',
        status: 'failed',
        error_code: errInfo.code,
        error_message: visionErr.message,
        error_meaning: errInfo.meaning
      });
      console.error('[OCR Pipeline] Google Cloud Vision OCR failed:', visionErr.message);
    }
  } else {
    const errMsg = 'Google Cloud Vision credentials file not found.';
    const errInfo = getErrorMeaning('ENOENT', errMsg);
    attempts.push({
      model_or_service: 'Google Cloud Vision',
      status: 'failed',
      error_code: errInfo.code,
      error_message: errMsg,
      error_meaning: errInfo.meaning
    });
    console.warn('[OCR Pipeline] Google Cloud Vision credentials file not found. Skipping to Tesseract.js...');
  }

  // Step 2: Tesseract.js OCR
  if (process.env.NODE_ENV === 'production' || process.env.DISABLE_LOCAL_OCR === 'true') {
    const errMsg = 'Local Tesseract OCR fallback is disabled in production to guarantee server performance. Please configure a valid Google Cloud Vision key.';
    const errInfo = getErrorMeaning('LOCAL_OCR_DISABLED', errMsg);
    attempts.push({
      model_or_service: 'Tesseract.js (Local)',
      status: 'failed',
      error_code: errInfo.code,
      error_message: errMsg,
      error_meaning: errInfo.meaning
    });
    
    await logFallbackEvent({
      request_type: 'OCR Pipeline',
      title: `OCR Extraction (${images.length} pages)`,
      success: false,
      selected_model_or_service: null,
      attempts
    });
    
    console.warn('[OCR Pipeline] Tesseract.js local OCR is disabled in production to protect the Node event loop and prevent memory depletion.');
    throw new Error(errMsg);
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
      attempts.push({
        model_or_service: 'Tesseract.js (Local)',
        status: 'success'
      });
      await logFallbackEvent({
        request_type: 'OCR Pipeline',
        title: `OCR Extraction (${images.length} pages)`,
        success: true,
        selected_model_or_service: 'Tesseract.js (Local)',
        attempts
      });
      return trimmedText;
    }
    throw new Error('Tesseract.js OCR returned insufficient text');
  } catch (tessErr: any) {
    const errInfo = getErrorMeaning(tessErr.status || tessErr.code, tessErr.message);
    attempts.push({
      model_or_service: 'Tesseract.js (Local)',
      status: 'failed',
      error_code: errInfo.code,
      error_message: tessErr.message,
      error_meaning: errInfo.meaning
    });
    
    await logFallbackEvent({
      request_type: 'OCR Pipeline',
      title: `OCR Extraction (${images.length} pages)`,
      success: false,
      selected_model_or_service: null,
      attempts
    });
    
    console.error('[OCR Pipeline] Tesseract.js OCR failed:', tessErr.message);
    throw tessErr;
  }

}
