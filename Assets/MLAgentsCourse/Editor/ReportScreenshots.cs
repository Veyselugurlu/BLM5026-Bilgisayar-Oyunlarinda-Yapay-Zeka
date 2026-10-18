using System;
using System.IO;
using Unity.MLAgents.Policies;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditorInternal;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;

/// <summary>
/// Takes the Unity Editor screenshots used in the weekly report (menu: ML Agents Course/5. Capture Report Screenshots).
/// It walks through the scenes step by step, enters Play mode where needed and saves the main editor window as PNG.
/// Scenes are never saved: the temporary Heuristic Only change is discarded by re-opening the scene.
/// The state survives the domain reload of entering Play mode through SessionState.
/// </summary>
[InitializeOnLoad]
public static class ReportScreenshots
{
    private const string RequestFile = "Temp/report_capture.request";
    private const string DoneFile = "Temp/report_capture.done";
    private const string OutDir = "docs/week05/images/editor";
    private const string Root = "Assets/MLAgentsCourse/Scenes/";
    private const string StepKey = "ReportShots.Step", TimeKey = "ReportShots.T0", EnteredKey = "ReportShots.Entered";

    private static readonly float[] Wait = { 0f, 3f, 4.5f, 3f, 5f, 3f, 7f, 6f, 3f };

    static ReportScreenshots()
    {
        EditorApplication.update += Tick;
    }

    [MenuItem("ML Agents Course/5. Capture Report Screenshots")]
    public static void Begin()
    {
        Directory.CreateDirectory(OutDir);
        if (File.Exists(DoneFile)) File.Delete(DoneFile);
        SessionState.SetInt(StepKey, 1);
        SessionState.SetBool(EnteredKey, false);
    }

    private static double Now => EditorApplication.timeSinceStartup;

    private static void Tick()
    {
        if (File.Exists(RequestFile))
        {
            File.Delete(RequestFile);
            Begin();
        }

        int step = SessionState.GetInt(StepKey, 0);
        if (step == 0) return;

        if (step == 1 && EditorApplication.isPlayingOrWillChangePlaymode)
        {
            EditorApplication.isPlaying = false; // start from Edit mode
            return;
        }

        if (!SessionState.GetBool(EnteredKey, false))
        {
            SessionState.SetBool(EnteredKey, true);
            SessionState.SetFloat(TimeKey, (float)Now);
            try { Enter(step); } catch (Exception e) { Fail(e); }
            return;
        }

        // Play/stop transitions take a few seconds (domain reload): start counting only once they are finished.
        bool wantsPlay = step == 2 || step == 4 || step == 7;
        bool wantsStop = step == 3 || step == 5 || step == 8;
        if ((wantsPlay && !EditorApplication.isPlaying) || (wantsStop && EditorApplication.isPlayingOrWillChangePlaymode)
            || EditorApplication.isCompiling)
        {
            SessionState.SetFloat(TimeKey, (float)Now);
            return;
        }

        double elapsed = Now - SessionState.GetFloat(TimeKey, 0f);
        if (step == 2 && EditorApplication.isPlaying) HoldKeys(elapsed > 0.8);
        if (elapsed < Wait[step]) return;

        try { Leave(step); } catch (Exception e) { Fail(e); return; }
        int next = step + 1 < Wait.Length ? step + 1 : 0;
        SessionState.SetInt(StepKey, next);
        SessionState.SetBool(EnteredKey, false);
        if (next == 0)
        {
            File.WriteAllText(DoneFile, "ok");
            Debug.Log("COURSE: report screenshots saved to " + OutDir);
        }
    }

