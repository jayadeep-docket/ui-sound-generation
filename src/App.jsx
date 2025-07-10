// TriangleSynth.tsx
import { useEffect, useRef, useState } from "react";
import saveAs from "file-saver";
import JSZip from "jszip";
import {
  Box,
  Container,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  Paper,
  Divider,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  IconButton as MuiIconButton,
  TextField,
} from '@mui/material';
import {
  PlayArrow,
  Download,
  Save,
  Clear,
  Star,
  Headphones,
  Delete,
} from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const INTERACTION_TYPES = [
  "click",
  "tap",
  "hover",
  "select",
  "confirm",
  "cancel",
  "error",
  "popup",
  "notification",
  "transition",
  "back",
  "scroll",
  "drag-drop",
  "typing",
  "loading",
];
const TONAL_QUALITIES = [
  "tonal",
  "atonal",
  "pitched",
  "noise",
  "harmonic",
  "dissonant",
];
const ENVELOPES = [
  "short / snappy",
  "medium",
  "long",
  "sustain",
  "fade",
  "stutter",
  "pulse",
];
const TIMBRES = [
  "soft",
  "hard",
  "crisp",
  "warm",
  "cold",
  "metallic",
  "wooden",
  "digital",
  "organic",
  "glassy",
  "clicky",
  "whoosh",
];
const PITCHES = ["high", "mid", "low", "rising", "falling"];
const EMOTIONS = [
  "",
  "positive",
  "negative",
  "neutral",
  "attention",
  "subtle",
  "urgent",
  "informative",
];
const BEAT_COUNTS = [1, 2, 3]; // (no longer used as dropdown)

