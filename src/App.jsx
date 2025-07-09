// TriangleSynth.tsx
import { useEffect, useRef, useState } from "react";
import saveAs from "file-saver";
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
} from '@mui/material';
import {
  PlayArrow,
  Download,
  Save,
  Clear,
  Star,
  Headphones,
} from '@mui/icons-material';

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

export default function TriangleSynth() {
  const theme = useTheme();
  const audioCtxRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [soundLog, setSoundLog] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [savedSounds, setSavedSounds] = useState([]);

  // State for select boxes
  const [interactionType, setInteractionType] = useState(INTERACTION_TYPES[0]);
  const [tonalQuality, setTonalQuality] = useState(TONAL_QUALITIES[0]);
  const [envelope, setEnvelope] = useState(ENVELOPES[0]);
  const [timbre, setTimbre] = useState(TIMBRES[0]);
  const [pitch, setPitch] = useState(PITCHES[0]);
  const [emotion, setEmotion] = useState(EMOTIONS[0]);

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (!/^[a-zA-Z]$/.test(e.key)) return;

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
        setRecordings((prev) => [...prev, { name, blob }]);
      };

      // --- SOUND PARAMS BASED ON SELECTIONS ---
      // Envelope
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

      // Pitch/frequency
      let baseFreq = 800;
      if (pitch === "high") baseFreq = 1200 + Math.random() * 400;
      else if (pitch === "mid") baseFreq = 500 + Math.random() * 300;
      else if (pitch === "low") baseFreq = 180 + Math.random() * 200;
      else if (pitch === "rising") baseFreq = 400 + Math.random() * 200;
      else if (pitch === "falling") baseFreq = 1000 - Math.random() * 400;

      // Timbre/texture
      let oscType = "sine";
      if (timbre === "crisp" || timbre === "clicky") oscType = "triangle";
      if (timbre === "hard" || timbre === "metallic" || timbre === "digital")
        oscType = "square";
      if (timbre === "warm" || timbre === "wooden" || timbre === "organic")
        oscType = "sine";
      if (timbre === "glassy") oscType = "triangle";
      if (timbre === "whoosh") oscType = "sine";
      if (tonalQuality === "noise" || timbre === "noise" || timbre === "whoosh")
        oscType = "noise";

      // Envelope shape
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + duration + release
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
        audioCtx.currentTime
      );
      masterFilter.Q.value = 1.2;
      gain.connect(masterFilter);
      masterFilter.connect(dest);
      masterFilter.connect(audioCtx.destination);

      // Sound generation
      if (oscType === "noise") {
        // Noise burst
        const bufferSize = audioCtx.sampleRate * duration;
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
        noiseFilter.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
        noise.connect(noiseFilter);
        noiseFilter.connect(gain);
        mediaRecorder.start();
        noise.start();
        noise.stop(audioCtx.currentTime + duration);
        noise.onended = () => {
          mediaRecorder.stop();
          setSoundLog((prev) => [
            ...prev,
            `Key '${e.key.toUpperCase()}' -> ${interactionType} | ${tonalQuality} | ${envelope} | ${timbre} | ${pitch} | ${emotion}`,
          ]);
        };
      } else {
        // Oscillator
        const osc = audioCtx.createOscillator();
        osc.type = oscType;
        osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
        // Pitch bend for rising/falling
        if (pitch === "rising") {
          osc.frequency.linearRampToValueAtTime(
            baseFreq * 1.7,
            audioCtx.currentTime + duration
          );
        } else if (pitch === "falling") {
          osc.frequency.linearRampToValueAtTime(
            baseFreq * 0.5,
            audioCtx.currentTime + duration
          );
        }
        osc.connect(gain);
        mediaRecorder.start();
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
        osc.onended = () => {
          mediaRecorder.stop();
          setSoundLog((prev) => [
            ...prev,
            `Key '${e.key.toUpperCase()}' -> ${interactionType} | ${tonalQuality} | ${envelope} | ${timbre} | ${pitch} | ${emotion}`,
          ]);
        };
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

  // Save a sound to the saved list
  const handleSaveSound = (rec) => {
    setSavedSounds((prev) => {
      // Avoid duplicates by name and blob size
      if (
        prev.some((s) => s.name === rec.name && s.blob.size === rec.blob.size)
      )
        return prev;
      return [...prev, rec];
    });
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
            🎛️ UI Microinteraction Sound Generator
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            Press any <Chip label="A–Z" size="small" color="primary" /> key to generate a pleasant UI sound effect.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Each sound is recorded and available for download below.
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
              <InputLabel>Pitch / Frequency Range</InputLabel>
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
              <InputLabel>Emotion / Feedback Intent</InputLabel>
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
          </Box>
        </Paper>

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
                              onClick={() => saveAs(rec.blob, rec.name)}
                              color="primary"
                              size="small"
                            >
                              <Download />
                            </IconButton>
                            <IconButton
                              onClick={() => handleSaveSound(rec)}
                              color="success"
                              size="small"
                              disabled={savedSounds.some(
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
                              onClick={() => saveAs(rec.blob, rec.name)}
                              color="success"
                              size="small"
                            >
                              <Download />
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
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}
