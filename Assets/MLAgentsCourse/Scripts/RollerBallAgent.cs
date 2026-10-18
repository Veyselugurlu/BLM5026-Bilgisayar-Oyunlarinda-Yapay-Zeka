using Unity.MLAgents;
using Unity.MLAgents.Actuators;
using Unity.MLAgents.Policies;
using Unity.MLAgents.Sensors;
using UnityEngine;
using UnityEngine.InputSystem;

/// <summary>
/// Which features the agent observes. Absolute8 is the lecture baseline;
/// the other two are the "observation ablation" experiments (Sunu 2, slide 24).
/// </summary>
public enum ObservationMode
{
    Absolute8,   // target pos (3) + agent pos (3) + velocity x,z (2)  -> 8
    NoVelocity6, // target pos (3) + agent pos (3)                     -> 6  (Experiment A)
    Relative5    // target - agent (3) + velocity x,z (2)              -> 5  (Experiment B)
}

/// <summary>Where the agent starts each episode.</summary>
public enum SpawnMode
{
    Fixed,  // always (0, 0.5, 0) as in the lecture
    Random  // anywhere on the floor (used to test generalisation)
}

/// <summary>
/// RollerBall agent (Sunu 2). A green sphere learns to roll to an orange cube.
///   Observation : see ObservationMode
///   Action      : 2 continuous values in [-1, 1] -> force on X and Z
///   Reward      : +1 when closer than successDistance to the target, then the episode ends
///   Termination : success, falling off the floor, or Max Step (timeout)
/// </summary>
[RequireComponent(typeof(Rigidbody))]
public class RollerBallAgent : Agent
{
    private enum Outcome { None, Success, Fall }

    [Header("Scene references")]
    [SerializeField] private Transform target;

    [Header("Physics")]
    [SerializeField] private float forceMultiplier = 10f;

    [Header("Task")]
    [SerializeField] private float successDistance = 1.4f;
    [SerializeField] private float fallHeight = -1f;
    [SerializeField] private float spawnRange = 3.5f;
    [Tooltip("Optional small penalty every step (0 = lecture baseline).")]
    [SerializeField] private float stepPenalty = 0f;

    [Header("Experiment settings (can be overridden from the command line)")]
    [SerializeField] private ObservationMode observationMode = ObservationMode.Absolute8;
    [SerializeField] private SpawnMode spawnMode = SpawnMode.Fixed;

    private Rigidbody body;
    private Outcome lastOutcome = Outcome.None;
    private bool hasStartedAnEpisode;

    public ObservationMode CurrentObservationMode => observationMode;

    public static int ObservationSize(ObservationMode mode) => mode switch
    {
        ObservationMode.NoVelocity6 => 6,
        ObservationMode.Relative5 => 5,
        _ => 8
    };

    protected override void OnEnable()
    {
        // Command-line overrides must be applied BEFORE base.OnEnable(),
        // because that is where ML-Agents reads the Behavior Parameters.
        if (CourseArgs.TryGetEnum("obsMode", out ObservationMode mode)) observationMode = mode;
        if (CourseArgs.TryGetEnum("spawnMode", out SpawnMode spawn)) spawnMode = spawn;

        // The observation size is a contract between C#, Behavior Parameters and the model.
        var behavior = GetComponent<BehaviorParameters>();
        behavior.BrainParameters.VectorObservationSize = ObservationSize(observationMode);

        base.OnEnable();
    }

    public override void Initialize()
    {
        body = GetComponent<Rigidbody>();
    }

