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

  // Robust segmentation using Intl.Segmenter (Standard in modern browsers)
  // This handles "Dr. Smith", "e.g.", and other abbreviation cases correctly.
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      // @ts-ignore
      const segmenter = new (Intl as any).Segmenter('en', { granularity: 'sentence' });
      // @ts-ignore
      sentences = Array.from(segmenter.segment(text)).map((s: any) => s.segment);
    } catch (e) {
      // Fallback regex if instantiation fails (handles basic punctuation)
      sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
    }
  } else {
     sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
  }
  
  const chunks: string[] = [];
  let currentChunk = '';
  
  // Heuristics for "Theatrical" pacing:
  // We want to group short punchy sentences, but isolate long complex ones.
  const SOFT_LIMIT = 100; // Try to wrap after this
  const HARD_LIMIT = 220; // Force wrap close to this

  for (const sentence of sentences) {
    const cleanSentence = sentence.trim();
    if (!cleanSentence) continue;
    
    // Check if adding this sentence would exceed limits
    const potentialLength = currentChunk.length + cleanSentence.length;

    // Logic:
    // 1. If we have nothing, just start.
    // 2. If the current chunk plus next sentence is massive (Hard Limit), push current and start new.
    // 3. If the current chunk is already a decent size (Soft Limit) and we have a sentence end, push it.
    
    if (currentChunk.length > 0) {
      if (potentialLength > HARD_LIMIT) {
        chunks.push(currentChunk.trim());
        currentChunk = cleanSentence;
      } else if (currentChunk.length > SOFT_LIMIT) {
        // We are in the "sweet spot", let's push the previous thought and start a new one
        chunks.push(currentChunk.trim());
        currentChunk = cleanSentence;
      } else {
        // Still short, append it for better flow (grouping short sentences)
        currentChunk += ' ' + cleanSentence;
      }
    } else {
      currentChunk = cleanSentence;
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
    // 1. Reset Queue logic on Connection Change
    // We want to clear stale data, but immediately fetch fresh data if connecting.
    queueRef.current = [];
    isProcessingRef.current = false;
    
    // Trigger buffer only on fresh start
    shouldBufferRef.current = true;

    if (!connected) return;

    // The consumer loop that processes the queue sequentially
    const processQueueLoop = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        // PRE-ROLL BUFFER: Wait 8-10 seconds before speaking.
        // This ensures we have a healthy buffer of text from the stream for continuity.
        if (shouldBufferRef.current) {
          console.log('Buffering stream for smooth playback (8s)...');
          await new Promise(resolve => setTimeout(resolve, 8000));
          shouldBufferRef.current = false;
        }

        // While there are items and we are still connected
        while (queueRef.current.length > 0 && client.status === 'connected') {
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

          // Log to console (Visuals)
          addTurn({
            role: 'system',
            text: scriptedText,
            isFinal: true
          });

          // Send to Gemini Live (Audio)
          client.send([{ text: scriptedText }]);

          // Remove the item we just sent
          queueRef.current.shift();

          // Dynamic delay calculation for human-like pacing
          // We calculate roughly how long it takes to speak the text
          const wordCount = rawText.split(/\s+/).length;
          // ~2.5 words per second is a slow, deliberate speaking rate
          const readTime = (wordCount / 2.5) * 1000;
          
          // Inter-segment buffer (Breathing Room)
          // We add this *after* the estimated read time to ensure the model finishes
          // before we fire the next thought.
          let bufferBase = 2000; 
          if (style === 'natural') bufferBase = 1000;
          if (style === 'dramatic') bufferBase = 3000;

          // Add slight randomness for organic feel
          const bufferTime = bufferBase + (Math.random() * 500); 
          
          // Wait for read + buffer
          await new Promise(resolve => setTimeout(resolve, readTime + bufferTime));
        }
      } catch (e) {
        console.error('Error in processing loop:', e);
      } finally {
        isProcessingRef.current = false;
        
        // If queue still has items (e.g. added while waiting), restart loop
        if (queueRef.current.length > 0 && client.status === 'connected') {
           setTimeout(processQueueLoop, 100);
        }
      }
    };

    const processNewData = (data: EburonTTSCurrent) => {
      // AUTO DETECTION LOGIC
      if (data.target_language && SUPPORTED_LANGUAGES.includes(data.target_language)) {
        if (languageRef.current !== data.target_language) {
          console.log(`Auto-detected target language: ${data.target_language}`);
          setLanguage(data.target_language);
          setDetectedLanguage(data.target_language);
        }
      } else if (data.source_lang_label && SUPPORTED_LANGUAGES.includes(data.source_lang_label)) {
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
      
      // Segment the text using the refined logic
      const segments = segmentText(textToRead);
      
      if (segments.length > 0) {
        queueRef.current.push(...segments);
        // Trigger loop if not running
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

    // --- SETUP WORKER & SUBSCRIPTION ---

    // 1. Initialize Web Worker for background polling
    // This ensures we keep fetching even if the tab is minimized.
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

    // 3. Initial Fetch & Auto-Start
    // Immediately fetch data so the user hears something right away
    fetchLatest();

    return () => {
      worker.terminate();
      supabase.removeChannel(channel);
    };
  }, [connected, client, addTurn, setLanguage, setDetectedLanguage]);

  return null;
}