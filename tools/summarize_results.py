"""
Aggregates the evaluation JSON files (docs/week05/data/eval/*.json) into
  docs/week05/data/results_summary.json   (mean +- std over seeds)
  docs/week05/images/eval_comparison.png  (bar chart for the report)
  python tools/summarize_results.py
"""
import json
import statistics
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

EVAL = Path("docs/week05/data/eval")
OUT_JSON = Path("docs/week05/data/results_summary.json")
OUT_IMG = Path("docs/week05/images")

ORDER = ["random", "scripted", "ppo_Absolute8", "ppo_NoVelocity6", "ppo_Relative5"]
NAMES = {
    "random": "Rastgele politika\n(eğitimsiz)",
    "scripted": "Kural tabanlı\nkontrolcü",
    "ppo_Absolute8": "PPO baseline\n(8 gözlem)",
    "ppo_NoVelocity6": "PPO Deney A\n(6 gözlem, hızsız)",
    "ppo_Relative5": "PPO Deney B\n(5 gözlem, göreli)",
}
METRICS = ["success_rate", "fall_rate", "timeout_rate", "mean_episode_length", "mean_time_to_target_s"]


def group_key(stem):
    # ppo_Absolute8_s1_Fixed -> (ppo_Absolute8, Fixed); random_Fixed -> (random, Fixed)
    parts = stem.split("_")
    spawn = parts[-1]
    if parts[0] == "ppo":
        return f"ppo_{parts[1]}", spawn
    return parts[0], spawn


def main():
    groups = defaultdict(list)
    for f in sorted(EVAL.glob("*.json")):
        groups[group_key(f.stem)].append(json.loads(f.read_text()))

    summary = {}
    for (name, spawn), runs in groups.items():
        row = {"n_runs": len(runs), "episodes_per_run": runs[0]["episodes"]}
        for m in METRICS:
            vals = [r[m] for r in runs if r[m] is not None]
            row[m] = {"mean": statistics.mean(vals) if vals else None,
                      "std": statistics.stdev(vals) if len(vals) > 1 else 0.0,
                      "values": vals}
        summary.setdefault(spawn, {})[name] = row
    OUT_JSON.write_text(json.dumps(summary, indent=2, ensure_ascii=False))

    fig, axes = plt.subplots(1, 2, figsize=(14, 5.2), sharey=True)
    for ax, spawn, title in zip(axes, ["Fixed", "Random"],
                                ["Ajan merkezden başlıyor (eğitimdeki gibi)", "Ajan rastgele yerden başlıyor (genelleme testi)"]):
        data = summary.get(spawn, {})
        keys = [k for k in ORDER if k in data]
        x = np.arange(len(keys))
        succ = [data[k]["success_rate"]["mean"] * 100 for k in keys]
        err = [data[k]["success_rate"]["std"] * 100 for k in keys]
        fall = [data[k]["fall_rate"]["mean"] * 100 for k in keys]
        ax.bar(x - 0.2, succ, 0.4, yerr=err, capsize=4, color="#1a9e5c", label="Başarı (%)")
        ax.bar(x + 0.2, fall, 0.4, color="#d1495b", label="Düşme (%)")
        for xi, s in zip(x, succ):
            ax.text(xi - 0.2, s + 2, f"{s:.1f}", ha="center", fontsize=9)
        ax.set_xticks(x)
        ax.set_xticklabels([NAMES[k] for k in keys], fontsize=9)
        ax.set_title(title)
        ax.set_ylim(0, 110)
        ax.grid(axis="y", alpha=0.3)
    axes[0].set_ylabel("Episode oranı (%)")
    axes[0].legend(loc="upper left")
    fig.suptitle("Aynı 200 başlangıç koşulunda politika karşılaştırması (PPO: 3 seed ortalaması ± std)")
    fig.tight_layout()
    fig.savefig(OUT_IMG / "eval_comparison.png", dpi=130)
    plt.close(fig)

    for spawn, data in summary.items():
        print(f"--- {spawn}")
        for k in ORDER:
            if k in data:
                d = data[k]
                t = d["mean_time_to_target_s"]["mean"]
                print(f"{k:16s} n={d['n_runs']} success={d['success_rate']['mean']*100:5.1f}±{d['success_rate']['std']*100:4.1f} "
                      f"fall={d['fall_rate']['mean']*100:5.1f} timeout={d['timeout_rate']['mean']*100:5.1f} "
                      f"len={d['mean_episode_length']['mean']:6.1f} t2t={t if t is None else round(t, 2)}")


if __name__ == "__main__":
    main()
