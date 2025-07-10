import { useEffect, useRef, useState } from "react";
import saveAs from "file-saver";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Play, Download, Save, Trash2, Star, Headphones, Settings } from "lucide-react";

const INTERACTION_TYPES = [
  "click", "tap", "hover", "select", "confirm", "cancel", "error", "popup", 
  "notification", "transition", "back", "scroll", "drag-drop", "typing", "loading",
];
const TONAL_QUALITIES = ["tonal", "atonal", "pitched", "noise", "harmonic", "dissonant"];
const ENVELOPES = ["short / snappy", "medium", "long", "sustain", "fade", "stutter", "pulse"];
const TIMBRES = ["soft", "hard", "crisp", "warm", "cold", "metallic", "wooden", "digital", "organic", "glassy", "clicky", "whoosh"];
const PITCHES = ["high", "mid", "low", "rising", "falling"];
const EMOTIONS = ["none", "positive", "negative", "neutral", "attention", "subtle", "urgent", "informative"];

export default function TriangleSynth() {
  const audioCtxRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [recordings, setRecordings] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Helper functions for blob/base64 conversion
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const base64ToBlob = (base64, type) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type });
  };

  const [savedSounds, setSavedSounds] = useState(() => {
    const saved = localStorage.getItem('savedSounds');
    if (saved) {
      try {
        const parsedSounds = JSON.parse(saved);
        return parsedSounds.map(sound => ({
          name: sound.name,
          blob: base64ToBlob(sound.blobData, 'audio/ogg'),
          blobData: sound.blobData,
          config: sound.config,
          timestamp: sound.timestamp
        }));
      } catch (e) {
        console.error('Error loading saved sounds:', e);
        return [];
      }
    }
    return [];
  });

  // Save sounds to localStorage
  const saveSoundsToStorage = async (sounds) => {
    try {
      const soundsForStorage = await Promise.all(
        sounds.map(async (sound) => ({
          name: sound.name,
          blobData: sound.blobData || await blobToBase64(sound.blob),
          config: sound.config,
          timestamp: sound.timestamp || Date.now()
        }))
      );
      localStorage.setItem('savedSounds', JSON.stringify(soundsForStorage));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  // State for select boxes
  const [interactionType, setInteractionType] = useState(INTERACTION_TYPES[0]);
  const [tonalQuality, setTonalQuality] = useState(TONAL_QUALITIES[0]);
  const [envelope, setEnvelope] = useState(ENVELOPES[0]);
  const [timbre, setTimbre] = useState(TIMBRES[0]);
  const [pitch, setPitch] = useState(PITCHES[0]);
  const [emotion, setEmotion] = useState(EMOTIONS[0]);
  const [beatCount, setBeatCount] = useState(1);
  const [beatDelay, setBeatDelay] = useState(200);
  const [beatDialogOpen, setBeatDialogOpen] = useState(false);

  // Function to generate and record actual audio
  const generateAudioBlob = async (config) => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const sampleRate = audioCtx.sampleRate;
    
    // === DURATION CALCULATION ===
    let singleBeatDuration = 0.15; // Default short duration
    
    // Envelope affects base duration
    if (config.settings.envelope.includes("medium")) {
      singleBeatDuration = 0.3;
    } else if (config.settings.envelope.includes("long")) {
      singleBeatDuration = 0.6;
    } else if (config.settings.envelope.includes("sustain")) {
      singleBeatDuration = 1.2;
    } else if (config.settings.envelope.includes("short") || config.settings.envelope.includes("snappy")) {
      singleBeatDuration = 0.08;
    }
    
    // Interaction type affects duration
    if (config.settings.interactionType === "loading") {
      singleBeatDuration *= 1.5; // Longer for loading sounds
    } else if (config.settings.interactionType === "error") {
      singleBeatDuration *= 1.3; // Longer for emphasis
    } else if (config.settings.interactionType === "hover") {
      singleBeatDuration *= 0.7; // Shorter for quick feedback
    } else if (config.settings.interactionType === "click" || config.settings.interactionType === "tap") {
      singleBeatDuration *= 0.6; // Very short for immediate feedback
    }
    
    // Beat settings
    const beatCount = config.settings.beatCount || 1;
    const beatDelay = (config.settings.beatDelay || 200) / 1000; // Convert ms to seconds
    const totalDuration = (singleBeatDuration * beatCount) + (beatDelay * (beatCount - 1));
    
    // Debug logging for beat timing
    if (beatCount > 1) {
      console.log('Beat Debug:', {
        beatCount,
        beatDelayMs: config.settings.beatDelay,
        beatDelaySeconds: beatDelay,
        singleBeatDuration,
        totalDuration,
        expectedTiming: `${beatCount} beats, ${config.settings.beatDelay}ms delays`
      });
    }
    
    const length = sampleRate * totalDuration;
    const buffer = audioCtx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    
    // === FREQUENCY CALCULATION ===
    let baseFreq = 300 + (config.progressionFactor * 700); // Base progression
    
    // Pitch range modifications
    if (config.settings.pitch === "high") {
      baseFreq = 800 + (config.progressionFactor * 1200); // 800-2000Hz
    } else if (config.settings.pitch === "mid") {
      baseFreq = 400 + (config.progressionFactor * 800); // 400-1200Hz
    } else if (config.settings.pitch === "low") {
      baseFreq = 150 + (config.progressionFactor * 350); // 150-500Hz
    } else if (config.settings.pitch === "rising") {
      // Frequency will rise during the sound
      baseFreq = 200 + (config.progressionFactor * 400); // Start lower
    } else if (config.settings.pitch === "falling") {
      // Frequency will fall during the sound
      baseFreq = 600 + (config.progressionFactor * 600); // Start higher
    }
    
    // Interaction type frequency modifications
    const interactionFreqMods = {
      "error": 0.65,        // Lower, more serious
      "confirm": 1.25,      // Higher, more positive
      "cancel": 0.75,       // Lower, less positive
      "hover": 1.1,         // Slightly higher
      "select": 1.15,       // Clear selection sound
      "notification": 1.2,  // Attention-grabbing
      "popup": 1.05,        // Gentle popup
      "transition": 0.9,    // Smooth transition
      "back": 0.85,         // Going back/down
      "scroll": 0.95,       // Neutral scroll
      "drag-drop": 1.0,     // Neutral
      "typing": 1.1,        // Crisp typing sound
      "loading": 0.8,       // Lower, less intrusive
      "click": 1.2,         // Sharp click
      "tap": 1.15           // Quick tap
    };
    
    if (interactionFreqMods[config.settings.interactionType]) {
      baseFreq *= interactionFreqMods[config.settings.interactionType];
    }
    
    // Emotion frequency modifications
    const emotionFreqMods = {
      "positive": 1.15,     // Brighter, higher
      "negative": 0.85,     // Darker, lower
      "urgent": 1.4,        // Much higher, demanding attention
      "attention": 1.25,    // Higher, but not as urgent
      "subtle": 0.9,        // Slightly lower, less noticeable
      "neutral": 1.0,       // No change
      "informative": 1.05   // Slightly higher, clear
    };
    
    if (emotionFreqMods[config.settings.emotion]) {
      baseFreq *= emotionFreqMods[config.settings.emotion];
    }
    
    // === AUDIO GENERATION ===
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let sample = 0;
      let envelope = 0;
      
      // Determine which beat we're in
      for (let beat = 0; beat < beatCount; beat++) {
        const beatStartTime = beat * (singleBeatDuration + beatDelay);
        const beatEndTime = beatStartTime + singleBeatDuration;
        
        // Debug logging for first few samples of each beat
        if (beatCount > 1 && i < sampleRate * 0.01 && Math.abs(t - beatStartTime) < 0.001) {
          console.log(`Beat ${beat + 1} starts at ${beatStartTime.toFixed(3)}s, ends at ${beatEndTime.toFixed(3)}s`);
        }
        
        if (t >= beatStartTime && t < beatEndTime) {
          const localT = t - beatStartTime;
          const normalizedT = localT / singleBeatDuration; // 0 to 1
          
          // Dynamic frequency for pitch effects
          let dynamicFreq = baseFreq;
          if (config.settings.pitch === "rising") {
            dynamicFreq = baseFreq * (1 + normalizedT * 0.8); // Rise by 80%
          } else if (config.settings.pitch === "falling") {
            dynamicFreq = baseFreq * (1 - normalizedT * 0.6); // Fall by 60%
          }
          
          // === TONAL QUALITY EFFECTS ===
          let harmonicContent = [];
          let noiseAmount = 0;
          
          if (config.settings.tonalQuality === "tonal") {
            harmonicContent = [1.0]; // Pure fundamental
          } else if (config.settings.tonalQuality === "harmonic") {
            harmonicContent = [1.0, 0.5, 0.25, 0.125]; // Rich harmonics
          } else if (config.settings.tonalQuality === "dissonant") {
            harmonicContent = [1.0, 0.6, 0.4]; // Clashing intervals
            dynamicFreq *= 1.0; // Add slight detuning
          } else if (config.settings.tonalQuality === "atonal") {
            harmonicContent = [1.0, 0.3, 0.2, 0.1]; // Weak harmonics
            noiseAmount = 0.1;
          } else if (config.settings.tonalQuality === "noise") {
            harmonicContent = [0.7]; // Reduced fundamental
            noiseAmount = 0.4;
          } else if (config.settings.tonalQuality === "pitched") {
            harmonicContent = [1.0, 0.3]; // Clear pitch with some harmonics
          }
          
          // === TIMBRE WAVEFORM GENERATION ===
          if (config.settings.timbre === "soft") {
            // Pure sine wave
            sample = Math.sin(2 * Math.PI * dynamicFreq * localT);
          } else if (config.settings.timbre === "hard") {
            // Square wave with harmonics
            sample = Math.sign(Math.sin(2 * Math.PI * dynamicFreq * localT));
          } else if (config.settings.timbre === "crisp") {
            // Triangle wave
            sample = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * dynamicFreq * localT));
          } else if (config.settings.timbre === "warm") {
            // Sine with even harmonics
            sample = Math.sin(2 * Math.PI * dynamicFreq * localT) + 
                    0.3 * Math.sin(2 * Math.PI * dynamicFreq * 2 * localT) +
                    0.1 * Math.sin(2 * Math.PI * dynamicFreq * 4 * localT);
          } else if (config.settings.timbre === "cold") {
            // Pure sine, filtered
            sample = Math.sin(2 * Math.PI * dynamicFreq * localT) * 0.8;
          } else if (config.settings.timbre === "metallic") {
            // Square with high harmonics
            sample = Math.sign(Math.sin(2 * Math.PI * dynamicFreq * localT)) +
                    0.3 * Math.sign(Math.sin(2 * Math.PI * dynamicFreq * 3 * localT));
          } else if (config.settings.timbre === "wooden") {
            // Sawtooth-like
            sample = (2 / Math.PI) * Math.atan(Math.tan(Math.PI * dynamicFreq * localT));
          } else if (config.settings.timbre === "digital") {
            // Bit-crushed square
            const crushed = Math.sign(Math.sin(2 * Math.PI * dynamicFreq * localT));
            sample = Math.round(crushed * 4) / 4; // 4-bit quantization
          } else if (config.settings.timbre === "organic") {
            // Sine with slight variations
            sample = Math.sin(2 * Math.PI * dynamicFreq * localT) * 
                    (1 + 0.1 * Math.sin(2 * Math.PI * dynamicFreq * 0.1 * localT));
          } else if (config.settings.timbre === "glassy") {
            // High harmonics, bell-like
            sample = Math.sin(2 * Math.PI * dynamicFreq * localT) +
                    0.4 * Math.sin(2 * Math.PI * dynamicFreq * 3 * localT) +
                    0.2 * Math.sin(2 * Math.PI * dynamicFreq * 5 * localT);
          } else if (config.settings.timbre === "clicky") {
            // Sharp attack, quick decay
            sample = Math.sin(2 * Math.PI * dynamicFreq * localT) * 
                    Math.exp(-localT * 10);
          } else if (config.settings.timbre === "whoosh") {
            // Filtered noise sweep
            sample = Math.sin(2 * Math.PI * dynamicFreq * localT) * 
                    (1 + 0.5 * Math.sin(2 * Math.PI * dynamicFreq * 0.05 * localT));
          } else {
            // Default sine
            sample = Math.sin(2 * Math.PI * dynamicFreq * localT);
          }
          
          // Apply tonal quality modifications
          if (harmonicContent.length > 1) {
            let harmonicSum = 0;
            for (let h = 0; h < harmonicContent.length; h++) {
              if (config.settings.tonalQuality === "dissonant" && h > 0) {
                // Add slight detuning for dissonance
                harmonicSum += harmonicContent[h] * Math.sin(2 * Math.PI * dynamicFreq * (h + 1) * 1.05 * localT);
              } else {
                harmonicSum += harmonicContent[h] * Math.sin(2 * Math.PI * dynamicFreq * (h + 1) * localT);
              }
            }
            sample = harmonicSum;
          }
          
          // Add noise if specified
          if (noiseAmount > 0) {
            sample = sample * (1 - noiseAmount) + (Math.random() - 0.5) * noiseAmount;
          }
          
          // === ENVELOPE SHAPING ===
          envelope = 1;
          const fadeInTime = 0.005; // Very quick fade in
          let fadeOutStart = singleBeatDuration * 0.7;
          let envelopeShape = "linear";
          
          if (config.settings.envelope.includes("short") || config.settings.envelope.includes("snappy")) {
            fadeOutStart = singleBeatDuration * 0.2;
            envelopeShape = "exponential";
          } else if (config.settings.envelope.includes("medium")) {
            fadeOutStart = singleBeatDuration * 0.6;
          } else if (config.settings.envelope.includes("long")) {
            fadeOutStart = singleBeatDuration * 0.8;
          } else if (config.settings.envelope.includes("sustain")) {
            fadeOutStart = singleBeatDuration * 0.95;
          } else if (config.settings.envelope.includes("fade")) {
            fadeOutStart = singleBeatDuration * 0.3;
            envelopeShape = "smooth";
          } else if (config.settings.envelope.includes("stutter")) {
            // Stutter effect
            const stutterRate = 12; // Hz
            const stutterPhase = Math.floor(localT * stutterRate) % 2;
            envelope *= stutterPhase === 0 ? 1 : 0.2;
          } else if (config.settings.envelope.includes("pulse")) {
            // Pulse effect
            const pulseRate = 8; // Hz
            envelope *= 0.3 + 0.7 * Math.abs(Math.sin(2 * Math.PI * pulseRate * localT));
          }
          
          // Apply envelope curves
          if (localT < fadeInTime) {
            envelope *= localT / fadeInTime;
          } else if (localT > fadeOutStart) {
            const fadeProgress = (localT - fadeOutStart) / (singleBeatDuration - fadeOutStart);
            if (envelopeShape === "exponential") {
              envelope *= Math.exp(-fadeProgress * 5);
            } else if (envelopeShape === "smooth") {
              envelope *= Math.cos(fadeProgress * Math.PI / 2);
            } else {
              envelope *= 1 - fadeProgress;
            }
          }
          
          // Interaction-specific envelope modifications
          if (config.settings.interactionType === "error") {
            envelope *= 1.2; // Slightly louder for emphasis
          } else if (config.settings.interactionType === "subtle" || config.settings.interactionType === "hover") {
            envelope *= 0.7; // Quieter for subtlety
          } else if (config.settings.interactionType === "loading") {
            envelope *= 0.8; // Less intrusive
          }
          
          break; // Found the right beat
        }
      }
      
      // Final amplitude scaling
      let finalAmplitude = 0.25;
      if (config.settings.emotion === "urgent") {
        finalAmplitude = 0.35;
      } else if (config.settings.emotion === "subtle") {
        finalAmplitude = 0.15;
      }
      
      data[i] = sample * envelope * finalAmplitude;
    }
    
    // Convert to WAV blob
    const wavBlob = audioBufferToWav(buffer);
    return wavBlob;
  };
  
  // Function to convert AudioBuffer to WAV blob
  const audioBufferToWav = (buffer) => {
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float samples to 16-bit PCM
    const data = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };
  


  // Keyboard event handler with sound generation
  useEffect(() => {
    const handleKeyDown = async (e) => {
      const keyboardProgression = [
        'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p',
        'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l',
        'z', 'x', 'c', 'v', 'b', 'n', 'm'
      ];
      
      const keyIndex = keyboardProgression.indexOf(e.key.toLowerCase());
      if (keyIndex === -1) return;

      const progressionFactor = keyIndex / (keyboardProgression.length - 1);

      // Create config for this sound
      const config = {
        key: e.key.toUpperCase(),
        keyIndex: keyIndex,
        progressionFactor: progressionFactor,
        settings: {
          interactionType, tonalQuality, envelope, timbre, pitch, emotion, beatCount, beatDelay
        },
        timestamp: Date.now(),
        generatedAt: new Date().toISOString()
      };
      
      // Generate audio blob for saving/downloading
      const blob = await generateAudioBlob(config);
      const name = `UISound_${e.key.toUpperCase()}_${Date.now()}.wav`;
      
      // Play the same audio that was generated
      await handlePlay(blob, config);
      
      setRecordings(prev => [...prev, { name, blob, config }]);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [interactionType, tonalQuality, envelope, timbre, pitch, emotion, beatCount, beatDelay]);

  const handlePlay = async (blob, config = null) => {
    try {
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      await audio.play();
      audio.onended = () => URL.revokeObjectURL(audioUrl);
    } catch (error) {
      console.error('Error playing audio:', error);
      alert('Unable to play audio. Please try generating a new sound.');
    }
  };

  const handleDownload = (rec) => {
    const url = URL.createObjectURL(rec.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = rec.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveSound = async (rec) => {
    setIsSaving(true);
    try {
      const base64Data = await blobToBase64(rec.blob);
      const soundWithData = {
        name: rec.name,
        blob: rec.blob,
        blobData: base64Data,
        config: rec.config,
        timestamp: Date.now()
      };
      setSavedSounds(prev => {
        const newSavedSounds = [...prev, soundWithData];
        saveSoundsToStorage(newSavedSounds);
        return newSavedSounds;
      });
    } catch (error) {
      console.error('Error saving sound:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSavedSound = async (index) => {
    const newSaved = savedSounds.filter((_, i) => i !== index);
    setSavedSounds(newSaved);
    if (newSaved.length > 0) {
      await saveSoundsToStorage(newSaved);
    } else {
      localStorage.removeItem('savedSounds');
    }
  };

  const handleClearSavedSounds = () => {
    setSavedSounds([]);
    localStorage.removeItem('savedSounds');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-4">
            UI Sound Generator
          </h1>
          <p className="text-lg text-muted-foreground mb-2">
            Press keys <Badge variant="outline">Q→M</Badge> to generate progressive UI sound effects.
          </p>
          <p className="text-sm text-muted-foreground">
            Sounds progress from low to high pitch across the keyboard layout.
          </p>
        </div>

        {/* Controls Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Sound Parameters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interaction-type">Interaction Type</Label>
                <Select value={interactionType} onValueChange={setInteractionType}>
                  <SelectTrigger id="interaction-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERACTION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tonal-quality">Tonal Quality</Label>
                <Select value={tonalQuality} onValueChange={setTonalQuality}>
                  <SelectTrigger id="tonal-quality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONAL_QUALITIES.map((quality) => (
                      <SelectItem key={quality} value={quality}>
                        {quality}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="envelope">Envelope</Label>
                <Select value={envelope} onValueChange={setEnvelope}>
                  <SelectTrigger id="envelope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVELOPES.map((env) => (
                      <SelectItem key={env} value={env}>
                        {env}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timbre">Timbre / Texture</Label>
                <Select value={timbre} onValueChange={setTimbre}>
                  <SelectTrigger id="timbre">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMBRES.map((timb) => (
                      <SelectItem key={timb} value={timb}>
                        {timb}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pitch">Pitch</Label>
                <Select value={pitch} onValueChange={setPitch}>
                  <SelectTrigger id="pitch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PITCHES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emotion">Emotion</Label>
                <Select value={emotion} onValueChange={setEmotion}>
                  <SelectTrigger id="emotion">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMOTIONS.map((emo) => (
                      <SelectItem key={emo} value={emo}>
                        {emo === "none" ? "(none)" : emo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label>Beat Settings</Label>
                <Dialog open={beatDialogOpen} onOpenChange={setBeatDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      {beatCount} beat{beatCount > 1 ? 's' : ''} • {beatDelay}ms
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Beat Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="beat-count">Beat Count</Label>
                        <Input
                          id="beat-count"
                          type="number"
                          min="1"
                          value={beatCount}
                          onChange={(e) => setBeatCount(Math.max(1, Number(e.target.value)))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="beat-delay">Delay: {beatDelay}ms</Label>
                        <Slider
                          id="beat-delay"
                          min={100}
                          max={1000}
                          step={10}
                          value={[beatDelay]}
                          onValueChange={(value) => setBeatDelay(value[0])}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sounds Section */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          {/* Generated Sounds List */}
          <Card className="lg:col-span-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5" />
                  Generated UI Sounds
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRecordings([])}
                  disabled={recordings.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear List
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto space-y-2">
                {recordings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-lg">No sounds generated yet.</p>
                    <p className="text-sm">Press a key to get started!</p>
                  </div>
                ) : (
                  recordings.map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10"
                    >
                      <div className="flex-1">
                        <p className="font-mono text-sm text-primary font-medium">
                          {rec.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePlay(rec.blob, rec.config)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(rec)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveSound(rec)}
                          disabled={isSaving}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Saved Sounds List */}
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Saved Sounds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto space-y-2">
                {savedSounds.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="text-sm">No sounds saved yet.</p>
                  </div>
                ) : (
                  savedSounds.map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                    >
                      <div className="flex-1">
                        <p className="font-mono text-sm text-green-700 font-medium">
                          {rec.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePlay(rec.blob, rec.config)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(rec)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSavedSound(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {savedSounds.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearSavedSounds}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Saved Sounds
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

