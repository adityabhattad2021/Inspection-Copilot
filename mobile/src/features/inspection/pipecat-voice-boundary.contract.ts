import type { MediaDeviceInfo } from "@daily-co/react-native-webrtc";
import type { RTVIMessage } from "@pipecat-ai/client-js";

import {
  buildPipecatErrorEvent,
  selectSpeakerphone,
} from "./pipecat-voice-boundary";

function audioDevice(deviceId: string, label: string): MediaDeviceInfo {
  return {
    deviceId,
    groupId: "",
    kind: "audio",
    label,
  } as MediaDeviceInfo;
}

export function pipecatVoiceBoundaryAudioRouteContract() {
  const speakerphone = selectSpeakerphone([
    audioDevice("WIRED_OR_EARPIECE", "Phone earpiece"),
    audioDevice("SPEAKERPHONE", "Speakerphone"),
  ]);

  if (speakerphone?.deviceId !== "SPEAKERPHONE") {
    throw new Error("Voice runtime should prefer the Android speakerphone route.");
  }

  const labeledSpeaker = selectSpeakerphone([
    audioDevice("custom-speaker", "Loud speaker"),
  ]);

  if (labeledSpeaker?.deviceId !== "custom-speaker") {
    throw new Error("Voice runtime should fall back to speaker-labeled devices.");
  }

  const earpiece = selectSpeakerphone([
    audioDevice("WIRED_OR_EARPIECE", "Phone earpiece"),
  ]);

  if (earpiece !== null) {
    throw new Error("Voice runtime should not choose the phone earpiece.");
  }

  return speakerphone.deviceId;
}

export function pipecatVoiceBoundaryRtviErrorContract() {
  const errorEvent = buildPipecatErrorEvent({
    data: {},
    type: "error",
  } as RTVIMessage);

  if (errorEvent.type !== "inspection-control-error") {
    throw new Error("Pipecat runtime errors should not be emitted as agent speech.");
  }

  if ("text" in errorEvent) {
    throw new Error("Pipecat runtime errors must not create agent-message text.");
  }

  if (errorEvent.error !== "Pipecat voice transport error.") {
    throw new Error("Pipecat runtime errors should keep a debuggable fallback.");
  }

  return errorEvent.error;
}
