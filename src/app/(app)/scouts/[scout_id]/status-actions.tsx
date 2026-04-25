import { pauseScoutAction, resumeScoutAction } from "./actions";
import { runScoutNowAction } from "./actions";

export function StatusActions({
  scoutId,
  status,
}: {
  scoutId: string;
  status: string;
}) {
  const runNowForm = (
    <form action={runScoutNowAction.bind(null, scoutId)}>
      <button
        type="submit"
        className="btn btn-primary"
        data-testid="run-scout-now-button"
      >
        Run now
      </button>
    </form>
  );

  if (status === "paused") {
    return (
      <div className="flex items-center gap-2">
        {runNowForm}
        <form action={resumeScoutAction.bind(null, scoutId)}>
          <button
            type="submit"
            className="btn btn-secondary"
            data-testid="resume-scout-button"
          >
            Resume scout
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {runNowForm}
      <form action={pauseScoutAction.bind(null, scoutId)}>
        <button
          type="submit"
          className="btn btn-secondary"
          data-testid="pause-scout-button"
        >
          Pause scout
        </button>
      </form>
    </div>
  );
}
