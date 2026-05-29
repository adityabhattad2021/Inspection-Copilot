import { useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewProps,
} from "react-native";

type LiveWaveformProps = ViewProps & {
  active?: boolean;
  barColor?: string;
  barGap?: number;
  barHeight?: number;
  barRadius?: number;
  barWidth?: number;
  height?: number;
  level?: number;
  processing?: boolean;
  sensitivity?: number;
  smoothingTimeConstant?: number;
};

export function LiveWaveform({
  active = false,
  barColor = "#000000",
  barGap = 4,
  barHeight: baseBarHeight = 6,
  barRadius = 999,
  barWidth = 6,
  height = 64,
  level = 0,
  processing = false,
  sensitivity = 1,
  smoothingTimeConstant = 0.8,
  style,
  ...rest
}: LiveWaveformProps) {
  const [width, setWidth] = useState(0);
  const [bars, setBars] = useState<number[]>([]);
  const processingTimeRef = useRef(0);
  const smoothedRef = useRef<number[]>([]);

  const step = barWidth + barGap;
  const barCount = Math.max(12, Math.floor(width / step));
  const halfCount = Math.floor(barCount / 2);

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth !== width) {
      setWidth(nextWidth);
    }
  }

  useEffect(() => {
    smoothedRef.current = new Array(barCount).fill(0);
    setBars(new Array(barCount).fill(0));
  }, [barCount]);

  useEffect(() => {
    if (barCount === 0) {
      return;
    }

    let frame = 0;
    let last = 0;

    function tick(now: number) {
      if (last === 0) {
        last = now;
      }

      const delta = Math.min(64, now - last) / 1000;
      last = now;

      const next = smoothedRef.current.slice();

      if (active) {
        const liveLevel = Math.max(0, Math.min(1, level * sensitivity));

        for (let index = 0; index < barCount; index += 1) {
          const norm = (index - halfCount) / Math.max(1, halfCount);
          const centerWeight = 1 - Math.abs(norm) * 0.45;
          const wobble =
            0.8 +
            0.2 *
              Math.sin(now * 0.005 + index * 0.6) *
              Math.cos(now * 0.003 + index * 0.35);
          const target = Math.max(0.05, liveLevel * centerWeight * wobble);
          next[index] =
            next[index] * smoothingTimeConstant +
            target * (1 - smoothingTimeConstant);
        }
      } else if (processing) {
        processingTimeRef.current += delta;

        for (let index = 0; index < barCount; index += 1) {
          const norm = (index - halfCount) / Math.max(1, halfCount);
          const centerWeight = 1 - Math.abs(norm) * 0.35;
          const wave =
            0.22 +
            0.18 * Math.sin(processingTimeRef.current * 1.8 + norm * 3) +
            0.14 * Math.cos(processingTimeRef.current * 1.2 - norm * 2);
          next[index] = Math.max(0.05, Math.min(1, wave * centerWeight));
        }
      } else {
        for (let index = 0; index < barCount; index += 1) {
          next[index] *= 0.88;
          if (next[index] < 0.01) {
            next[index] = 0;
          }
        }
      }

      smoothedRef.current = next;
      setBars(next);
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    active,
    barCount,
    halfCount,
    level,
    processing,
    sensitivity,
    smoothingTimeConstant,
  ]);

  const renderedBars = useMemo(
    () =>
      bars.map((value, index) => {
        const barVisualHeight = Math.max(baseBarHeight, value * height * 0.8);
        const opacity = 0.25 + Math.min(1, value) * 0.7;

        return (
          <View
            key={`waveform-bar-${index}`}
            style={[
              styles.bar,
              {
                backgroundColor: barColor,
                borderRadius: barRadius,
                height: barVisualHeight,
                marginRight: index === bars.length - 1 ? 0 : barGap,
                opacity,
                width: barWidth,
              },
            ]}
          />
        );
      }),
    [
      barColor,
      barGap,
      barRadius,
      barWidth,
      bars,
      baseBarHeight,
      height,
    ],
  );

  return (
    <View
      {...rest}
      onLayout={handleLayout}
      style={[styles.container, { height }, style]}
    >
      <View style={styles.row}>{renderedBars}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: "center",
  },
  container: {
    justifyContent: "center",
    overflow: "hidden",
    width: "100%",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
});
