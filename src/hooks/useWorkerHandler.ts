import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslatorStore } from '@/store/translatorStore';
import type { ExtractedItem } from '@/store/translatorStore';

type Resolver = { 
  resolve: (v: string) => void; 
  reject: (e: Error) => void; 
  timeoutId: number 
};

/**
 * Hook for Web Worker-based processing
 * Provides better performance for large files
 */
export const useWorkerHandler = () => {
  const workerRef = useRef<Worker | null>(null);
  const resolversRef = useRef<Map<number, Resolver>>(new Map());
  const nextRequestId = useRef<number>(1);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  const {
    setLoading,
    setProgress,
    setExtractedData,
    setContent,
    setTranslationMap,
    extractedData,
    translationMap,
  } = useTranslatorStore();

  const [workerReady, setWorkerReady] = useState(false);

  // Safe initialization (lazy)
  const initWorker = useCallback(() => {
    if (initPromiseRef.current) return initPromiseRef.current;

    initPromiseRef.current = new Promise<void>((resolve) => {
      if (typeof window === 'undefined') {
        setWorkerReady(false);
        return resolve();
      }

      try {
        // Try to create worker from public path
        const workerUrl = '/workers/extractWorker.js';
        workerRef.current = new Worker(workerUrl);

        // Message handler
        workerRef.current.onmessage = (e: MessageEvent) => {
          const d = e.data ?? {};
          try {
            // Handshake: READY
            if (d && d.type === 'READY') {
              setWorkerReady(true);
              return resolve();
            }

            // Progress update
            if ('progress' in d && typeof d.progress === 'number') {
              setProgress(d.progress);
            }

            // Extracted data
            if ('extracted' in d) {
              setExtractedData(d.extracted ?? []);
              setLoading(false);
              setProgress(100);
              toast.success(`${(d.extracted ?? []).length.toLocaleString('fa-IR')} متن استخراج شد`);
            }

            // Apply result
            if (d.type === 'APPLY_RESULT') {
              setContent(d.updated);
              setTranslationMap(new Map(d.map || []));
              setLoading(false);
              toast.success(`${d.count?.toLocaleString('fa-IR') ?? 0} ترجمه اعمال شد`);
            }

            // Reverse result
            if (d.type === 'REVERSE_RESULT') {
              setLoading(false);
              const reqId = d.requestId;
              if (typeof reqId === 'number' && resolversRef.current.has(reqId)) {
                const r = resolversRef.current.get(reqId)!;
                clearTimeout(r.timeoutId);
                resolversRef.current.delete(reqId);
                r.resolve(d.updated);
              } else {
                setContent(d.updated);
                toast.success('ریورس اعمال شد');
              }
            }

            // Error handling
            if (d.error) {
              const reqId = d.requestId;
              if (typeof reqId === 'number' && resolversRef.current.has(reqId)) {
                const r = resolversRef.current.get(reqId)!;
                clearTimeout(r.timeoutId);
                resolversRef.current.delete(reqId);
                r.reject(new Error(d.error));
              } else {
                console.error('Worker error:', d.error);
                setLoading(false);
                toast.error(`خطای پردازش: ${d.error}`);
              }
            }
          } catch (innerErr) {
            console.error('Error in worker onmessage handler:', innerErr);
          }
        };

        workerRef.current.onerror = (err) => {
          console.error('Worker error:', err);
          setLoading(false);
          setWorkerReady(false);
          toast.error('خطا در Worker - از حالت عادی استفاده کنید');
        };

        // Handshake timeout fallback
        const handshakeTimer = window.setTimeout(() => {
          setWorkerReady(true);
          resolve();
        }, 1500);
      } catch (err) {
        console.error('Worker init failed:', err);
        toast.error('Worker در دسترس نیست');
        setWorkerReady(false);
        resolve();
      }
    });

    return initPromiseRef.current;
  }, [setContent, setExtractedData, setLoading, setProgress, setTranslationMap]);

  // Cleanup
  useEffect(() => {
    return () => {
      // Reject all pending resolvers
      for (const [, r] of resolversRef.current.entries()) {
        try { 
          r.reject(new Error('Component unmounted')); 
        } catch {}
        clearTimeout(r.timeoutId);
      }
      resolversRef.current.clear();

      if (workerRef.current) {
        try { 
          workerRef.current.terminate(); 
        } catch {}
        workerRef.current = null;
      }
      initPromiseRef.current = null;
    };
  }, []);

  // Safe postMessage wrapper
  const postMessage = useCallback(async (msg: any) => {
    await initWorker();
    try {
      workerRef.current?.postMessage(msg);
    } catch (err) {
      console.error('postMessage failed:', err);
      throw err;
    }
  }, [initWorker]);

  // Create download promise with requestId support
  const createDownloadPromise = useCallback(async (finalContent: string, timeoutMs = 30000) => {
    await initWorker();
    return new Promise<string>((resolve, reject) => {
      if (!workerRef.current) return reject(new Error('Worker not ready'));

      const requestId = nextRequestId.current++;

      // Set timeout
      const timeoutId = window.setTimeout(() => {
        if (resolversRef.current.has(requestId)) {
          const r = resolversRef.current.get(requestId)!;
          resolversRef.current.delete(requestId);
          r.reject(new Error('Worker timeout (30s)'));
        }
      }, timeoutMs);

      resolversRef.current.set(requestId, { resolve, reject, timeoutId });

      try {
        workerRef.current.postMessage({
          type: 'GENERATE_REVERSED',
          requestId,
          content: finalContent,
          extractedData,
          translationsArray: Array.from(translationMap.entries()),
        });
      } catch (err) {
        clearTimeout(timeoutId);
        resolversRef.current.delete(requestId);
        reject(new Error('Worker communication failed'));
      }
    });
  }, [initWorker, extractedData, translationMap]);

  return {
    workerReady,
    initWorker,
    postMessage,
    createDownloadPromise,
  };
};

export default useWorkerHandler;