export default function TriangleSynth() {
  const theme = useTheme();
  const audioCtxRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [soundLog, setSoundLog] = useState([]);
  const [recordings, setRecordings] = useState([]);

  // Helper functions for blob/base64 conversion (moved before useState)
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
    console.log('Initializing saved sounds from localStorage...');
    const saved = localStorage.getItem('savedSounds');
    if (saved) {
      try {
        console.log('Found saved sounds in localStorage, parsing...');
        const parsedSounds = JSON.parse(saved);
        console.log('Parsed sounds count:', parsedSounds.length);
        // Convert base64 back to blobs
        const convertedSounds = parsedSounds.map(sound => ({
          name: sound.name,
          blob: base64ToBlob(sound.blobData, 'audio/ogg'),
          blobData: sound.blobData,
          config: sound.config, // Include configuration data
          timestamp: sound.timestamp
        }));
        console.log('Successfully loaded saved sounds:', convertedSounds.length);
        return convertedSounds;
      } catch (e) {
        console.error('Error loading saved sounds:', e);
        return [];
      }
    }
    console.log('No saved sounds found in localStorage');
    return [];
  });

  // Save sounds to localStorage
  const saveSoundsToStorage = async (sounds) => {
    try {
      console.log('Converting sounds for storage, count:', sounds.length);
      const soundsForStorage = await Promise.all(
        sounds.map(async (sound) => ({
          name: sound.name,
          blobData: sound.blobData || await blobToBase64(sound.blob),
          config: sound.config, // Include configuration data
          timestamp: sound.timestamp || Date.now()
        }))
      );
      console.log('Sounds converted for storage, saving to localStorage...');
      localStorage.setItem('savedSounds', JSON.stringify(soundsForStorage));
      console.log('Successfully saved to localStorage');
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
  const [beatDelay, setBeatDelay] = useState(200); // ms
  const [beatDialogOpen, setBeatDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Define keyboard layout progression from Q to M (left to right, top to bottom)
      const keyboardProgression = [
        'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p',  // Top row
        'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l',       // Middle row
        'z', 'x', 'c', 'v', 'b', 'n', 'm'                  // Bottom row
      ];
      
      const keyIndex = keyboardProgression.indexOf(e.key.toLowerCase());
      
      // Only respond to keys in our progression
      if (keyIndex === -1) return;

      // Calculate progression factor (0 to 1) based on key position
      const progressionFactor = keyIndex / (keyboardProgression.length - 1);

      // Envelope/duration calculation
      let attack = 0.005,
        release = 0.15,
        duration = 0.15;
      if (envelope.includes("medium")) {
        attack = 0.01;
        release = 0.3;
        duration = 0.3;
      }
      if (envelope.includes("long")) {
        attack = 0.02;
        release = 0.6;
        duration = 0.6;
      }
      if (envelope.includes("sustain")) {
        attack = 0.01;
        release = 1.2;
        duration = 1.2;
      }
      if (envelope.includes("fade")) {
        attack = 0.01;
        release = 0.7;
        duration = 0.7;
      }
      if (envelope.includes("stutter")) {
        attack = 0.005;
        release = 0.08;
        duration = 0.08;
      }
      if (envelope.includes("pulse")) {
        attack = 0.005;
        release = 0.08;
        duration = 0.08;
      }

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      const mediaRecorder = new MediaRecorder(dest.stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];
      mediaRecorder.ondataavailable = (event) => chunks.push(event.data);
      mediaRecorder.onstop = () => {
        let blob;
        try {
          blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
        } catch (e) {
          blob = new Blob(chunks);
        }
        const name = `UISound_${e.key.toUpperCase()}_${Date.now()}.ogg`;
        
        // Create configuration object
        const config = {
          key: e.key.toUpperCase(),
          keyIndex: keyIndex,
          progressionFactor: progressionFactor,
          settings: {
            interactionType,
            tonalQuality,
            envelope,
            timbre,
            pitch,
            emotion,
            beatCount,
            beatDelay
          },
          timestamp: Date.now(),
          generatedAt: new Date().toISOString()
        };
        
        setRecordings((prev) => [...prev, { name, blob, config }]);
      };

      // Calculate interaction duration multiplier for total duration
      let interactionDurationMultiplier = 1;
      if (interactionType === "click" || interactionType === "tap") {
        interactionDurationMultiplier = 0.8;
      } else if (interactionType === "error") {
        interactionDurationMultiplier = 1.5;
      } else if (interactionType === "loading") {
        interactionDurationMultiplier = 1.2;
      } else if (interactionType === "typing") {
        interactionDurationMultiplier = 0.6;
      }

      // Calculate total duration for multiple beats
      const beatInterval = beatDelay / 1000; // convert ms to seconds
      const finalDuration = duration * interactionDurationMultiplier;
      const totalDuration = (beatCount - 1) * beatInterval + finalDuration;
      
      // Start recording
      mediaRecorder.start();
      
      // Generate multiple beats
      for (let i = 0; i < beatCount; i++) {
        const beatStartTime = audioCtx.currentTime + (i * beatInterval);
        generateBeat(audioCtx, dest, beatStartTime, attack, release, finalDuration, progressionFactor);
      }
      
      // Stop recording after all beats are complete
      setTimeout(() => {
        mediaRecorder.stop();
      }, totalDuration * 1000 + 100);
    };
    
    // Function to generate a single beat
    const generateBeat = (audioCtx, dest, startTime, attack, release, baseDuration, progressionFactor) => {
      // --- SOUND PARAMS BASED ON SELECTIONS AND PROGRESSION ---
      // Base frequency progression: Start low and go higher
      let baseFreq;
      if (pitch === "high") {
        baseFreq = 800 + (progressionFactor * 800); // 800Hz to 1600Hz
      } else if (pitch === "mid") {
        baseFreq = 400 + (progressionFactor * 600); // 400Hz to 1000Hz
      } else if (pitch === "low") {
        baseFreq = 200 + (progressionFactor * 400); // 200Hz to 600Hz
      } else if (pitch === "rising") {
        baseFreq = 300 + (progressionFactor * 500); // 300Hz to 800Hz, will rise further
      } else if (pitch === "falling") {
        baseFreq = 1000 - (progressionFactor * 400); // 1000Hz to 600Hz, will fall further
      } else {
        // Default progressive scale
        baseFreq = 300 + (progressionFactor * 700); // 300Hz to 1000Hz
      }

      // Interaction Type modifications
      let interactionGainMultiplier = 1;
      let interactionDurationMultiplier = 1;
      if (interactionType === "click" || interactionType === "tap") {
        interactionGainMultiplier = 1.1; // Slightly louder for clicks
        interactionDurationMultiplier = 0.8; // Shorter duration
      } else if (interactionType === "hover") {
        interactionGainMultiplier = 0.7; // Quieter for hover
        baseFreq *= 1.1; // Higher pitch
      } else if (interactionType === "error") {
        baseFreq *= 0.7; // Lower pitch for errors
        interactionGainMultiplier = 1.3; // Louder
        interactionDurationMultiplier = 1.5; // Longer duration
      } else if (interactionType === "confirm") {
        baseFreq *= 1.2; // Higher pitch for confirmation
        interactionGainMultiplier = 1.2; // Louder
      } else if (interactionType === "cancel") {
        baseFreq *= 0.9; // Lower pitch
        interactionGainMultiplier = 0.9; // Quieter
      } else if (interactionType === "notification") {
        baseFreq *= 1.15; // Higher pitch
        interactionGainMultiplier = 1.1; // Louder
      } else if (interactionType === "loading") {
        interactionGainMultiplier = 0.8; // Quieter
        interactionDurationMultiplier = 1.2; // Longer
      } else if (interactionType === "typing") {
        interactionGainMultiplier = 0.6; // Much quieter
        interactionDurationMultiplier = 0.6; // Much shorter
      }

      // Emotion-based modifications
      let emotionGainMultiplier = 1;
      let emotionFreqMultiplier = 1;
      if (emotion === "positive") {
        baseFreq *= 1.1; // Slightly higher pitch
        emotionGainMultiplier = 1.1; // Slightly louder
      } else if (emotion === "negative") {
        baseFreq *= 0.9; // Slightly lower pitch
        emotionGainMultiplier = 0.8; // Quieter
      } else if (emotion === "attention" || emotion === "urgent") {
        baseFreq *= 1.2; // Higher pitch for attention
        emotionGainMultiplier = 1.2; // Louder
      } else if (emotion === "subtle") {
        baseFreq *= 0.95; // Slightly lower
        emotionGainMultiplier = 0.6; // Much quieter
      } else if (emotion === "informative") {
        baseFreq *= 1.05; // Slightly higher
        emotionGainMultiplier = 0.9; // Slightly quieter
      }

      // Tonal Quality modifications
      let tonalFreqMultiplier = 1;
      let tonalGainMultiplier = 1;
      if (tonalQuality === "atonal") {
        // Add slight detuning for atonal effect, but keep progression
        baseFreq *= (0.98 + (progressionFactor * 0.04)); // Slight progressive detuning
      } else if (tonalQuality === "pitched") {
        // Clean, precise pitch - no modification needed
        tonalFreqMultiplier = 1.0;
      } else if (tonalQuality === "harmonic") {
        // Add harmonic richness
        tonalGainMultiplier = 1.1;
      } else if (tonalQuality === "dissonant") {
        // Add progressive dissonance
        baseFreq *= (0.95 + (progressionFactor * 0.1)); // Progressive detuning
        tonalGainMultiplier = 0.9;
      }

      // Combine all multipliers
      const finalGainMultiplier = emotionGainMultiplier * interactionGainMultiplier * tonalGainMultiplier;
      const finalDuration = baseDuration;

      // Timbre/texture
      let oscType = "sine";
      if (timbre === "crisp" || timbre === "clicky") oscType = "triangle";
      if (timbre === "hard" || timbre === "metallic" || timbre === "digital")
        oscType = "square";
      if (timbre === "warm" || timbre === "wooden" || timbre === "organic")
        oscType = "sine";
      if (timbre === "cold") {
        oscType = "triangle";
        baseFreq *= 1.1; // Slightly higher pitch for cold
      }
      if (timbre === "glassy") oscType = "triangle";
      if (timbre === "whoosh") oscType = "sine";
      if (tonalQuality === "noise" || timbre === "noise" || timbre === "whoosh")
        oscType = "noise";

      // Envelope shape
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.7 * finalGainMultiplier, startTime + attack);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        startTime + finalDuration + release
      );

      // Filter
      const masterFilter = audioCtx.createBiquadFilter();
      masterFilter.type = "lowpass";
      masterFilter.frequency.setValueAtTime(
        timbre === "crisp" || timbre === "hard"
          ? 4000
          : timbre === "soft" || timbre === "warm"
          ? 1200
          : 2000,
        startTime
      );
      masterFilter.Q.value = 1.2;
      gain.connect(masterFilter);
      masterFilter.connect(dest);
      masterFilter.connect(audioCtx.destination);

      // Sound generation
      if (oscType === "noise") {
        // Noise burst with progressive filtering
        const bufferSize = audioCtx.sampleRate * finalDuration;
        const buffer = audioCtx.createBuffer(
          1,
          bufferSize,
          audioCtx.sampleRate
        );
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] =
            (Math.random() * 2 - 1) * (timbre === "crisp" ? 0.25 : 0.15);
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = timbre === "whoosh" ? "highpass" : "bandpass";
        noiseFilter.frequency.setValueAtTime(baseFreq, startTime);
        noise.connect(noiseFilter);
        noiseFilter.connect(gain);
        noise.start(startTime);
        noise.stop(startTime + finalDuration);
      } else {
        // Oscillator
        const osc = audioCtx.createOscillator();
        osc.type = oscType;
        osc.frequency.setValueAtTime(baseFreq, startTime);
        // Pitch bend for rising/falling
        if (pitch === "rising") {
          osc.frequency.linearRampToValueAtTime(
            baseFreq * 1.7,
            startTime + finalDuration
          );
        } else if (pitch === "falling") {
          osc.frequency.linearRampToValueAtTime(
            baseFreq * 0.5,
            startTime + finalDuration
          );
        }
        osc.connect(gain);
        osc.start(startTime);
        osc.stop(startTime + finalDuration);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    interactionType,
    tonalQuality,
    envelope,
    timbre,
    pitch,
    emotion,
    beatCount,
    beatDelay,
  ]);

  const handlePlay = (blob) => {
    if (!blob || blob.size === 0) {
      alert("No audio data to play.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.onerror = (e) => {
      alert(
        "Audio playback failed. Try downloading and playing in a media player."
      );
      console.error("Audio playback error", e);
    };
    audio.play().catch((err) => {
      alert("Audio playback failed: " + err.message);
      console.error("Audio play() error", err);
    });
  };

  // Generate configuration text content
  const generateConfigText = (config) => {
    return `UI Sound Generator Configuration
=====================================

Audio File: ${config.name || 'Unknown'}
Generated: ${config.generatedAt}
Key Pressed: ${config.key}
Key Position: ${config.keyIndex + 1} of 26
Progression Factor: ${(config.progressionFactor * 100).toFixed(1)}%

Sound Settings:
--------------
Interaction Type: ${config.settings.interactionType}
Tonal Quality: ${config.settings.tonalQuality}
Envelope: ${config.settings.envelope}
Timbre/Texture: ${config.settings.timbre}
Pitch: ${config.settings.pitch}
Emotion: ${config.settings.emotion || '(none)'}
Beat Count: ${config.settings.beatCount}
Beat Delay: ${config.settings.beatDelay}ms

Technical Details:
-----------------
Keyboard Layout: Q-W-E-R-T-Y-U-I-O-P, A-S-D-F-G-H-J-K-L, Z-X-C-V-B-N-M
Key Progression: Left to right, top to bottom
Frequency Range: Progressive based on key position
Audio Format: OGG Vorbis

Instructions to Recreate:
------------------------
1. Set the sound parameters as listed above
2. Press the '${config.key}' key to generate the same sound
3. The sound will be identical if all settings match

Generated by UI Sound Generator
Timestamp: ${config.timestamp}
`;
  };

  // Download both audio and configuration files as a ZIP
  const handleDownload = async (rec) => {
    try {
      const zip = new JSZip();
      
      // Add audio file to ZIP
      zip.file(rec.name, rec.blob);
      
      // Add configuration file to ZIP
      if (rec.config) {
        const configText = generateConfigText({ ...rec.config, name: rec.name });
        const configName = rec.name.replace('.ogg', '_config.txt');
        zip.file(configName, configText);
      }
      
      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipName = rec.name.replace('.ogg', '_package.zip');
      
      // Download ZIP file
      saveAs(zipBlob, zipName);
    } catch (error) {
      console.error('Error creating download package:', error);
      // Fallback to separate downloads if ZIP creation fails
      saveAs(rec.blob, rec.name);
      if (rec.config) {
        const configText = generateConfigText({ ...rec.config, name: rec.name });
        const configBlob = new Blob([configText], { type: 'text/plain' });
        const configName = rec.name.replace('.ogg', '_config.txt');
        saveAs(configBlob, configName);
      }
    }
  };

  // Save a sound to the saved list
  const handleSaveSound = async (rec) => {
    console.log('Attempting to save sound:', rec.name);
    setIsSaving(true);
    
    // Check for duplicates
    const isDuplicate = savedSounds.some(
      (s) => s.name === rec.name && s.blob.size === rec.blob.size
    );
    if (isDuplicate) {
      console.log('Sound already exists, skipping save');
      setIsSaving(false);
      return;
    }

    try {
      console.log('Converting blob to base64...');
      // Convert blob to base64 for the new sound
      const base64Data = await blobToBase64(rec.blob);
      console.log('Base64 conversion successful, length:', base64Data.length);
      
      const soundWithData = {
        name: rec.name,
        blob: rec.blob,
        blobData: base64Data,
        config: rec.config, // Include configuration data
        timestamp: Date.now()
      };

      console.log('Setting saved sounds state, count:', savedSounds.length + 1);
      setSavedSounds(prev => {
        const newSavedSounds = [...prev, soundWithData];
        
        // Save to localStorage synchronously after state update
        setTimeout(async () => {
          try {
            console.log('Saving to localStorage...');
            await saveSoundsToStorage(newSavedSounds);
            console.log('Save to localStorage completed');
          } catch (error) {
            console.error('Error saving to localStorage:', error);
          }
        }, 0);
        
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
    
    // Update localStorage
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
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.palette.primary.light}15 0%, ${theme.palette.secondary.light}15 100%)`,
        py: 4,
        px: 2,
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
                      <Typography
              variant="h3"
              component="h1"
              sx={{
              fontWeight: 700,
              color: theme.palette.primary.main,
              mb: 2,
              textShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            UI Sound Generator
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            Press keys <Chip label="Q→M" size="small" color="primary" /> to generate progressive UI sound effects.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sounds progress from low to high pitch across the keyboard layout (Q-W-E-R-T-Y-U-I-O-P, A-S-D-F-G-H-J-K-L, Z-X-C-V-B-N-M).
          </Typography>
        </Box>

        {/* Controls Section */}
        <Paper
          elevation={4}
          sx={{
            p: 3,
            mb: 4,
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
              gap: 2,
            }}
          >
            <FormControl fullWidth size="small">
              <InputLabel>Interaction Type</InputLabel>
              <Select
                value={interactionType}
                onChange={(e) => setInteractionType(e.target.value)}
                label="Interaction Type"
              >
                {INTERACTION_TYPES.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Tonal Quality</InputLabel>
              <Select
                value={tonalQuality}
                onChange={(e) => setTonalQuality(e.target.value)}
                label="Tonal Quality"
              >
                {TONAL_QUALITIES.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Envelope</InputLabel>
              <Select
                value={envelope}
                onChange={(e) => setEnvelope(e.target.value)}
                label="Envelope"
              >
                {ENVELOPES.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Timbre / Texture</InputLabel>
              <Select
                value={timbre}
                onChange={(e) => setTimbre(e.target.value)}
                label="Timbre / Texture"
              >
                {TIMBRES.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Pitch</InputLabel>
              <Select
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                label="Pitch / Frequency Range"
              >
                {PITCHES.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Emotion</InputLabel>
              <Select
                value={emotion}
                onChange={(e) => setEmotion(e.target.value)}
                label="Emotion / Feedback Intent"
              >
                {EMOTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt || "(none)"}>
                    {opt || "(none)"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" sx={{ gridColumn: { lg: 'span 2' } }}>
              <Button
                variant="outlined"
                onClick={() => setBeatDialogOpen(true)}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  height: '40px',
                  borderColor: 'rgba(0, 0, 0, 0.23)',
                  color: 'rgba(0, 0, 0, 0.87)',
                  fontSize: '0.875rem',
                  px: 2,
                  py: 1,
                  '&:hover': {
                    borderColor: 'rgba(0, 0, 0, 0.87)',
                  },
                }}
                fullWidth
              >
                {beatCount} beat{beatCount > 1 ? 's' : ''} • {beatDelay}ms
              </Button>
            </FormControl>
                      </Box>
        </Paper>

        {/* Beat Settings Dialog */}
        <Dialog open={beatDialogOpen} onClose={() => setBeatDialogOpen(false)} maxWidth={false}>
          <Box sx={{ width: 300 }}>
            <DialogTitle>Beats Settings</DialogTitle>
            <DialogContent sx={{ px: 2, pb: 2, p: 2 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Beats Count</Typography>
              <TextField
                type="number"
                value={beatCount}
                onChange={e => setBeatCount(Math.max(1, Number(e.target.value)))}
                inputProps={{ min: 1 }}
                size="small"
                fullWidth
                label="Number of beats"
              />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Delay</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ width: 'calc(100% - 30px)', px: 2 }}>
                  <Slider
                    value={beatDelay}
                    min={100}
                    max={1000}
                    step={10}
                    onChange={(_, v) => setBeatDelay(v)}
                    valueLabelDisplay="auto"
                    marks={[{ value: 100, label: '100ms' }, { value: 1000, label: '1000ms' }]}
                  />
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBeatDialogOpen(false)} color="secondary">Cancel</Button>
            <Button onClick={() => setBeatDialogOpen(false)} color="primary" variant="contained">Save</Button>
          </DialogActions>
            </Box>
        </Dialog>

        {/* Sounds Section */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3 }}>
          {/* Generated Sounds List */}
          <Card elevation={4} sx={{ 
            flex: { xs: 1, lg: 6 },
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Headphones color="primary" />
                  <Typography variant="h6" color="primary">
                    Generated UI Sounds
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Clear />}
                  onClick={() => setRecordings([])}
                  disabled={recordings.length === 0}
                  size="small"
                >
                  Clear List
                </Button>
              </Box>
              
              <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
                {recordings.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    <Typography variant="body1">
                      No sounds generated yet.
                    </Typography>
                    <Typography variant="body2">
                      Press a key to get started!
                    </Typography>
                  </Box>
                ) : (
                  <List>
                    {recordings.map((rec, idx) => (
                      <ListItem
                        key={idx}
                        sx={{
                          mb: 1,
                          bgcolor: 'primary.50',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'primary.100',
                          '&:hover': {
                            bgcolor: 'primary.100',
                          },
                        }}
                        secondaryAction={
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              onClick={() => handlePlay(rec.blob)}
                              color="primary"
                              size="small"
                            >
                              <PlayArrow />
                            </IconButton>
                            <IconButton
                              onClick={() => handleDownload(rec)}
                              color="primary"
                              size="small"
                            >
                              <Download />
                            </IconButton>
                            <IconButton
                              onClick={() => handleSaveSound(rec)}
                              color="success"
                              size="small"
                              disabled={isSaving || savedSounds.some(
                                (s) => s.name === rec.name && s.blob.size === rec.blob.size
                              )}
                            >
                              <Save />
                            </IconButton>
                          </Box>
                        }
                      >
                        <ListItemText
                          primary={rec.name}
                          primaryTypographyProps={{
                            variant: 'body2',
                            fontFamily: 'monospace',
                            color: 'primary.main',
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Saved Sounds List */}
          <Card elevation={4} sx={{ 
            bgcolor: 'white', 
            flex: { xs: 1, lg: 4 },
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Star color="primary" />
                <Typography variant="h6" color="primary">
                  Saved Sounds
                </Typography>
              </Box>
              
              <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
                {savedSounds.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>
                    <Typography variant="body2">
                      No sounds saved yet.
                    </Typography>
                  </Box>
                ) : (
                  <List>
                    {savedSounds.map((rec, idx) => (
                      <ListItem
                        key={idx}
                        sx={{
                          mb: 1,
                          bgcolor: 'success.50',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'success.100',
                          '&:hover': {
                            bgcolor: 'success.100',
                          },
                        }}
                        secondaryAction={
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              onClick={() => handlePlay(rec.blob)}
                              color="success"
                              size="small"
                            >
                              <PlayArrow />
                            </IconButton>
                            <IconButton
                              onClick={() => handleDownload(rec)}
                              color="success"
                              size="small"
                            >
                              <Download />
                            </IconButton>
                            <IconButton
                              onClick={() => handleDeleteSavedSound(idx)}
                              color="error"
                              size="small"
                            >
                              <Delete />
                            </IconButton>
                          </Box>
                        }
                      >
                        <ListItemText
                          primary={rec.name}
                          primaryTypographyProps={{
                            variant: 'body2',
                            fontFamily: 'monospace',
                            color: 'success.main',
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
              <Divider sx={{ my: 1 }} />
              <Button
                variant="outlined"
                color="error"
                startIcon={<Clear />}
                onClick={handleClearSavedSounds}
                disabled={savedSounds.length === 0}
                size="small"
                fullWidth
              >
                Clear All Saved Sounds
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}
