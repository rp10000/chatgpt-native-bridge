const path = require("node:path");

function inspectCandidate(candidate) {
  const pathReason = sensitivePathReason(candidate.relativePath);
  if (pathReason) return { blocked: true, reason: pathReason };

  if (!candidate.binary && candidate.content !== undefined) {
    const contentReason = sensitiveContentReason(candidate.content);
    if (contentReason) return { blocked: true, reason: contentReason };
  }

  return { blocked: false, reason: "" };
}

function sensitivePathReason(relativePath) {
  const normalized = relativePath.split(path.sep).join("/").toLowerCase();
  const base = path.basename(normalized);

  if (base === ".env" || base.startsWith(".env.")) {
    return `Blocked sensitive env file: ${relativePath}`;
  }

  if (/\.(pem|key|p12|pfx)$/i.test(base)) {
    return `Blocked private key or certificate file: ${relativePath}`;
  }

  if (/(\b|\/)(id_rsa|id_ed25519|id_dsa|id_ecdsa)(\b|$)/i.test(normalized)) {
    return `Blocked SSH private key file: ${relativePath}`;
  }

  if (/(^|\/)(cookies?|sessions?)(\/|\.|$)/i.test(normalized)) {
    return `Blocked cookie or session file: ${relativePath}`;
  }

  return "";
}

function sensitiveContentReason(content) {
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(content)) {
    return "Blocked private key material.";
  }

  if (/authorization\s*:\s*(bearer|basic)\s+[A-Za-z0-9._~+/=-]+/i.test(content)) {
    return "Blocked Authorization header.";
  }

  if (/\b(sk-[A-Za-z0-9]{16,})\b/.test(content)) {
    return "Blocked API key-like token.";
  }

  if (/\b([A-Z0-9_]*(API_KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{8,}/i.test(content)) {
    return "Blocked secret-like assignment.";
  }

  return "";
}

module.exports = {
  inspectCandidate,
  sensitiveContentReason,
  sensitivePathReason
};
