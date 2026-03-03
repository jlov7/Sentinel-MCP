import React from "react";

type MessageCalloutProps = {
  tone: "error" | "ok" | "info";
  children: React.ReactNode;
};

const MessageCallout = ({ tone, children }: MessageCalloutProps) => {
  const className = tone === "info" ? "info" : tone;
  return (
    <p className={className} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
};

export default MessageCallout;
