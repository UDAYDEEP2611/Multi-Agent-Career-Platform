import { useEffect, useRef, useState } from "react";

import { generateHeroSummaries } from "../../api/portfolioApi";

// Runs the hero summary agent: { run(designIds?), running, progress, error, notes, stop }
// onDone(heroSummaries, written) receives the server's saved summaries
export default function useHeroSummaryAgent(onDone) {
  const [state, setState] = useState({ running: false, progress: "", error: "", notes: [] });
  const controller = useRef(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function run(designIds) {
    controller.current?.abort();
    controller.current = new AbortController();
    setState({ running: true, progress: "Starting the agent", error: "", notes: [] });
    let finished = false;

    try {
      await generateHeroSummaries(designIds, (event, data) => {
        if (event === "progress") setState((current) => ({ ...current, progress: data.message }));
        if (event === "error") {
          finished = true;
          setState({ running: false, progress: "", error: data.message, notes: [] });
        }
        if (event === "result") {
          finished = true;
          onDone(data.heroSummaries, data.written);
          setState({ running: false, progress: "", error: "", notes: data.notes || [], written: data.written.length });
        }
      }, controller.current.signal);
      if (!finished) setState({ running: false, progress: "", error: "The agent stopped before it finished.", notes: [] });
    } catch (error) {
      if (error?.name === "AbortError") return;
      setState({ running: false, progress: "", error: error.message || "Unable to write your summaries.", notes: [] });
    }
  }

  const stop = () => {
    controller.current?.abort();
    setState({ running: false, progress: "", error: "", notes: [] });
  };

  return { ...state, run, stop };
}
