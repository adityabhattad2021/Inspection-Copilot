package com.cars24.jockeycopilot;

import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.PixelCopy;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.UIManagerHelper;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@ReactModule(name = RealtimeFrameCaptureModule.NAME)
public class RealtimeFrameCaptureModule extends ReactContextBaseJavaModule {
    public static final String NAME = "RealtimeFrameCaptureModule";

    private static final int DEFAULT_JPEG_QUALITY = 86;
    private static final int DEFAULT_MAX_WIDTH = 1280;
    private static final int DEFAULT_TIMEOUT_MS = 1800;
    private static final String IMAGE_MIME_TYPE = "image/jpeg";

    private final ExecutorService captureExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public RealtimeFrameCaptureModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public void invalidate() {
        captureExecutor.shutdownNow();
        super.invalidate();
    }

    @ReactMethod
    public void captureVideoViewFrame(int viewTag, ReadableMap options, Promise promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.reject(
                    "PIXEL_COPY_UNAVAILABLE",
                    "Realtime camera view capture requires Android 8 or newer.");
            return;
        }

        UIManager uiManager =
                UIManagerHelper.getUIManagerForReactTag(getReactApplicationContext(), viewTag);
        if (uiManager == null) {
            promise.reject(
                    "UI_MANAGER_UNAVAILABLE",
                    "React Native UI manager is not available.");
            return;
        }

