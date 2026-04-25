import { pauseScoutAction, resumeScoutAction } from "./actions";

export function StatusActions({
  scoutId,
  status,
}: {
  scoutId: string;
  status: string;
}) {
  if (status === "paused") {
    return (
      <form action={resumeScoutAction.bind(null, scoutId)}>
        <button
          type="submit"
          className="btn btn-secondary"
          data-testid="resume-scout-button"
        >
          Resume scout
        </button>
      </form>
    );
  }

  return (
    <form action={pauseScoutAction.bind(null, scoutId)}>
      <button
        type="submit"
        className="btn btn-secondary"
        data-testid="pause-scout-button"
      >
        Pause scout
      </button>
    </form>
  );
}
