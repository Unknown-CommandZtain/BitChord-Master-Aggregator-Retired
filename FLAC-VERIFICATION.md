# FLAC verification limits

1. **File extension or claimed metadata:** `format: flac` / `.flac` is not proof of actual codec bytes.
2. **Signature check:** FLAC's `fLaC` magic bytes indicate a likely FLAC bitstream; this is stronger than a label but does not prove the entire file is valid.
3. **Complete decoding:** successful full-file decoding and integrity checks increase confidence the media is intact.
4. **Original provenance:** even valid, complete 24-bit FLAC can come from a previously lossy source. Verify provenance independently where needed; spectral analysis provides clues, not a guarantee.

**DASH/HLS** are transport/container presentation mechanisms and do not themselves certify FLAC audio. The final Worker rejects unsupported manifest transports rather than mislabeling them as progressive FLAC. Neither this archive nor a decoder trace constitutes permission to access, cache or redistribute recordings.
