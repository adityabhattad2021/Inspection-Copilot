import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function patchFile(relativePath, replacements) {
  const filePath = resolve(process.cwd(), relativePath);
  let contents = readFileSync(filePath, "utf8");
  let changed = false;

  for (const [before, after] of replacements) {
    if (contents.includes(after)) {
      continue;
    }

    if (!contents.includes(before)) {
      throw new Error(`Patch target not found in ${relativePath}`);
    }

    contents = contents.replace(before, after);
    changed = true;
  }

  if (changed) {
    writeFileSync(filePath, contents, "utf8");
    console.log(`Patched ${relativePath}`);
  }
}

const transceiverBefore = `  getAudioTransceiver() {
    // Transceivers always appear in creation-order for both peers
    // Look at addInitialTransceivers
    return this.pc.getTransceivers()[AUDIO_TRANSCEIVER_INDEX];
  }
  getVideoTransceiver() {
    // Transceivers always appear in creation-order for both peers
    // Look at addInitialTransceivers
    return this.pc.getTransceivers()[VIDEO_TRANSCEIVER_INDEX];
  }
  getScreenVideoTransceiver() {
    // Transceivers always appear in creation-order for both peers
    // Look at addInitialTransceivers
    return this.pc.getTransceivers()[SCREEN_VIDEO_TRANSCEIVER_INDEX];
  }`;

const transceiverAfter = `  _getTransceiver(index) {
    const transceivers = this.pc?.getTransceivers?.();
    return transceivers?.[index] ?? null;
  }
  getAudioTransceiver() {
    // Transceivers always appear in creation-order for both peers
    // Look at addInitialTransceivers
    return this._getTransceiver(AUDIO_TRANSCEIVER_INDEX);
  }
  getVideoTransceiver() {
    // Transceivers always appear in creation-order for both peers
    // Look at addInitialTransceivers
    return this._getTransceiver(VIDEO_TRANSCEIVER_INDEX);
  }
  getScreenVideoTransceiver() {
    // Transceivers always appear in creation-order for both peers
    // Look at addInitialTransceivers
    return this._getTransceiver(SCREEN_VIDEO_TRANSCEIVER_INDEX);
  }`;

patchFile("node_modules/@pipecat-ai/react-native-small-webrtc-transport/lib/module/transport.js", [
  [transceiverBefore, transceiverAfter],
]);

patchFile("node_modules/@pipecat-ai/react-native-small-webrtc-transport/lib/commonjs/transport.js", [
  [transceiverBefore, transceiverAfter],
]);
