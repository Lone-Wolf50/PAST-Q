import fs from 'fs';
import path from 'path';
import vision from '@google-cloud/vision';
import Tesseract from 'tesseract.js';
import { logFallbackEvent, getErrorMeaning, FallbackAttempt } from './fallback-logger';

export interface OCRBlock {
  text: string;
  boundingBox: { x: number; y: number; w: number; h: number };
  confidence: number;
}

export interface OCRPage {
  pageNumber: number;
  width: number;
  height: number;
  blocks: OCRBlock[];
}

export interface OCRPipelineResult {
  text: string;
  pages: OCRPage[];
}

/**
 * Converts PDF pages to images and runs Google Cloud Vision API OCR or Tesseract.js local OCR.
 * Supports up to 12 pages dynamically to capture all exam questions.
 */
export async function performOcrPipeline(pdfBuffer: Buffer, numPages: number): Promise<OCRPipelineResult> {
  const images: Buffer[] = [];
  const ocrPages: OCRPage[] = [];
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
  const hasEnvCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const hasFileCredentials = fs.existsSync(keyPath);

  if (hasEnvCredentials || hasFileCredentials) {
    try {
      console.log('[OCR Pipeline] Attempting Google Cloud Vision OCR...');
      let clientOptions: any = {};
      
      if (hasEnvCredentials) {
        try {
          console.log('[OCR Pipeline] Using Google Cloud Vision credentials from environment variable...');
          clientOptions.credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);
        } catch (jsonErr: any) {
          throw new Error(`Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable: ${jsonErr.message}`);
        }
      } else {
        console.log('[OCR Pipeline] Using Google Cloud Vision credentials from local file...');
        clientOptions.keyFilename = keyPath;
      }

      const client = new vision.ImageAnnotatorClient(clientOptions);

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

          const pageBlocks: OCRBlock[] = [];
          const pageObj = res.fullTextAnnotation?.pages?.[0];
          const pageWidth = pageObj?.width || 0;
          const pageHeight = pageObj?.height || 0;

          if (pageObj?.blocks) {
            for (const block of pageObj.blocks) {
              if (block.paragraphs) {
                for (const para of block.paragraphs) {
                  let paraText = '';
                  let wordConfidenceSum = 0;
                  let wordCount = 0;

                  if (para.words) {
                    for (const word of para.words) {
                      let wordText = '';
                      if (word.symbols) {
                        for (const sym of word.symbols) {
                          wordText += sym.text || '';
                        }
                      }
                      paraText += (paraText ? ' ' : '') + wordText;

                      if (word.confidence !== undefined && word.confidence !== null) {
                        wordConfidenceSum += word.confidence;
                        wordCount++;
                      }
                    }
                  }

                  const vertices = para.boundingBox?.vertices || [];
                  const xs = vertices.map((v: any) => v.x ?? 0);
                  const ys = vertices.map((v: any) => v.y ?? 0);
                  const minX = xs.length ? Math.min(...xs) : 0;
                  const minY = ys.length ? Math.min(...ys) : 0;
                  const maxX = xs.length ? Math.max(...xs) : 0;
                  const maxY = ys.length ? Math.max(...ys) : 0;

                  pageBlocks.push({
                    text: paraText,
                    boundingBox: {
                      x: minX,
                      y: minY,
                      w: maxX - minX,
                      h: maxY - minY
                    },
                    confidence: wordCount > 0 ? (wordConfidenceSum / wordCount) : 1.0
                  });
                }
              }
            }
          }

          ocrPages.push({
            pageNumber: i + 1,
            width: pageWidth,
            height: pageHeight,
            blocks: pageBlocks
          });
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
        return { text: trimmedText, pages: ocrPages };
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
    const errMsg = 'Google Cloud Vision credentials (env or file) not found.';
    const errInfo = getErrorMeaning('ENOENT', errMsg);
    attempts.push({
      model_or_service: 'Google Cloud Vision',
      status: 'failed',
      error_code: errInfo.code,
      error_message: errMsg,
      error_meaning: errInfo.meaning
    });
    console.warn('[OCR Pipeline] Google Cloud Vision credentials not found. Skipping to Tesseract.js...');
  }

  // Step 1.5: Azure Vision OCR
  const azureKey = process.env.AZURE_VISION_KEY;
  const azureEndpointRaw = process.env.AZURE_VISION_ENDPOINT;

  if (azureKey && azureEndpointRaw) {
    try {
      console.log('[OCR Pipeline] Attempting Azure Vision OCR...');
      let endpoint = azureEndpointRaw;
      if (!endpoint.includes('/vision/')) {
        endpoint = endpoint.replace(/\/$/, '') + '/vision/v3.2/read/analyze';
      }

      let ocrText = '';
      for (let i = 0; i < images.length; i++) {
        console.log(`[OCR Pipeline] Azure Vision processing page ${i + 1}/${images.length}...`);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            'Content-Type': 'application/octet-stream'
          },
          body: images[i] as any
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Azure Vision Read API call failed with status ${response.status}: ${errText}`);
        }

        const operationLocation = response.headers.get('operation-location');
        if (!operationLocation) {
          throw new Error('Azure Vision Read API did not return operation-location header');
        }

        // Poll for results (max 15 attempts, 1s delay)
        let status = 'notStarted';
        let resultData: any = null;
        for (let pollAttempt = 0; pollAttempt < 15; pollAttempt++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const pollResponse = await fetch(operationLocation, {
            headers: {
              'Ocp-Apim-Subscription-Key': azureKey
            }
          });
          if (!pollResponse.ok) continue;
          resultData = await pollResponse.json();
          status = resultData.status;
          if (status === 'succeeded' || status === 'failed') {
            break;
          }
        }

        if (status !== 'succeeded' || !resultData) {
          throw new Error(`Azure Vision OCR operation status: ${status}`);
        }

        if (resultData.analyzeResult?.readResults) {
          for (const page of resultData.analyzeResult.readResults) {
            const pageWidth = page.width || 0;
            const pageHeight = page.height || 0;
            const pageBlocks: OCRBlock[] = [];

            if (page.lines) {
              for (const line of page.lines) {
                const box = line.boundingBox || [];
                const xs = [box[0] || 0, box[2] || 0, box[4] || 0, box[6] || 0];
                const ys = [box[1] || 0, box[3] || 0, box[5] || 0, box[7] || 0];
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);
                const maxX = Math.max(...xs);
                const maxY = Math.max(...ys);

                let wordConfidenceSum = 0;
                let wordCount = 0;
                if (line.words) {
                  for (const word of line.words) {
                    if (word.confidence !== undefined && word.confidence !== null) {
                      wordConfidenceSum += word.confidence;
                      wordCount++;
                    }
                  }
                }

                pageBlocks.push({
                  text: line.text || '',
                  boundingBox: {
                    x: minX,
                    y: minY,
                    w: maxX - minX,
                    h: maxY - minY
                  },
                  confidence: wordCount > 0 ? (wordConfidenceSum / wordCount) : 1.0
                });

                ocrText += line.text + '\n';
              }
            }
            ocrText += '\n';

            ocrPages.push({
              pageNumber: i + 1,
              width: pageWidth,
              height: pageHeight,
              blocks: pageBlocks
            });
          }
        }
      }

      const trimmedText = ocrText.trim();
      if (trimmedText.length > 50) {
        console.log(`[OCR Pipeline] Azure Vision OCR succeeded! Character length: ${trimmedText.length}`);
        attempts.push({
          model_or_service: 'Azure Vision OCR',
          status: 'success'
        });
        await logFallbackEvent({
          request_type: 'OCR Pipeline',
          title: `OCR Extraction (${images.length} pages)`,
          success: true,
          selected_model_or_service: 'Azure Vision OCR',
          attempts
        });
        return { text: trimmedText, pages: ocrPages };
      } else {
        throw new Error('OCR_INSUFFICIENT_TEXT: Azure Vision returned insufficient text');
      }
    } catch (azureErr: any) {
      const errInfo = getErrorMeaning(azureErr.status || azureErr.code, azureErr.message);
      attempts.push({
        model_or_service: 'Azure Vision OCR',
        status: 'failed',
        error_code: errInfo.code,
        error_message: azureErr.message,
        error_meaning: errInfo.meaning
      });
      console.error('[OCR Pipeline] Azure Vision OCR failed:', azureErr.message);
    }
  } else {
    const errMsg = 'Azure Vision credentials (key or endpoint) not found in env variables.';
    const errInfo = getErrorMeaning('ENOENT', errMsg);
    attempts.push({
      model_or_service: 'Azure Vision OCR',
      status: 'failed',
      error_code: errInfo.code,
      error_message: errMsg,
      error_meaning: errInfo.meaning
    });
    console.warn('[OCR Pipeline] Azure Vision credentials not found. Skipping to Tesseract.js...');
  }

  // Step 2: Tesseract.js OCR
  if (process.env.NODE_ENV === 'production' || process.env.DISABLE_LOCAL_OCR === 'true') {
    console.error('[OCR Pipeline] ⚠️ BOTH OCR providers unavailable — Google Cloud Vision: credentials not configured | Tesseract.js: disabled in production to protect server performance.');
    const errMsg = 'Local Tesseract OCR fallback is disabled in production to guarantee server performance. Google Cloud Vision credentials (env variable or file) are also missing. Please configure a valid Google Cloud Vision key or use Gemini Vision as a fallback.';
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

        const linesList = text.split('\n');
        const pageBlocks: OCRBlock[] = linesList
          .map((line, lineIdx) => ({
            text: line.trim(),
            boundingBox: { x: 50, y: lineIdx * 40, w: 500, h: 30 },
            confidence: 1.0
          }))
          .filter(b => b.text.length > 0);

        ocrPages.push({
          pageNumber: i + 1,
          width: 600,
          height: linesList.length * 40 + 100,
          blocks: pageBlocks
        });
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
      return { text: trimmedText, pages: ocrPages };
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
