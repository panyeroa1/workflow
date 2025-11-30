/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef } from 'react';
import { supabase, EburonTTSCurrent } from '../lib/supabase';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { useLogStore, useSettings } from '../lib/state';
import { SUPPORTED_LANGUAGES } from '../lib/constants';

// Worker script to ensure polling continues even when tab is in background
const workerScript = `
  self.onmessage = function() {
    setInterval(() => {
      self.postMessage('tick');
    }, 5000);
  };
`;

// Helper to segment text into natural reading chunks (sentences)
const segmentText = (text: string): string[] => {
  if (!text) return [];

  let sentences: string[] = [];

  // Robust segmentation using Intl.Segmenter
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      // @ts-ignore
      const segmenter = new (Intl as any).Segmenter('en', { granularity: 'sentence' });
      // @ts-ignore
      sentences = Array.from(segmenter.segment(text)).map((s: any) => s.segment);
    } catch (e) {
      // Fallback if instantiation fails
      sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
    }
  } else {
     // Fallback Regex
     sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
  }
  
  const chunks: string[] = [];
  let currentChunk = '';
  let sentenceCount = 0;

  for (const sentence of sentences) {
    const cleanSentence = sentence.trim();
    if (!cleanSentence) continue;
    
    // Add space if appending to existing chunk
    if (currentChunk) currentChunk += ' ';
    currentChunk += cleanSentence;
    sentenceCount++;
    
    // Chunking heuristics for natural pauses:
    // STRICTLY sentence-based flow.
    // If chunk is getting too long (> 200 chars) OR we have 2 sentences, push it.
    // This allows better flow than waiting for massive paragraphs.
    if (sentenceCount >= 2 || currentChunk.length > 200) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
      sentenceCount = 0;
    }
  }
  
  // Push any remaining text
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

export default function DatabaseBridge() {
  const { client, connected } = useLiveAPIContext();
  const { addTurn } = useLogStore();
  const { voiceStyle, language, setLanguage, setDetectedLanguage } = useSettings();
  
  const lastProcessedIdRef = useRef<number | null>(null);
  const voiceStyleRef = useRef(voiceStyle);
  const languageRef = useRef(language);

  // Sync refs for use in effect loop
  useEffect(() => { voiceStyleRef.current = voiceStyle; }, [voiceStyle]);
  useEffect(() => { languageRef.current = language; }, [language]);

  // High-performance queue using Refs
  const queueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);
  const shouldBufferRef = useRef(false);

  // Data Ingestion & Processing Logic
  useEffect(() => {
    // Clear queue on mount/connect to ensure we start fresh
    queueRef.current = [];
    isProcessingRef.current = false;
    shouldBufferRef.current = false;

    if (!connected) return;

    // The consumer loop that processes the queue sequentially
    const processQueueLoop = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        // PRE-ROLL BUFFER: If flagged, wait 8-10 seconds before starting the loop.
        // This allows data to accumulate for a continuous stream.
        if (shouldBufferRef.current) {
          console.log('Buffering stream for smooth playback (8s)...');
          await new Promise(resolve => setTimeout(resolve, 8000));
          shouldBufferRef.current = false;
        }

        // While there are items and we are still connected
        while (queueRef.current.length > 0) {
          const rawText = queueRef.current[0];
          const style = voiceStyleRef.current;

          // Inject Stage Directions based on selected Style
          let scriptedText = rawText;
          if (style === 'breathy') {
            scriptedText = `(soft inhale) ${rawText} ... (pause)`;
          } else if (style === 'dramatic') {
             scriptedText = `(slowly) ${rawText} ... (long pause)`;
          }

          // Ensure we don't send empty strings
          if (!scriptedText || !scriptedText.trim()) {
            queueRef.current.shift();
            continue;
          }

          // Log to console
          addTurn({
            role: 'system',
            text: scriptedText,
            isFinal: true
          });

          // Send to Gemini Live
          client.send([{ text: scriptedText }]);

          // Remove the item we just sent
          queueRef.current.shift();

          // Dynamic delay calculation for human-like pacing
          const wordCount = rawText.split(/\s+/).length;
          // ~2.5 words per second + overhead
          const readTime = (wordCount / 2.5) * 1000;
          
          // Inter-segment buffer (breathing room)
          let bufferBase = 4000; 
          if (style === 'natural') bufferBase = 1500;
          if (style === 'dramatic') bufferBase = 6000;

          const bufferTime = bufferBase + (Math.random() * 1000); 
          const totalDelay = readTime + bufferTime;
          
          await new Promise(resolve => setTimeout(resolve, totalDelay));
        }
      } catch (e) {
        console.error('Error in processing loop:', e);
      } finally {
        isProcessingRef.current = false;
      }
    };

    const processNewData = (data: EburonTTSCurrent) => {
      // AUTO DETECTION LOGIC
      // If the incoming data has a target language we support, and it differs from current, update it.
      if (data.target_language && SUPPORTED_LANGUAGES.includes(data.target_language)) {
        if (languageRef.current !== data.target_language) {
          console.log(`Auto-detected target language: ${data.target_language}`);
          setLanguage(data.target_language);
          setDetectedLanguage(data.target_language);
        }
      } else if (data.source_lang_label && SUPPORTED_LANGUAGES.includes(data.source_lang_label)) {
        // Fallback: If no target specified but source is known (e.g. read original), detect that
        setDetectedLanguage(data.source_lang_label);
      }

      // Prioritize translated text
      const textToRead = (data.translated_text && data.translated_text.trim().length > 0) 
        ? data.translated_text 
        : data.source_text;

      if (!data || !textToRead) return;

      // Deduplicate based on ID
      if (lastProcessedIdRef.current === data.id) {
        return;
      }

      lastProcessedIdRef.current = data.id;
      
      // Segment the text
      const segments = segmentText(textToRead);
      
      if (segments.length > 0) {
        // If queue was empty, trigger the buffer flag to ensure we wait before speaking
        if (queueRef.current.length === 0) {
          shouldBufferRef.current = true;
        }

        queueRef.current.push(...segments);
        processQueueLoop();
      }
    };

    const fetchLatest = async () => {
      const { data, error } = await supabase
        .from('eburon_tts_current')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!error && data) {
        processNewData(data as EburonTTSCurrent);
      }
    };

    // 1. Initialize Web Worker for background polling
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => {
      fetchLatest();
    };
    worker.postMessage('start');

    // 2. Setup Realtime Subscription
    const channel = supabase
      .channel('bridge-realtime-opt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'eburon_tts_current' },
        (payload) => {
          if (payload.new) {
             processNewData(payload.new as EburonTTSCurrent);
          }
        }
      )
      .subscribe();

    // 3. Initial Fetch
    fetchLatest();

    return () => {
      worker.terminate();
      supabase.removeChannel(channel);
    };
  }, [connected, client, addTurn, setLanguage, setDetectedLanguage]);

  return null;
}