    private static void Enter(int step)
    {
        switch (step)
        {
            case 1: // training scene, agent selected, components visible in the Inspector
                ClearConsole();
                OpenAndSelect("RollerBallTraining.unity");
                FocusGameView();
                EditorApplication.ExecuteMenuItem("Window/General/Project");
                break;
            case 2: // Heuristic Only + Play, keys W and D are simulated
                SelectAgent().GetComponent<BehaviorParameters>().BehaviorType = BehaviorType.HeuristicOnly;
                EditorApplication.isPlaying = true;
                break;
            case 3:
                EditorApplication.isPlaying = false;
                break;
            case 4: // trained model, Inference Only
                OpenAndSelect("RollerBallInference.unity");
                EditorApplication.isPlaying = true;
                break;
            case 5:
                EditorApplication.isPlaying = false;
                break;
            case 6: // package version
                EditorApplication.ExecuteMenuItem("Window/General/Project");
                UnityEditor.PackageManager.UI.Window.Open("com.unity.ml-agents");
                break;
            case 7: // console during a run of the Experiment B scene
                ClearConsole();
                OpenAndSelect("RollerBallInference_Relative5.unity");
                EditorApplication.ExecuteMenuItem("Window/General/Console");
                EditorApplication.isPlaying = true;
                break;
            case 8:
                EditorApplication.isPlaying = false;
                break;
        }
    }

    private static void Leave(int step)
    {
        switch (step)
        {
            case 1: Capture("01_training_scene_inspector.png"); break;
            case 2: SelectAgent(); Capture("02_heuristic_play.png"); HoldKeys(false); break;
            case 4: SelectAgent(); Capture("03_inference_play.png"); break;
            case 6: Capture("04_package_manager.png"); break;
            case 7: Capture("05_console_relative5_play.png"); break;
            case 8: // leave the editor as we found it
                EditorSceneManager.OpenScene(Root + "RollerBallTraining.unity", OpenSceneMode.Single);
                FocusGameView();
                break;
        }
    }

    private static void OpenAndSelect(string scene)
    {
        EditorSceneManager.OpenScene(Root + scene, OpenSceneMode.Single); // discards unsaved changes, never saves
        GameObject agent = SelectAgent();
        foreach (var c in agent.GetComponents<Component>())
        {
            bool keepOpen = c is BehaviorParameters || c is RollerBallAgent || c is Unity.MLAgents.DecisionRequester || c is Rigidbody;
            InternalEditorUtility.SetIsInspectorExpanded(c, keepOpen);
        }
        ActiveEditorTracker.sharedTracker.ForceRebuild();
    }

    private static GameObject SelectAgent()
    {
        GameObject agent = GameObject.Find("TrainingArea/RollerAgent");
        Selection.activeGameObject = agent;
        EditorGUIUtility.PingObject(agent); // expands TrainingArea in the Hierarchy
        return agent;
    }

    private static void FocusGameView()
    {
        var gameViewType = Type.GetType("UnityEditor.GameView,UnityEditor");
        if (gameViewType != null) EditorWindow.GetWindow(gameViewType, false, null, true);
    }

    private static void HoldKeys(bool pressed)
    {
        if (Keyboard.current == null) return;
        InputSystem.QueueStateEvent(Keyboard.current, pressed ? new KeyboardState(Key.W, Key.D) : new KeyboardState());
    }

    private static void ClearConsole()
    {
        var logEntries = Type.GetType("UnityEditor.LogEntries,UnityEditor");
        logEntries?.GetMethod("Clear")?.Invoke(null, null);
    }

    private static void Capture(string file)
    {
        Rect r = EditorGUIUtility.GetMainWindowPosition();
        // ReadScreenPixel works in editor points (the same units as the window rect), also with Windows display scaling.
        int w = Mathf.RoundToInt(r.width), h = Mathf.RoundToInt(r.height);
        Color[] pixels = InternalEditorUtility.ReadScreenPixel(r.position, w, h);
        var tex = new Texture2D(w, h, TextureFormat.RGB24, false);
        tex.SetPixels(pixels);
        tex.Apply();
        File.WriteAllBytes(Path.Combine(OutDir, file), tex.EncodeToPNG());
        UnityEngine.Object.DestroyImmediate(tex);
        Debug.Log("COURSE: captured " + file);
    }

    private static void Fail(Exception e)
    {
        SessionState.SetInt(StepKey, 0);
        if (EditorApplication.isPlaying) EditorApplication.isPlaying = false;
        File.WriteAllText(DoneFile, "error: " + e);
        Debug.LogException(e);
    }
}
