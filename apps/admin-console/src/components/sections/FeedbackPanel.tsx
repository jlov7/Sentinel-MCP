import React, { FormEvent, useState } from "react";

import Panel from "../ui/Panel";

type FeedbackPanelProps = {
  feedbackCount: number;
  onSubmitFeedback: (score: number, note: string) => void;
};

const FeedbackPanel = ({ feedbackCount, onSubmitFeedback }: FeedbackPanelProps) => {
  const [score, setScore] = useState(5);
  const [note, setNote] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmitFeedback(score, note);
    setNote("");
  };

  return (
    <Panel
      id="operator-feedback"
      wide
      title="Operator Feedback"
      subtitle="Capture UX friction and improvement requests continuously during operations."
    >
      <form className="form" onSubmit={onSubmit}>
        <label className="field__label" htmlFor="feedback-score">
          Experience score (1-5)
        </label>
        <input
          id="feedback-score"
          type="range"
          min={1}
          max={5}
          value={score}
          onChange={(event) => setScore(Number(event.target.value))}
          className="field__input"
        />

        <label className="field__label" htmlFor="feedback-note">
          Feedback note
        </label>
        <textarea
          id="feedback-note"
          className="field__input"
          value={note}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What slowed you down, and what should improve?"
        />

        <div className="actions">
          <button type="submit">Submit feedback</button>
        </div>
      </form>

      <p className="helper">Feedback items captured locally this session: {feedbackCount}</p>
    </Panel>
  );
};

export default FeedbackPanel;
