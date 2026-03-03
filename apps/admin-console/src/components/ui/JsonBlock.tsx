import React from "react";

type JsonBlockProps = {
  value: unknown;
  label?: string;
};

const JsonBlock = ({ value, label }: JsonBlockProps) => {
  return (
    <div className="json-block">
      {label ? <h3 className="json-block__title">{label}</h3> : null}
      <pre className="output" aria-label={label ?? "JSON output"}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
};

export default JsonBlock;
