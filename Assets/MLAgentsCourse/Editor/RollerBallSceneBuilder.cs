using System.IO;
using Unity.InferenceEngine;
using Unity.MLAgents;
using Unity.MLAgents.Actuators;
using Unity.MLAgents.Policies;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

/// <summary>
/// Editor automation for Week 5 (menu: ML Agents Course/...).
/// It creates exactly the scene described in Sunu 2 (TrainingArea, Floor, Target, RollerAgent)
/// so that the setup is reproducible, builds the players used for training,
/// and creates the inference scene once an ONNX model has been trained.
/// All methods can also be called from the command line with -executeMethod.
/// </summary>
public static class RollerBallSceneBuilder
{
    private const string Root = "Assets/MLAgentsCourse";
    private const string TrainingScenePath = Root + "/Scenes/RollerBallTraining.unity";
    private const string InferenceScenePath = Root + "/Scenes/RollerBallInference.unity";
    private const string ModelPath = Root + "/Models/RollerBall_U63.onnx";
    private const string BehaviorName = "RollerBall_U63";

    // ---------------------------------------------------------------- scene

    [MenuItem("ML Agents Course/1. Build RollerBall Training Scene")]
    public static void BuildTrainingScene()
    {
        foreach (string dir in new[] { "Scenes", "Materials", "Models" })
            Directory.CreateDirectory(Path.Combine(Root, dir));

        Material floorMat = CreateMaterial("Floor_Mat", new Color(0.32f, 0.45f, 0.62f));
        Material targetMat = CreateMaterial("Target_Mat", new Color(1.00f, 0.55f, 0.10f));
        Material agentMat = CreateMaterial("Agent_Mat", new Color(0.20f, 0.80f, 0.30f));

        var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);

