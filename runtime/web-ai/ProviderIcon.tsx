import { React } from "../react";
import gemini from "../assets/providers/gemini.svg";
import deepseek from "../assets/providers/deepseek.svg";
import openai from "../assets/providers/openai.svg";

const logos: Record<string, string> = {
  gemini,
  deepseek,
  chatgpt: openai,
  openai,
};
export function ProviderIcon({
  service,
  size = 14,
}: {
  service: string;
  size?: number;
}) {
  const source = logos[service];
  const mask = source ? `url(${JSON.stringify(source)})` : undefined;
  if (!source)
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c-6 6-6 12 0 18 6-6 6-12 0-18" />
      </svg>
    );
  return (
    <span
      data-provider-icon={service}
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        flexShrink: 0,
        backgroundColor: "currentColor",
        maskImage: mask,
        maskPosition: 'center',
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskImage: mask,
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
      }}
    />
  );
}
