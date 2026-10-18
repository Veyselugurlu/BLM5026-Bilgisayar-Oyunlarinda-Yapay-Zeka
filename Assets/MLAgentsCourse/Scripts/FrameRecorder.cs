using System.IO;
using UnityEngine;

/// <summary>
/// Saves camera frames as PNG files so the report can show the trained agent in action.
/// Only active when the build is started with "-recordFrames &lt;folder&gt;":
///   RollerBallInference.exe -recordFrames D:/frames -recordCount 300 -recordEvery 2
/// </summary>
public class FrameRecorder : MonoBehaviour
{
    [SerializeField] private Camera sourceCamera;
    [SerializeField] private int width = 960;
    [SerializeField] private int height = 540;

    private string folder;
    private int frameLimit;
    private int every;
    private int saved;
    private int frameIndex;
    private RenderTexture renderTexture;
    private Texture2D readback;

    private void Awake()
    {
        folder = CourseArgs.GetString("recordFrames", null);
        if (folder == null)
        {
            enabled = false;
            return;
        }

        Directory.CreateDirectory(folder);
        frameLimit = CourseArgs.GetInt("recordCount", 300);
        every = Mathf.Max(1, CourseArgs.GetInt("recordEvery", 2));
        Time.captureFramerate = 50; // fixed game time per frame -> smooth, reproducible video

        if (sourceCamera == null) sourceCamera = Camera.main;
        renderTexture = new RenderTexture(width, height, 24);
        readback = new Texture2D(width, height, TextureFormat.RGB24, false);
    }

    private void LateUpdate()
    {
        if (frameIndex++ % every != 0) return;

        RenderTexture previous = sourceCamera.targetTexture;
        sourceCamera.targetTexture = renderTexture;
        sourceCamera.Render();
        sourceCamera.targetTexture = previous;

        RenderTexture.active = renderTexture;
        readback.ReadPixels(new Rect(0, 0, width, height), 0, 0);
        readback.Apply();
        RenderTexture.active = null;

        File.WriteAllBytes(Path.Combine(folder, $"frame_{saved:D4}.png"), readback.EncodeToPNG());

        if (++saved >= frameLimit)
            Application.Quit();
    }
}