        // Camera: sees the whole 10 x 10 floor.
        Camera cam = Camera.main;
        cam.transform.SetPositionAndRotation(new Vector3(0f, 11f, -9.5f), Quaternion.Euler(50f, 0f, 0f));
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.10f, 0.11f, 0.14f);
        cam.gameObject.AddComponent<FrameRecorder>();

        // TrainingArea groups everything; copies of it become extra parallel areas.
        var area = new GameObject("TrainingArea");

        GameObject floor = GameObject.CreatePrimitive(PrimitiveType.Plane); // 10 x 10, MeshCollider
        floor.name = "Floor";
        floor.transform.SetParent(area.transform, false);
        floor.GetComponent<Renderer>().sharedMaterial = floorMat;

        GameObject target = GameObject.CreatePrimitive(PrimitiveType.Cube); // BoxCollider
        target.name = "Target";
        target.transform.SetParent(area.transform, false);
        target.transform.localPosition = new Vector3(3f, 0.5f, 3f);
        target.GetComponent<Renderer>().sharedMaterial = targetMat;

        GameObject agentGo = GameObject.CreatePrimitive(PrimitiveType.Sphere); // SphereCollider
        agentGo.name = "RollerAgent";
        agentGo.transform.SetParent(area.transform, false);
        agentGo.transform.localPosition = new Vector3(0f, 0.5f, 0f);
        agentGo.GetComponent<Renderer>().sharedMaterial = agentMat;

        var body = agentGo.AddComponent<Rigidbody>();
        body.useGravity = true;
        body.mass = 1f;

        // Behavior Parameters: the contract between C#, the YAML file and the model.
        var behavior = agentGo.AddComponent<BehaviorParameters>();
        behavior.BehaviorName = BehaviorName;
        behavior.BrainParameters.VectorObservationSize = 8;
        behavior.BrainParameters.ActionSpec = ActionSpec.MakeContinuous(2);
        behavior.BehaviorType = BehaviorType.Default;

        var agent = agentGo.AddComponent<RollerBallAgent>();
        agent.MaxStep = 500;
        var so = new SerializedObject(agent);
        so.FindProperty("target").objectReferenceValue = target.transform;
        so.ApplyModifiedPropertiesWithoutUndo();

        var requester = agentGo.AddComponent<DecisionRequester>();
        requester.DecisionPeriod = 1;
        requester.TakeActionsBetweenDecisions = true;

        var replicator = new GameObject("AreaReplicator").AddComponent<TrainingAreaReplicator>();
        var rso = new SerializedObject(replicator);
        rso.FindProperty("trainingArea").objectReferenceValue = area;
        rso.ApplyModifiedPropertiesWithoutUndo();

        EditorSceneManager.SaveScene(scene, TrainingScenePath);
        Debug.Log("COURSE: training scene saved -> " + TrainingScenePath);
    }

    private static Material CreateMaterial(string name, Color color)
    {
        string path = $"{Root}/Materials/{name}.mat";
        var mat = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (mat == null)
        {
            mat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            AssetDatabase.CreateAsset(mat, path);
        }
        mat.SetColor("_BaseColor", color);
        mat.SetFloat("_Smoothness", 0.35f);
        EditorUtility.SetDirty(mat);
        AssetDatabase.SaveAssets();
        return mat;
    }

    // ---------------------------------------------------------------- inference

    /// <summary>
    /// Inference step of the lecture: the trained ONNX file is in Assets/MLAgentsCourse/Models,
    /// it is assigned to Behavior Parameters -> Model and Behavior Type = Inference Only.
    /// </summary>
    [MenuItem("ML Agents Course/3. Create Inference Scenes (uses Models/*.onnx)")]
    public static void BuildInferenceScene()
    {
        // Lecture baseline: 8 observations, agent starts in the centre.
        CreateInferenceScene(ModelPath, InferenceScenePath, ObservationMode.Absolute8, SpawnMode.Fixed);
        // Experiment B: relative observations generalise to random start positions.
        CreateInferenceScene(RelativeModelPath, RelativeInferenceScenePath, ObservationMode.Relative5, SpawnMode.Random);
    }

    private const string RelativeModelPath = Root + "/Models/RollerBall_U63_Relative5.onnx";
    private const string RelativeInferenceScenePath = Root + "/Scenes/RollerBallInference_Relative5.unity";

    private static void CreateInferenceScene(string modelPath, string scenePath, ObservationMode obsMode, SpawnMode spawnMode)
    {
        AssetDatabase.ImportAsset(modelPath, ImportAssetOptions.ForceUpdate);
        var model = AssetDatabase.LoadAssetAtPath<ModelAsset>(modelPath);
        if (model == null)
        {
            Debug.LogError("COURSE: model not found at " + modelPath);
            return;
        }

        var scene = EditorSceneManager.OpenScene(TrainingScenePath, OpenSceneMode.Single);
        foreach (var agent in Object.FindObjectsByType<RollerBallAgent>(FindObjectsSortMode.None))
        {
            var so = new SerializedObject(agent);
            so.FindProperty("observationMode").enumValueIndex = (int)obsMode;
            so.FindProperty("spawnMode").enumValueIndex = (int)spawnMode;
            so.ApplyModifiedPropertiesWithoutUndo();

            var behavior = agent.GetComponent<BehaviorParameters>();
            behavior.BrainParameters.VectorObservationSize = RollerBallAgent.ObservationSize(obsMode);
            behavior.Model = model;
            behavior.BehaviorType = BehaviorType.InferenceOnly;
            behavior.InferenceDevice = InferenceDevice.Default;
            behavior.DeterministicInference = true;
            EditorUtility.SetDirty(behavior);
        }
        EditorSceneManager.SaveScene(scene, scenePath);
        Debug.Log("COURSE: inference scene saved -> " + scenePath);
    }

    // ---------------------------------------------------------------- builds

    [MenuItem("ML Agents Course/2. Build Training Player")]
    public static void BuildTrainingPlayer() => BuildPlayer(TrainingScenePath, "Builds/RollerBall/RollerBall.exe");

    [MenuItem("ML Agents Course/4. Build Inference Player")]
    public static void BuildInferencePlayer() => BuildPlayer(InferenceScenePath, "Builds/RollerBallInference/RollerBallInference.exe");

    private static void BuildPlayer(string scenePath, string exePath, bool exitWhenDone = true)
    {
        PlayerSettings.runInBackground = true; // the trainer keeps stepping even when the window is not focused
        PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
        PlayerSettings.defaultScreenWidth = 960;
        PlayerSettings.defaultScreenHeight = 540;
        PlayerSettings.resizableWindow = true;

        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = new[] { scenePath },
            locationPathName = exePath,
            target = BuildTarget.StandaloneWindows64,
            options = BuildOptions.None
        });
        Debug.Log($"COURSE_BUILD_RESULT {report.summary.result} -> {exePath}");
        if (Application.isBatchMode && exitWhenDone)
            EditorApplication.Exit(report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded ? 0 : 1);
    }

    // ---------------------------------------------------------------- report images

    /// <summary>Renders the scene from two cameras into docs/week05/images (used in the report).</summary>
    public static void CaptureSceneImages()
    {
        EditorSceneManager.OpenScene(TrainingScenePath, OpenSceneMode.Single);
        Directory.CreateDirectory("docs/week05/images");

        Camera main = Camera.main;
        Render(main, "docs/week05/images/scene_game_view.png");

        var side = new GameObject("TempCamera").AddComponent<Camera>();
        side.CopyFrom(main);
        side.transform.SetPositionAndRotation(new Vector3(-7.5f, 4.2f, -6.5f), Quaternion.Euler(24f, 45f, 0f));
        Render(side, "docs/week05/images/scene_perspective.png");
        Object.DestroyImmediate(side.gameObject);

        Debug.Log("COURSE: scene images captured");
        if (Application.isBatchMode) EditorApplication.Exit(0);
    }

    private static void Render(Camera cam, string file)
    {
        var rt = new RenderTexture(1280, 720, 24);
        cam.targetTexture = rt;
        cam.Render();
        RenderTexture.active = rt;
        var tex = new Texture2D(1280, 720, TextureFormat.RGB24, false);
        tex.ReadPixels(new Rect(0, 0, 1280, 720), 0, 0);
        tex.Apply();
        File.WriteAllBytes(file, tex.EncodeToPNG());
        cam.targetTexture = null;
        RenderTexture.active = null;
        Object.DestroyImmediate(rt);
    }

    /// <summary>Command-line entry: create the scene and build the training player in one go.</summary>
    public static void BuildSceneAndTrainingPlayer()
    {
        BuildTrainingScene();
        BuildTrainingPlayer();
    }

    /// <summary>Command-line entry: inference scene + inference player.</summary>
    public static void BuildInferenceSceneAndPlayer()
    {
        BuildInferenceScene();
        BuildPlayer(RelativeInferenceScenePath, "Builds/RollerBallInference_Relative5/RollerBallInference_Relative5.exe", exitWhenDone: false);
        BuildInferencePlayer();
    }
}
