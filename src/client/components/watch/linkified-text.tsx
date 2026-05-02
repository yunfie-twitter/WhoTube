interface Props {
  text?: string;
}

const urlPattern = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

function cleanUrl(value: string) {
  return value.replace(/[),.、。!?！？]+$/u, '');
}

export function LinkifiedText({ text = '' }: Props) {
  const parts = String(text).split(urlPattern);

  return (
    <>
      {parts.map((part, index) => {
        urlPattern.lastIndex = 0;
        if (!urlPattern.test(part)) {
          return <span key={`${part}-${index}`}>{part}</span>;
        }
        urlPattern.lastIndex = 0;
        const label = cleanUrl(part);
        const href = label.startsWith('http') ? label : `https://${label}`;
        const suffix = part.slice(label.length);

        return (
          <span key={`${part}-${index}`}>
            <a href={href} target="_blank" rel="noreferrer" className="text-sky-300 underline-offset-4 hover:underline">
              {label}
            </a>
            {suffix}
          </span>
        );
      })}
    </>
  );
}
