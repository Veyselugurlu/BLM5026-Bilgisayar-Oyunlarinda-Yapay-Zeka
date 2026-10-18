using UnityEngine;

/// <summary>
/// Copies the TrainingArea N-1 times in a grid when the build is started with "-areas N".
/// Several areas share one policy and collect experience in parallel, which only shortens
/// wall-clock training time; the step budget (max_steps) stays the same.
/// In the Editor (no arguments) the scene keeps the single area from the lecture.
/// </summary>
[DefaultExecutionOrder(-1000)] // runs before the agents register themselves
public class TrainingAreaReplicator : MonoBehaviour
{
    [SerializeField] private GameObject trainingArea;
    [SerializeField] private int areaCount = 1;
    [SerializeField] private float spacing = 14f;

    private void Awake()
    {
        int count = Mathf.Max(1, CourseArgs.GetInt("areas", areaCount));
        int columns = Mathf.CeilToInt(Mathf.Sqrt(count));

        for (int i = 1; i < count; i++)
        {
            Vector3 offset = new Vector3((i % columns) * spacing, 0f, (i / columns) * spacing);
            GameObject copy = Instantiate(trainingArea, trainingArea.transform.position + offset,
                trainingArea.transform.rotation, trainingArea.transform.parent);
            copy.name = $"{trainingArea.name} ({i})";
        }
    }
}
