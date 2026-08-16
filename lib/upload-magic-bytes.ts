// Magic-byte sniffers for the allowlisted upload types. Checks the leading
// bytes of a buffer against the signature for a declared MIME type; returns
// true for unknown types (the upload route never reaches them).
export function matchesMagicBytes(buf: Buffer, mime: string): boolean {
  const sig = (hex: string) =>
    hex
      .split(" ")
      .map((b) => parseInt(b, 16))
      .every((b, i) => buf[i] === b);

  switch (mime) {
    case "image/jpeg":
      return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case "image/png":
      return sig("89 50 4E 47 0D 0A 1A 0A");
    case "image/webp":
      return buf.length > 11 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP";
    case "image/gif":
      return buf.toString("latin1", 0, 3) === "GIF";
    case "application/pdf":
      return buf.toString("latin1", 0, 5) === "%PDF-";
    case "video/mp4":
      return buf.length > 7 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
    case "video/webm":
      return buf.toString("latin1", 0, 4) === "\x1aE\xdf\xa3";
    case "video/quicktime":
      return buf.length > 7 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
    case "video/avi":
      return buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "AVI ";
    case "video/ogg":
      return buf.toString("latin1", 0, 4) === "OggS";
    default:
      return true;
  }
}
