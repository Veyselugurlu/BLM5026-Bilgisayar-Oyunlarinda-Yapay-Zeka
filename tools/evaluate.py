"""
Evaluate RollerBall policies on the SAME set of initial conditions (Sunu 2, slide 23).

Policies
  random   : uniform random actions in [-1, 1]            (untrained baseline)
  scripted : hand-written controller "push towards the target, brake with velocity"
             (automated stand-in for keyboard Heuristic control)
  onnx     : a trained PPO model exported by mlagents-learn (results/<run>/RollerBall_U63.onnx)

The Unity build is started with a fixed --seed, so episode k always gets the same target
position for every policy. One training area is used, so the random sequence is not shared.

Example
  python tools/evaluate.py --env Builds/RollerBall/RollerBall.exe --policy onnx \
      --model results/RollerBall_U63_01/RollerBall_U63.onnx --episodes 200 --out docs/week05/data/eval_ppo.json
"""
import argparse
import json
import statistics
from pathlib import Path

import numpy as np
from mlagents_envs.environment import UnityEnvironment
from mlagents_envs.side_channel.engine_configuration_channel import EngineConfigurationChannel


def make_policy(kind, obs_mode, model_path=None, rng=None):
    if kind == "random":
        return lambda obs: rng.uniform(-1.0, 1.0, size=(obs.shape[0], 2)).astype(np.float32)

    if kind == "scripted":
        if obs_mode != "Absolute8":
            raise ValueError("scripted controller expects Absolute8 observations")

        def scripted(obs):
            target, agent, vel = obs[:, 0:3], obs[:, 3:6], obs[:, 6:8]
            delta = np.stack([target[:, 0] - agent[:, 0], target[:, 2] - agent[:, 2]], axis=1)
            # proportional-derivative control: go to the target, damp the velocity
            return np.clip(0.8 * delta - 0.6 * vel, -1.0, 1.0).astype(np.float32)

        return scripted

    if kind == "onnx":
        import onnxruntime as ort

        session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        input_name = session.get_inputs()[0].name
        outputs = [o.name for o in session.get_outputs()]
        out_name = "deterministic_continuous_actions" if "deterministic_continuous_actions" in outputs \
            else "continuous_actions"

        def onnx_policy(obs):
            action = session.run([out_name], {input_name: obs.astype(np.float32)})[0]
            return np.clip(action, -1.0, 1.0).astype(np.float32)

        return onnx_policy

    raise ValueError(kind)


def evaluate(args):
    channel = EngineConfigurationChannel()
    env = UnityEnvironment(
        file_name=args.env,
        seed=args.seed,
        no_graphics=True,
        base_port=args.port,
        side_channels=[channel],
        additional_args=["-obsMode", args.obs_mode, "-spawnMode", args.spawn_mode, "-areas", "1"],
    )
    channel.set_configuration_parameters(time_scale=20.0)
    env.reset()
    behavior = list(env.behavior_specs)[0]
    policy = make_policy(args.policy, args.obs_mode, args.model, np.random.default_rng(args.seed))

    episodes = []
    steps = 0
    while len(episodes) < args.episodes:
        decision, terminal = env.get_steps(behavior)
        for i, agent_id in enumerate(terminal.agent_id):
            reward = float(terminal.reward[i])
            interrupted = bool(terminal.interrupted[i])
            outcome = "success" if reward > 0.5 else ("timeout" if interrupted else "fall")
            episodes.append({"outcome": outcome, "length": steps})
            steps = 0
        if len(decision) > 0:
            env.set_actions(behavior, _action_tuple(policy(decision.obs[0])))
            steps += 1
        env.step()
    env.close()

    episodes = episodes[: args.episodes]
    n = len(episodes)
    succ = [e["length"] for e in episodes if e["outcome"] == "success"]
    summary = {
        "policy": args.policy,
        "model": str(args.model) if args.model else None,
        "obs_mode": args.obs_mode,
        "spawn_mode": args.spawn_mode,
        "seed": args.seed,
        "episodes": n,
        "success_rate": sum(e["outcome"] == "success" for e in episodes) / n,
        "fall_rate": sum(e["outcome"] == "fall" for e in episodes) / n,
        "timeout_rate": sum(e["outcome"] == "timeout" for e in episodes) / n,
        "mean_episode_length": statistics.mean(e["length"] for e in episodes),
        "mean_steps_to_target": statistics.mean(succ) if succ else None,
        "mean_time_to_target_s": statistics.mean(succ) * 0.02 if succ else None,  # 1 decision = 1 physics step = 0.02 s
        "per_episode": episodes,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(summary, indent=2))
    print(f"{args.policy:9s} {args.obs_mode:11s} {args.spawn_mode:6s} "
          f"success={summary['success_rate']:.3f} fall={summary['fall_rate']:.3f} "
          f"timeout={summary['timeout_rate']:.3f} len={summary['mean_episode_length']:.1f}")


def _action_tuple(actions):
    from mlagents_envs.base_env import ActionTuple

    return ActionTuple(continuous=actions)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--env", required=True)
    p.add_argument("--policy", choices=["random", "scripted", "onnx"], required=True)
    p.add_argument("--model")
    p.add_argument("--obs-mode", default="Absolute8", choices=["Absolute8", "NoVelocity6", "Relative5"])
    p.add_argument("--spawn-mode", default="Fixed", choices=["Fixed", "Random"])
    p.add_argument("--episodes", type=int, default=200)
    p.add_argument("--seed", type=int, default=12345)
    p.add_argument("--port", type=int, default=6005)
    p.add_argument("--out", required=True)
    evaluate(p.parse_args())
