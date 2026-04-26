"use client";

import { useFormStatus } from "react-dom";

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
      <SubmitButton
        idleLabel="Run now"
        pendingLabel="Running..."
        className="btn btn-primary"
        testId="run-scout-now-button"
      />
    </form>
  );

  if (status === "paused") {
    return (
      <div className="flex items-center gap-2">
        {runNowForm}
        <form action={resumeScoutAction.bind(null, scoutId)}>
          <SubmitButton
            idleLabel="Resume scout"
            pendingLabel="Resuming..."
            className="btn btn-secondary"
            testId="resume-scout-button"
          />
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {runNowForm}
      <form action={pauseScoutAction.bind(null, scoutId)}>
        <SubmitButton
          idleLabel="Pause scout"
          pendingLabel="Pausing..."
          className="btn btn-secondary"
          testId="pause-scout-button"
        />
      </form>
    </div>
  );
}

function SubmitButton({
  idleLabel,
  pendingLabel,
  className,
  testId,
}: {
  idleLabel: string;
  pendingLabel: string;
  className: string;
  testId: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      data-testid={testId}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
