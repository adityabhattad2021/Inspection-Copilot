import type { MediaDeviceInfo } from "@daily-co/react-native-webrtc";

import { selectSpeakerphone } from "./pipecat-voice-boundary";

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
