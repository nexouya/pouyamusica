import math
import os
import struct
import wave
from pathlib import Path

out = Path(os.environ["USERPROFILE"]) / "Music" / "pouya-music"
out.mkdir(parents=True, exist_ok=True)


def write_wav(path: Path, seconds: float, freqs: list[float], sr: int = 44100) -> None:
    n = int(sr * seconds)
    with wave.open(str(path), "w") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        frames = bytearray()
        for i in range(n):
            t = i / sr
            env = min(1.0, t * 4) * min(1.0, (seconds - t) * 2)
            s = 0.0
            for f in freqs:
                s += math.sin(2 * math.pi * f * t) / len(freqs)
            s *= 0.35 * env
            s *= 0.85 + 0.15 * math.sin(2 * math.pi * 2 * t)
            v = int(max(-1.0, min(1.0, s)) * 32767)
            frames += struct.pack("<hh", v, v)
        w.writeframes(frames)


tracks = [
    ("morning-coffee.wav", 12, [261.63, 329.63, 392.00]),
    ("night-drive.wav", 12, [220.00, 277.18, 329.63]),
    ("glass-waves.wav", 12, [293.66, 369.99, 440.00]),
]
for name, secs, freqs in tracks:
    path = out / name
    write_wav(path, secs, freqs)
    print("wrote", path, path.stat().st_size)
print("OK", out)
