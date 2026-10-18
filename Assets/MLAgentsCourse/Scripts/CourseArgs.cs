using System;
using System.Globalization;

/// <summary>
/// Reads optional command-line arguments of a standalone build, e.g.
///   RollerBall.exe -obsMode Relative5 -areas 9
/// mlagents-learn forwards them with:  --env-args -obsMode Relative5 -areas 9
/// In the Editor no arguments exist, so every getter returns its default value.
/// </summary>
public static class CourseArgs
{
    private static string Find(string name)
    {
        string[] args = Environment.GetCommandLineArgs();
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (string.Equals(args[i], "-" + name, StringComparison.OrdinalIgnoreCase))
                return args[i + 1];
        }
        return null;
    }

    public static string GetString(string name, string defaultValue)
        => Find(name) ?? defaultValue;

    public static int GetInt(string name, int defaultValue)
        => int.TryParse(Find(name), NumberStyles.Integer, CultureInfo.InvariantCulture, out int v) ? v : defaultValue;

    public static float GetFloat(string name, float defaultValue)
        => float.TryParse(Find(name), NumberStyles.Float, CultureInfo.InvariantCulture, out float v) ? v : defaultValue;

    public static bool TryGetEnum<T>(string name, out T value) where T : struct
    {
        value = default;
        string raw = Find(name);
        return raw != null && Enum.TryParse(raw, true, out value);
    }
}
