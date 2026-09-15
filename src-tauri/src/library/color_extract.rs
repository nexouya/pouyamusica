use base64::{engine::general_purpose::STANDARD as B64, Engine};
use image::imageops::FilterType;
use image::DynamicImage;

/// Extract up to 4 dominant colors from cover art using simple k-means on sampled pixels.
pub fn extract_palette(img: &DynamicImage, color_count: usize) -> Vec<String> {
    let small = img.resize_exact(64, 64, FilterType::Triangle).to_rgb8();
    let pixels: Vec<[f32; 3]> = small
        .pixels()
        .map(|p| [p[0] as f32, p[1] as f32, p[2] as f32])
        .collect();

    if pixels.is_empty() {
        return default_palette();
    }

    let k = color_count.clamp(2, 6);
    let mut centroids: Vec<[f32; 3]> = Vec::with_capacity(k);
    // spread initial centroids across the sample
    for i in 0..k {
        let idx = (i * pixels.len() / k).min(pixels.len() - 1);
        centroids.push(pixels[idx]);
    }

    let mut assignments = vec![0usize; pixels.len()];
    for _ in 0..12 {
        // assign
        for (i, px) in pixels.iter().enumerate() {
            let mut best = 0usize;
            let mut best_d = f32::MAX;
            for (ci, c) in centroids.iter().enumerate() {
                let d = dist2(px, c);
                if d < best_d {
                    best_d = d;
                    best = ci;
                }
            }
            assignments[i] = best;
        }
        // update
        let mut sums = vec![[0.0f32; 3]; k];
        let mut counts = vec![0usize; k];
        for (i, px) in pixels.iter().enumerate() {
            let a = assignments[i];
            sums[a][0] += px[0];
            sums[a][1] += px[1];
            sums[a][2] += px[2];
            counts[a] += 1;
        }
        for ci in 0..k {
            if counts[ci] > 0 {
                centroids[ci] = [
                    sums[ci][0] / counts[ci] as f32,
                    sums[ci][1] / counts[ci] as f32,
                    sums[ci][2] / counts[ci] as f32,
                ];
            }
        }
    }

    // Sort by cluster size (dominant first)
    let mut clusters: Vec<(usize, [f32; 3])> = centroids
        .into_iter()
        .enumerate()
        .map(|(i, c)| (assignments.iter().filter(|a| **a == i).count(), c))
        .collect();
    clusters.sort_by(|a, b| b.0.cmp(&a.0));

    clusters
        .into_iter()
        .take(k.min(4))
        .map(|(_, c)| {
            format!(
                "#{:02X}{:02X}{:02X}",
                c[0].round().clamp(0.0, 255.0) as u8,
                c[1].round().clamp(0.0, 255.0) as u8,
                c[2].round().clamp(0.0, 255.0) as u8
            )
        })
        .collect()
}

/// Pick the most saturated reasonably bright color as the UI accent.
pub fn pick_accent(palette: &[String]) -> String {
    let mut best: Option<(f32, String)> = None;
    for hex in palette {
        if let Some(rgb) = hex_to_rgb(hex) {
            let (r, g, b) = (rgb[0] as f32 / 255.0, rgb[1] as f32 / 255.0, rgb[2] as f32 / 255.0);
            let max = r.max(g).max(b);
            let min = r.min(g).min(b);
            let sat = if max == 0.0 { 0.0 } else { (max - min) / max };
            let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            let score = sat * 0.75 + (1.0 - (luma - 0.45).abs()) * 0.25;
            if best.as_ref().map(|(s, _)| score > *s).unwrap_or(true) {
                best = Some((score, hex.clone()));
            }
        }
    }
    let picked = best.map(|(_, h)| h).unwrap_or_else(|| "#7C9CFF".into());
    brighten_hex(&picked, 0.28)
}

/// Lift a color toward white so accent text stays readable on dark glass.
fn brighten_hex(hex: &str, t: f32) -> String {
    let Some([r, g, b]) = hex_to_rgb(hex) else {
        return hex.to_string();
    };
    let lift = |v: u8| (v as f32 + (255.0 - v as f32) * t).round().clamp(0.0, 255.0) as u8;
    format!("#{:02X}{:02X}{:02X}", lift(r), lift(g), lift(b))
}

pub fn hex_to_rgb(hex: &str) -> Option<[u8; 3]> {
    let h = hex.trim_start_matches('#');
    if h.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&h[0..2], 16).ok()?;
    let g = u8::from_str_radix(&h[2..4], 16).ok()?;
    let b = u8::from_str_radix(&h[4..6], 16).ok()?;
    Some([r, g, b])
}

pub fn encode_cover_jpeg(img: &DynamicImage, max_side: u32) -> String {
    let resized = img.resize(max_side, max_side, FilterType::Triangle);
    let mut buf = std::io::Cursor::new(Vec::new());
    let rgb = resized.to_rgb8();
    let _ = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 82).encode(
        rgb.as_raw(),
        rgb.width(),
        rgb.height(),
        image::ExtendedColorType::Rgb8,
    );
    B64.encode(buf.into_inner())
}

fn dist2(a: &[f32; 3], b: &[f32; 3]) -> f32 {
    let dr = a[0] - b[0];
    let dg = a[1] - b[1];
    let db = a[2] - b[2];
    dr * dr + dg * dg + db * db
}

fn default_palette() -> Vec<String> {
    vec!["#7C9CFF".into(), "#4A5568".into(), "#1A2030".into()]
}