    public override void OnEpisodeBegin()
    {
        // MaxStep ends an episode without calling our code, so "no recorded outcome" = timeout.
        if (hasStartedAnEpisode)
            RecordOutcome(lastOutcome);
        hasStartedAnEpisode = true;
        lastOutcome = Outcome.None;

        // Reset the motion state as well as the position, otherwise the old velocity leaks into the new episode.
        body.linearVelocity = Vector3.zero;
        body.angularVelocity = Vector3.zero;

        transform.localPosition = spawnMode == SpawnMode.Fixed
            ? new Vector3(0f, 0.5f, 0f)
            : RandomFloorPoint();

        // New target position every episode (randomisation -> a more general policy).
        // It must not spawn on top of the agent.
        Vector3 targetPos;
        do
        {
            targetPos = RandomFloorPoint();
        } while (Vector3.Distance(targetPos, transform.localPosition) < successDistance + 0.5f);
        target.localPosition = targetPos;
    }

    private Vector3 RandomFloorPoint()
        => new Vector3(Random.Range(-spawnRange, spawnRange), 0.5f, Random.Range(-spawnRange, spawnRange));

    public override void CollectObservations(VectorSensor sensor)
    {
        // Local positions: everything is expressed in the TrainingArea's coordinate system,
        // so copies of the area placed elsewhere in the world see identical numbers.
        switch (observationMode)
        {
            case ObservationMode.Absolute8:
                sensor.AddObservation(target.localPosition);       // 3
                sensor.AddObservation(transform.localPosition);    // 3
                sensor.AddObservation(body.linearVelocity.x);      // 1
                sensor.AddObservation(body.linearVelocity.z);      // 1
                break;
            case ObservationMode.NoVelocity6:
                sensor.AddObservation(target.localPosition);       // 3
                sensor.AddObservation(transform.localPosition);    // 3
                break;
            case ObservationMode.Relative5:
                sensor.AddObservation(target.localPosition - transform.localPosition); // 3
                sensor.AddObservation(body.linearVelocity.x);      // 1
                sensor.AddObservation(body.linearVelocity.z);      // 1
                break;
        }
    }

    public override void OnActionReceived(ActionBuffers actions)
    {
        // The action is a force, not a new position: momentum is left to the physics engine.
        var a = actions.ContinuousActions;
        Vector3 force = new Vector3(Mathf.Clamp(a[0], -1f, 1f), 0f, Mathf.Clamp(a[1], -1f, 1f)) * forceMultiplier;
        body.AddForce(force, ForceMode.Force);

        if (stepPenalty > 0f)
            AddReward(-stepPenalty);

        if (Vector3.Distance(transform.localPosition, target.localPosition) < successDistance)
        {
            SetReward(1f);
            lastOutcome = Outcome.Success;
            Academy.Instance.StatsRecorder.Add("RollerBall/Steps To Target", StepCount);
            EndEpisode();
        }
        else if (transform.localPosition.y < fallHeight)
        {
            lastOutcome = Outcome.Fall;
            EndEpisode();
        }
    }

    public override void Heuristic(in ActionBuffers actionsOut)
    {
        // Manual control with the new Input System (no legacy Input.GetAxis).
        var keys = Keyboard.current;
        var continuous = actionsOut.ContinuousActions;
        if (keys == null) return;

        float x = (keys.dKey.isPressed || keys.rightArrowKey.isPressed ? 1f : 0f)
                - (keys.aKey.isPressed || keys.leftArrowKey.isPressed ? 1f : 0f);
        float z = (keys.wKey.isPressed || keys.upArrowKey.isPressed ? 1f : 0f)
                - (keys.sKey.isPressed || keys.downArrowKey.isPressed ? 1f : 0f);
        continuous[0] = x;
        continuous[1] = z;
    }

    /// <summary>Custom TensorBoard metrics: success / fall / timeout rates per summary period.</summary>
    private static void RecordOutcome(Outcome outcome)
    {
        var stats = Academy.Instance.StatsRecorder;
        stats.Add("RollerBall/Success Rate", outcome == Outcome.Success ? 1f : 0f);
        stats.Add("RollerBall/Fall Rate", outcome == Outcome.Fall ? 1f : 0f);
        stats.Add("RollerBall/Timeout Rate", outcome == Outcome.None ? 1f : 0f);
    }
}
