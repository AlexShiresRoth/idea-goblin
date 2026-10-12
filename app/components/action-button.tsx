"use client";
type Props = {
  action: () => void;
  children: React.ReactNode;
};

export default function ActionButton({ action, children }: Props) {
  return (
    <button className="action-button" onClick={action}>
      {children}
    </button>
  );
}