        int jpegQuality = getIntOption(options, "jpegQuality", DEFAULT_JPEG_QUALITY);
        int maxWidth = getIntOption(options, "maxWidth", DEFAULT_MAX_WIDTH);
        int timeoutMs = getIntOption(options, "timeoutMs", DEFAULT_TIMEOUT_MS);
        mainHandler.post(() -> {
            try {
                View view = uiManager.resolveView(viewTag);
                SurfaceView surfaceView = findSurfaceView(view);
                if (surfaceView == null) {
                    promise.reject("VIDEO_VIEW_UNAVAILABLE", "Realtime camera view is not ready.");
                    return;
                }
                captureSurfaceView(
                        surfaceView,
                        promise,
                        clamp(jpegQuality, 1, 100),
                        Math.max(2, maxWidth),
                        Math.max(250, timeoutMs));
            } catch (Exception error) {
                promise.reject(
                        "VIDEO_VIEW_UNAVAILABLE",
                        "Realtime camera view is not ready.",
                        error);
            }
        });
    }

    private SurfaceView findSurfaceView(View view) {
        if (view instanceof SurfaceView) {
            return (SurfaceView) view;
        }
        if (!(view instanceof ViewGroup)) {
            return null;
        }

        ViewGroup viewGroup = (ViewGroup) view;
        for (int index = 0; index < viewGroup.getChildCount(); index += 1) {
            SurfaceView surfaceView = findSurfaceView(viewGroup.getChildAt(index));
            if (surfaceView != null) {
                return surfaceView;
            }
        }
        return null;
    }

    private void captureSurfaceView(
            SurfaceView surfaceView,
            Promise promise,
            int jpegQuality,
            int maxWidth,
            int timeoutMs) {
        int width = surfaceView.getWidth();
        int height = surfaceView.getHeight();
        if (width <= 0 || height <= 0) {
            promise.reject("VIDEO_VIEW_EMPTY", "Realtime camera view has no visible frame.");
            return;
        }

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        AtomicBoolean settled = new AtomicBoolean(false);
        Runnable timeoutRunnable = () -> {
            if (settled.compareAndSet(false, true)) {
                promise.reject("FRAME_CAPTURE_TIMEOUT", "Timed out capturing the realtime camera view.");
            }
        };
        mainHandler.postDelayed(timeoutRunnable, timeoutMs);

        PixelCopy.request(surfaceView, bitmap, result -> {
            if (result != PixelCopy.SUCCESS) {
                if (settled.compareAndSet(false, true)) {
                    mainHandler.removeCallbacks(timeoutRunnable);
                    promise.reject("PIXEL_COPY_FAILED", "Could not copy the realtime camera view.");
                }
                return;
            }

            captureExecutor.execute(() -> {
                try {
                    CaptureResult captureResult = saveBitmap(bitmap, jpegQuality, maxWidth);
                    mainHandler.post(() -> {
                        if (!settled.compareAndSet(false, true)) {
                            return;
                        }
                        mainHandler.removeCallbacks(timeoutRunnable);
                        resolveCapture(promise, captureResult);
                    });
                } catch (Exception error) {
                    mainHandler.post(() -> {
                        if (!settled.compareAndSet(false, true)) {
                            return;
                        }
                        mainHandler.removeCallbacks(timeoutRunnable);
                        promise.reject(
                                "FRAME_CAPTURE_FAILED",
                                "Could not capture the realtime camera view.",
                                error);
                    });
                }
            });
        }, mainHandler);
    }

    private int getIntOption(ReadableMap options, String key, int defaultValue) {
        if (options == null || !options.hasKey(key) || options.isNull(key)) {
            return defaultValue;
        }
        return options.getInt(key);
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private CaptureResult saveBitmap(Bitmap sourceBitmap, int jpegQuality, int maxWidth)
            throws IOException {
        Bitmap bitmap = sourceBitmap;
        if (sourceBitmap.getWidth() > maxWidth) {
            int scaledWidth = maxWidth;
            int scaledHeight = Math.round(
                    sourceBitmap.getHeight() * (scaledWidth / (float) sourceBitmap.getWidth()));
            bitmap = Bitmap.createScaledBitmap(sourceBitmap, scaledWidth, scaledHeight, true);
        }

        ByteArrayOutputStream jpegStream = new ByteArrayOutputStream();
        boolean compressed = bitmap.compress(Bitmap.CompressFormat.JPEG, jpegQuality, jpegStream);
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        if (bitmap != sourceBitmap) {
            bitmap.recycle();
        }
        sourceBitmap.recycle();
        if (!compressed) {
            throw new IOException("Could not encode realtime camera view as JPEG.");
        }

        return writeEncodedImage(
                new EncodedImage(jpegStream.toByteArray(), width, height));
    }

    private CaptureResult writeEncodedImage(EncodedImage encodedImage) throws IOException {
        File captureDir = new File(getReactApplicationContext().getCacheDir(), "evidence-captures");
        if (!captureDir.exists() && !captureDir.mkdirs()) {
            throw new IOException("Could not create capture cache directory.");
        }

        File outputFile = File.createTempFile("webrtc-frame-", ".jpg", captureDir);
        try (FileOutputStream outputStream = new FileOutputStream(outputFile)) {
            outputStream.write(encodedImage.bytes);
        }

        String dataUrl = "data:" + IMAGE_MIME_TYPE + ";base64,"
                + Base64.encodeToString(encodedImage.bytes, Base64.NO_WRAP);
        return new CaptureResult(
                outputFile,
                encodedImage.width,
                encodedImage.height,
                encodedImage.bytes.length,
                dataUrl);
    }

    private void resolveCapture(Promise promise, CaptureResult result) {
        WritableMap payload = Arguments.createMap();
        payload.putString("uri", Uri.fromFile(result.file).toString());
        payload.putString("path", result.file.getAbsolutePath());
        payload.putString("mimeType", IMAGE_MIME_TYPE);
        payload.putString("dataUrl", result.dataUrl);
        payload.putInt("width", result.width);
        payload.putInt("height", result.height);
        payload.putInt("bytes", result.bytes);
        promise.resolve(payload);
    }

    private static final class EncodedImage {
        final byte[] bytes;
        final int width;
        final int height;

        EncodedImage(byte[] bytes, int width, int height) {
            this.bytes = bytes;
            this.width = width;
            this.height = height;
        }
    }

    private static final class CaptureResult {
        final File file;
        final int width;
        final int height;
        final int bytes;
        final String dataUrl;

        CaptureResult(File file, int width, int height, int bytes, String dataUrl) {
            this.file = file;
            this.width = width;
            this.height = height;
            this.bytes = bytes;
            this.dataUrl = dataUrl;
        }
    }
}
