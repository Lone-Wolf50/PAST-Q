import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  Loader2,
  ExternalLink,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { clsx } from 'clsx';
import { apiStreamPaper } from '../lib/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfPageCanvasProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  totalPages: number;
  containerWidth: number;
  zoom: number;
  onPageVisible?: (pageNumber: number) => void;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  pdfDoc,
  pageNumber,
  totalPages,
  containerWidth,
  zoom,
  onPageVisible,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const [pageHeight, setPageHeight] = useState<number>(Math.round(containerWidth * 1.414));

  // Track which page is currently in view while scrolling
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || !onPageVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            onPageVisible(pageNumber);
          }
        }
      },
      { threshold: [0.35, 0.65] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onPageVisible]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any = null;
    let pageProxy: PDFPageProxy | null = null;

    const renderPage = async () => {
      if (!canvasRef.current || containerWidth <= 0) return;

      try {
        setRendering(true);
        pageProxy = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const unscaledViewport = pageProxy.getViewport({ scale: 1 });
        // Leave comfortable horizontal padding inside the scroll container
        const availableWidth = Math.max(containerWidth - 24, 240);
        const baseScale = availableWidth / unscaledViewport.width;
        const cssScale = baseScale * zoom;

        const cssViewport = pageProxy.getViewport({ scale: cssScale });
        setPageHeight(Math.round(cssViewport.height));

        // Cap devicePixelRatio at 2.5 to keep text razor-sharp on mobile Retina screens
        // without exceeding iOS Safari canvas memory limits on multi-page documents.
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const renderViewport = pageProxy.getViewport({ scale: cssScale * dpr });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${Math.floor(cssViewport.width)}px`;
        canvas.style.height = `${Math.floor(cssViewport.height)}px`;

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        renderTask = pageProxy.render({
          canvasContext: context,
          viewport: renderViewport,
          canvas,
        });

        await renderTask.promise;
        if (!cancelled) {
          setRendering(false);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !cancelled) {
          setRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore cancel errors
        }
      }
    };
  }, [pdfDoc, pageNumber, containerWidth, zoom]);

  return (
    <div
      ref={wrapperRef}
      data-page-number={pageNumber}
      className="flex flex-col items-center w-full"
    >
      <div
        className="relative bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden transition-shadow"
        style={{ minHeight: rendering ? `${pageHeight}px` : undefined }}
      >
        <canvas ref={canvasRef} className="block max-w-none" />
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-[1px]">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        )}
      </div>
      <div className="mt-1.5 mb-2 px-2.5 py-0.5 rounded-full bg-theme-surface/90 border border-theme-border text-[10px] font-bold text-theme-muted tracking-wider uppercase shadow-sm">
        Page {pageNumber} of {totalPages}
      </div>
    </div>
  );
};

interface PdfPaperViewerProps {
  paperId: string;
  viewUrl: string;
  title: string;
  token?: string;
}

const PdfPaperViewer: React.FC<PdfPaperViewerProps> = ({
  paperId,
  viewUrl,
  title,
  token,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [fallbackMode, setFallbackMode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Measure viewer container width dynamically so PDF pages always fit mobile & desktop screens
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const width = el.clientWidth;
      if (width > 0) {
        setContainerWidth((prev) => (Math.abs(prev - width) > 4 ? width : prev));
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(el);

    window.addEventListener('orientationchange', updateWidth);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', updateWidth);
    };
  }, [isFullscreen, loading]);

  // Close fullscreen on Escape key
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Load PDF document via CORS-safe stream proxy (or direct URL)
  useEffect(() => {
    let active = true;
    let loadedDoc: PDFDocumentProxy | null = null;

    const loadDocument = async () => {
      setLoading(true);
      setFallbackMode(false);
      setPdfDoc(null);
      setNumPages(0);
      setCurrentPage(1);

      try {
        const buffer = await apiStreamPaper(paperId, viewUrl, token);
        if (!active) return;

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
        });

        loadedDoc = await loadingTask.promise;
        if (!active) {
          loadedDoc.destroy();
          return;
        }

        setPdfDoc(loadedDoc);
        setNumPages(loadedDoc.numPages);
      } catch (err) {
        console.warn('[PdfPaperViewer] Falling back to embedded viewer:', err);
        if (active) {
          setFallbackMode(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      active = false;
      if (loadedDoc) {
        loadedDoc.destroy();
      }
    };
  }, [paperId, viewUrl, token]);

  const scrollToPage = useCallback(
    (targetPage: number) => {
      if (!scrollContainerRef.current || targetPage < 1 || targetPage > numPages) return;
      const pageEl = scrollContainerRef.current.querySelector(
        `[data-page-number="${targetPage}"]`
      ) as HTMLElement | null;
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setCurrentPage(targetPage);
      }
    },
    [numPages]
  );

  const handleZoomOut = () => setZoom((z) => Math.max(0.75, Math.round((z - 0.25) * 100) / 100));
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, Math.round((z + 0.25) * 100) / 100));
  const handleResetZoom = () => setZoom(1);

  const isMobileDevice =
    typeof window !== 'undefined' &&
    (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768);

  const googleViewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(viewUrl)}`;

  return (
    <div
      className={clsx(
        'flex flex-col w-full h-full bg-theme-surface-2/60 select-none',
        isFullscreen && 'fixed inset-0 z-[120] bg-theme-base'
      )}
    >
      {/* ── Viewer Top Control Bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-2.5 bg-theme-surface border-b border-theme-border shrink-0 z-10">
        {/* Left: Page Counter & Navigation */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-theme-surface-2 border border-theme-border text-xs font-bold text-theme-primary">
            <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            {numPages > 0 ? (
              <span>
                Page <span className="text-indigo-400">{currentPage}</span> / {numPages}
              </span>
            ) : (
              <span className="truncate max-w-[120px] sm:max-w-[200px]">{title}</span>
            )}
          </div>

          {numPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                title="Previous Page"
                className="p-1.5 rounded-lg bg-theme-surface-2 border border-theme-border text-theme-secondary hover:text-theme-primary disabled:opacity-35 transition-colors"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
                title="Next Page"
                className="p-1.5 rounded-lg bg-theme-surface-2 border border-theme-border text-theme-secondary hover:text-theme-primary disabled:opacity-35 transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Zoom Controls + Fullscreen + External Open */}
        <div className="flex items-center gap-1.5">
          {!fallbackMode && numPages > 0 && (
            <div className="flex items-center gap-1 bg-theme-surface-2 border border-theme-border rounded-xl p-0.5">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.75}
                title="Zoom Out"
                className="p-1.5 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-surface disabled:opacity-35 transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset Zoom to Fit Width"
                className="px-2 py-1 text-[11px] font-black text-theme-primary hover:text-indigo-400 transition-colors min-w-[44px] text-center"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 2.5}
                title="Zoom In"
                className="p-1.5 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-surface disabled:opacity-35 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {zoom !== 1 && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  title="Fit to screen width"
                  className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary transition-colors hidden sm:flex"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <a
            href={viewUrl}
            target="_blank"
            rel="noreferrer"
            title="Open PDF in full browser tab"
            className="p-2 rounded-xl bg-theme-surface-2 border border-theme-border text-theme-secondary hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white text-xs font-bold transition-all"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Minimize</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Expand</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Scrollable Multi-Page Document Canvas Area ────────────────────── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 w-full overflow-auto px-3 py-4 space-y-4 scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {loading ? (
          <div className="w-full h-full min-h-[360px] flex flex-col items-center justify-center gap-3 text-theme-muted">
            <Loader2 className="w-9 h-9 animate-spin text-indigo-500" />
            <p className="text-xs font-bold uppercase tracking-wider animate-pulse">
              Rendering full exam paper...
            </p>
          </div>
        ) : !fallbackMode && pdfDoc && numPages > 0 ? (
          <div
            className={clsx(
              'flex flex-col gap-4 mx-auto',
              zoom > 1 ? 'items-start min-w-max' : 'items-center w-full'
            )}
          >
            {Array.from({ length: numPages }, (_, idx) => (
              <PdfPageCanvas
                key={idx + 1}
                pdfDoc={pdfDoc}
                pageNumber={idx + 1}
                totalPages={numPages}
                containerWidth={containerWidth || 340}
                zoom={zoom}
                onPageVisible={setCurrentPage}
              />
            ))}
          </div>
        ) : (
          /* Fallback mode if direct stream/fetch is unavailable */
          <div className="w-full h-full min-h-[420px] flex flex-col gap-3">
            <div className="flex-1 w-full rounded-xl overflow-hidden bg-white border border-theme-border">
              <iframe
                src={isMobileDevice ? googleViewerUrl : `${viewUrl}#toolbar=0`}
                title={`Document viewer for ${title}`}
                className="w-full h-full min-h-[420px] bg-white border-0"
              />
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-theme-surface border border-theme-border text-xs">
              <div className="flex items-center gap-2 text-theme-muted">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Having trouble viewing inline?</span>
              </div>
              <a
                href={viewUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white font-bold hover:bg-indigo-600 transition-colors shrink-0 flex items-center gap-1.5"
              >
                <span>Open Full PDF</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfPaperViewer;
